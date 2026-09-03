#!/usr/bin/env python3
"""Regression checks for the JSONL fleet ledger: writer, state renderer, teardown."""

from __future__ import annotations

import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
LOG = HERE / "fleet-log.sh"
STATE = HERE / "fleet-state.py"
TEARDOWN = HERE / "fleet-teardown.sh"

ISO_Z = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def event(kind: str, subject: str, data: dict | None = None, time: str = "2026-09-03T10:00:00Z") -> str:
    return json.dumps(
        {
            "specversion": "1.0",
            "id": f"id-{kind}-{subject}-{time}",
            "source": "fleet/demo/mbp",
            "type": kind,
            "time": time,
            "subject": subject,
            "data": data or {},
        }
    )


FIXTURE = "\n".join(
    [
        event("fleet.run.started", "demo", {"session": "fleet-demo", "runmap": "Necmttn/ax#1"}, "2026-09-03T09:00:00Z"),
        event("fleet.policy.set", "routing", {"text": "mechanical -> codex"}, "2026-09-03T09:00:01Z"),
        event("fleet.resource.minted", "session:fleet-demo", {"label": "fleet-demo"}, "2026-09-03T09:00:02Z"),
        event("fleet.resource.minted", "tab:w1:t2", {"label": "fleet:demo"}, "2026-09-03T09:00:03Z"),
        event("fleet.resource.minted", "pane:w1:p6", {"label": "w0-prunes"}, "2026-09-03T09:00:04Z"),
        event("fleet.resource.minted", "pane:w1:p7", {"label": "w0-ffi"}, "2026-09-03T09:00:05Z"),
        event("fleet.chunk.spawned", "mbp/w0-prunes", {"pane": "w1:p6", "engine": "codex"}, "2026-09-03T09:01:00Z"),
        event("fleet.chunk.spawned", "mbp/w0-ffi", {"pane": "w1:p7", "engine": "claude"}, "2026-09-03T09:01:01Z"),
        event("fleet.chunk.built", "mbp/w0-prunes", {"commit": "1390e639"}, "2026-09-03T09:30:00Z"),
        event("fleet.attn.opened", "mbp/w0-ffi", {"ask": "needs API key"}, "2026-09-03T09:31:00Z"),
        event("fleet.chunk.merged", "mbp/w0-prunes", {"pr": "Necmttn/ax#784", "gist": "gate PASSED"}, "2026-09-03T09:45:00Z"),
        event("fleet.resource.closed", "pane:w1:p6", {}, "2026-09-03T09:46:00Z"),
        "this line is not json",
    ]
) + "\n"


FAKE_HERDR = r'''#!/usr/bin/env bash
# Records every argv line, answers agent list / pane list / close / read.
printf '%s\n' "$*" >> "$FAKE_HERDR_LOG"
# A closed pane disappears from every later listing, as in real herdr.
filter_closed() {
  python3 -c '
import json, sys, os
closed = set()
try:
    closed = set(open(os.environ["FAKE_HERDR_LOG"] + ".closed").read().split())
except FileNotFoundError:
    pass
doc = json.load(sys.stdin)
for key in ("agents", "panes"):
    if key in doc["result"]:
        doc["result"][key] = [x for x in doc["result"][key] if x.get("pane_id") not in closed]
print(json.dumps(doc))
'
}
args=("$@")
if [[ "${args[0]}" == "--session" ]]; then args=("${args[@]:2}"); fi
case "${args[0]} ${args[1]}" in
  "agent list")
    filter_closed <<'JSON'
{"result":{"type":"agent_list","agents":[
 {"name":"w0-ffi","pane_id":"w1:p7","agent_status":"idle","tab_id":"w1:t2","workspace_id":"w1"},
 {"name":"stray","pane_id":"w1:p9","agent_status":"working","tab_id":"w1:t2","workspace_id":"w1"}
]}}
JSON
    ;;
  "pane list")
    if [[ "${args[3]}" != "w1" ]]; then
      echo '{"error":{"code":"workspace_not_found","message":"workspace not found"},"id":"cli:pane:list"}'
      exit 1
    fi
    filter_closed <<'JSON'
{"result":{"type":"pane_list","panes":[{"pane_id":"w1:p7"},{"pane_id":"w1:p9"}]}}
JSON
    ;;
  "agent read")
    printf 'transcript tail for %s\n' "${args[2]}"
    ;;
  "pane close"|"tab close"|"workspace close")
    printf '%s\n' "${args[2]}" >> "$FAKE_HERDR_LOG.closed"
    echo '{"result":{"ok":true}}'
    ;;
  "session stop"|"session delete")
    echo "ok ${args[1]} ${args[2]}"
    ;;
  *)
    echo '{"error":{"code":"not_found"}}'
    exit 1
    ;;
esac
'''


def run(cmd: list[str], env: dict | None = None, cwd: Path | None = None) -> subprocess.CompletedProcess:
    full_env = dict(os.environ)
    if env:
        full_env.update(env)
    return subprocess.run(cmd, text=True, capture_output=True, check=False, env=full_env, cwd=cwd)


def with_fake_herdr(tmp: Path) -> dict:
    bin_dir = tmp / "bin"
    bin_dir.mkdir(exist_ok=True)
    fake = bin_dir / "herdr"
    fake.write_text(FAKE_HERDR)
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    log = tmp / "herdr-calls.log"
    log.write_text("")
    return {"PATH": f"{bin_dir}:{os.environ['PATH']}", "FAKE_HERDR_LOG": str(log)}


def check_writer(tmp: Path) -> int:
    ledger = tmp / "demo.jsonl"
    first = run([str(LOG), str(ledger), "fleet.chunk.merged", "mbp/w0-prunes", "pr=Necmttn/ax#784", "gist=gate PASSED, 6 fixed"],
                env={"FLEET_SOURCE": "fleet/demo/mbp"})
    assert first.returncode == 0, first.stderr
    second = run([str(LOG), str(ledger), "fleet.note", "-", "text=root shell closed"], env={"FLEET_SOURCE": "fleet/demo/mbp"})
    assert second.returncode == 0, second.stderr
    lines = ledger.read_text().splitlines()
    assert len(lines) == 2, lines
    one, two = (json.loads(line) for line in lines)
    assert one["specversion"] == "1.0"
    assert one["type"] == "fleet.chunk.merged"
    assert one["subject"] == "mbp/w0-prunes"
    assert one["source"] == "fleet/demo/mbp"
    assert one["data"] == {"pr": "Necmttn/ax#784", "gist": "gate PASSED, 6 fixed"}, one["data"]
    assert ISO_Z.match(one["time"]), one["time"]
    assert one["id"] != two["id"], "ids must be unique"
    assert two["subject"] == "", "a bare '-' subject writes an empty subject"

    bad = run([str(LOG), str(ledger), "chunk.merged", "x"], env={"FLEET_SOURCE": "fleet/demo/mbp"})
    assert bad.returncode == 2, "a type outside the fleet.* namespace is rejected"
    assert len(ledger.read_text().splitlines()) == 2, "a rejected event writes nothing"

    no_source = run([str(LOG), str(ledger), "fleet.note", "-", "text=x"], env={"FLEET_SOURCE": ""})
    assert no_source.returncode == 0, no_source.stderr
    third = json.loads(ledger.read_text().splitlines()[-1])
    assert third["source"].startswith("fleet/demo/"), "source defaults to fleet/<ledger stem>/<host>"
    return 9


def check_renderer(tmp: Path) -> int:
    ledger = tmp / "demo.jsonl"
    ledger.write_text(FIXTURE)
    out = run([sys.executable, str(STATE), str(ledger)])
    assert out.returncode == 0, out.stderr
    text = out.stdout

    assert "epic: demo" in text, text
    assert "session: fleet-demo" in text, text
    assert "malformed: 1" in text, "an unparsable line is reported, not swallowed"

    prunes = next(line for line in text.splitlines() if "w0-prunes" in line and "|" in line)
    assert "merged" in prunes and "Necmttn/ax#784" in prunes, prunes
    ffi = next(line for line in text.splitlines() if "w0-ffi" in line and "|" in line)
    assert "spawned" in ffi, ffi

    assert "merged: 1" in text and "spawned: 1" in text, text
    assert "open attn" in text and "needs API key" in text, text
    assert "pane:w1:p7" in text.split("open resources")[1], "an unclosed pane is listed"
    assert "pane:w1:p6" not in text.split("open resources")[1].split("action log")[0], "a closed pane is not listed"
    assert "mechanical -> codex" in text, "active policies are shown"

    tail = text.split("action log")[1]
    assert "fleet.resource.closed" in tail and "fleet.run.started" not in tail.split("\n", 12)[0]
    return 12


def check_renderer_live(tmp: Path) -> int:
    ledger = tmp / "demo.jsonl"
    ledger.write_text(FIXTURE)
    env = with_fake_herdr(tmp)
    out = run([sys.executable, str(STATE), str(ledger), "--live", "--session", "fleet-demo"], env=env)
    assert out.returncode == 0, out.stderr
    text = out.stdout
    calls = Path(env["FAKE_HERDR_LOG"]).read_text()
    assert "--session fleet-demo agent list" in calls, calls
    ffi = next(line for line in text.splitlines() if "w0-ffi" in line and "|" in line)
    assert "idle" in ffi, ffi
    assert "orphan pane" in text and "w1:p9" in text, "a live pane with no chunk is an orphan"
    return 4


def check_teardown_dry_run(tmp: Path) -> int:
    ledger = tmp / "demo.jsonl"
    ledger.write_text(FIXTURE)
    env = with_fake_herdr(tmp)
    out = run(["bash", str(TEARDOWN), str(ledger), "--epic", "demo", "--session", "fleet-demo"], env=env)
    assert out.returncode == 0, out.stderr
    rows = {line.split()[1]: line for line in out.stdout.splitlines()[1:] if line.strip()}
    assert rows["w1:p6"].endswith("already-closed"), rows["w1:p6"]
    assert rows["w1:p7"].endswith("would-capture-and-close"), rows["w1:p7"]
    assert rows["w1:t2"].endswith("would-close"), rows["w1:t2"]
    assert rows["fleet-demo"].endswith("would-stop-session"), rows["fleet-demo"]
    assert Path(env["FAKE_HERDR_LOG"]).read_text() == "", "dry run never calls herdr"
    return 5


def check_teardown_execute(tmp: Path) -> int:
    ledger = tmp / "demo.jsonl"
    ledger.write_text(FIXTURE)
    env = with_fake_herdr(tmp)
    archive = tmp / "runs"
    out = run(["bash", str(TEARDOWN), str(ledger), "--epic", "demo", "--session", "fleet-demo",
               "--archive-dir", str(archive), "--execute"], env=env)
    assert out.returncode == 0, out.stderr + out.stdout
    calls = Path(env["FAKE_HERDR_LOG"]).read_text().splitlines()
    assert all(c.startswith("--session fleet-demo ") for c in calls), calls
    assert "--session fleet-demo pane close w1:p7" in calls, calls
    assert "--session fleet-demo session stop fleet-demo" in calls, calls
    assert not any("pane close w1:p6" in c for c in calls), "already-closed panes are not closed twice"
    captured = (archive / "demo.md").read_text()
    assert "transcript tail for w0-ffi" in captured, captured

    events = [json.loads(line) for line in ledger.read_text().splitlines() if line.startswith("{")]
    closed = {e["subject"] for e in events if e["type"] == "fleet.resource.closed"}
    assert {"pane:w1:p7", "tab:w1:t2", "session:fleet-demo"} <= closed, closed
    assert events[-1]["type"] == "fleet.run.teardown", events[-1]
    assert events[-1]["data"]["closed"] >= 3, events[-1]
    return 8


def check_teardown_rejects_empty_id(tmp: Path) -> int:
    ledger = tmp / "demo.jsonl"
    ledger.write_text(event("fleet.resource.minted", "workspace:", {"label": "oops"}) + "\n")
    env = with_fake_herdr(tmp)
    out = run(["bash", str(TEARDOWN), str(ledger), "--epic", "demo", "--session", "fleet-demo"], env=env)
    assert out.returncode == 2, out.stdout + out.stderr
    assert "empty resource id" in out.stderr, out.stderr
    return 2


def check_teardown_unknown_workspace_is_gone(tmp: Path) -> int:
    ledger = tmp / "demo.jsonl"
    ledger.write_text("\n".join([
        event("fleet.resource.minted", "pane:w9:p1", {"label": "w0-lost"}),
        event("fleet.resource.minted", "tab:w1:t2", {"label": "fleet:demo"}),
    ]) + "\n")
    env = with_fake_herdr(tmp)
    out = run(["bash", str(TEARDOWN), str(ledger), "--epic", "demo", "--session", "fleet-demo", "--execute"], env=env)
    assert out.returncode == 0, out.stdout + out.stderr
    assert "gone   pane       w9:p1" in out.stdout, out.stdout
    assert "Traceback" not in out.stderr, out.stderr
    events = [json.loads(line) for line in ledger.read_text().splitlines()]
    closed = {e["subject"] for e in events if e["type"] == "fleet.resource.closed"}
    assert "pane:w9:p1" in closed, closed
    return 4


def main() -> None:
    total = 0
    with tempfile.TemporaryDirectory() as raw:
        tmp = Path(raw)
        for check in (check_writer, check_renderer, check_renderer_live, check_teardown_dry_run, check_teardown_execute,
                      check_teardown_rejects_empty_id, check_teardown_unknown_workspace_is_gone):
            sub = tmp / check.__name__
            sub.mkdir()
            total += check(sub)
    print(f"fleet-ledger regression checks: PASS ({total} assertions)")


if __name__ == "__main__":
    main()
