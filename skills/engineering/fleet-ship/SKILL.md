---
name: fleet-ship
description: Orchestrate a fleet of herdr agent panes to ship a multi-chunk backlog in parallel - one labeled pane per chunk (own git worktree), engine-routed (mechanical→codex/gpt-5.5+grok-4.5 twin lanes, judgment→fable-5, review→fable-5/opus-4.8), each chunk plan→TDD→cross-model-consensus-gate→merge, follow-up concerns filed as issues, tracked on a GitHub Project kanban, advanced by event-driven idle-waiters + a fleet-wide liveness monitor that catches stuck/errored/dead panes, dogfooded tracer-bullet after each merge. Use when the user wants to run many build tasks in parallel across herdr panes, act as orchestrator over claude/codex/pi agents, "ship the backlog", "orchestrate the fleet", keep an autonomous overnight build loop going, or fan out a wave-graph of chunks. Builds on herdr-agent-orchestration (low-level pane driving).
---

# Fleet Ship - parallel herdr orchestration

You are the **orchestrator** (run on fable-5 or opus-4.8). Panes do the building; you plan the waves, route engines,
gate reviews, merge, track on a kanban, and dogfood. This skill *composes* our normal ship workflow -
it just runs it across many parallel herdr panes instead of one session.

## Multi-orchestrator coordination (MANDATORY - several fleets run this repo concurrently)
The registry is **fleetboard** - a live board at `$FLEET_BOARD_URL` (default `http://localhost:7777`,
server + CLI in `~/Projects/fleetboard`; VPS fleets set FLEET_BOARD_URL to the Mac's tailscale addr).
Drive it with `bun ~/Projects/fleetboard/fleetctl.ts <register|heartbeat|claim|release|attn|deregister>`
- claim returns exit 1 + holder when a resource is taken. Heartbeat each orchestrator wake. If the
board is unreachable, fall back to `docs/superpowers/fleet-runs/ACTIVE.md` in the target repo.
Live lessons that forced this: a fleet rebased main under another fleet's staged merge; three merges
landed vitest-breaking test files; a port cleanup killed a sibling fleet's dev servers and a native
build mid-compile.
1. **Register on run start** (epic, status), **deregister on run end**, heartbeat between.
2. **Claims are exclusive**: `main-merge` (only the holder merges/rebases main - others queue their
   gated branches and note them in the registry), `sim:<udid>` (boot a SEPARATE simulator per fleet -
   `xcrun simctl list devices available` then `boot`; never install/launch on a claimed sim),
   `ports:<app>` (better: run dev stacks from YOUR worktree so `scripts/worktree-ports.sh` +
   portless auto-offset - then no port claim is needed), `neon:<project>` (dev-DB migrations).
3. **Before killing anything shared** (kill-port-listeners, `just * kill`, pkill, sim uninstall):
   check the registry; if another fleet holds the claim, work around it or queue.
4. **Shared merge gate**: `bun run test:vitest` from the repo root must be green before ANY merge to
   main, whatever the fleet's own runner is (bun-runner-only gates shipped broken files three times).
5. **The bell - single attention surface**: when blocked on a human decision or a must-see finding,
   `fleetctl attn <fleet-id> "<one-line ask>"` (shows on the board + ntfy phone push) - plus
   PushNotification when running on the user's Mac. Never ring for routine progress; the user watches
   the board's attention list as the only inbox and expects silence otherwise. Poll `/state` for the
   user's typed answer on your item after ringing.
6. **Name your orchestrator pane/tab** (`herdr tab create --label "orchestrator:<epic>"`) so
   `herdr agent list` yields a truthful census.

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

Claude panes (fable/opus/sonnet) invoke these directly. **pigrok/codex panes lack the Skill tool → bake the discipline
(plan-first, red→green TDD, gates) into their brief text.** The orchestrator (fable/opus) always owns Review + Finish.

## Model axes (rankings, higher = better; cost = what the user actually pays, not list price)
Intelligence = how hard a problem the model handles unsupervised. Taste = UI/UX, code quality, API design, copy.
| model | cost | intelligence | taste | how to run |
|---|---|---|---|---|
| gpt-5.5 | 9 | 8 | 5 | Codex CLI ONLY - `codex exec` / `codex review` (`~/.codex/config.toml` defaults to gpt-5.5); herdr pane = codex argv below |
| grok-4.5 | 8 | 7 | 4 | grok CLI - `grok --always-approve` (`-m` to pin model); second mechanical lane, peer of codex (2026-07-10) |
| sonnet-5 | 5 | 5 | 7 | `claude --model sonnet` / Agent `model:'sonnet'` |
| opus-4.8 | 4 | 7 | 8 | `claude --model opus` / Agent `model:'opus'` |
| fable-5 | 2 | 9 | 9 | `claude --model fable` / Agent `model:'fable'` |

**How to apply (defaults, NOT limits):**
- **Standing permission to escalate:** cheaper model's output doesn't meet the bar / fails the gate ->
  re-run or re-spawn the chunk on a smarter model in the SAME worktree, without asking. Judge the output,
  not the price tag. Escalating costs less than shipping mediocre work.
- **Cost is a tie-breaker only.** Anything that ships: **intelligence > taste > cost**.
- **Bulk/mechanical** (clear-spec implementation, data analysis, migrations) -> gpt-5.5, effectively free.
- **User-facing** (UI, copy, API design) needs **taste >= 7** -> sonnet-5/opus-4.8/fable-5, never gpt-5.5 solo.
- **Reviews of plans/implementations** -> fable-5 or opus-4.8, optionally gpt-5.5 (`codex review`) as an
  extra independent perspective (`/review-all` already includes it).
- **NEVER use Haiku.**
- **gpt-5.5 inside subagents/Workflows** (the `model` param takes Claude models only): thin Claude wrapper
  agent `model:'sonnet', effort:'low'` whose prompt writes a self-contained codex prompt, runs `codex exec`
  via Bash, and returns the result; investigation/data-analysis -> `codex exec -s read-only` with a
  self-contained prompt. In herdr panes skip the wrapper - spawn the codex CLI directly.

## Engine routing (default policy — USER-STEERABLE via ~/.ax/fleet-routing.json)
**At fleet start (and on any steering sentence), read `~/.ax/fleet-routing.json`** — the ax-idiom lane table
(`{lanes:[{id, match, engine, argv, enabled, reason, origin}]}`). It OVERRIDES the table below; the table is
the fallback when the file is absent/invalid. Route each chunk to the enabled lane whose `match` best fits;
skip `enabled:false` lanes. The user edits the file to re-route (e.g. flip judgment→opus) without touching
this skill; record which lane file version a run used in the ledger. Resolution order:
**user sentence override (ledger) > ~/.ax/fleet-routing.json > table below.**
| work class | engine | notes |
|---|---|---|
| mechanical (clear spec, schema/validator/wiring, 1-3 files, migrations, data analysis) | **codex / gpt-5.5** `codex --dangerously-bypass-approvals-and-sandbox` **AND grok-4.5** `grok --always-approve` - TWO peer lanes; route each unblocked mechanical chunk to whichever has free capacity, run both in parallel when several chunks are unblocked | codex: effectively free, reads CLAUDE.md. grok: same brief discipline (no Skill tool - spell it out); escalation ladder grok/codex → fable/opus in the SAME worktree. Keep >1 lane funded |
| burst overflow only (both mechanical lanes saturated) | pigrok `pi --model xai-oauth/grok-4.3 --approve` | expect convention mop-ups (bun:test/catchAll) + credit risk; gate hard |
| judgment / reactor-subtle / security / hard-unsupervised | **fable-5** `claude --model fable --dangerously-skip-permissions` (fallback opus-4.8) | int 9; always pin `--model` |
| user-facing: UI / copy / API design | **fable-5 or opus-4.8** (taste ≥ 7) | never gpt-5.5 solo (taste 5); sonnet-5 acceptable floor |
| review + gate + merge | orchestrator (fable-5 or opus-4.8) + `codex review` as extra independent perspective | never delegated |

**Steering:** the user can override routing at ANY time with one sentence ("route all mechanical to codex",
"no pigrok this run", "everything on opus tonight"). Apply it for the remainder of the run, write the active
override into the run ledger (so a resumed orchestrator keeps honoring it), and ask once whether to persist
it into this table as the new default.

## Setup (once)
1. A **backlog** with a wave-graph (chunks + deps + acceptance). None? build it with `superpowers:writing-plans`
   (after `superpowers:brainstorming` if the shape is unclear). Commit to main so every worktree pane reads it.
2. `herdr status` up. A **GitHub Project** board (`gh project create`) - see [REFERENCE.md](REFERENCE.md).
3. Two notification spines (REFERENCE): one **idle-waiter** background task per active pane (catches *done*)
   AND one fleet-wide **liveness monitor** loop (catches *stuck/errored/dead*). Start the monitor when the
   first pane spawns; keep it running the whole fleet.

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
   **Tab hygiene (live lesson - user caught both):** (a) `herdr tab list --workspace <ws>` BEFORE creating -
   reuse an existing `fleet:<epic>` tab instead of minting a duplicate; (b) `tab create` ships an empty root
   SHELL pane (`result.root_pane` in the create response) - after the first chunk pane spawns into the tab,
   `herdr pane close <root_pane_id>`, and sweep with `herdr pane list --workspace <ws>` (no stray `shell`
   panes in fleet tabs). Note a tab dies with its last pane - re-check `tab list` before reusing a stored id.
   Engine per the **Engine routing** table above (+ any active user steering override from the ledger).
   **ALWAYS pin `--model` explicitly** — a bare `claude` inherits the user's CURRENT default, which can change
   mid-fleet (live lesson: user switched their default mid-run and the next pane silently ran on it; caught
   only by reading the pane status line).
4. **Brief** (literal `agent send`, then a separate `pane send-keys Enter`). A brief = **CONTEXT section
   (varies per chunk: spec/bug/repro/files/constraints — write it as richly as you like) + DISCIPLINE BLOCK
   (fixed — copy it VERBATIM from REFERENCE.md, never freehand it)**. The block carries the whole chain:
   PLAN first (`superpowers:writing-plans`) → BUILD via `superpowers:subagent-driven-development` (TDD) →
   seam rule (point at `testing-anti-patterns.md`; a behavior-bearing chunk asserts the *observable effect
   at the real seam*, e.g. the repo's `e2e-*.test.ts` /rpc pattern — the goal actually appears — NOT that a
   mocked dispatch was called) → gates (`superpowers:verification-before-completion`: `bun run typecheck` 0,
   `verify:effect` 0, suites green) → **`git add -A && git commit` before STOP, then report; do NOT
   push/PR/merge** (uncommitted worktree = UNFINISHED to the waiter). Claude panes get the skill NAMES (they
   have the Skill tool); codex/pi panes get the non-Claude variant with the discipline spelled out as text.
   **Live lesson (2026-07-02): a freehanded bug-fix brief had excellent context + a TDD sentence but never
   told the pane to plan or use subagent-driven development — rich context is NOT the discipline; ANY chunk
   shape (build, bug fix, refactor, spike) ends with the verbatim block.**
<<<<<<< HEAD
5. **Arm waiter + monitor.** Background `herdr agent wait <name> --status idle` (re-arming) → re-invokes you on
   idle; AND ensure the fleet **liveness monitor** loop is running (it sweeps this pane for stuck/errored/dead).
6. **Gate (you, fable/opus): CROSS-MODEL CONSENSUS (2026-07-10, user rule).** On idle, read the pane, then three passes before your judgment:
   a. **Cross-engine review:** the chunk's diff is reviewed by the OTHER mechanical engine (codex-built chunk → grok review; grok-built → `codex review`). Reviewer gets plan section + diff; hunts correctness bugs + plan deviations. **An engine NEVER reviews its own work; a chunk NEVER self-approves.**
   b. **Reuse/simplicity pass** on the same diff (either engine or fable): hand-rolled code that a shared package / the repo's package index already owns = must-fix; needless complexity = should-fix.
   c. `/review-all` → **seam check** (the
   `superpowers:requesting-code-review` task-reviewer rubric already asks *"tests verify real behavior, not
   mocks?"* — enforce it; heuristic: *delete the mock — if the test still passes, it tests the mock, not the
   code*; a behavior-bearing chunk with only mocked-dispatch tests is NOT done → send back) →
   `superpowers:receiving-code-review` judgment → one fix subagent for Critical/Important →
   `superpowers:finishing-a-development-branch`.
   **Merge gate = consensus:** merge only when the cross-engine reviewer has zero unresolved must-fix AND the
   reuse pass is clean-or-fixed AND your judgment review passes. Builder-vs-reviewer disagreement → fable/opus
   tiebreak, never a coin flip. Then **squash-merge to main.**
7. **Track + housekeep + FILE FOLLOW-UPS (2026-07-10, user rule).** Move the kanban card Todo→In Progress→Done; attach the PR. **Follow-up capture:** any concern a builder/reviewer/roaster raised that is NOT resolved within the chunk (fragile spot, "fix later", out-of-scope bug, deferred improvement) → file a repo issue labeled `follow-up` (title `[follow-up][<area>] <gist>`; body: source chunk, agent, what+why+suggested fix, severity) AT TRIAGE TIME, not batched, and link it from the card + run archive. Sweeps: at every /review-all checkpoint scan recent chunk reports for un-filed concerns; before each final PR do a full-run sweep and list all follow-ups in the PR body under "Deferred concerns". Then **archive-then-close** the pane (see Housekeeping — NEVER close before archiving).
8. **Dogfood (tracer-bullet).** After a runtime-affecting merge, when test panes are quiescent, spawn a
   fable/opus `dogfood` pane: run the app, exercise the chunk's new behavior + a core smoke, report → findings
   become **new kanban cards** linked to the chunk.
9. **Fan out.** Spawn the next wave's *independent* chunks in parallel; sequence shared-file/reactor chunks.

## Liveness monitor - the SECOND spine (waiters catch *done*; the monitor catches *stuck/errored/dead*)
The idle-waiter only fires on `idle|done`. A pane that **errors** (network drop, `403 out of credits`, crash,
connection-refused, rate-limit, model API 5xx), **freezes** mid-`working`, or flickers to `unknown` NEVER
reaches idle → its waiter blocks to a **silent ~30-40 min TIMEOUT** and the chunk stalls invisibly while you
think it's building. Waiters alone are blind to this - so run ONE wall-clock monitor loop for the WHOLE fleet,
in parallel with the per-pane waiters. It RINGS; it does not auto-kill (classify via tail first - never kill a
genuinely-`working` pane).
1. **Sweep every ~2 min** (`run_in_background`, re-arming): `herdr agent list` → for each active fleet pane
   snapshot `{status, output-tail hash, commits-beyond-main, dirty}` and diff vs the last snapshot in a state
   file (survives orchestrator compaction - the monitor is stateless per wake, like the waiters).
2. **ERRORED** - tail matches an error signature (list in REFERENCE monitor script) → ring immediately
   (`fleetctl attn <fleet-id> "<pane> errored: <line>"` + PushNotification on the user's Mac); don't wait out K sweeps.
3. **STUCK** - status + output-hash + commit-count ALL unchanged for K sweeps (~6-10 min) while status ∉
   `{idle,done}` → ring. Read the tail to classify: real long compile/suite (re-arm, leave it) vs frozen
   (recover). A pane legitimately on a background shell shows *changing* output/logs - a frozen one is inert.
4. **DEAD/gone** - pane vanished from `agent list` (crashed / user closed) but its chunk isn't merged → ring +
   re-spawn on the fallback engine in the SAME already-installed worktree.
5. **Recover a caught pane** via the Hard-rules credits/frozen path: close the dead pane → re-spawn
   grok→codex→fable/opus (ascending intelligence) in the same worktree → re-arm BOTH its waiter and the monitor.
6. **Distinct from the idle-waiter, not a replacement.** Waiter = "did it finish?" (git-state gate). Monitor =
   "is it still alive + progressing?" (liveness gate). Both run per active pane; a chunk is advanced only by the
   waiter's DONE/READY, rescued only by the monitor's STUCK/ERRORED/DEAD. See REFERENCE 'Liveness monitor'.

## Housekeeping — close done panes, KEEP their results (restorable)
A pane's scrollback/result is LOST on `herdr pane close` (herdr has no transcript export; only the *session* persists, and even that is not guaranteed re-attachable after close). So **capture before you close**, into a git-tracked run archive — the durable, restorable record of what each agent actually did.

Per chunk, right after merge (step 7), BEFORE closing:
1. **Capture the pane's final report:** `herdr agent read <name> --source recent --lines 400` → the report text (files, commit, test summary, concerns).
2. **Append to the run archive** (git-tracked → permanent, greppable, travels with the code): `docs/superpowers/fleet-runs/<epic>.md`, one section per chunk: `## <chunk-id>` + PR# + merge commit + gate verdict + test summary + the captured report + concerns. Commit it (part of the merge or a follow-up housekeeping commit). Link it on the kanban card.
3. **THEN teardown:** `herdr pane close <pane_id>` (resolve id from the name) → `git worktree remove` → `git branch -D`. Last chunk of the run: `herdr tab rename <fleet-tab> "fleet:<epic> ✓done"` (or close it).
4. **Restore** later: read `docs/superpowers/fleet-runs/<epic>.md` (the authority), or `herdr session attach <name>` for a live re-entry WHILE the session still persists.
Do NOT let done panes pile up (they clutter the fleet tab + hold worktrees) — but never trade the result for the cleanup.

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
- **Never close a pane before archiving its result.** `close` is where the transcript dies (no herdr export; session-attach not guaranteed post-close). Capture `agent read --source recent` → the git-tracked run archive (`docs/superpowers/fleet-runs/<epic>.md`) FIRST, then close. The archive — not the live pane — is the restorable record.
- **Housekeep ONLY worktrees THIS run created — never pattern-match names.** Track each worktree you `git worktree add` (by exact path) and remove only those. A broad `grep`/regex over `git worktree list` WILL catch other sessions' parked branches (live lesson: a cleanup regex removed byo-cloudflare/channels/fix-* worktrees from prior streams). Committed work survives on the branch (recreate with `git worktree add <path> <branch>`), but **uncommitted edits in someone's idle worktree are lost**. Before removing ANY worktree you didn't just create: confirm no live agent is cwd'd there AND it has no uncommitted changes (`git -C <wt> status --porcelain`).
- **Orchestrator gates the merge** - panes never auto-merge to main (checkpoint + avoid collisions).
- **Never brief `git add -A` while worktree-root scratch exists (live lesson - BRIEF.md/REPORT.md shipped to main twice).** Pane briefs and reports live at the worktree root; `add -A` commits them, the squash-merge lands them on main, and every later worktree "inherits" a stale brief. Fix: gitignore the scratch names (`/BRIEF.md`, `/REPORT.md`) in the repo once, AND write briefs with explicit `git add <paths>` or `git add -A ':!BRIEF.md' ':!REPORT.md'`. Gate check: the review diff must not contain the brief/report files.
- **Event-driven, not timed.** `herdr agent wait` background tasks are the notifier; `send_later`/
  `ScheduleWakeup` may be unavailable (no CCR session). If herdr can't track an engine's status, fall that
  chunk back to one it can (codex/claude). **Engines run out of credits/quota mid-run** (grok hit a
  `403: run out of credits`, pane frozen) - detect via a pane read, close the dead pane, and re-spawn the
  chunk on a fallback engine (grok→codex→fable/opus, ascending intelligence) in the SAME already-installed worktree. Keep >1 lane funded.
  **The idle-waiter will NOT catch a frozen/errored pane** (it never goes idle) - the **liveness monitor** (above) is the
  proactive spine that catches it. Always run BOTH per active pane: the git-state waiter for *done*, the monitor for *stuck/errored/dead*.
- **Parallelize only within a wave where chunks don't share files.** **Verify "already done" claims**
  against current code before building (recent merges shift things).

See [REFERENCE.md](REFERENCE.md) for brief templates, kanban `gh` commands, the waiter script, engine flags.
