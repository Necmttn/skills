#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: fleet-teardown.sh <ledger-path> --epic <epic> [--archive-dir <dir>] [--execute]
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
ARCHIVE_DIR=docs/superpowers/fleet-runs
EXECUTE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --epic)
      [[ $# -ge 2 ]] || die_usage "--epic requires a value"
      EPIC=$2
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

TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/fleet-teardown.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT
RECORDS=$TMP_DIR/records.tsv

PARSE_STATUS=0
python3 - "$LEDGER" > "$RECORDS" <<'PY' || PARSE_STATUS=$?
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    lines = handle.read().splitlines()

closed_at = {}
for number, line in enumerate(lines):
    match = re.fullmatch(r"CLOSED\s+(\S+)\s*", line)
    if match:
        closed_at.setdefault(match.group(1), []).append(number)

count = 0
for number, line in enumerate(lines):
    if not line.startswith("RES "):
        continue
    match = re.fullmatch(r"RES\s+(tab|pane|agent|workspace)\s+(\S+)\s+(.+)", line)
    if not match:
        print(f"fleet-teardown: malformed RES line {number + 1}: {line}", file=sys.stderr)
        sys.exit(2)
    resource_type, resource_id, label = match.groups()
    label = label.replace("\t", " ")
    state = "closed" if any(i > number for i in closed_at.get(resource_id, [])) else "open"
    print(resource_type, resource_id, label, state, sep="\t")
    count += 1

if count == 0:
    print("fleet-teardown: ledger contains no RES lines", file=sys.stderr)
    sys.exit(2)
PY
if [[ "$PARSE_STATUS" -ne 0 ]]; then
  exit "$PARSE_STATUS"
fi

action_for() {
  local type=$1 state=$2
  if [[ "$state" == closed ]]; then
    printf 'already-closed'
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

append_closed() {
  printf 'CLOSED %s\n' "$1" >> "$LEDGER"
}

agent_snapshot() {
  herdr agent list
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
  pane_id=$(herdr pane list --workspace "$workspace" | python3 -c '
import json, sys
wanted = sys.argv[1]
for pane in json.load(sys.stdin)["result"]["panes"]:
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
  local name=$1 label=$2 json text
  if [[ -z "$name" ]]; then
    printf 'capture skipped: pane has no unique agent name (%s)\n' "$label" >&2
    return 0
  fi
  if ! json=$(herdr agent read "$name" --source recent --lines 400); then
    printf 'capture failed (continuing): %s\n' "$name" >&2
    return 0
  fi
  if ! text=$(printf '%s' "$json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["read"]["text"])'); then
    printf 'capture parse failed (continuing): %s\n' "$name" >&2
    return 0
  fi
  mkdir -p "$ARCHIVE_DIR"
  {
    printf '## %s (teardown capture)\n\n' "$label"
    printf '%s\n\n' "$text"
  } >> "$ARCHIVE_DIR/$EPIC.md"
}

close_exact() {
  local type=$1 id=$2 output
  if output=$(herdr "$type" close "$id" 2>&1); then
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
      append_closed "$id"
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
    append_closed "$id"
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
    append_closed "$id"
    if [[ "$close_status" -eq 0 ]]; then
      CLOSED_COUNT=$((CLOSED_COUNT + 1))
    fi
  done < "$RECORDS"
}

process_panes
process_containers tab
process_containers workspace

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
  if herdr pane list --workspace "${id%%:*}" | python3 -c '
import json, sys
wanted = sys.argv[1]
raise SystemExit(not any(p.get("pane_id") == wanted for p in json.load(sys.stdin)["result"]["panes"]))
' "$id"
  then
    SURVIVORS="${SURVIVORS}${SURVIVORS:+$'\n'}pane $id"
  fi
done < "$RECORDS"
if [[ -n "$SURVIVORS" ]]; then
  printf 'fleet-teardown: survivors remain:\n%s\n' "$SURVIVORS" >&2
  exit 1
fi

printf 'TEARDOWN-DONE %d %s\n' "$CLOSED_COUNT" "$(date -Iseconds)" >> "$LEDGER"
printf 'teardown complete: %d closed\n' "$CLOSED_COUNT"
