#!/usr/bin/env bash
# Lint the apps playbook doctrine + verdict cards.
# Usage: check-playbook.sh [wiki-root]   (default ~/wiki). Exit 1 on any FAIL.
set -u
ROOT="${1:-$HOME/wiki}"
DOC="$ROOT/playbook/apps.md"
VDIR="$ROOT/playbook/verdicts"
rc=0
fail(){ echo "FAIL $1: $2"; rc=1; }

[ -f "$DOC" ] || { fail "$DOC" "missing"; exit 1; }
grep -q '^type: playbook$' "$DOC" || fail "$DOC" "frontmatter type must be playbook"
grep -qE '^updated: [0-9]{4}-[0-9]{2}-[0-9]{2}$' "$DOC" || fail "$DOC" "missing updated:"
for h in "## How to read this page" "## Idea gate" "## Product rules" "## Growth rules" "## Autonomy boundary" "## Decision log" "## Retired"; do
  grep -qF "$h" "$DOC" || fail "$DOC" "missing heading '$h'"
done

RULE_RE='^- \*\*[IPGA]-[0-9]{2}\*\* \[(candidate|decided|verified|retired) [0-9]{4}-[0-9]{2}-[0-9]{2}\] .+'
LOG_RE='^- [0-9]{4}-[0-9]{2}-[0-9]{2} \| [IPGA]-[0-9]{2} \| (candidate|decided|verified|retired) -> (candidate|decided|verified|retired) \| .+ \| .+$'

# Every line that starts "- **X-" is a rule line and must match RULE_RE.
while IFS= read -r line; do
  [ -n "$line" ] || continue
  echo "$line" | grep -qE "$RULE_RE" || fail "$DOC" "bad rule line: $line"
done <<< "$(grep -E '^- \*\*[A-Z]-' "$DOC")"

ids="$(grep -oE '^- \*\*[IPGA]-[0-9]{2}\*\*' "$DOC" | sed -E 's/^- \*\*([IPGA]-[0-9]{2})\*\*/\1/')"
for d in $(echo "$ids" | sort | uniq -d); do fail "$DOC" "duplicate id $d"; done

# Decision-log lines live between "## Decision log" and the next "## ".
while IFS= read -r l; do
  [ -n "$l" ] || continue
  echo "$l" | grep -qE "$LOG_RE" || fail "$DOC" "bad decision-log line: $l"
done <<< "$(awk '/^## Decision log/{f=1;next} /^## /{f=0} f' "$DOC" | grep -E '^- ' || true)"

# Verdict cards.
if [ -d "$VDIR" ]; then
  for c in "$VDIR"/*.md; do
    [ -e "$c" ] || continue
    grep -q '^type: verdict$' "$c" || fail "$c" "frontmatter type must be verdict"
    grep -qE '^kind: (new|existing)$' "$c" || fail "$c" "kind must be new|existing"
    grep -qE '^verdict: (build|park|kill|keep|fix|sunset)$' "$c" || fail "$c" "verdict must be build|park|kill|keep|fix|sunset"
    for h in "## One-liner" "## Receipts" "## Paying-intent bands" "## Scores" "## Verdict" "## Kill criterion" "## Rules applied" "## Owner override"; do
      grep -qF "$h" "$c" || fail "$c" "missing heading '$h'"
    done
    for id in $(awk '/^## Rules applied/{f=1;next} /^## /{f=0} f' "$c" | grep -oE '\b[A-Z]-[0-9]{2}\b' | sort -u); do
      echo "$ids" | grep -qx "$id" || fail "$c" "unknown rule $id"
    done
    n="$(grep -oE '\[\[[a-z0-9-]+\]\]' "$c" | sort -u | wc -l | tr -d ' ')"
    [ "$n" -ge 2 ] || fail "$c" "needs >=2 wikilinks (has $n)"
  done
fi
[ $rc -eq 0 ] && echo "OK $ROOT"
exit $rc
