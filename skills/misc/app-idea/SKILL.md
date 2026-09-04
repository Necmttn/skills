---
name: app-idea
description: Run a new or existing consumer/AI app idea through the golden-track playbook (~/wiki/playbook/apps.md) from intake to verdict, write a verdict card, stop for the owner, and ratchet owner overrides back into the doctrine. Use when the user shares an app idea, asks "should I build X", "audit <app>", "re-score <app>", or pastes an idea in a product context. Never builds; never promotes a rule on its own.
user-invocable: true
---

# /app-idea

Intake -> verdict for one app idea. The rules live in `~/wiki/playbook/apps.md`; this file holds the procedure only. If a rule you need is not on that page, apply it as `candidate` in the card and say so. Do not add rules here.

## 0. Guardrails
- Write under `~/wiki/playbook/**` and append to `~/wiki/log.md` via shell (`cat > file <<'EOF'`) with `ALLOW_MAIN_WRITE=1` exported; the write-guard hook blocks Write/Edit under `~/wiki`. Never `git commit` in `~/wiki`.
- One card per run. Never overwrite an existing card. A re-score gets a new dated card that links the old one.
- Statuses move only on an explicit owner instruction (step 7). Dry runs (`run: dry-run`) never move a status.
- Never edit `~/wiki/raw/**` or `~/Projects/apps/docs/playbooks/*`.

## 1. Orient (always)
Read, in order: `~/wiki/playbook/apps.md`, `~/wiki/index.md`, `~/wiki/queries/2026-08-28-app-ideas-from-knowledge-base.md`, the last 20 lines of `~/wiki/log.md`.
Existing app: also read `~/Projects/apps/apps/<app>/docs/METRICS.md`, `~/Projects/apps/docs/experiments/<app>/`, `~/Projects/apps/docs/reports/<app>/` when they exist, and the wiki entity page if one exists.

## 2. Intake (gate I-01)
Restate the idea in one sentence a stranger understands. Cannot? Stop. Ask the owner for the sentence. Do not proceed on a paragraph.
Decide `kind`: `new` (no shipped app) or `existing` (an app dir under `~/Projects/apps/apps/` or a wiki entity page exists).

## 3. Evidence sweep
- `new`: WebSearch for competitor revenue, App Store rank, reviews, paid ads, creator content. If `~/.cache/appllama/` exists, read cached app walks before spending credits (see `~/Projects/apps/docs/playbooks/appllama-research.md`). Every receipt is a URL.
- `existing`: repo artifacts and wiki entity pages only. Every receipt is a file path. No web.
- No receipts found: the verdict is `park` and the card names the single receipt to go get.

## 4. Score
Apply every `I-` rule. Fill the four paying-intent bands with an estimate and a one-phrase basis. Score evidence / monetization / built-in loop 0-5. Name the hardest risk and one numeric, dated kill criterion. Cite each rule you leaned on by id with its current status.

## 5. Card
Copy `templates/verdict-card.md` (relative to this skill dir) to `~/wiki/playbook/verdicts/YYYY-MM-DD-<slug>.md`. Fill every `{{...}}`. Set `run:` to `normal|dry-run|audit`. Then lint:

```
<this-skill-dir>/scripts/check-playbook.sh ~/wiki
```

It must print `OK`. Fix before presenting.
Append to `~/wiki/log.md`: `## [DATE] app-idea | <slug> | <verdict>` plus one line naming the card path and the rule ids applied.

## 6. Stop
Show the card in chat: one-liner, verdict, scores, kill criterion, rules applied. End the turn. Build starts only on an explicit go, via `~/Projects/apps/docs/playbooks/new-app.md`.

## 7. Feedback loop (owner-triggered only)
On an owner override (an edited `## Owner override` block, or a chat instruction):
- Score or verdict change: update the card's `updated:` and the field; record the override in the block.
- Rule promotion ("that rule is right", "make P-02 decided"): append `- DATE | P-02 | candidate -> decided | <owner reason> | <card path>` under `## Decision log` in `apps.md`, flip the rule line's status and date, bump `updated:`.
- Verified ("we measured it"): require a path to an experiment file with a DECIDED line or a weekly report; flip to `verified` with that path as evidence.
- Retire: move the rule line under `## Retired`, strike the text with `~~`, add `Reason:`; log line `... -> retired`.
- Re-lint. Append a `log.md` line.

## Dry-run protocol
When asked to dry-run: set `run: dry-run`, complete steps 1-6, skip step 7 entirely.
