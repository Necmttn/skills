---
name: improve-loop
description: Burn surplus tokens into the backlog - a self-pacing loop that picks real tickets (follow-up issues, /improve plans, board cards), routes each to the cheapest engine that can ship it (codex/grok mechanical, fable/opus judgment), gates, and PRs until the budget or the backlog runs dry. Use when the user says "improve loop", "burn down the backlog", "I have extra tokens", "overnight improve", "+500k on the backlog", or "ship the follow-ups". Solo-session sibling of fleet-ship - no herdr panes; escalate to fleet-ship when many independent tickets are unblocked.
---

# Improve Loop - surplus tokens → merged PRs

One orchestrator (you, fable/opus), no panes. Each iteration ships ONE ticket end-to-end,
then re-checks budget and picks the next. The plan is the product; the executor is cheap.

## Sources (in order - first non-empty wins; user can name one)

1. **Follow-up issues:** `gh issue list --label follow-up --state open` - pre-scoped by fleet
   gates, already carry source chunk + suggested fix.
2. **Existing /improve plans:** `plans/README.md` (or `advisor-plans/`) with TODO status - run
   `improve reconcile` first so you don't build stale plans.
3. **Board cards:** the repo's kanban backlog column (apps repo: noktadev org project 2).
4. **Fresh audit (sources 1-3 empty):** `improve quick` → vet → plan top 3 by leverage → those
   become the queue. Never `deep` inside the loop - depth is a user decision.

Skip tickets that are: design-ambiguous (need the human - label them `needs-decision` and move
on), device-verify-only, or blocked-by. The loop ships what is shippable unattended.

## Per-ticket loop

1. **Scope** (you): read the ticket + cited code. Write a self-contained brief the weakest
   plausible executor can follow - exact files, current-state excerpt, repo conventions with an
   exemplar, machine-checkable done criteria, escape hatch ("if X, STOP and report"). The
   `improve` skill's plan template is the standard. One sentence scope pin: deliver what the
   ticket asks, nothing wider.
2. **Worktree:** `git worktree add .claude/worktrees/<ticket> -b fix/<ticket> origin/main` +
   the repo's install (fresh worktrees don't share node_modules).
3. **Route** (fleet-ship's lane table, solo form):
   - mechanical / clear-spec → `codex exec` in the worktree via Bash (self-contained prompt,
     name the test framework: "vitest, import from 'vitest', never bun:test"), or a
     `model:'sonnet', effort:'low'` Agent when codex is dry; grok CLI as the second lane when
     several tickets run in parallel.
   - judgment / user-facing (taste ≥ 7) / reactor-subtle → do it yourself or `model:'opus'`.
   - NEVER stack "double-check your work" on a frontier executor; concrete gates only.
4. **Gate** (you, never delegated): review the diff - cross-engine when codex/grok built it
   (fable reviews codex work; grok never reviews). Reviewer instruction: report EVERYTHING,
   you triage severity after. Then the repo's real gates from the worktree: typecheck 0,
   `bun run test:vitest` green, new tests actually load and run (a wrong-framework test file
   passes typecheck and runs 0 tests).
5. **Ship:** conventional commit → push branch → `gh pr create` "Fixes #<ticket>" (capture the
   printed PR URL, never hardcode a number) → merge per repo convention. UAT-relevant behavior
   → checkbox + PR link on the open `uat` issue (docs/playbooks/issue-labels.md contract).
6. **Housekeep:** remove the worktree, file any NEW concern the review surfaced as a
   `follow-up` issue (it becomes future loop fuel), one-line ledger append to the session notes.

## Pacing + stop conditions

- **Budget directive** ("+500k"): track spend; stop when remaining < ~60k (enough to finish,
  not start). No directive: iterate until the source list is empty or the user interrupts.
- **Unattended pacing:** `/loop` dynamic mode - after each ticket, ScheduleWakeup ~20-30 min
  (or immediately if a lane is idle and budget is fat).
- **Dry = done:** 2 consecutive picks yielding no shippable ticket → wrap up: report shipped
  PRs, filed follow-ups, skipped-with-reasons. Never pad the queue with invented work.
- **Escalate to fleet-ship** when ≥3 independent tickets are unblocked and the machine is free -
  panes parallelize what this loop serializes.
