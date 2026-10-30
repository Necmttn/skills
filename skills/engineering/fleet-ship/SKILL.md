---
name: fleet-ship
description: Orchestrate parallel implementation across herdr panes for a backlog with independent chunks. Use when the user asks to ship multiple tasks as a fleet or run an unattended multi-agent build.
---

# Fleet Ship - parallel herdr orchestration

Before setup, assignment, completion, rotation, or teardown, read [Durable task
delivery](../herdr-agent-orchestration/references/durable-delivery.md).
Workers own commits, branch publication, draft PR upkeep, and recovery records. You (the **orchestrator**, on
Opus 5.5 or Fable 5.1) plan waves, route engines, enforce cross-engine review and repo gates, merge under claim,
track kanban + run map, and trigger dogfooding.

On-demand references (load only when needed):
- [`fleet-routing.json`](fleet-routing.json) (symlinked at `~/.ax/fleet-routing.json`): live lane routing table.
- [`REFERENCE.md`](REFERENCE.md): engine launch protocols, verbatim brief discipline blocks, waiter/monitor
  scripts, archive/teardown/ledger/kanban recipes, and rotation handoff schema.
- [`references/multi-machine.md`](references/multi-machine.md): multi-machine placement, stewards, tandem
  co-orchestrator, and dead-pane rescue.

## Composed skills (invoke, do not reinvent)
- **Drive panes:** `herdr-agent-orchestration` (`agent list/get/read/prompt/wait`, `pane split/rename/close`,
  `tab create/list/rename`).
- **Plan:** wave, architecture, design, and implementation plans route to the `design-plan` lane (`gpt-6-astra`
  `high`); inside an assigned Claude build pane, `superpowers:writing-plans` handles its short per-chunk task
  decomposition. Ambiguous design chunks in unattended mode use parallel design-exploration
  (`superpowers:dispatching-parallel-agents` / `design-an-interface`) producing options marked
  **`AWAITING-DECISION`** (`✋` + bell; never run interactive `superpowers:brainstorming` unattended, and never
  decide the human's side).
- **Build:** `superpowers:subagent-driven-development` (TDD + git worktrees). **Seam rule
  (`testing-anti-patterns.md`):** mock only non-deterministic leaves (LLM, clock, network), never the code path
  under test.
- **Review & finish:** cross-engine tandem review (`review` / `review-hard` lane) + `/review-all` +
  `superpowers:receiving-code-review` → concrete repo gates → `superpowers:finishing-a-development-branch`.
  (`superpowers:verification-before-completion` is retired; name concrete gate commands, never stack
  "double-check your work" ceremony on frontier panes.)
- **Subagent dispatch (`efficient-dispatch`):** classify every `Agent` call so mechanical work never inherits
  the orchestrator model: pure locate/search → `model:'haiku'`; mechanical implementer/fix/Codex-exec wrapper →
  `model:'sonnet', effort:'low'`; judgment/review → explicit frontier model. **Never use Haiku for panes,
  builds, or any review/judgment.**
- **Dogfood & closure:** `dogfood` after runtime merges; `wrap-up` after `fleet teardown`.

Claude panes invoke installed skills directly after a per-machine skill probe (`REFERENCE.md` § *Pane Briefs*);
Codex and Antigravity (`agy`) panes lack Claude's `Skill` tool and receive the inline non-Claude discipline
block.

## Model & engine routing
Read `~/.ax/fleet-routing.json` (or [`fleet-routing.json`](fleet-routing.json)) at fleet start and on any
steering sentence, and log its version via `fleet.policy.set`. Resolution order: **user sentence override (in
ledger) > `fleet-routing.json` > table below**. Epic `graph.json` `lane` (`mechanical | judgment | design |
design-plan | copy | computer-use`) is a coarse class resolved to a concrete `fleet-routing.json` lane via
`match` (legacy `design` maps to `judgment` + `hold:human` for UI/API builds, `copy` for prose, or `design-plan`
for specs). Interactive shell shortcuts are `xx` (`codex --yolo`), `cc` (`claude
--dangerously-skip-permissions`), and `aa` (`agy --dangerously-skip-permissions`); `herdr agent start --kind
<codex|claude|agy> --pane <id> -- <flags>` invokes the binary directly, so pass expanded flags after `--`.

| Lane | Engine / Model | Effort & why | Match |
|---|---|---|---|
| `review` | Cross-engine: `agy` `gemini-4-argon-medium` → `codex` `gpt-6-astra` / `claude` `claude-opus-5-5` | `medium`: frontier review quality on routine diffs/plans/copy without `high` latency or quota burn | Required cross-engine tandem review of routine diffs, plans, reports, and copy |
| `review-hard` | Cross-engine: `agy` `gemini-4-argon-high` → `gpt-6-astra` (`high`) / `claude-fable-5-1` (`medium`) / `claude-opus-5-5` (`high`) | `high` (`medium` on Fable 5.1): deeper reasoning for subtle concurrency, security, specs, or tiebreaks | Reactor-subtle, security-critical, architecture specs, `hold:human`, disputed tiebreaks |
| `design-plan` | `codex` `gpt-6-astra` | `high`: plan boundaries govern the whole wave; never substitute Opus/Fable without owner instruction | Design plans, implementation plans, wave/architecture planning, spec authoring |
| `copy` / `copy-high` | `agy` `gemini-4-argon-medium` (`copy-high`: `gemini-4-argon-high`) | `medium` default (Argon's human voice comes from base taste, not long thinking); `high` only for high-stakes launch/positioning/sensitive comms | Copywriting, UX writing, store/marketing copy, release notes, outreach, tone-sensitive reports |
| `computer-use` | `codex` `gpt-6.1-terra` | `medium`: tracks multi-step UI state + repro without burning `high` quota per action-observe turn | Browser, iOS/Android simulator, desktop/GUI driving, visual QA, interactive app/device dogfood |
| `mechanical` | `codex` `gpt-6.1-sol` (`-fast`: `service_tier="fast"` per blocking chunk only) | `medium`: coding workhorse; pin `-m` and effort so `~/.codex/config.toml` (`gpt-6.1-terra` `low`) is not inherited | Clear-spec non-UI code, schema/validator/wiring, 1–3 files, migrations, sweeps, data analysis |
| `mechanical-luna` | `codex` `gpt-6-luna` | `medium`: fast/cheap on trivial crisp specs; gate hard, escalate to `mechanical` on ambiguity | Small crisp 1–3 file renames, mop-ups, boilerplate wiring (never review) |
| `mechanical-claude` | `claude` `claude-sonnet-5-5` | `medium`: non-Codex mechanical capacity (and UI taste floor when Opus is busy) | Cross-engine mechanical parallelism or Codex-quota-dry mechanical fallback |
| `judgment` | `claude` `claude-opus-5-5` (`-fast`: `--settings '{"fastMode":true}'`) | `high`: deep unsupervised multi-file/UI/API/security/seam work without `max` burn | Reactor-subtle, security-critical, user-facing UI & API design, complex seams (excludes plans & copy) |
| `frontier` | `claude` `claude-fable-5-1` (`-p "$BRIEF"`) | `medium`: Mythos-class review/tiebreak seat matching `~/.claude/settings.json` | High-stakes independent review & tiebreaks only; never a build or dogfood lane |
| `dogfood` | `claude` `claude-sonnet-5-5` | `medium`: headless smoke; escalate reactor-subtle smoke to `claude-opus-5-5` | CLI/API tracer smoke or non-GUI dogfood fallback when Codex is at reserve (GUI → `computer-use`) |
| `tandem` | `codex` `gpt-6-astra` (Codex-dry fallback: `agy` `gemini-4-argon-medium` for Claude orchestrator, `claude-opus-5-5` `medium` for non-Claude) | `high` on Astra (`medium` on fallback: 10-min watchdog sweeps & terse `TANDEM-JUDGE` verdicts do not need `argon-high` latency/burn); never `max` | Co-orchestrator watchdog & external rotation trigger on autonomous/overnight runs |

**Routing & engine invariants:**
- **Always pin `--model`/`-m` and effort** on every pane and review call; never pin `max` effort on any fleet
  lane. Keep **>1 engine lane funded** so single-provider quota exhaustion never halts the fleet; if herdr
  cannot track an engine's status, fall back to one it tracks (`codex`, `claude`, `agy`).
- **User-facing taste floor:** UI implementation and public API design route to `judgment` (`claude-opus-5-5`,
  with `claude-sonnet-5-5` as floor when saturated) and copywriting routes to `copy` (`gemini-4-argon-medium`) —
  never `mechanical` Sol/Luna solo.
- **Standing permission to escalate:** if a cheaper lane fails gates or quality, respawn in the **same
  worktree** on a stronger lane without asking (`intelligence > taste > cost`).
- **Required review rules:** reviewer engine must differ from builder engine (`Argon` never reviews
  Gemini/Argon; `Claude` never reviews Claude; `Codex` never reviews Codex). Routine review defaults to
  `gemini-4-argon-medium` (overriding older `argon-high`-everywhere examples; reserve `gemini-4-argon-high` for
  `review-hard`). Lightweight models (`gemini-3.8-flash-*`, `claude-haiku-5-5`, `gpt-6-luna`, mini) **never**
  satisfy required review. Preserve open findings across fallback; block rather than downgrade if all eligible
  frontier reviewers fail.
- **Live steering:** apply any one-sentence user routing override immediately, log `fleet.policy.set steer`, and
  ask once whether to persist it to `fleet-routing.json`.

## Coordination, session isolation & naming
Several fleets share the repo and machine concurrently. Coordinate via **fleetboard** (`bun
~/Projects/fleetboard/fleetctl.ts <register|heartbeat|claim|release|attn|event|events|deregister>`,
`$FLEET_BOARD_URL` default `http://localhost:7777`; offline fallback `docs/superpowers/fleet-runs/ACTIVE.md` +
`/tmp/fleet-<epic>.signals`):
1. **Lifecycle & bell:** `register` on start, `heartbeat` every wake, `deregister` after teardown. Fixed 7-stage
   board vocabulary: `ASSIGNED → PLANNED → BUILT → IN_REVIEW → GATED → MERGED → DOGFOODED`. Ring `fleetctl attn
   <fleet-id> "<slug>/<chunk-id> <ask>"` (+ `PushNotification` on Mac + `✋` pane glyph) **only** for human
   decisions or unrecoverable blockers; poll `/state` for the owner's reply.
2. **Exclusive TTL + FIFO claims:** honor queue order, never poll-race or jump, and check claims before killing
   shared ports/processes/sims. Claims: `main-merge` (only holder rebases/merges `main`), `sim:<udid>` (boot a
   separate simulator per fleet), `ports:<app>` (prefer worktree auto-offset ports), `neon:<project>`.
3. **Isolated herdr session (`fleet-<epic>`):** keep your own pane in the default session
   (`orchestrator:<epic>`). Reuse or start `nohup herdr --session fleet-<epic> server </dev/null >/dev/null 2>&1
   &` and prefix **every** fleet command with `herdr --session fleet-<epic>` (remote: `ssh <host> 'herdr
   --session fleet-<epic> ...'`; `--remote` is interactive UI-attach only, never for driving).
4. **Four-level placement & naming:** `session=fleet-<epic> · workspace=<epic> · tab=fleet:<epic>`
   (`fleet:<epic>@<slug>` off-primary) `· pane=<chunk-id>`. Herdr agent names must match `[a-z][a-z0-9_-]{0,31}`
   and stay **bare** (`<chunk-id>`, `tandem-<epic>`, `steward-<epic>`, set once — `agent *` targets names across
   `pane move`, while `pane *` requires `pane_id` from `agent get`). **`fleetctl event <STAGE> --machine <slug>
   --chunk <chunk-id> [--epic <epic>]` also takes bare `<chunk-id>`** (never prefix `--chunk`, or board filters
   silently match nothing). Qualify **every other** off-machine/durable surface (`fleet log`, `fleetctl attn`,
   kanban cards, run map, archive, handoff, human reports `<slug>/<chunk-id> (<pane_id>)`) as
   `<slug>/<chunk-id>`.
5. **Sidebar legibility:** update pane labels (`herdr pane rename <pane_id> "<glyph> <chunk-id>"`) at every
   transition: `▶` building · `⏳` built/queued · `🔎` in review · `✋` awaiting human · `❌` errored/stuck (no `✅`
   — finished panes archive-then-close). Refresh tab counts (`fleet:<epic> ▶3 ⏳1 ✋1`) every wake.
6. **One-time setup:** verify `herdr integration status` (`herdr integration install` for `claude`, `codex`,
   `antigravity-cli`) and `pi.orchestrator` plugin enabled (auto-retries transient 429/5xx/stream drops); ensure
   `/BRIEF.md` and `/REPORT.md` are gitignored in the target repo; initialize epic dir (`fleet init <home>
   <epic> --repo <owner/name> --plan <path>` + `fleet graph check <dir>`, or legacy
   `docs/superpowers/fleet-runs/<epic>.jsonl`) via `fleet` (`bun ~/.claude/skills/fleet-ship/scripts/fleet.ts`);
   log `fleet.run.started`, `fleet.resource.minted session:fleet-<epic>`, `fleet.policy.set`, and
   `fleet.cursor.advanced` (board `seq` + `SIGNALS=/tmp/fleet-<epic>.signals`); create `fleet:map` GitHub issue
   (Destination, Decisions, Not-yet-specified fog, Out-of-scope — never pre-slice foggy work) and kanban
   project.

## Wake & per-chunk operating loop
**Wake discipline:** FIRST run `fleet state <dir|ledger> --live` and drain `fleetctl events --since <cursor>` (+
`$SIGNALS` fallback) at drain points only (never mid-merge); advance `fleet.cursor.advanced`; archive+close
orphan panes. Read pane tails (`agent read --lines 30`) only for flagged rows (`blocked`, `error`, `gone`,
`orphan`). LAST append `fleet log` and push durable checkpoints on the coordination branch/draft PR.

1. **Frontier, file-isolation & Codex quota gate (every wave):** parallelize only ready chunks from `fleet next
   <dir>` (enforces `max_in_flight`, `max_gate_queue`, `pilot`, `spawn-paused`, `conflicts`) that do not share
   files/areas, verify `"already done"` claims against current code on `main`, check `git worktree list`, and
   claim the ticket assignee. Before **any** Codex spawn, read the 7d remaining percent (`herdr agent get`
   `.tokens.limit` `7d N%`, or `~/.codex/sessions` rollout fallback in `REFERENCE.md`) and verify active Codex
   account identity did not auto-switch (`codex-auth` switch is not fresh budget); log `fleet.quota.gate`. If `N
   <= FLEET_CODEX_RESERVE` (default `20%`), account switched, or `QUOTA_HALT` fired, refuse Codex spawns for the
   run: route mechanical to `mechanical-claude`, judgment/UI to `judgment`, headless smoke to `dogfood`,
   `tandem` to Argon (`gemini-4-argon-medium`), and hold Astra-pinned `design-plan` and Terra-pinned
   GUI/simulator `computer-use` chunks as `BLOCKED: quota` unless the owner steers an override.
2. **Worktree & spawn (one agent per worktree):** `git worktree add .claude/worktrees/<chunk> -b feat/<chunk>
   origin/main` + repo install (`bun install`) before spawning. Reuse `fleet:<epic>` tab (`tab list` first; use
   `tab create`'s `.result.root_pane.pane_id` for chunk 1, `pane split --cwd <wt> --no-focus` thereafter,
   closing stray empty shells). Log `fleet.resource.minted` for every workspace/tab/pane/agent in the **same
   wake** (never close unrecorded resources). Mint `attempt_id` via `fleet.chunk.building` (required on all
   subsequent pane events). Start with pinned model + effort (`herdr agent start <chunk-id> --kind
   <claude|codex|agy> --pane <pane_id> -- <lane flags>`; for Codex TUI use `scripts/verify-codex-launch.sh`
   until `BOOT_READY`, leaving `BOOT_HUNG` panes intact for inspection). Rename label `▶ <chunk-id>` and emit
   `fleetctl event ASSIGNED`.
3. **Brief & delivery check:** write `BRIEF.md` = rich CONTEXT + `fleet status <dir> <chunk>` + `attempt_id` +
   the matching **verbatim DISCIPLINE BLOCK** from `REFERENCE.md` (Claude code, non-Claude code, or non-code
   `design-plan` / `copy` artifact block — each carries scope pin, `:!BRIEF.md :!REPORT.md` commit guard, remote
   delivery receipt, and mandatory SIGNAL STEP emitting `BUILT` or `attn` + `herdr notification show` +
   `$SIGNALS` fallback). Never send long briefs as keystrokes, and **never interrupt a `working` pane**. For
   non-Codex panes, confirm an **empty** prompt line first (`agent prompt` appends — capture any parked draft,
   `Ctrl+U`, verify empty, then `agent prompt <chunk-id> "Read BRIEF.md and execute it fully" --wait --until
   working`; retry at most twice on idle Ctx 0, then ring). Emit `fleetctl event PLANNED` when the plan lands.
4. **Waiter + liveness monitor (`REFERENCE.md` scripts):** run BOTH per active pane — the commit-gated waiter
   (`idle|done` settle-poll + commit-or-dirty; status alone flaps on background shells) AND one fleet-wide
   liveness monitor (`QUOTA_LOW <=10%` prompts `ROTATE NOW`; `QUOTA_HALT <=20%` closes Codex spawns; `ERRORED`
   rings after `pi.orchestrator` retry exhaustion/fatal; `STUCK` checks normalized tail + branch commits before
   ringing; `DEAD` respawns or runs `scripts/session-handoff.ts` rescue). Waiter timeout ≠ stuck: check pane
   status + recent commits first and re-arm active long chunks; an `"API Error: Connection closed mid-response"`
   tail on a clean worktree is recoverable — nudge the existing pane rather than respawning. On
   `READY_UNCOMMITTED` (idle + dirty tree), commit excluding `BRIEF.md`/`REPORT.md` and emit `fleetctl event
   BUILT` yourself. **Archive-then-close applies to ALL fleet-spawned panes** (build, review, fix, dogfood,
   tandem, steward); close build panes at **verified remote delivery receipt + archived report** (before merge,
   unless send-back is minutes away) so idle panes never pile up while worktree + pushed branch carry the gate.
5. **Consensus gate (`IN_REVIEW` → `GATED`, never delegated):**
   - Emit `fleetctl event IN_REVIEW` and run **cross-engine tandem review** (`review` or `review-hard`) from a
     different engine than built the chunk; instruct reviewer to report **all** concrete findings without
     severity self-filtering; verify reviewer model identity and that a real verdict returned (clean wrapper
     exit ≠ PASS; fall back to direct CLI on drop).
   - **Reuse, simplicity & seam check:** flag duplicate shared-package logic; apply delete-the-mock heuristic
     (reject behavior chunks whose tests only assert mocked dispatches); confirm `BRIEF.md`/`REPORT.md` are
     absent from diff.
   - **Full verification matrix:** enumerate and run every plan-specified concrete gate from the worktree
     (typecheck with unpiped `$?`, `verify:effect`, `bun run test:vitest`, confirming new test files actually
     load and execute tests). Dispatch a `model:'sonnet', effort:'low'` fix subagent (or send-back) for
     Critical/Important findings and re-gate to consensus.
   - Record commit-bound gate receipt (`fleet log <dir> fleet.chunk.gated <slug>/<chunk-id> attempt_id=<tok>
     commit=<40-hex> verdict=PASS evidence=verified checks=<path>`) and emit `fleetctl event GATED`.
6. **Held chunks vs merge under claim (`MERGED`):**
   - **`hold:human`** (tagged at assignment on `reactor-subtle`, `security-critical`, `user-facing design`):
     **STOP at `GATED`**, set `✋ <chunk-id>`, ring `fleetctl attn` with verdict + PR link, and poll `/state`
     (`approve` → record `hold=approved` and merge under claim; `reject` → respawn in same worktree with
     feedback).
   - **Merge under claim (ordered, unskippable):** run `fleet check-gate <dir> <slug>/<chunk-id> --worktree
     <wt>` first (never hold `main-merge` while reviewing). (1) Claim `main-merge` (wait FIFO turn if taken);
     (2) rebase branch on `origin/main`; (3) run repo-root `bun run test:vitest` green locally; (4) **re-verify
     `main-merge` claim TTL is still yours** — on expiry, `git rebase --abort` / `git merge --abort`, re-queue
     FIFO, and restart at step 2, never half-merge — then squash-merge and push (`fleet.chunk.merged` with
     `input_commit=<reviewed-sha> commit=<squash-sha>`); (5) emit `fleetctl event MERGED`; (6) release
     `main-merge`.
7. **Archive, follow-ups, UAT, dogfood & teardown:**
   - Append captured report (`agent read --source recent --lines 400`) + PR + gate verdict to
     `docs/superpowers/fleet-runs/<epic>.md`, update kanban card + `fleet:map` Decisions line.
   - File `follow-up` issues immediately at triage for every deferred concern; append real-device checks
     (widgets, push, IAP, entitlements, camera/mic, TestFlight) to the app's **single** open `uat` issue
     (`--label uat --label device-verify`).
   - Remove **only** exact worktrees this run created (after confirming unoccupied + clean `git status
     --porcelain`), delete local branch, and sweep Xcode `DerivedData` matching exact `WorkspacePath` inside
     that worktree (`REFERENCE.md`).
   - After runtime-affecting merges (when build/test panes are quiescent), spawn a `computer-use`
     (`gpt-6.1-terra`) pane for GUI/browser/simulator/device dogfood (or `dogfood` `claude-sonnet-5-5` for
     CLI/API smoke or non-GUI fallback), gated on its report file → file kanban cards → emit `fleetctl event
     DOGFOODED`.
   - At run end: `fleet teardown <ledger> --epic <epic> --session fleet-<epic>` (dry-run, then `--execute` to
     archive/close exact minted IDs and stop/delete `fleet-<epic>`), confirm absent in `herdr session list`,
     `fleetctl deregister`, then run `wrap-up`.

## Context hygiene & proactive rotation
Keep state in **ledger + git + board**, never in your window: offload diffs/briefs/reports to files, read
verdicts rather than raw diffs, delegate heavy searches to `sonnet`/`haiku` subagents, and always clear/submit
your prompt line before parking.

Rotate proactively (same policy for stewards; `tandem` monitors `.result.agent.tokens.context` externally) on
**any single trigger** (never ANDed): **(a)** ~70–75% context fill, **(b)** 4–6h active wakes (tandem triggers
at 5h), **(c)** same rotation-blocking cause 2 cycles in a row, or **(d)** user says `"rotate"`. Execute as
**one atomic step**: write the rotation handoff (`REFERENCE.md` schema pasting `fleet state --live`), commit +
push + update draft PR + verify delivery receipt, and park with an empty prompt. Keep the handoff refreshed when
parking; successors treat every snapshot line as stale, re-query live state, sweep orphans, re-arm
waiters/monitor, and re-register on fleetboard.
