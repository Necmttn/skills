#!/usr/bin/env python3
"""Render the orchestrator's view of one fleet run from its JSONL ledger.

    fleet-state.py <ledger.jsonl> [--live] [--session <name>] [--tail N]

The ledger is one CloudEvents 1.0 record per line (see fleet-log.sh). This folds it into
five blocks: header, chunks, checklist, open items, action log. With --live it merges
`herdr agent list` from the fleet session and flags orphan panes and gone panes.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from pathlib import Path

STAGE_ORDER = ["assigned", "spawned", "planned", "building", "built", "in_review", "gated", "merged", "dogfooded",
               "blocked", "error", "archived", "closed"]
TERMINAL = {"merged", "archived", "closed"}


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def age(then: datetime | None, now: datetime) -> str:
    if then is None:
        return "?"
    seconds = int((now - then).total_seconds())
    if seconds < 0:
        seconds = 0
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    return f"{seconds // 86400}d"


def load(path: Path) -> tuple[list[dict], int]:
    events: list[dict] = []
    malformed = 0
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        try:
            record = json.loads(raw)
            if not isinstance(record, dict) or "type" not in record:
                raise ValueError("not an event object")
        except ValueError as exc:
            malformed += 1
            print(f"fleet-state: line {number} malformed ({exc}): {raw[:80]}", file=sys.stderr)
            continue
        record.setdefault("subject", "")
        record.setdefault("data", {}) or record.__setitem__("data", {})
        events.append(record)
    return events, malformed


def fold(events: list[dict]) -> dict:
    state: dict = {
        "epic": None, "session": None, "runmap": None, "kanban": None,
        "policies": OrderedDict(), "cursor": None,
        "chunks": OrderedDict(), "attn": OrderedDict(), "resources": OrderedDict(),
        "last": None, "teardown": None,
    }
    for event in events:
        kind, subject, data = event["type"], event["subject"], event["data"]
        when = event.get("time")
        state["last"] = when or state["last"]
        if kind == "fleet.run.started":
            state["epic"] = subject or state["epic"]
            for key in ("session", "runmap", "kanban"):
                if data.get(key):
                    state[key] = data[key]
        elif kind == "fleet.run.teardown":
            state["teardown"] = when
        elif kind == "fleet.policy.set":
            state["policies"][subject] = data.get("text", json.dumps(data))
        elif kind == "fleet.cursor.advanced":
            state["cursor"] = data
        elif kind == "fleet.resource.minted":
            state["resources"][subject] = {"label": data.get("label", ""), "time": when}
            if subject.startswith("session:") and not state["session"]:
                state["session"] = subject.split(":", 1)[1]
        elif kind == "fleet.resource.closed":
            state["resources"].pop(subject, None)
        elif kind == "fleet.attn.opened":
            state["attn"][subject] = {"ask": data.get("ask", ""), "time": when}
        elif kind == "fleet.attn.closed":
            state["attn"].pop(subject, None)
        elif kind.startswith("fleet.chunk."):
            chunk = state["chunks"].setdefault(subject, {"stage": None, "time": None, "data": {}})
            chunk["stage"] = kind[len("fleet.chunk."):]
            chunk["time"] = when
            chunk["data"].update(data)
    return state


def herdr_agents(session: str | None) -> list[dict]:
    cmd = ["herdr"] + (["--session", session] if session else []) + ["agent", "list"]
    result = subprocess.run(cmd, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        print(f"fleet-state: {' '.join(cmd)} failed: {result.stderr.strip() or result.stdout.strip()}", file=sys.stderr)
        return []
    try:
        return json.loads(result.stdout)["result"]["agents"]
    except (ValueError, KeyError, TypeError) as exc:
        print(f"fleet-state: could not parse agent list ({exc})", file=sys.stderr)
        return []


def render(state: dict, events: list[dict], malformed: int, live: list[dict] | None, tail: int, now: datetime) -> str:
    out: list[str] = []
    epic = state["epic"] or "?"
    out.append(f"epic: {epic}   session: {state['session'] or '-'}   last action: {state['last'] or '-'} ({age(parse_time(state['last']), now)} ago)")
    out.append(f"events: {len(events)}   malformed: {malformed}   runmap: {state['runmap'] or '-'}   kanban: {state['kanban'] or '-'}")
    if state["cursor"]:
        out.append("cursor: " + " ".join(f"{k}={v}" for k, v in state["cursor"].items()))
    for name, text in state["policies"].items():
        out.append(f"policy {name}: {text}")
    if state["teardown"]:
        out.append(f"TEARDOWN DONE at {state['teardown']}")

    by_pane: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    for agent in live or []:
        if agent.get("pane_id"):
            by_pane[agent["pane_id"]] = agent
        if agent.get("name"):
            by_name[agent["name"]] = agent

    out.append("")
    out.append("chunks")
    out.append("chunk | stage | pane | live | engine | pr | age | gist")
    claimed_panes: set[str] = set()
    gone: list[str] = []
    for subject, chunk in state["chunks"].items():
        data = chunk["data"]
        pane = data.get("pane", "")
        name = subject.rsplit("/", 1)[-1]
        agent = by_pane.get(pane) or by_name.get(name)
        status = "-"
        if live is not None:
            if agent:
                status = agent.get("agent_status", "?")
                claimed_panes.add(agent.get("pane_id", ""))
            elif pane and chunk["stage"] not in TERMINAL:
                status = "gone"
                gone.append(f"{subject} pane {pane}")
        if pane:
            claimed_panes.add(pane)
        gist = data.get("gist") or data.get("commit") or ""
        out.append(" | ".join([
            subject, chunk["stage"] or "?", pane or "-", status, data.get("engine", "-"),
            data.get("pr", "-"), age(parse_time(chunk["time"]), now), gist,
        ]))
    if not state["chunks"]:
        out.append("(no chunk events yet)")

    out.append("")
    out.append("checklist")
    counts = Counter(chunk["stage"] for chunk in state["chunks"].values())
    ordered = [s for s in STAGE_ORDER if counts.get(s)] + [s for s in counts if s not in STAGE_ORDER]
    out.append("  ".join(f"{stage}: {counts[stage]}" for stage in ordered) or "no chunks")
    hints: list[str] = []
    for stage, hint in (("built", "gate them"), ("gated", "merge them"), ("blocked", "unblock or reassign"), ("error", "triage the pane")):
        if counts.get(stage):
            hints.append(f"{counts[stage]} {stage} -> {hint}")
    if counts.get("merged"):
        unarchived = [s for s, c in state["chunks"].items() if c["stage"] == "merged"]
        if unarchived:
            hints.append(f"{len(unarchived)} merged -> archive-then-close")
    out.append("next: " + ("; ".join(hints) if hints else "wait on working panes"))

    out.append("")
    out.append("open attn")
    for subject, item in state["attn"].items():
        out.append(f"{subject}: {item['ask']} ({age(parse_time(item['time']), now)} ago)")
    if not state["attn"]:
        out.append("none")

    out.append("")
    out.append("open resources")
    for subject, item in state["resources"].items():
        out.append(f"{subject} {item['label']}".rstrip())
    if not state["resources"]:
        out.append("none")

    if live is not None:
        out.append("")
        out.append("live")
        orphans = [a for a in live if a.get("pane_id") not in claimed_panes and a.get("name") not in
                   {s.rsplit('/', 1)[-1] for s in state["chunks"]}]
        for agent in orphans:
            out.append(f"orphan pane {agent.get('pane_id')} {agent.get('name') or '(unnamed)'} {agent.get('agent_status', '?')}")
        for line in gone:
            out.append(f"gone {line}")
        if not orphans and not gone:
            out.append(f"{len(live)} agents, all accounted for")

    out.append("")
    out.append(f"action log (last {tail})")
    for event in events[-tail:]:
        data = event.get("data") or {}
        summary = data.get("gist") or data.get("text") or data.get("ask") or data.get("label") or data.get("pr") or ""
        out.append(f"{event.get('time', '?')} {event['type']} {event.get('subject', '')} {summary}".rstrip())
    return "\n".join(out) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ledger", type=Path)
    parser.add_argument("--live", action="store_true", help="merge herdr agent list from the fleet session")
    parser.add_argument("--session", help="herdr session name (default: from the ledger)")
    parser.add_argument("--tail", type=int, default=20)
    args = parser.parse_args()
    if not args.ledger.is_file():
        print(f"fleet-state: ledger does not exist: {args.ledger}", file=sys.stderr)
        return 2
    events, malformed = load(args.ledger)
    state = fold(events)
    if not state["epic"]:
        state["epic"] = args.ledger.stem
    live = herdr_agents(args.session or state["session"]) if args.live else None
    sys.stdout.write(render(state, events, malformed, live, args.tail, datetime.now(timezone.utc)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
