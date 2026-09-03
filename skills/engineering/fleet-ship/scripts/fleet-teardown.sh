#!/usr/bin/env bash
# Ledger-driven teardown of every herdr resource one fleet run minted.
#
#   fleet-teardown.sh <ledger.jsonl> --epic <epic> [--session <name>] [--archive-dir <dir>] [--execute]
#
# Reads fleet.resource.minted minus fleet.resource.closed from the JSONL ledger (see
# fleet-log.sh), captures every pane's tail into the run archive, closes panes, tabs and
# workspaces by exact id, then stops and deletes the fleet session. Every close appends a
# fleet.resource.closed event; the end appends fleet.run.teardown. Without --execute it only
# prints what it would do and never calls herdr.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
FLEET_LOG=$SCRIPT_DIR/fleet-log.sh

usage() {
  cat >&2 <<'EOF'
Usage: fleet-teardown.sh <ledger.jsonl> --epic <epic> [--session <name>] [--archive-dir <dir>] [--execute]
EOF
}

die_usage() {
  printf 'fleet-teardown: %s\n' "$1" >&2
  usage
  exit 2
}

LEDGER=${1:-}
[[ -n "$LEDGER" ]] || die_usage "ledger path is required"
shift || true

EPIC=
SESSION=
ARCHIVE_DIR=docs/superpowers/fleet-runs
EXECUTE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --epic)
      [[ $# -ge 2 ]] || die_usage "--epic requires a value"
      EPIC=$2
      shift 2
      ;;
    --session)
      [[ $# -ge 2 ]] || die_usage "--session requires a value"
      SESSION=$2
      shift 2
      ;;
    --archive-dir)
      [[ $# -ge 2 ]] || die_usage "--archive-dir requires a value"
      ARCHIVE_DIR=$2
      shift 2
      ;;
    --execute)
      EXECUTE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) die_usage "unknown argument: $1" ;;
  esac
done

[[ -n "$EPIC" ]] || die_usage "--epic is required"
[[ -f "$LEDGER" ]] || die_usage "ledger does not exist: $LEDGER"

HERDR=(herdr)
if [[ -n "$SESSION" ]]; then
  HERDR=(herdr --session "$SESSION")
fi

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/fleet-teardown.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT
RECORDS=$TMP_DIR/records.tsv

# records.tsv: type <TAB> id <TAB> label <TAB> state(open|closed)
PARSE_STATUS=0
python3 - "$LEDGER" > "$RECORDS" <<'PY' || PARSE_STATUS=$?
import json
import sys

path = sys.argv[1]
minted = {}
order = []
with open(path, encoding="utf-8") as handle:
    for number, raw in enumerate(handle, 1):
        raw = raw.strip()
        if not raw:
            continue
        try:
            event = json.loads(raw)
        except ValueError:
            print(f"fleet-teardown: skipping malformed line {number}", file=sys.stderr)
            continue
        kind = event.get("type")
        subject = event.get("subject") or ""
        if kind == "fleet.resource.minted":
            if ":" not in subject:
                print(f"fleet-teardown: malformed resource subject on line {number}: {subject}", file=sys.stderr)
                sys.exit(2)
            rtype, rid = subject.split(":", 1)
            if not rid:
                print(f"fleet-teardown: empty resource id on line {number}: {subject}", file=sys.stderr)
                sys.exit(2)
            if rtype not in ("session", "workspace", "tab", "pane", "agent"):
                print(f"fleet-teardown: unknown resource type on line {number}: {rtype}", file=sys.stderr)
                sys.exit(2)
            label = str((event.get("data") or {}).get("label", "")).replace("\t", " ")
            if subject not in minted:
                order.append(subject)
            minted[subject] = [rtype, rid, label, "open"]
        elif kind == "fleet.resource.closed" and subject in minted:
            minted[subject][3] = "closed"

if not order:
    print("fleet-teardown: ledger contains no fleet.resource.minted events", file=sys.stderr)
    sys.exit(2)
for subject in order:
    print(*minted[subject], sep="\t")
PY
if [[ "$PARSE_STATUS" -ne 0 ]]; then
  exit "$PARSE_STATUS"
fi

action_for() {
  local type=$1 state=$2
  if [[ "$state" == closed ]]; then
    printf 'already-closed'
  elif [[ "$type" == session ]]; then
    printf 'would-stop-session'
  elif [[ "$type" == pane || "$type" == agent ]]; then
    printf 'would-capture-and-close'
  else
    printf 'would-close'
  fi
}

if [[ "$EXECUTE" -eq 0 ]]; then
  printf '%-10s %-20s %-28s %s\n' type id label action
  while IFS=$'\t' read -r type id label state; do
    printf '%-10s %-20s %-28s %s\n' "$type" "$id" "$label" "$(action_for "$type" "$state")"
  done < "$RECORDS"
  exit 0
fi

log_event() {
  "$FLEET_LOG" "$LEDGER" "$@"
}

append_closed() {
  log_event fleet.resource.closed "$1:$2"
}

agent_snapshot() {
  "${HERDR[@]}" agent list
}

resolve_from_agent_list() {
  local type=$1 id=$2
  python3 -c '
import json, sys
kind, wanted = sys.argv[1:]
agents = json.load(sys.stdin)["result"]["agents"]
for agent in agents:
    if ((kind == "pane" and agent.get("pane_id") == wanted) or
            (kind == "agent" and agent.get("name") == wanted)):
        print(agent.get("name") or "__UNNAMED__", agent["pane_id"], sep="\t")
        break
' "$type" "$id"
}

resolve_resource() {
  local type=$1 id=$2 workspace pane_id name
  if [[ "$type" == agent ]]; then
    agent_snapshot | resolve_from_agent_list "$type" "$id"
    return
  fi

  workspace=${id%%:*}
  pane_id=$("${HERDR[@]}" pane list --workspace "$workspace" 2>/dev/null | python3 -c '
import json, sys
wanted = sys.argv[1]
try:
    panes = json.load(sys.stdin).get("result", {}).get("panes", [])
except ValueError:
    panes = []
for pane in panes:
    if pane.get("pane_id") == wanted:
        print(pane["pane_id"])
        break
' "$id")
  [[ -n "$pane_id" ]] || return 0
  name=$(agent_snapshot | python3 -c '
import json, sys
wanted = sys.argv[1]
for agent in json.load(sys.stdin)["result"]["agents"]:
    if agent.get("pane_id") == wanted:
        print(agent.get("name") or "__UNNAMED__")
        break
' "$pane_id")
  printf '%s\t%s\n' "${name:-__UNNAMED__}" "$pane_id"
}

capture_agent() {
  local name=$1 label=$2 raw text
  if [[ -z "$name" ]]; then
    printf 'capture skipped: pane has no unique agent name (%s)\n' "$label" >&2
    return 0
  fi
  if ! raw=$("${HERDR[@]}" agent read "$name" --source recent --lines 400); then
    printf 'capture failed (continuing): %s\n' "$name" >&2
    return 0
  fi
  # herdr >= 0.8 prints plain text; older builds wrapped it in {"result":{"read":{"text":...}}}.
  text=$(printf '%s' "$raw" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    print(json.loads(raw)["result"]["read"]["text"])
except Exception:
    print(raw)
')
  mkdir -p "$ARCHIVE_DIR"
  {
    printf '## %s (teardown capture)\n\n' "$label"
    printf '%s\n\n' "$text"
  } >> "$ARCHIVE_DIR/$EPIC.md"
}

close_exact() {
  local type=$1 id=$2 output
  if output=$("${HERDR[@]}" "$type" close "$id" 2>&1); then
    printf 'closed %-10s %s\n' "$type" "$id"
    return 0
  fi
  if [[ "$output" == *not_found* || "$output" == *"not found"* ]]; then
    printf 'gone   %-10s %s\n' "$type" "$id"
    return 3
  fi
  printf 'fleet-teardown: failed to close %s %s: %s\n' "$type" "$id" "$output" >&2
  return 1
}

CLOSED_COUNT=0
process_panes() {
  local type id label state match name pane_id close_status
  while IFS=$'\t' read -r type id label state; do
    [[ "$type" == pane || "$type" == agent ]] || continue
    if [[ "$state" == closed ]]; then
      printf 'skip   %-10s %s (already closed)\n' "$type" "$id"
      continue
    fi
    match=$(resolve_resource "$type" "$id")
    if [[ -z "$match" ]]; then
      printf 'gone   %-10s %s\n' "$type" "$id"
      append_closed "$type" "$id"
      continue
    fi
    IFS=$'\t' read -r name pane_id <<< "$match"
    if [[ "$name" == __UNNAMED__ ]]; then
      name=
    fi
    capture_agent "$name" "$label"
    close_status=0
    close_exact pane "$pane_id" || close_status=$?
    [[ "$close_status" -eq 0 || "$close_status" -eq 3 ]] || return "$close_status"
    append_closed "$type" "$id"
    if [[ "$close_status" -eq 0 ]]; then
      CLOSED_COUNT=$((CLOSED_COUNT + 1))
    fi
  done < "$RECORDS"
}

process_containers() {
  local wanted_type=$1 type id label state close_status
  while IFS=$'\t' read -r type id label state; do
    [[ "$type" == "$wanted_type" ]] || continue
    if [[ "$state" == closed ]]; then
      printf 'skip   %-10s %s (already closed)\n' "$type" "$id"
      continue
    fi
    close_status=0
    close_exact "$type" "$id" || close_status=$?
    [[ "$close_status" -eq 0 || "$close_status" -eq 3 ]] || return "$close_status"
    append_closed "$type" "$id"
    if [[ "$close_status" -eq 0 ]]; then
      CLOSED_COUNT=$((CLOSED_COUNT + 1))
    fi
  done < "$RECORDS"
}

process_panes
process_containers tab
process_containers workspace

# Survivors check runs while the server is still up - a stopped session answers nothing.
agent_snapshot > "$TMP_DIR/final-agents.json"
SURVIVORS=$(python3 - "$RECORDS" "$TMP_DIR/final-agents.json" <<'PY'
import json
import sys

records_path = sys.argv[1]
with open(sys.argv[2], encoding="utf-8") as snapshot:
    agents = json.load(snapshot)["result"]["agents"]
pane_ids = {agent.get("pane_id") for agent in agents}
names = {agent.get("name") for agent in agents if agent.get("name")}
survivors = []
with open(records_path, encoding="utf-8") as records:
    for line in records:
        kind, resource_id, _label, _state = line.rstrip("\n").split("\t", 3)
        if ((kind == "pane" and resource_id in pane_ids) or
                (kind == "agent" and resource_id in names)):
            survivors.append(f"{kind} {resource_id}")
print("\n".join(survivors))
PY
)
while IFS=$'\t' read -r type id label state; do
  [[ "$type" == pane ]] || continue
  if "${HERDR[@]}" pane list --workspace "${id%%:*}" 2>/dev/null | python3 -c '
import json, sys
wanted = sys.argv[1]
try:
    panes = json.load(sys.stdin).get("result", {}).get("panes", [])
except ValueError:
    panes = []
raise SystemExit(not any(p.get("pane_id") == wanted for p in panes))
' "$id"
  then
    SURVIVORS="${SURVIVORS}${SURVIVORS:+$'\n'}pane $id"
  fi
done < "$RECORDS"
if [[ -n "$SURVIVORS" ]]; then
  printf 'fleet-teardown: survivors remain:\n%s\n' "$SURVIVORS" >&2
  exit 1
fi

# The session goes last: stopping it kills every remaining surface at once.
process_sessions() {
  local type id label state
  while IFS=$'\t' read -r type id label state; do
    [[ "$type" == session ]] || continue
    if [[ "$state" == closed ]]; then
      printf 'skip   %-10s %s (already closed)\n' "$type" "$id"
      continue
    fi
    if ! "${HERDR[@]}" session stop "$id"; then
      printf 'fleet-teardown: failed to stop session %s\n' "$id" >&2
      return 1
    fi
    "${HERDR[@]}" session delete "$id" || printf 'session delete failed (continuing): %s\n' "$id" >&2
    printf 'closed %-10s %s\n' "$type" "$id"
    append_closed "$type" "$id"
    CLOSED_COUNT=$((CLOSED_COUNT + 1))
  done < "$RECORDS"
}
process_sessions

log_event fleet.run.teardown "$EPIC" "closed=$CLOSED_COUNT"
printf 'teardown complete: %d closed\n' "$CLOSED_COUNT"
