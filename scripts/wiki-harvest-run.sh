#!/usr/bin/env bash
# Headless wiki harvest. launchd fires daily at 21:00; the 40h guard
# below turns that into an every-2-days cadence that self-heals when
# the machine was asleep. Force with WIKI_HARVEST_FORCE=1.
set -euo pipefail

CHECKPOINT="$HOME/wiki/inbox/.harvest-checkpoint.json"
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"

if [ "${WIKI_HARVEST_FORCE:-0}" != "1" ] && [ -f "$CHECKPOINT" ]; then
  last_epoch=$(jq -r '.last_harvested_epoch // 0' "$CHECKPOINT")
  age=$(( $(date +%s) - last_epoch ))
  if [ "$age" -lt 144000 ]; then   # 40 hours
    echo "$(date -Iseconds) skip: last harvest ${age}s ago" >> "$LOG_DIR/wiki-harvest.log"
    exit 0
  fi
fi

echo "$(date -Iseconds) start" >> "$LOG_DIR/wiki-harvest.log"
cd "$HOME"
claude -p "/wiki-harvest" --permission-mode acceptEdits \
  >> "$LOG_DIR/wiki-harvest.log" 2>&1
echo "$(date -Iseconds) done rc=$?" >> "$LOG_DIR/wiki-harvest.log"
