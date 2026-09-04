#!/usr/bin/env bash
# Runs check-playbook.sh against fixtures. good must pass; bad must fail with exactly the expected defects.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
CHECK="$HERE/../scripts/check-playbook.sh"
fail=0
if ! "$CHECK" "$HERE/fixtures/good" >/dev/null; then echo "FAIL good fixture should pass"; "$CHECK" "$HERE/fixtures/good"; fail=1; fi
out="$("$CHECK" "$HERE/fixtures/bad" 2>&1)"; rc=$?
[ $rc -eq 1 ] || { echo "FAIL bad fixture should exit 1 (got $rc)"; fail=1; }
for want in "duplicate id P-01" "bad rule line" "unknown rule Z-77" "missing heading '## Kill criterion'"; do
  echo "$out" | grep -q "$want" || { echo "FAIL bad fixture missing: $want"; echo "$out"; fail=1; }
done
[ $fail -eq 0 ] && echo "OK"
exit $fail
