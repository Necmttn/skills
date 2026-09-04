# App Playbook (golden track + `/app-idea`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One decided, ratcheting consumer-app doctrine page in the wiki plus an `/app-idea` skill that runs intake -> verdict and feeds owner overrides back into the doctrine.

**Architecture:** Doctrine = `~/wiki/playbook/apps.md` (rules with id + status + date, decision log). Verdict cards = `~/wiki/playbook/verdicts/*.md`. Skill = `skills/misc/app-idea/` in necmttn-skills (procedure only, no rules) with a bash lint that enforces the file contracts. Wiki writes go through the shell with `ALLOW_MAIN_WRITE=1`; never `git commit` in `~/wiki`.

**Tech Stack:** Markdown + YAML frontmatter, bash (BSD/macOS), `rg`, `grep -E`. No code runtime.

**Spec:** `docs/specs/2026-09-04-app-playbook-design.md` (same worktree).

## Global Constraints

- Wiki conventions from `~/wiki/SCHEMA.md` win: lowercase-hyphen names, frontmatter, >=2 `[[wikilinks]]` per page, bump `updated` on edit, add pages to `index.md`, append every action to `log.md`.
- NEVER `git commit` inside `~/wiki` (vault-sync owns commits). Commit only in the necmttn-skills worktree.
- Wiki writes: shell only (`tee`/heredoc), with `ALLOW_MAIN_WRITE=1` exported, because the write-guard hook blocks Write/Edit under `~/wiki`.
- Never edit `~/wiki/raw/**`. Never edit `~/Projects/apps/docs/playbooks/*`.
- Rule line format (exact): `- **P-01** [candidate 2026-09-04] Rule text. (provenance)`; ids `P-NN` product, `G-NN` growth, `A-NN` autonomy, `I-NN` idea gate; statuses `candidate|decided|verified|retired`.
- Decision-log line format (exact): `- 2026-09-04 | P-01 | candidate -> decided | reason | evidence`.
- Every seed rule enters as `candidate 2026-09-04` EXCEPT the autonomy boundary rules (`A-`), which enter as `decided 2026-08-01` (ratified in `apps/docs/playbooks/growth-ops.md` §4).
- Rule statuses do not change during dry runs.
- Worktree: `~/Projects/necmttn-skills/.claude/worktrees/app-playbook`, branch `spec/app-playbook`. All `git` via `git -C <worktree>`.

---

## File map

| Path | Responsibility |
| --- | --- |
| `~/wiki/SCHEMA.md` | add `playbook` + `verdict` page types, second-writer note |
| `~/wiki/playbook/apps.md` | the doctrine (rules, decision log, retired) |
| `~/wiki/playbook/verdicts/YYYY-MM-DD-<slug>.md` | one verdict card per run |
| `~/wiki/index.md`, `~/wiki/log.md` | catalog + action log |
| `<wt>/skills/misc/app-idea/SKILL.md` | the procedure (orient, intake, sweep, score, card, stop, feedback) |
| `<wt>/skills/misc/app-idea/templates/verdict-card.md` | card template |
| `<wt>/skills/misc/app-idea/scripts/check-playbook.sh` | lint for doctrine + cards |
| `<wt>/skills/misc/app-idea/tests/fixtures/{good,bad}/` | lint fixtures |
| `<wt>/skills/misc/app-idea/tests/run.sh` | runs lint against fixtures, exits non-zero on mismatch |

`<wt>` = the worktree path above.

---

### Task 1: SCHEMA.md gains the playbook contract

**Files:**
- Modify: `~/wiki/SCHEMA.md` (frontmatter `type:` line ~22, after "## Inbox and Feeds" section ~line 107-115)

**Interfaces:**
- Produces: page types `playbook` and `verdict`; the rule/log line formats every later task uses.

- [ ] **Step 1: Record the pre-state**

Run: `rg -n "type: entity \| concept" ~/wiki/SCHEMA.md; rg -c "" ~/wiki/SCHEMA.md`
Expected: one hit for the type line; a line count (note it).

- [ ] **Step 2: Apply the edit via python heredoc (Write/Edit are blocked under ~/wiki)**

```bash
export ALLOW_MAIN_WRITE=1
python3 - <<'EOF'
p='/Users/necmttn/wiki/SCHEMA.md'
s=open(p).read()
s=s.replace('type: entity | concept | comparison | query | summary',
            'type: entity | concept | comparison | query | summary | playbook | verdict',1)
s=s.rstrip('\n')+'''

## Playbook (golden track)

`playbook/apps.md` is the ONE decided consumer-app doctrine. Rules carry an id, a status, and a date:

- Rule line: `- **P-01** [candidate 2026-09-04] Rule text. (provenance)`
- Ids: `I-` idea gate, `P-` product, `G-` growth, `A-` autonomy. Ids are stable; never renumber.
- Status: `candidate` (from any source) -> `decided` (owner call) -> `verified` (measured in a shipped app). `retired` rules stay on the page, struck, with reason.
- Decision log line: `- YYYY-MM-DD | P-01 | candidate -> decided | reason | evidence`
- Only the owner moves a status. Ingest/harvest feeds add candidates only.

`playbook/verdicts/YYYY-MM-DD-<slug>.md` (`type: verdict`) is one intake->verdict card per app idea or existing-app audit, written by the `/app-idea` skill.

Writers: `/wiki-ingest` (all pages) and `/app-idea` (scoped to `playbook/**`, the Playbook section of `index.md`, and `log.md`). Both follow the orientation protocol above.
'''
open(p,'w').write(s+'\n')
EOF
```

- [ ] **Step 3: Verify**

Run: `rg -n "playbook \| verdict|^## Playbook \(golden track\)|/app-idea" ~/wiki/SCHEMA.md`
Expected: 3+ hits (type line, heading, writers line).

- [ ] **Step 4: Log it**

```bash
cat >> ~/wiki/log.md <<'EOF'

## [2026-09-04] schema | playbook + verdict page types
- Added `playbook` and `verdict` types, rule/log line formats, and `/app-idea` as second sanctioned writer scoped to `playbook/**`.
- Spec: necmttn-skills `docs/specs/2026-09-04-app-playbook-design.md`.
EOF
```

No git commit (wiki).

---

### Task 2: Lint script with fixtures (TDD)

**Files:**
- Create: `<wt>/skills/misc/app-idea/scripts/check-playbook.sh`
- Create: `<wt>/skills/misc/app-idea/tests/run.sh`
- Create: `<wt>/skills/misc/app-idea/tests/fixtures/good/playbook/apps.md`
- Create: `<wt>/skills/misc/app-idea/tests/fixtures/good/playbook/verdicts/2026-01-01-sample.md`
- Create: `<wt>/skills/misc/app-idea/tests/fixtures/bad/playbook/apps.md`
- Create: `<wt>/skills/misc/app-idea/tests/fixtures/bad/playbook/verdicts/2026-01-01-sample.md`

**Interfaces:**
- Produces: `check-playbook.sh <wiki-root>` -> exit 0 clean, exit 1 with one `FAIL <file>: <reason>` line per defect. Checks listed in Step 3.

- [ ] **Step 1: Write fixtures (good = minimal valid, bad = 4 defects)**

```bash
WT=~/Projects/necmttn-skills/.claude/worktrees/app-playbook/skills/misc/app-idea
mkdir -p $WT/tests/fixtures/good/playbook/verdicts $WT/tests/fixtures/bad/playbook/verdicts $WT/scripts
cat > $WT/tests/fixtures/good/playbook/apps.md <<'EOF'
---
title: Apps Playbook
created: 2026-01-01
updated: 2026-01-01
type: playbook
tags: [strategy, product, startup]
sources: [raw/articles/x.md]
---
# Apps Playbook

## How to read this page
Legend.

## Idea gate
- **I-01** [candidate 2026-01-01] One-sentence promise. (src)

## Product rules
- **P-01** [decided 2026-01-01] First value before paywall. ([[funnel-native-consumer-apps]])

## Growth rules
- **G-01** [candidate 2026-01-01] Verify attribution before spend. ([[mobile-subscription-attribution-pipelines]])

## Autonomy boundary
- **A-01** [decided 2026-01-01] Price changes need human go. (src)

## Decision log
- 2026-01-01 | P-01 | candidate -> decided | owner call | chat

## Retired
- **P-99** [retired 2026-01-01] ~~Old rule.~~ Reason: superseded by P-01.
EOF
cat > $WT/tests/fixtures/good/playbook/verdicts/2026-01-01-sample.md <<'EOF'
---
title: Verdict: Sample
created: 2026-01-01
updated: 2026-01-01
type: verdict
tags: [startup, product]
sources: []
kind: new
verdict: build
---
# Verdict: Sample

## One-liner
Sample.

## Receipts
- https://example.com

## Paying-intent bands
| Band | Est. |
| --- | --- |
| pay now | 5% |

## Scores
| Evidence | Monetization | Loop |
| --- | --- | --- |
| 4 | 4 | 3 |

## Verdict
build

## Kill criterion
Kill if X.

## Rules applied
- P-01 (decided)
- G-01 (candidate)

## Owner override
(empty)

Links: [[apps]] [[funnel-native-consumer-apps]]
EOF
# bad: duplicate id, bad status, card cites unknown rule, card missing heading
sed -e 's/\*\*G-01\*\* \[candidate/**P-01** [maybe/' $WT/tests/fixtures/good/playbook/apps.md > $WT/tests/fixtures/bad/playbook/apps.md
sed -e 's/- G-01 (candidate)/- Z-77 (candidate)/' -e '/^## Kill criterion/,+1d' $WT/tests/fixtures/good/playbook/verdicts/2026-01-01-sample.md > $WT/tests/fixtures/bad/playbook/verdicts/2026-01-01-sample.md
```

- [ ] **Step 2: Write the test runner**

```bash
cat > $WT/tests/run.sh <<'EOF'
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
EOF
chmod +x $WT/tests/run.sh
```

- [ ] **Step 3: Run to verify it fails (script missing)**

Run: `$WT/tests/run.sh`
Expected: non-zero, "No such file" for check-playbook.sh.

- [ ] **Step 4: Write the lint**

```bash
cat > $WT/scripts/check-playbook.sh <<'EOF'
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
grep -q '^updated: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}$' "$DOC" || fail "$DOC" "missing updated:"
for h in "## How to read this page" "## Idea gate" "## Product rules" "## Growth rules" "## Autonomy boundary" "## Decision log" "## Retired"; do
  grep -qF "$h" "$DOC" || fail "$DOC" "missing heading '$h'"
done
RULE_RE='^- \*\*[IPGA]-[0-9]{2}\*\* \[(candidate|decided|verified|retired) [0-9]{4}-[0-9]{2}-[0-9]{2}\] .+'
LOG_RE='^- [0-9]{4}-[0-9]{2}-[0-9]{2} \| [IPGA]-[0-9]{2} \| (candidate|decided|verified|retired) -> (candidate|decided|verified|retired) \| .+ \| .+$'
# rule lines: anything that starts "- **X-" must match RULE_RE
grep -nE '^- \*\*[A-Z]-' "$DOC" | while IFS= read -r line; do
  body="${line#*:}"
  echo "$body" | grep -qE "$RULE_RE" || echo "FAIL $DOC: bad rule line: $body"
done | tee /tmp/check-playbook.$$ ; grep -q FAIL /tmp/check-playbook.$$ && rc=1
ids="$(grep -oE '^- \*\*[IPGA]-[0-9]{2}\*\*' "$DOC" | tr -d '*- ')"
dups="$(echo "$ids" | sort | uniq -d)"
[ -z "$dups" ] || for d in $dups; do fail "$DOC" "duplicate id $d"; done
# decision log lines: between "## Decision log" and next "## "
awk '/^## Decision log/{f=1;next} /^## /{f=0} f' "$DOC" | grep -E '^- ' | while IFS= read -r l; do
  echo "$l" | grep -qE "$LOG_RE" || echo "FAIL $DOC: bad decision-log line: $l"
done | tee /tmp/check-playbook-log.$$ ; grep -q FAIL /tmp/check-playbook-log.$$ && rc=1
rm -f /tmp/check-playbook.$$ /tmp/check-playbook-log.$$

# verdict cards
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
EOF
chmod +x $WT/scripts/check-playbook.sh
```

- [ ] **Step 5: Run tests, expect OK**

Run: `$WT/tests/run.sh`
Expected: `OK`. If a `want` string is missing, fix the lint message text, not the test.

- [ ] **Step 6: Commit**

```bash
git -C ~/Projects/necmttn-skills/.claude/worktrees/app-playbook add skills/misc/app-idea/scripts skills/misc/app-idea/tests
git -C ~/Projects/necmttn-skills/.claude/worktrees/app-playbook commit -m "feat(app-idea): playbook lint + fixtures"
```

---

### Task 3: Seed the doctrine page

**Files:**
- Create: `~/wiki/playbook/apps.md`
- Modify: `~/wiki/index.md` (new `## Playbook` section after `## Queries`), `~/wiki/log.md`
- Read-only sources: `~/wiki/concepts/{funnel-native-consumer-apps,entitlements-are-product-architecture,mobile-subscription-attribution-pipelines,paying-intent-market-sizing}.md`, `~/Projects/apps/docs/playbooks/{growth-ops,paywall-experiments,growth-tricks}.md`, `~/Projects/apps/docs/knowledge/superwall/SYNTHESIS.md` (§1 headings 1.1-1.17), `~/wiki/queries/2026-08-28-app-ideas-from-knowledge-base.md`

**Interfaces:**
- Produces: rule ids I-01..I-07, P-01..P-1x, G-01..G-1x, A-01..A-05 that cards cite.

- [ ] **Step 1: Write the page (content below is the seed; keep under 200 lines)**

Rules to include, verbatim intent (write each as one rule line, provenance in parentheses as a `[[wikilink]]` or a repo path):

Idea gate (`I-`, all candidate 2026-09-04):
- I-01 The idea fits one sentence a stranger understands. No sentence, no verdict. (funnel-native-consumer-apps)
- I-02 Demand receipts required: competitor revenue, reviews, paid ads, creator content, App Store rank. Empty category = nobody cares until proven otherwise. (funnel-native-consumer-apps)
- I-03 Size the market by paying intent: prior 5% pay now / 15% after trial / 30% free-upsellable / 50% never; revenue market ~20%. (paying-intent-market-sizing)
- I-04 Name the free/paid line, price anchor, and who pays vs who uses before scoring monetization. (entitlements-are-product-architecture)
- I-05 Name the built-in distribution loop; a channel is not a loop. (queries/2026-08-28-app-ideas-from-knowledge-base)
- I-06 Name the hardest risk and one numeric kill criterion with a date. (queries/2026-08-28-app-ideas-from-knowledge-base)
- I-07 Score evidence, monetization, loop 0-5 each; novelty earns zero. (queries/2026-08-28-app-ideas-from-knowledge-base)

Product (`P-`, candidate 2026-09-04):
- P-01 First version = onboarding + monetization + core loop only. (funnel-native-consumer-apps)
- P-02 First value moment before the paywall where possible. (funnel-native-consumer-apps)
- P-03 Entitlements are roles, not one paid boolean; enforce server-side. (entitlements-are-product-architecture)
- P-04 Cover every paywall placement before A/B testing one. (apps/docs/playbooks/paywall-experiments.md §Core principles 1)
- P-05 Never copy a paywall one-to-one; re-derive for intent + demographics. (paywall-experiments.md §Core principles 2)
- P-06 Hard paywall right after onboarding out-earns explore-first. (superwall/SYNTHESIS.md §1.1)
- P-07 Trial anxiety, not value communication, is the binding constraint on trial starts. (SYNTHESIS §1.2)
- P-08 Longer onboarding beats shorter; only large jumps move the number. (SYNTHESIS §1.3)
- P-09 Transaction abandonment is the highest-leverage extra placement; discount only the annual. (SYNTHESIS §1.4)
- P-10 Annual preselected, few plans, no comparison table. (SYNTHESIS §1.5)
- P-11 Put the paywall at the peak of invested effort. (SYNTHESIS §1.14)
- P-12 Externalized concrete loss beats an abstract counter. (SYNTHESIS §1.16)
- P-13 Freemium only if the paid outcome stays compelling after the free feature; winback reconnects to the original outcome, not a discount. (funnel-native-consumer-apps 2026-09-04 section)
- P-14 Benchmarks: trial start <15% bad / 15%+ good; trial-to-paid <30% bad / 30%+ good; install-to-paid no-trial <4% bad. (paywall-experiments.md §Benchmarks)

Growth (`G-`, candidate 2026-09-04):
- G-01 Start distribution before App Store approval. (funnel-native-consumer-apps)
- G-02 Measure marketing by funnel progression, not views. (funnel-native-consumer-apps)
- G-03 Verify the attribution pipe end to end before scaling paid spend. (mobile-subscription-attribution-pipelines)
- G-04 Creator CAC = fee + coordination + revisions + rights + analytics + variance. (funnel-native-consumer-apps 2026-09-04 section)
- G-05 Views and conversions are decoupled; viewer intent decides, not CTA. (SYNTHESIS §1.6)
- G-06 Every video shows the product on screen; the wow moment must be filmable. (SYNTHESIS §1.7, §1.8)
- G-07 Select creators on comment engagement, never follower count. (SYNTHESIS §1.9)
- G-08 Base plus non-stacking milestone bonuses is the creator pay structure. (SYNTHESIS §1.10)
- G-09 Budget weeks to months of flat results before judging a channel. (SYNTHESIS §1.11)
- G-10 Copy a proven format; change only surface variables. (SYNTHESIS §1.12)
- G-11 Sell the outcome, not the mechanic. (SYNTHESIS §1.13)
- G-12 Widgets and OS surfaces are the top mobile-only re-entry lever. (SYNTHESIS §1.17)
- G-13 Diagnose the current funnel constraint before adding traffic; more traffic makes a leak more expensive. (funnel-native-consumer-apps 2026-09-04 section)
- G-14 Every experiment has a ledger file with a DECIDED line; no file = no experiment. (apps/docs/playbooks/growth-ops.md §1)

Autonomy (`A-`, decided 2026-08-01, provenance `apps/docs/playbooks/growth-ops.md §4`):
- A-01 Autonomous: experiment ledger files, offering/metadata prep, copy-string-only experiments, weekly reports, guardrail flags.
- A-02 Human go: price or product changes.
- A-03 Human go: flow-JSON KV publishes (100% blast radius).
- A-04 Human go: trial-length changes; stopping/shipping a winning arm.
- A-05 Human go: anything touching the hard-lock surface; every live experiment appears in the weekly report.

Page skeleton:

```bash
export ALLOW_MAIN_WRITE=1; mkdir -p ~/wiki/playbook/verdicts
cat > ~/wiki/playbook/apps.md <<'EOF'
---
title: Apps Playbook (golden track)
created: 2026-09-04
updated: 2026-09-04
type: playbook
tags: [strategy, product, startup, marketing, workflow]
sources: [raw/articles/2026-09-04-paying-intent-audience-split.md, raw/transcripts/2026-09-04-jake-castillo-scaling-consumer-app.md, raw/transcripts/2026-08-28-david-ch-mobile-app-playbook.md]
---
# Apps Playbook (golden track)

The ONE decided doctrine for consumer/AI apps. Run `/app-idea` to apply it. Tactical detail lives in `~/Projects/apps/docs/playbooks/`; concepts live in the linked wiki pages. This page holds decisions.

## How to read this page
Each rule: `- **ID** [status YYYY-MM-DD] text. (provenance)`.
Status: `candidate` (any source) -> `decided` (owner call) -> `verified` (measured in a shipped app) -> `retired` (struck, reason kept). Only the owner moves a status. Ids never change.

## Idea gate
<I- rules>

## Product rules
<P- rules>

## Growth rules
<G- rules>

## Autonomy boundary
<A- rules>

## Decision log
- 2026-08-01 | A-01 | candidate -> decided | growth-ops contract ratified | ~/Projects/apps/docs/playbooks/growth-ops.md
(one line each for A-02..A-05, same date/reason)

## Retired
(none yet)

## Related
- [[funnel-native-consumer-apps]] · [[entitlements-are-product-architecture]] · [[mobile-subscription-attribution-pipelines]] · [[paying-intent-market-sizing]] · [[2026-08-28-app-ideas-from-knowledge-base]]
EOF
```

Replace each `<X- rules>` placeholder with the rule lines listed above before saving (the placeholders exist only in this plan).

- [ ] **Step 2: Lint**

Run: `~/Projects/necmttn-skills/.claude/worktrees/app-playbook/skills/misc/app-idea/scripts/check-playbook.sh ~/wiki`
Expected: `OK /Users/necmttn/wiki`. Fix any FAIL line before continuing.

- [ ] **Step 3: Index + log**

```bash
python3 - <<'EOF'
p='/Users/necmttn/wiki/index.md'; s=open(p).read()
s=s.replace('Total pages: 80','Total pages: 81')
s=s.replace('## Queries','## Playbook\n- [[apps]] — The ONE decided consumer/AI-app doctrine: idea gate, product, growth, autonomy rules with candidate/decided/verified/retired status; verdict cards under playbook/verdicts/.\n\n## Queries',1)
open(p,'w').write(s)
EOF
cat >> ~/wiki/log.md <<'EOF'

## [2026-09-04] create | playbook/apps.md seeded
- Created: playbook/apps.md (7 idea-gate, 14 product, 14 growth candidates; 5 autonomy rules decided 2026-08-01 from growth-ops.md §4).
- Sources: 4 wiki concept pages, apps repo growth-ops/paywall-experiments/growth-tricks, Superwall SYNTHESIS §1, app-ideas query.
- Updated: index.md (new Playbook section).
EOF
```

- [ ] **Step 4: Verify index line resolves**

Run: `rg -n "^## Playbook|\[\[apps\]\]" ~/wiki/index.md && ls ~/wiki/playbook/apps.md`
Expected: both hits and the file.

No git commit (wiki).

---

### Task 4: Verdict template + SKILL.md + link

**Files:**
- Create: `<wt>/skills/misc/app-idea/templates/verdict-card.md`
- Create: `<wt>/skills/misc/app-idea/SKILL.md`
- Modify: `<wt>/skills/misc/README.md` (add one row/line for `app-idea`)
- Run: `<wt>/scripts/link-skills.sh` (from the MAIN checkout after merge; during the worktree phase, symlink manually)

**Interfaces:**
- Consumes: rule ids from Task 3; lint from Task 2.
- Produces: `/app-idea` skill, invocable; card template with the 8 required headings.

- [ ] **Step 1: Template (must pass lint when filled)**

```bash
WT=~/Projects/necmttn-skills/.claude/worktrees/app-playbook/skills/misc/app-idea
mkdir -p $WT/templates
cat > $WT/templates/verdict-card.md <<'EOF'
---
title: Verdict: {{TITLE}}
created: {{DATE}}
updated: {{DATE}}
type: verdict
tags: [startup, product, strategy]
sources: []
kind: {{new|existing}}
verdict: {{build|park|kill|keep|fix|sunset}}
run: {{normal|dry-run|audit}}
---
# Verdict: {{TITLE}}

## One-liner
{{One sentence a stranger understands. If this cannot be written, the run stops here.}}

## Receipts
{{One bullet per demand receipt. New idea: URL each. Existing app: repo path each (METRICS.md, docs/experiments/<app>/NNN-*.md, docs/reports/<app>/YYYY-WW.md). "none found" is a valid entry and forces park.}}

## Paying-intent bands
| Band | Prior | Estimate | Basis |
| --- | --- | --- | --- |
| pay now | 5% | | |
| pay after trial | 15% | | |
| free, upsellable | 30% | | |
| never | 50% | | |

## Scores
| Evidence | Monetization | Built-in loop | Total /15 |
| --- | --- | --- | --- |
| | | | |

## Verdict
{{build|park|kill or keep|fix|sunset}} — {{one sentence why}}

## Kill criterion
Kill if {{numeric condition}} by {{date}}.

## Rules applied
{{One bullet per rule id used, with its current status, e.g. `- P-02 (candidate) — applied as: ...`}}

## Owner override
(empty — owner edits here or says it in chat; the skill turns it into a decision-log line)

Links: [[apps]] {{>=1 more wikilink}}
EOF
```

- [ ] **Step 2: SKILL.md (invoke `writing-skills` conventions: frontmatter name/description/user-invocable; procedure only, no rules)**

```bash
cat > $WT/SKILL.md <<'EOF'
---
name: app-idea
description: Run a new or existing consumer/AI app idea through the golden-track playbook (~/wiki/playbook/apps.md) from intake to verdict, write a verdict card, stop for the owner, and ratchet owner overrides back into the doctrine. Use when the user shares an app idea, asks "should I build X", "audit <app>", "re-score <app>", or pastes an idea in a product context. Never builds; never promotes a rule on its own.
user-invocable: true
---

# /app-idea

Intake -> verdict for one app idea. The rules live in `~/wiki/playbook/apps.md`; this file holds the procedure only. If a rule you need is not on that page, apply it as `candidate` in the card and say so - do not add it here.

## 0. Guardrails
- Write under `~/wiki/playbook/**` and append to `~/wiki/log.md` via shell with `ALLOW_MAIN_WRITE=1` (the write-guard blocks Write/Edit under ~/wiki). Never `git commit` in ~/wiki.
- One card per run. Never overwrite an existing card; a re-score gets a new dated card that links the old one.
- Statuses move only on an explicit owner instruction (step 7). Dry runs (`run: dry-run`) never move a status.

## 1. Orient (always)
Read, in order: `~/wiki/playbook/apps.md`, `~/wiki/index.md`, `~/wiki/queries/2026-08-28-app-ideas-from-knowledge-base.md`, the last 20 lines of `~/wiki/log.md`.
Existing app: also read `~/Projects/apps/apps/<app>/docs/METRICS.md`, `~/Projects/apps/docs/experiments/<app>/`, `~/Projects/apps/docs/reports/<app>/` when they exist, and the wiki entity page if one exists.

## 2. Intake (gate I-01)
Restate the idea in one sentence a stranger understands. Cannot? Stop. Ask the owner for the sentence. Do not proceed on a paragraph.
Decide `kind`: `new` (no shipped app) or `existing` (an app dir or wiki entity exists).

## 3. Evidence sweep
- `new`: WebSearch for competitor revenue, App Store rank, reviews, paid ads, creator content. If `~/.cache/appllama/` exists, read cached app walks before spending credits (see `~/Projects/apps/docs/playbooks/appllama-research.md`). Every receipt = URL.
- `existing`: repo artifacts only. Every receipt = file path. No web.
- No receipts found -> the verdict is `park` and the card names the single receipt to go get.

## 4. Score
Apply every `I-` rule. Fill the four paying-intent bands with an estimate and a one-phrase basis. Score evidence / monetization / built-in loop 0-5. Name the hardest risk and one numeric, dated kill criterion. Cite each rule you leaned on by id with its current status.

## 5. Card
Copy `templates/verdict-card.md` (path relative to this skill) to `~/wiki/playbook/verdicts/YYYY-MM-DD-<slug>.md`, fill every `{{...}}`, set `run:` to `normal|dry-run|audit`. Then lint:
`<this-skill>/scripts/check-playbook.sh ~/wiki` must print `OK`. Fix before presenting.
Append to `~/wiki/log.md`: `## [DATE] app-idea | <slug> | <verdict>` + one line naming the card and the rule ids applied.

## 6. Stop
Show the card in chat (verdict, scores, kill criterion, rules applied). End the turn. Build starts only on an explicit go, via `~/Projects/apps/docs/playbooks/new-app.md`.

## 7. Feedback loop (owner-triggered only)
On an owner override (edited `## Owner override` block or a chat instruction):
- Score/verdict change: update the card's `updated:` and the field; note the override in the block.
- Rule promotion ("that rule is right" / "make P-02 decided"): append `- DATE | P-02 | candidate -> decided | <owner reason> | <card path>` to `## Decision log`, flip the rule line's status+date, bump `updated:`.
- Verified ("we measured it"): require a path to an experiment file with a DECIDED line or a report; flip to `verified` with that path as evidence.
- Retire: move the rule line to `## Retired`, strike the text with `~~`, add `Reason:`; log line `... -> retired`.
- Re-lint. Append a `log.md` line.

## Dry-run protocol
When asked to dry-run: set `run: dry-run`, complete steps 1-6, skip step 7 entirely.
EOF
```

- [ ] **Step 3: README row + manual link**

```bash
printf -- '- `app-idea` - golden-track intake->verdict for consumer/AI app ideas; writes verdict cards to ~/wiki/playbook/verdicts and ratchets owner overrides into ~/wiki/playbook/apps.md.\n' >> ~/Projects/necmttn-skills/.claude/worktrees/app-playbook/skills/misc/README.md
ln -sfn $WT ~/.claude/skills/app-idea
ls -l ~/.claude/skills/app-idea
```

Note: after the branch merges to main, re-run `scripts/link-skills.sh` so the link points at the main checkout, not the worktree.

- [ ] **Step 4: Verify skill is discoverable**

Run: `head -4 ~/.claude/skills/app-idea/SKILL.md && ls ~/.claude/skills/app-idea/templates ~/.claude/skills/app-idea/scripts`
Expected: frontmatter with `name: app-idea`; template and lint present.

- [ ] **Step 5: Commit**

```bash
git -C ~/Projects/necmttn-skills/.claude/worktrees/app-playbook add skills/misc/app-idea skills/misc/README.md
git -C ~/Projects/necmttn-skills/.claude/worktrees/app-playbook commit -m "feat(app-idea): skill procedure + verdict card template"
```

---

### Task 5: Four existing-app audit cards

**Files:**
- Create: `~/wiki/playbook/verdicts/2026-09-04-audit-ailifestory.md`, `...-audit-lockin-chinese.md`, `...-audit-dotself.md`, `...-audit-rove.md`
- Read-only: `~/Projects/apps/apps/lockin-chinese/docs/METRICS.md`, `~/Projects/apps/docs/experiments/`, `~/Projects/apps/apps/ailifestory/`, `~/Projects/apps/apps/dotself/`, `~/wiki/entities/{ailifestory,rove}.md`
- Modify: `~/wiki/log.md`

**Interfaces:**
- Consumes: SKILL.md procedure (Task 4) with `kind: existing`, `run: audit`.

- [ ] **Step 1: Run the skill procedure for each app, in this order: lockin-chinese (has METRICS.md), ailifestory, dotself, rove**

For each: steps 1-6 of SKILL.md. Receipts = repo paths / wiki entity pages only. Rove has no app dir: receipts come from `~/wiki/entities/rove.md` only; if that yields no demand receipt, verdict = `park` (not `sunset`) with the named receipt to get. Verdict vocabulary: `keep|fix|sunset` for apps with code; `park` allowed for rove.

- [ ] **Step 2: Lint all four**

Run: `~/.claude/skills/app-idea/scripts/check-playbook.sh ~/wiki`
Expected: `OK`.

- [ ] **Step 3: Log**

One `log.md` entry per card as SKILL.md step 5 prescribes (4 entries).

No git commit (wiki).

---

### Task 6: Three dry runs

**Files:**
- Create: `~/wiki/playbook/verdicts/2026-09-04-dryrun-strong-receipts.md`, `...-dryrun-no-receipts.md`, `...-dryrun-rescore-lockin-chinese.md`
- Modify: `~/wiki/log.md`

**Interfaces:**
- Consumes: SKILL.md dry-run protocol.

- [ ] **Step 1: Dry run 1 - strong receipts**

Idea: "Calorie tracking from a photo for people on GLP-1 medication" (a category with public competitor revenue: Cal AI is cited in `paywall-experiments.md`). `kind: new`, `run: dry-run`. Expected verdict: `build`. If the sweep returns `park`, record that honestly; do not force `build`.

- [ ] **Step 2: Dry run 2 - no receipts**

Idea: "An app that rates the vibe of a room from a photo." `kind: new`, `run: dry-run`. Expected: `park`, card names the one receipt to go get (e.g. "any App Store top-200 app in this category with >$10k/mo").

- [ ] **Step 3: Dry run 3 - existing app re-score**

`re-score lockin-chinese`. `kind: existing`, `run: dry-run`. Card links the Task-5 audit card. Expected: every receipt is a repo path; zero URLs in `## Receipts`.

Check: `rg -c "https?://" ~/wiki/playbook/verdicts/2026-09-04-dryrun-rescore-lockin-chinese.md` -> `0`.

- [ ] **Step 4: Lint + confirm no status moved**

Run: `~/.claude/skills/app-idea/scripts/check-playbook.sh ~/wiki && rg -c "\[(decided|verified|retired)" ~/wiki/playbook/apps.md`
Expected: `OK` and the count equals 5 (the A- rules only).

- [ ] **Step 5: Log** - three entries per SKILL.md step 5.

No git commit (wiki).

---

### Task 7: Close out

**Files:**
- Modify: `<wt>/docs/specs/2026-09-04-app-playbook-design.md` (status line -> "implemented 2026-09-04")
- Create: `~/.claude/projects/-Users-necmttn-Projects/memory/project_app-playbook.md` + one index line in `MEMORY.md`

- [ ] **Step 1: Full verification**

```bash
~/.claude/skills/app-idea/scripts/check-playbook.sh ~/wiki
~/Projects/necmttn-skills/.claude/worktrees/app-playbook/skills/misc/app-idea/tests/run.sh
ls ~/wiki/playbook/verdicts | wc -l   # expect 7
rg -n "^## Playbook" ~/wiki/index.md
tail -5 ~/wiki/log.md
```

- [ ] **Step 2: Spec status + commit**

```bash
sed -i '' 's/^Date: 2026-09-04. Status: approved in chat (3 sections), pending written review./Date: 2026-09-04. Status: approved; implemented 2026-09-04 (plan docs\/superpowers\/plans\/2026-09-04-app-playbook.md)./' ~/Projects/necmttn-skills/.claude/worktrees/app-playbook/docs/specs/2026-09-04-app-playbook-design.md
git -C ~/Projects/necmttn-skills/.claude/worktrees/app-playbook add docs
git -C ~/Projects/necmttn-skills/.claude/worktrees/app-playbook commit -m "docs(app-playbook): mark spec implemented"
```

- [ ] **Step 3: Memory note** - project memory: home paths, status semantics, "never promote without owner", the merge-then-relink step, and the three unresolved defaults from the spec.

- [ ] **Step 4: Hand off** - report: branch `spec/app-playbook` ready for PR; wiki changes uncommitted by design (vault-sync); 7 cards awaiting owner review; no rule promoted yet.

---

## Self-review

- Spec coverage: SCHEMA (T1), doctrine (T3), skill + template + write path (T4), audits (T5), dry runs (T6), index/log (T3-T6), out-of-scope honored (no build, no auto-promotion, no apps-repo playbook edits). Unresolved defaults: rule ids by section (adopted), dry-run cards kept (adopted, `run: dry-run`), override via block or chat (adopted in SKILL.md §7).
- Placeholders: `{{...}}` appear only inside the card template by design; `<X- rules>` in T3 is called out as plan-only.
- Consistency: lint heading names == template headings == SKILL.md §5; status vocabulary identical across SCHEMA, lint, page; id regex `[IPGA]-[0-9]{2}` everywhere.
