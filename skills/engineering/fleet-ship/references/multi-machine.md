# Multi-Machine Placement, Stewards, Tandem & Rescue

Load this reference when placing chunks across multiple machines, spawning a remote steward, running an
overnight tandem co-orchestrator, or rescuing a quota-killed pane.

## Placement: `(chunk, lane) -> (machine slug, steward assignment)`
Lane selection (`fleet-routing.json`) picks **what** engine/model runs a chunk; placement on the **Mac primary
orchestrator** picks **where** (lanes in `fleet-routing.json` never name machines):
1. **Hard filters (a machine in fleetboard registry must pass ALL):**
   - `state === "active"` (drop pending/stale) and `inWindowNow === true`.
   - Lane's `engine` (`codex`, `claude`, `agy`) is authenticated on that machine **and** owner-consented
     (`enginesPolicy`, defaulting to `owner-only` on non-owned hosts), and not marked `BLOCKED: quota` for this
     run.
   - Static capability match against the chunk's declared `needs` (e.g., `xcodeVersion` / `simRuntimes` for iOS
     builds; default empty `needs` passes all).
   - `freeSlots > 0`, and long/`judgment` chunks are excluded from `policy.preemptible === true` machines.
2. **Deterministic priority among survivors (first differing key wins):**
   - Pinned (`policy.preemptible === false`) before preemptible → warm repo cache (when present) → highest
     `freeSlots` → alphabetical machine `<slug>`. No mid-chunk migration after placement.
3. **Hold tagging at assignment (Mac orchestrator):** attach `hold:human` (or `hold:central`) on
   `reactor-subtle`, `security-critical`, and `user-facing design` chunks. Mac-local chunks run directly under
   the Mac orchestrator; remote chunks queue for that host's steward.

## Steward Mode & Verbatim Steward Brief
A **steward** is an on-demand per-machine orchestrator spawned into `fleet:<epic>@<slug>` (herdr agent name
`steward-<epic>` matching `[a-z][a-z0-9_-]{0,31}`, pane label `steward:<epic>`, `claude-opus-5-5 --effort high`)
when chunks are assigned to a non-primary host, and torn down as soon as its queue empties (idle hosts run only
the heartbeat daemon):
- **Division of labor:** Mac orchestrator keeps wave planning, placement, hold tagging, kanban/run-map edits,
  dogfood triggering (`DOGFOODED`), and the human interface. Steward runs worktrees, local pane spawns,
  **local** waiters + liveness monitor (never held open over SSH), cross-engine consensus gate, `follow-up`
  issue filing, and merge under `main-merge` claim.
- **Held chunks:** steward runs `hold:human` chunks through `GATED`, flips `✋ <chunk-id>`, rings `fleetctl attn`
  with verdict + PR link, and stops; merges under `main-merge` only on owner `approve`, or respawns send-back on
  `reject`.
- **Rotation & exit-on-empty:** obeys the exact orchestrator single-condition rotation triggers (`70-75%`
  context, `4-6h` wakes, `2` blocked cycles, `"rotate"`). On empty queue: run `fleet teardown --execute` for its
  minted resources, write the `REFERENCE.md` rotation handoff (including machine slug, released claims, and any
  `GATED` held chunks), confirm terminal board events, `fleetctl deregister`, and exit.

Spawn via file brief (`ssh <host> "herdr --session fleet-<epic> pane split ... && herdr --session fleet-<epic>
agent start steward-<epic> --kind claude --pane <pane> -- --dangerously-skip-permissions --model claude-opus-5-5
--effort high"`):
> You are the STEWARD for machine `<slug>` in fleet `<epic>` (read `fleet-ship` `SKILL.md`, `REFERENCE.md`, and
> `references/multi-machine.md`). Register on fleetboard and heartbeat each wake. Pull chunks assigned to
> `<slug>` (never place chunks or edit kanban/run-map). Per chunk, run the full local loop in
> `fleet:<epic>@<slug>`: worktree + install → mint `fleet.resource.minted` + `attempt_id` → spawn lane-pinned
> pane (`NAME=<chunk-id>`, external `<slug>/<chunk-id>`) → `BRIEF.md` with verbatim DISCIPLINE BLOCK → local
> commit-gated waiter + local liveness monitor → cross-engine consensus gate (`review`/`review-hard` lane) +
> full repo gates → file `follow-up` issues at triage. Emit `fleetctl event <STAGE> --machine <slug> --chunk
> <chunk-id> --epic <epic>` (pass bare `<chunk-id>`, never prefixed) across
> `ASSIGNED→PLANNED→BUILT→IN_REVIEW→GATED→MERGED` (emit `BUILT` yourself only on `READY_UNCOMMITTED`; never emit
> `DOGFOODED`). For `hold:human` chunks, STOP at `GATED`, label `✋ <chunk-id>`, ring `fleetctl attn` with
> verdict + PR link, and wait for owner `approve` before claiming `main-merge`. Honor single-condition rotation
> triggers (`70-75%` ctx, `4-6h` ceiling, `2` blocked cycles). When your queue is empty and no chunk is in
> flight: run `fleet teardown --execute`, write and push the rotation handoff, release claims, `fleetctl
> deregister`, and exit.

## Tandem Co-Orchestrator & Verbatim Tandem Brief
Default on for autonomous/overnight runs (skip short attended runs). Check the Codex weekly quota gate first;
spawn one read-only advisory pane beside the orchestrator (agent name `tandem-<epic>`, pane label
`tandem:<epic>`):
`herdr pane split <orchestrator-pane> --direction down --no-focus` → `herdr agent start tandem-<epic> --kind
codex --pane <new-pane> -- --yolo -m gpt-6-astra -c 'model_reasoning_effort="high"'`. When Codex is at weekly
reserve and the orchestrator runs on Claude, keep cross-engine diversity with `--kind agy --
--dangerously-skip-permissions --model gemini-4-argon-medium`; use `--kind claude --
--dangerously-skip-permissions --model claude-opus-5-5 --effort medium` only when the orchestrator is
non-Claude. Archive-then-close at run end.

> You are the TANDEM co-orchestrator for fleet `<epic>`, watching `<orchestrator-name>`. Every ~10 min:
> (1) WATCHDOG: read `herdr agent read <orchestrator-name> --lines 40`, `fleet state <dir|ledger> --live`, and
> `herdr --session fleet-<epic> agent list`. Check recent branch commits before flagging starvation; detect
> parked drafts blocking steering (capture draft, `Ctrl+U`, follow parked-draft submit protocol) and dead
> waiters/monitor. Send one terse `herdr agent prompt <orchestrator-name> "TANDEM: <finding + action>"`; if the
> same cause blocks 2 cycles in a row, ring `fleetctl attn <fleet-id> "..."`.
> (2) EXTERNAL ROTATION TRIGGER: read `herdr agent get <orchestrator-name> | jq -r
> '.result.agent.tokens.context'` (fall back to visible bottom lines only if empty) and last rotation timestamp
> in the ledger. On `>=70-75%` context fill, `>=5h` active wall clock (within the 4–6h rotation ceiling), or 2
> consecutive blocked cycles, send ONE atomic instruction: `"ROTATE NOW: write the rotation handoff per
> REFERENCE.md, commit and push it, update the draft PR, and park with an empty prompt."` Ring `fleetctl attn`
> if unparked after 2 sweeps.
> (3) `TANDEM-JUDGE:`: when prompted with `TANDEM-JUDGE:`, read only the cited plan/diff/review pointers and
> reply with a terse verdict + 3-line reasoning. Advisory and read-only: never edit files, merge, spawn, or
> close panes.

## Dead-Pane Rescue (Quota Death Without Handoff)
When `QUOTA_LOW` (`<=10%`) fires in time, the pane writes its own recovery handoff. If a pane dies mid-turn on a
usage limit without a handoff:
1. Check `agent read <pane> --source recent-unwrapped --lines 400` and `tokens.limit` to confirm mid-task death
   vs completed turn, and pick an engine with healthy quota. (Claude child panes require
   `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1` to persist `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`;
   Codex writes `~/.codex/sessions/YYYY/MM/DD/rollout-*-<session-id>.jsonl`.)
2. Reconstruct the brief from the on-disk transcript (redacts secret patterns automatically; never echo raw
   secrets):
   `bun ~/.claude/skills/fleet-ship/scripts/session-handoff.ts <pane|name|session-id> --out
   ~/.cache/herdr-rescue/<name>.md`
   Append the original brief's concrete gates and verbatim discipline block.
3. Spawn the successor in the **same workspace and worktree** (`herdr --session fleet-<epic> pane split ...
   --cwd <wt> --no-focus` → `herdr --session fleet-<epic> agent start rescue-<name> --kind <engine> --pane
   <pane_id> -- <lane flags>` — agent names must match `[a-z][a-z0-9_-]{0,31}`), mint `fleet.resource.minted` +
   a fresh `attempt_id`, deliver the rescue brief pointer with `--wait --until working`, rename the dead pane
   `<label> MOVED -> rescue-<name>`, archive-then-close the dead pane once verified, and re-arm waiter +
   monitor.
