---
name: wrap-up
description: Close down a work session or agent pane cleanly - land or file everything of value (follow-up tickets for loose ends, concerns, debt), add human-verification items to a `uat`-labeled checklist issue (builds to verify, flows to smoke), then do safe-only housekeeping (pushed worktrees, own background processes, created sims) and report what was closed, filed, and kept. Use when a session's work is done and the user says "wrap up", "close this down", "can we close this", "clean up and land it", when a fleet run or chunk finishes, or before ending a long session that minted resources.
---

# Wrap-up - land it, file it, or surface it; nothing of value dies silently

One invocation closes down THIS session/pane. Scope law: touch only what this
session created or claimed - exact paths and ids, never pattern-matching over
shared namespaces (concurrent sessions share worktrees, sims, tabs).

## 1. Sweep - inventory the residue

Collect before acting (parallel where possible):

- **Work state**: uncommitted changes in every worktree this session touched
  (`git -C <wt> status --short`); unpushed branches (`git log @{u}..` or no
  upstream); open PRs from this session (`gh pr list --author @me` filtered to
  session branches) and their CI state.
- **Claims**: issues assigned as claims (wayfinder tickets, `fix-feedback`
  claims) - resolved, or still claimed with work unfinished?
- **Runtime residue**: background tasks/monitors started this session (dev
  servers, watchers - check /tasks), sim devices/runtimes created, settings
  toggled (sim defaults, env), scratchpad servers, temp files outside scratchpad.
- **Unshipped knowledge**: concerns noted mid-session, review findings deferred,
  "TODO later" utterances, REPORT.md concern sections, debt discovered but not
  fixed.

## 2. Land or file - follow-up tickets

For each loose end, in order of preference: finish it now (only if minutes, not
hours) > file a follow-up issue > surface in the report. File with
`gh issue create --label follow-up`, title prefixed by area (repo convention,
e.g. `fix(lockin):` / `chore(fleet):`), body carrying: what, why deferred,
pointers (PR/commit/session evidence, file:line). Concerns from a fleet chunk's
REPORT.md each get their own issue linked to the chunk's PR. Never close a
claimed ticket that isn't actually resolved - release the claim (unassign)
instead and say so in the report.

## 3. UAT checklist - queue human verification

Anything shipped this session that a human must verify on a real device/build
goes on a `uat`-labeled checklist issue, so the next ship has one list to walk:

- Find an OPEN issue labeled `uat` for the same app/scope (`gh issue list
  --label uat`). Append checkboxes to it; create `UAT: <app/scope>` only when
  none exists. One live UAT issue per scope - never duplicates.
- Items are verifiable checkboxes with context, not vibes:
  `- [ ] lockin build 84+: tap elements present in feedback events.json (fix #NNN)`
  `- [ ] dashboard session <url>: video plays + seeks from findings`
- Include: builds to install (TestFlight numbers), flows to smoke, regressions
  to confirm dead, device-only behaviors sims cannot prove.

## 4. Housekeep - safe-only, ledger-driven

Execute autonomously ONLY what is provably safe; surface the rest:

- Worktrees: remove when branch is pushed or merged (`git worktree remove` +
  delete local branch; remote branch survives as the artifact). NEVER remove
  with uncommitted or unpushed work - that is a report item, not a cleanup.
- Kill background processes/monitors this session started; free their ports.
- Sims: shutdown devices this session booted; delete devices it created only
  if trivially recreatable; restore toggled sim/system defaults to prior state.
- Scratch/temp: leave scratchpad alone (session-scoped anyway); delete stray
  temp files written outside it.
- In a fleet run, pane/tab teardown belongs to the fleet's resource ledger
  (`/fleet-ship`), not this skill - do not close panes you cannot prove you
  minted.

## 5. Report - closed / filed / kept

End with three short lists: **Closed** (cleaned up, with what), **Filed**
(issues created/appended, named links), **Kept** (left in place deliberately +
why - unpushed work, live servers, claims released). If everything landed and
nothing needed filing, say exactly that in one line.
