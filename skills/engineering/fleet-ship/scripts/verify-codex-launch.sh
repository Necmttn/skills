#!/usr/bin/env bash

# Start a Codex TUI pane, accept its trust modal, and prove its argv turn ran.
# Run on the pane's herdr server; this script resolves monitor-tail.py beside itself.

set -uo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: verify-codex-launch.sh <name> <worktree> <tab-id> <report-name> <fleet-id>
EOF
}

if [[ $# -ne 5 ]]; then
  usage
  exit 2
fi

NAME=$1
WORKTREE=$2
TAB_ID=$3
REPORT_NAME=$4
FLEET_ID=$5
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
NORMALIZER=$SCRIPT_DIR/monitor-tail.py
INITIAL_DELAY_SECONDS=${CODEX_BOOT_INITIAL_DELAY_SECONDS:-10}
DEADLINE_SECONDS=${CODEX_BOOT_DEADLINE_SECONDS:-90}

if [[ ! -f "$NORMALIZER" ]]; then
  echo "ERRORED:$REPORT_NAME missing monitor-tail helper: $NORMALIZER"
  exit 2
fi

TURN_TOKEN="fleet-turn:$NAME:$(date +%s)"
ARGV_BRIEF="Read BRIEF.md and execute it fully [$TURN_TOKEN]"
if ! herdr agent start "$NAME" --cwd "$WORKTREE" --tab "$TAB_ID" -- \
  codex --dangerously-bypass-approvals-and-sandbox "$ARGV_BRIEF"; then
  echo "ERRORED:$REPORT_NAME Codex pane failed to start"
  bun ~/Projects/fleetboard/fleetctl.ts attn "$FLEET_ID" "$REPORT_NAME ERRORED: Codex pane failed to start" || :
  exit 1
fi
if ! PANE_ID=$(herdr agent get "$NAME" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["agent"]["pane_id"])'); then
  echo "ERRORED:$REPORT_NAME unable to resolve pane after spawn"
  bun ~/Projects/fleetboard/fleetctl.ts attn "$FLEET_ID" "$REPORT_NAME ERRORED: unable to resolve spawned pane" || :
  exit 1
fi
sleep "$INITIAL_DELAY_SECONDS"
herdr pane send-keys "$PANE_ID" Enter

deadline=$(( $(date +%s) + DEADLINE_SECONDS ))
boot_ready=0
status=unknown
while [[ $(date +%s) -lt $deadline ]]; do
  agent=$(herdr agent get "$NAME" 2>/dev/null || :)
  status=$(printf '%s' "$agent" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null || printf unknown)
  tail=$(herdr agent read "$NAME" --source recent --lines 40 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["read"]["text"])' 2>/dev/null || :)
  if printf '%s' "$tail" | python3 "$NORMALIZER" past-boot --status "$status" --turn-token "$TURN_TOKEN"; then
    boot_ready=1
    break
  fi
  sleep 5
done

if [[ $boot_ready -ne 1 ]]; then
  echo "BOOT_HUNG:$REPORT_NAME status=$status no-argv-activity-after-${DEADLINE_SECONDS}s"
  bun ~/Projects/fleetboard/fleetctl.ts attn "$FLEET_ID" "$REPORT_NAME BOOT_HUNG: no argv activity after ${DEADLINE_SECONDS}s" || :
  # Preserve the pane for classification and recovery. Never auto-kill it.
  exit 1
fi

echo "BOOT_READY:$REPORT_NAME status=$status"
