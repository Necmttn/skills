#!/usr/bin/env bash

# Start a Codex TUI pane and prove its argv turn actually ran.
# Run on the pane's herdr server; resolves monitor-tail.py beside itself.
#
# Usage: verify-codex-launch.sh <name> <worktree> <tab-id> <report-name> <fleet-id> [extra codex args...]
#
# Everything after <fleet-id> is passed straight through to codex BEFORE the argv
# brief, so the caller supplies the lane's argv from ~/.ax/fleet-routing.json, e.g.
#   verify-codex-launch.sh 019 "$WT" w22:t5 mac-necmttn/019 fleet-lockin-prelaunch \
#     -c 'model_reasoning_effort="medium"'
# Without it you inherit ~/.codex/config.toml, which is model_reasoning_effort="max"
# on this machine - wasteful on clear-spec mechanical chunks.

set -uo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: verify-codex-launch.sh <name> <worktree> <tab-id> <report-name> <fleet-id> [extra codex args...]
EOF
}

if [[ $# -lt 5 ]]; then
  usage
  exit 2
fi

NAME=$1; WORKTREE=$2; TAB_ID=$3; REPORT_NAME=$4; FLEET_ID=$5
shift 5
CODEX_ARGS=("$@")

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
NORMALIZER=$SCRIPT_DIR/monitor-tail.py
INITIAL_DELAY_SECONDS=${CODEX_BOOT_INITIAL_DELAY_SECONDS:-10}
DEADLINE_SECONDS=${CODEX_BOOT_DEADLINE_SECONDS:-90}
# Was 40. A pane that boots and starts working immediately scrolls the turn token
# out of a short tail well inside the deadline -> false BOOT_HUNG + a false bell
# on a healthy pane (live 2026-07-21). Read enough scrollback to still see it.
TAIL_LINES=${CODEX_BOOT_TAIL_LINES:-400}

if [[ ! -f "$NORMALIZER" ]]; then
  echo "ERRORED:$REPORT_NAME missing monitor-tail helper: $NORMALIZER"
  exit 2
fi

# --- Trust detection -------------------------------------------------------
# codex only shows the Yes/No trust modal for an UNtrusted cwd. When the worktree
# (or any ancestor) is trust_level="trusted" in ~/.codex/config.toml there is no
# modal at all, so the sleep + bare-Enter accept is dead ceremony - and the Enter
# lands on the prompt line instead. Verified live 2026-07-21.
codex_path_is_trusted() {
  local p=$1 cfg=${CODEX_HOME:-$HOME/.codex}/config.toml
  [[ -f $cfg ]] || return 1
  python3 - "$p" "$cfg" <<'PY'
import sys, os, re
target = os.path.realpath(sys.argv[1])
cfg = open(sys.argv[2], encoding="utf-8", errors="replace").read()
trusted = {
    os.path.realpath(m.group(1))
    for m in re.finditer(r'^\[projects\.(?:"([^"]+)")\]\s*\n(?:(?!^\[).*\n)*?\s*trust_level\s*=\s*"trusted"',
                         cfg, re.M)
}
p = target
while True:
    if p in trusted:
        sys.exit(0)
    parent = os.path.dirname(p)
    if parent == p:
        break
    p = parent
sys.exit(1)
PY
}

TRUSTED=0
if codex_path_is_trusted "$WORKTREE"; then
  TRUSTED=1
fi

TURN_TOKEN="fleet-turn:$NAME:$(date +%s)"
ARGV_BRIEF="Read BRIEF.md and execute it fully [$TURN_TOKEN]"

if ! herdr agent start "$NAME" --cwd "$WORKTREE" --tab "$TAB_ID" -- \
  codex --dangerously-bypass-approvals-and-sandbox "${CODEX_ARGS[@]}" "$ARGV_BRIEF"; then
  echo "ERRORED:$REPORT_NAME Codex pane failed to start"
  bun ~/Projects/fleetboard/fleetctl.ts attn "$FLEET_ID" "$REPORT_NAME ERRORED: Codex pane failed to start" || :
  exit 1
fi
if ! PANE_ID=$(herdr agent get "$NAME" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["agent"]["pane_id"])'); then
  echo "ERRORED:$REPORT_NAME unable to resolve pane after spawn"
  bun ~/Projects/fleetboard/fleetctl.ts attn "$FLEET_ID" "$REPORT_NAME ERRORED: unable to resolve spawned pane" || :
  exit 1
fi

if [[ $TRUSTED -eq 1 ]]; then
  echo "TRUSTED:$REPORT_NAME cwd is trust_level=trusted; skipping modal accept"
else
  # NEVER send text here - any text while the modal is up CRASHES the pane.
  sleep "$INITIAL_DELAY_SECONDS"
  herdr pane send-keys "$PANE_ID" Enter
fi

deadline=$(( $(date +%s) + DEADLINE_SECONDS ))
boot_ready=0
status=unknown
while [[ $(date +%s) -lt $deadline ]]; do
  agent=$(herdr agent get "$NAME" 2>/dev/null || :)
  status=$(printf '%s' "$agent" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null || printf unknown)
  # A fast chunk can be finished before the first poll; done/idle is valid proof.
  tail=$(herdr agent read "$NAME" --source recent --lines "$TAIL_LINES" 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["read"]["text"])' 2>/dev/null || :)
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

echo "BOOT_READY:$REPORT_NAME status=$status trusted=$TRUSTED"
