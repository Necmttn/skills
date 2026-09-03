#!/usr/bin/env bash
# Append one CloudEvents 1.0 record to a JSONL fleet ledger.
#
#   fleet-log.sh <ledger> <type> <subject|-> [key=value ...]
#
# type    must live in the fleet.* namespace (fleet.chunk.merged, fleet.resource.minted, ...)
# subject "-" writes an empty subject
# key=value pairs become the data object; integers and true/false are coerced, everything
#         else stays a string. Repeated keys: last wins.
# env     FLEET_SOURCE overrides the source field (default fleet/<ledger stem>/<short hostname>)
set -euo pipefail

usage() {
  printf 'Usage: fleet-log.sh <ledger> <type> <subject|-> [key=value ...]\n' >&2
}

[[ $# -ge 3 ]] || { usage; exit 2; }
LEDGER=$1 TYPE=$2 SUBJECT=$3
shift 3

if [[ ! "$TYPE" =~ ^fleet\.[a-z][a-z0-9.-]*$ ]]; then
  printf 'fleet-log: type must match ^fleet\\.[a-z][a-z0-9.-]*$ (got %q)\n' "$TYPE" >&2
  exit 2
fi
[[ "$SUBJECT" == "-" ]] && SUBJECT=

for pair in "$@"; do
  if [[ "$pair" != *=* ]]; then
    printf 'fleet-log: data must be key=value (got %q)\n' "$pair" >&2
    exit 2
  fi
done

stem=$(basename "$LEDGER")
stem=${stem%.*}
SOURCE=${FLEET_SOURCE:-fleet/$stem/$(hostname -s 2>/dev/null || hostname)}

mkdir -p "$(dirname "$LEDGER")"
python3 - "$LEDGER" "$TYPE" "$SUBJECT" "$SOURCE" "$@" <<'PY'
import json, re, sys, uuid
from datetime import datetime, timezone

ledger, kind, subject, source, *pairs = sys.argv[1:]
data = {}
for pair in pairs:
    key, value = pair.split("=", 1)
    if re.fullmatch(r"-?\d+", value):
        data[key] = int(value)
    elif value in ("true", "false"):
        data[key] = value == "true"
    else:
        data[key] = value
record = {
    "specversion": "1.0",
    "id": uuid.uuid4().hex,
    "source": source,
    "type": kind,
    "time": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "subject": subject,
    "data": data,
}
with open(ledger, "a", encoding="utf-8") as handle:
    handle.write(json.dumps(record, ensure_ascii=False) + "\n")
PY
