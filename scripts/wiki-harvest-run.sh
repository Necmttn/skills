#!/usr/bin/env bash
# Headless wiki harvest. launchd fires daily at 21:00; the 40h guard
# below turns that into an every-2-days cadence that self-heals when
# the machine was asleep. Force with WIKI_HARVEST_FORCE=1.
set -euo pipefail

CHECKPOINT="$HOME/wiki/inbox/.harvest-checkpoint.json"
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"

if [ "${WIKI_HARVEST_FORCE:-0}" != "1" ] && [ -f "$CHECKPOINT" ]; then
  last_epoch=$(jq -r '.last_harvested_epoch // 0' "$CHECKPOINT" 2>/dev/null || echo 0)
  age=$(( $(date +%s) - last_epoch ))
  if [ "$age" -lt 144000 ]; then   # 40 hours
    echo "$(date -Iseconds) skip: last harvest ${age}s ago" >> "$LOG_DIR/wiki-harvest.log"
    exit 0
  fi
fi

echo "$(date -Iseconds) start" >> "$LOG_DIR/wiki-harvest.log"
cd "$HOME"
# ALLOW_MAIN_WRITE lets the session's ax write-guard hook accept the
# sanctioned inbox/checkpoint writes under ~/wiki (a synced vault repo
# whose commits belong to vault-sync, not to a worktree/PR flow).
# perl alarm caps a hung run at 60 min (no coreutils timeout on macOS).
rc=0
ALLOW_MAIN_WRITE=1 perl -e 'alarm shift; exec @ARGV' 3600 \
  claude -p "/wiki-harvest" --permission-mode acceptEdits \
  --allowedTools "Bash,Read,Write,Edit,Grep,Glob" \
  >> "$LOG_DIR/wiki-harvest.log" 2>&1 || rc=$?
echo "$(date -Iseconds) done rc=$rc" >> "$LOG_DIR/wiki-harvest.log"
exit "$rc"
