---
name: fleet-ship
description: Orchestrate a fleet of herdr agent panes to ship a multi-chunk backlog in parallel - one labeled pane per chunk (own git worktree), engine-routed (mechanical→pigrok/codex, judgment+review→opus), each chunk plan→TDD→review→merge, tracked on a GitHub Project kanban, advanced by event-driven idle-waiters, dogfooded tracer-bullet after each merge. Use when the user wants to run many build tasks in parallel across herdr panes, act as orchestrator over claude/codex/pi agents, "ship the backlog", "orchestrate the fleet", keep an autonomous overnight build loop going, or fan out a wave-graph of chunks. Builds on herdr-agent-orchestration (low-level pane driving).
---

# Fleet Ship - parallel herdr orchestration

You are the **orchestrator** (run on opus). Panes do the building; you plan the waves, route engines,
gate reviews, merge, track on a kanban, and dogfood. This skill *composes* our normal ship workflow -
it just runs it across many parallel herdr panes instead of one session.

## Skills this composes (the chain - invoke these, don't reinvent)
- **Drive panes:** `herdr-agent-orchestration` (read FIRST - `agent list/read/send/wait`, `pane send-keys`, `agent start`).
- **Plan:** mechanical chunks → `superpowers:writing-plans` only. Design/ambiguous chunks in *autonomous*
  fleet mode → **parallel design-exploration** (`superpowers:dispatching-parallel-agents` / `design-an-interface`:
  N independent *lens* subagents → 1 synthesizer → an options doc + recommendation, **marked AWAITING-DECISION**).
  Interactive `superpowers:brainstorming` interviews the user - only run it when YOU/the user drive it live, never
  in an unattended pane. (Parallel-explore generates options; it does NOT replace the user's decision.)
- **Build:** `superpowers:subagent-driven-development` (runs `superpowers:test-driven-development` +
  `superpowers:using-git-worktrees` internally). **Seam discipline:** its `testing-anti-patterns.md` is the authority — mock only non-deterministic *leaves* (model/LLM, clock, net), NEVER the code path the test is named after.
- **Review:** `/review-all` = `simplify` + `/codex:review` + `/codex:adversarial-review`; plus
  `superpowers:requesting-code-review` / `superpowers:receiving-code-review` for the judgment on findings.
- **Finish:** `superpowers:verification-before-completion` (gates) → `superpowers:finishing-a-development-branch`
  (PR) → orchestrator merges → `commit` conventions.
- **Dogfood:** `dogfood` (+ `verify` / `run` to launch the app).

Opus panes invoke these directly. **pigrok/codex panes lack the Skill tool → bake the discipline
(plan-first, red→green TDD, gates) into their brief text.** The orchestrator (opus) always owns Review + Finish.

## Engine routing (default policy — USER-STEERABLE via ~/.ax/fleet-routing.json)
**At fleet start (and on any steering sentence), read `~/.ax/fleet-routing.json`** — the ax-idiom lane table
(`{lanes:[{id, match, engine, argv, enabled, reason, origin}]}`). It OVERRIDES the table below; the table is
the fallback when the file is absent/invalid. Route each chunk to the enabled lane whose `match` best fits;
skip `enabled:false` lanes. The user edits the file to re-route (e.g. flip judgment→fable) without touching
this skill; record which lane file version a run used in the ledger. Resolution order:
**user sentence override (ledger) > ~/.ax/fleet-routing.json > table below.**
| work class | engine | notes |
|---|---|---|
| mechanical (clear spec, schema/validator/wiring, 1-3 files) | **codex** `codex --dangerously-bypass-approvals-and-sandbox` | reads CLAUDE.md, cleanest fast lane (live evidence) |
| burst overflow only (codex lane saturated) | pigrok `pi --model xai-oauth/grok-4.3 --approve` | expect convention mop-ups (bun:test/catchAll) + credit risk; gate hard |
| judgment / reactor-subtle / security / design / UX | **opus** `claude --model opus --dangerously-skip-permissions` | always pin `--model` |
| review + gate + merge | orchestrator (opus) | never delegated |

**Steering:** the user can override routing at ANY time with one sentence ("route all mechanical to codex",
"no pigrok this run", "everything on opus tonight"). Apply it for the remainder of the run, write the active
override into the run ledger (so a resumed orchestrator keeps honoring it), and ask once whether to persist
it into this table as the new default.

## Setup (once)
1. A **backlog** with a wave-graph (chunks + deps + acceptance). None? build it with `superpowers:writing-plans`
   (after `superpowers:brainstorming` if the shape is unclear). Commit to main so every worktree pane reads it.
2. `herdr status` up. A **GitHub Project** board (`gh project create`) - see [REFERENCE.md](REFERENCE.md).
3. One **idle-waiter** background task per active pane (notification spine - REFERENCE).

## Per-chunk loop
1. **Map FIRST.** `herdr agent list` + `git worktree list`. Never spawn into an occupied worktree or
   duplicate work a user/agent already started. (Live lesson: this bit us.)
2. **Worktree** (`superpowers:using-git-worktrees`): `git worktree add .claude/worktrees/<chunk> -b feat/<chunk> origin/main`
   **then `bun install` (or the repo's install) in the new worktree** - fresh worktrees don't share the root
   `node_modules`, and a pane may skip install → `Cannot find module @workbench/*` gate failures that look
   like code bugs but aren't. Do it at the orchestrator before spawning, so the pane + your gates both resolve.
3. **Spawn, engine-routed + NAMED, into the FLEET TAB:** `herdr agent start <chunk-id> --cwd <worktree> --tab <fleet-tab-id> -- <engine argv>`
   — the agent NAME is the kanban chunk id. Placement hierarchy (once per fleet run, not per chunk):
   **workspace = the project/space** (existing, human-labeled) → **tab 1 = the human's interactive sessions
   (NEVER spawn there)** → **one fleet tab per run**: `herdr tab create --workspace <ws-id> --label "fleet:<epic>"
   --no-focus` (e.g. `fleet:define-view`), keep its `tab_id`, and spawn EVERY chunk pane with `--tab <tab_id>`.
   The human's sidebar then reads: space → `fleet:<epic>` tab → named chunk panes. `herdr tab rename` retrofits.
   Engine per the **Engine routing** table above (+ any active user steering override from the ledger).
   **ALWAYS pin `--model` explicitly** — a bare `claude` inherits the user's CURRENT default, which can change
   mid-fleet (live lesson: user switched their default mid-run and the next pane silently ran on it; caught
   only by reading the pane status line).
4. **Brief** (literal `agent send`, then a separate `pane send-keys Enter`): PLAN first
   (`superpowers:writing-plans`) → BUILD via `superpowers:subagent-driven-development` (TDD) → gates
   (`superpowers:verification-before-completion`: `bun run typecheck` 0, `verify:effect` 0, suites green) →
   **Run `git add -A && git commit` before STOP, then report; do NOT push/PR/merge** (an uncommitted worktree = UNFINISHED to the waiter; panes are inconsistent about self-committing). **Seam rule in every brief:** point the pane at `testing-anti-patterns.md`; a behavior-bearing chunk must assert the *observable effect at the real seam* (e.g. the repo's `e2e-*.test.ts` /rpc pattern — the goal actually appears), NOT that a mocked dispatch was called. Non-Claude panes: bake plan-first + red→green TDD into the brief.
5. **Arm waiter.** Background `herdr agent wait <name> --status idle` (re-arming) → re-invokes you on idle.
6. **Gate (you, opus).** On idle: read the pane → `/review-all` → **seam check** (the
   `superpowers:requesting-code-review` task-reviewer rubric already asks *"tests verify real behavior, not
   mocks?"* — enforce it; heuristic: *delete the mock — if the test still passes, it tests the mock, not the
   code*; a behavior-bearing chunk with only mocked-dispatch tests is NOT done → send back) →
   `superpowers:receiving-code-review` judgment → one fix subagent for Critical/Important →
   `superpowers:finishing-a-development-branch` → **squash-merge to main.**
7. **Track.** Move the kanban card Todo→In Progress→Done; attach the PR.
8. **Dogfood (tracer-bullet).** After a runtime-affecting merge, when test panes are quiescent, spawn an
   opus `dogfood` pane: run the app, exercise the chunk's new behavior + a core smoke, report → findings
   become **new kanban cards** linked to the chunk.
9. **Fan out.** Spawn the next wave's *independent* chunks in parallel; sequence shared-file/reactor chunks.

## Context hygiene (you, the orchestrator) - keep yourself clean + resumable
Your state lives in the **ledger + kanban + git**, NOT your context. So you survive compaction and a fresh
orchestrator can resume from those alone.
- **Per wake, re-derive from sources of truth** (`cat <ledger>`, `gh project item-list`, `git log`,
  `herdr agent list`) - do NOT trust memory.
- **Read pane *tails* only** (`agent read --lines 30`), never full transcripts. Never `cat` a subagent
  `.output` transcript into context.
- **Offload bulk to files:** diffs via `review-package`, pane reports + briefs as files, review verdicts
  returned terse. Read the *verdict*, not the diff.
- **Each wake is small + stateless:** read tail → gate (`/review-all`) → merge → move card → spawn next →
  append one ledger line → done. Don't accumulate; the board + ledger are the memory.
- Spawn the *building* on panes; keep heavy reading/searching in **subagents** (they return conclusions,
  not file dumps), so your window holds coordination only.

## Hard rules (live-dogfood lessons)
- **One agent per worktree.** Map before spawning. **Never interrupt a `working` pane;** clear prompt
  before `send`; submit is a separate `send-keys Enter`.
- **Name everything; report by name.** `agent start <chunk-id>` — the name IS the chunk id, unique per fleet
  (never generic like `codex`: detected labels are also targets → ambiguous). ALL `herdr agent *` commands
  (get/read/send/wait/rename/focus/attach) accept the NAME as target; address by name everywhere. Pane id is
  required ONLY for `herdr pane *` (send-keys/run/close) and `herdr wait output|agent-status` — resolve once:
  `herdr agent get <name> | jq -r .result.agent.pane_id`. REPORTING rule: to the human always say
  `<name> (<pane_id>)` — e.g. `dv-record-detail (wV:pC)` — never a bare pane id.
- **Three-level placement: workspace=space · tab=fleet run · pane=chunk.** The workspace is the human's
  project space — do NOT create one per chunk. Tab 1 of a workspace belongs to the human's interactive
  sessions — NEVER spawn fleet panes there or into whatever tab has focus. Create ONE `fleet:<epic>` tab per
  run (`herdr tab create --workspace <ws> --label "fleet:<epic>" --no-focus`) and spawn all chunk panes into
  it (`agent start ... --tab <tab_id>`); close or rename the tab (`fleet:<epic> ✓done`) when the run ends.
  **Retrofit/moves (dogfooded on a LIVE working codex pane — survives untouched):** `herdr pane move <pane_id>
  --tab <tab_id>` (existing tab) / `--new-tab --workspace <ws> --label TEXT` / `--new-workspace --label TEXT
  --tab-label TEXT` (creates workspace+tab+moves in one command; use `--no-focus`). CRITICAL: the pane_id
  CHANGES on move (wV:pC → w0:p1) but the agent NAME resolves seamlessly across it — one more reason waiters
  and every reference must target the NAME; any pane-id-addressed waiter dies silently on a move (re-arm by
  name).
- **Idle != done — and `done`, not `idle`, is how panes often END.** Codex chunks finish in status `done` (terminal); gate on `idle|done`, never `= idle` alone (else the waiter loops past a finished pane to TIMEOUT). `herdr agent wait --status idle` is LEVEL-triggered (returns instantly if already idle → no backpressure); herdr has no native turn-finished event. A pane can finish **gated-green but uncommitted** → gate on stable-idle AND (commit OR dirty tree); on idle+dirty the orchestrator commits the pane's work itself (`READY_UNCOMMITTED`). See REFERENCE 'Refinement 2'.
- **Idle != done (background-shell flap).** A pane reports idle/`done` while merely *holding on a background shell* (a test suite,
  a forked review). Gate on a REAL signal: a **commit beyond `origin/main`** + a final report/STOP - not bare
  idle. Make the waiter **commit-gated** (re-arm until a commit appears). Live lesson: a pane mid `+2292/-11510`
  with the suite running flapped `idle`→`working`, storming the naive idle-waiter.
- **Non-Claude panes miss repo conventions Claude Code auto-absorbs — point them at CLAUDE.md; the gate catches the rest.** Grok wrote
  `import from "bun:test"` + `toStartWith` in a vitest repo: **typecheck + verify:effect PASSED**, but the
  test file failed to load → 0 tests ran. So (a) name the repo's test framework + matcher set in the brief
  (e.g. "vitest, import from 'vitest', no bun:test/toStartWith"); (b) the orchestrator's gate must
  **actually run the new tests** - typecheck/verify alone pass over a non-loading or wrong-matcher test.
- **Green != correct — enforce SEAM discipline (define_view dogfood lesson).** A chunk shipped 31 green unit
  tests yet the feature hung in prod because they **mocked the dispatch (`CreateGoal`) — the behavior under
  test**; "green" meant "called the mock." The rules already existed (`testing-anti-patterns.md` + both review
  rubrics ask *"tests verify real behavior, not mocks?"*) — the miss was not wiring them into the fleet. So:
  (a) every brief names the seam rule + points at `testing-anti-patterns.md`; (b) the gate runs the seam check
  (delete-the-mock heuristic + task-reviewer rubric) and REJECTS behavior-bearing chunks whose tests mock their
  own dispatch; (c) such chunks carry a real-seam acceptance assertion (mock only non-deterministic leaves).
  UAT/dogfood is the backstop, not the primary catch.
- **Orchestrator gates the merge** - panes never auto-merge to main (checkpoint + avoid collisions).
- **Event-driven, not timed.** `herdr agent wait` background tasks are the notifier; `send_later`/
  `ScheduleWakeup` may be unavailable (no CCR session). If herdr can't track an engine's status, fall that
  chunk back to one it can (codex/claude). **Engines run out of credits/quota mid-run** (grok hit a
  `403: run out of credits`, pane frozen) - detect via a pane read, close the dead pane, and re-spawn the
  chunk on a fallback engine (grok→codex→opus) in the SAME already-installed worktree. Keep >1 lane funded.
- **Parallelize only within a wave where chunks don't share files.** **Verify "already done" claims**
  against current code before building (recent merges shift things).

See [REFERENCE.md](REFERENCE.md) for brief templates, kanban `gh` commands, the waiter script, engine flags.
