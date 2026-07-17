# build-28: Lifecycle-event emission via fleetctl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `fleetctl event <stage>` emits lifecycle events to the board's append-only `/events` log; the fleet-ship skill docs make the event log the source of truth for chunk-stage transitions, demoting `/tmp/fleet-<epic>.signals` to an offline fallback.

**Architecture:** Thin CLI addition in the fleetboard repo (new `case "event"` in `fleetctl.ts`, reusing the existing `post()` board-URL/auth plumbing; the 7-stage vocabulary extracted to a shared `v2/src/lifecycle.ts` so CLI and board can't drift) + prose rewrite in the skills repo (`fleet-ship/SKILL.md` + `REFERENCE.md`).

**Tech Stack:** Bun CLI (fleetctl.ts), Cloudflare DO board (Effect), `bun:test` + Miniflare contract tests (NOT vitest - this repo's v2 neighbors all use `bun:test`).

## Global Constraints

- Work ONLY in the two build-28 worktrees: skills `~/Projects/necmttn-skills/.worktrees/build-28` (branch `build/28-lifecycle`), fleetboard `~/Projects/fleetboard/.worktrees/build-28` (branch `build/28-lifecycle`). NEVER either primary checkout.
- Lifecycle vocabulary EXACTLY: `ASSIGNED PLANNED BUILT IN_REVIEW GATED MERGED DOGFOODED` (already enforced server-side in `board-do.ts` `decodeEventPost`).
- Contract test = real seam: real Miniflare board + real spawned fleetctl process, assert row appears via `GET /events`. Never a mocked POST (delete-the-mock heuristic).
- Test framework: `bun:test` imports + Miniflare harness - copy the header of `v2/test/board-events-cli.contract.test.ts` exactly.
- Keep `/tmp/fleet-<epic>.signals` working as offline fallback - demote in prose, never delete.
- `~/.ax/fleet-routing.json` OUT OF SCOPE.
- Gates (fleetboard `v2/`): `bun run typecheck` exit 0 (real exit code, no pipe before `$?`); new contract test green in isolation (`bun test test/board-events-emit-cli.contract.test.ts`), never a parallel full run.
- Commit per worktree with explicit awareness that BRIEF.md/REPORT.md/.worktrees are gitignored; verify diff carries neither.
- Doc changes have no unit test - verified E2E by tracer bullet #13 elsewhere; doc gate = every acceptance criterion literally satisfied + no dangling old-signals-only refs.

## Board facts the implementer must know (verified 2026-07-17 in the worktree)

- `POST /events` (board-do.ts:446) requires `authorize(request, "active")` - machine Bearer token. `machine` field on the stored event comes from the token identity; a client-sent `machine` body field is IGNORED (spoof-tested in board-events.contract.test.ts:88,129).
- Accepted body: `{type, stage, chunk, hold?, artifactRefs?, reportRefs?, gist?}`; `type` must be a lifecycle stage, `stage === type` required, `chunk` non-empty string; unknown extra keys are ignored. Response 201 `{seq}`.
- `GET /events?since=<seq>&chunk=&machine=&type=` is unauthenticated; returns `[{seq, timestamp, type, stage, chunk, machine, payload}]`.
- fleetctl auth plumbing: `TOKEN = --token flag ?? FLEET_MACHINE_TOKEN ?? stored ~/.config/fleetboard/token-<slug>`; `post(path, body, true)` attaches Bearer + exits 1 on non-ok. Board URL: `--board ?? FLEET_BOARD_URL ?? http://localhost:7777`.
- Machine-namespaced ids (#26): every reference leaving a machine is `<machine-slug>/<chunk-id>`; the emit command composes this into the event's `chunk` field.
- v2 tsconfig only covers `src/**` + `test/**` + alchemy.run.ts - fleetctl.ts is NOT typechecked by the v2 gate; the shared `v2/src/lifecycle.ts` IS (imported by board-do.ts).

---

### Task 1: fleetctl `event` emit command (fleetboard worktree, strict TDD)

**Files:**
- Create: `~/Projects/fleetboard/.worktrees/build-28/v2/test/board-events-emit-cli.contract.test.ts`
- Create: `~/Projects/fleetboard/.worktrees/build-28/v2/src/lifecycle.ts`
- Modify: `~/Projects/fleetboard/.worktrees/build-28/v2/src/board-do.ts:22-32` (import LIFECYCLE_STAGES from ./lifecycle.ts instead of local const)
- Modify: `~/Projects/fleetboard/.worktrees/build-28/fleetctl.ts` (new `case "event"` before `case "events"`; usage header + default-case usage string)

**Interfaces:**
- Consumes: existing `post()`, `flag()`, `CONFIG_DIR`, TOKEN plumbing in fleetctl.ts; `startBoard/stopBoard` harness, `joinMachine/seedActiveMachine` helpers.
- Produces: `fleetctl event <stage> --chunk <chunk-id> [--machine <slug>] [--epic <epic>] [--gist "<one-line>"] [--board <url>] [--token <machine-token>]`. Exit 0 + prints `{seq,...}` on success; exit 2 + usage/invalid-stage message on bad input (no stack trace); exit 1 on board error. `v2/src/lifecycle.ts` exports `export const LIFECYCLE_STAGES = ["ASSIGNED","PLANNED","BUILT","IN_REVIEW","GATED","MERGED","DOGFOODED"] as const`.

**Behavior spec:**
- Stage = first positional (`rest[0]`). Validate FIRST against LIFECYCLE_STAGES: invalid → stderr `` fleetctl event: invalid stage "<X>" (expected ASSIGNED|PLANNED|BUILT|IN_REVIEW|GATED|MERGED|DOGFOODED) `` and `process.exit(2)` - before any token/network work, so it's deterministic offline.
- Required: stage + `--chunk`. Missing → usage line to stderr, exit 2. TOKEN undefined → usage line (mention --token), exit 2 (mirror `attn`).
- Machine slug: `--machine` flag, else the stored slug from `~/.config/fleetboard/machine` (same file readStoredToken reads), else none.
- Event `chunk` field: `<slug>/<chunk-id>` when a slug is known and `--chunk` doesn't already contain `/`; otherwise the `--chunk` value verbatim (already-qualified ids pass through).
- POST body: `{ type: stage, stage, chunk: qualifiedChunk, ...(epic && {epic}), ...(gist && {gist}) }` via `post("/events", body, true)` (board ignores the extra `epic` key today; the bun-board meta stopgap stores whole bodies - same shape either way).

- [ ] **Step 1: Write the failing contract test**

`v2/test/board-events-emit-cli.contract.test.ts` (header copied from board-events-cli.contract.test.ts):

```ts
import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Miniflare } from "miniflare"
import { joinMachine, seedActiveMachine } from "./board-auth-helpers.ts"
import { startBoard, stopBoard } from "./harness.ts"

let board: Miniflare

beforeAll(async () => {
  board = await startBoard()
}, 20_000)

afterAll(async () => {
  await stopBoard(board)
})

const runFleetctl = async (
  boardUrl: string,
  args: readonly string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const fleetctl = Bun.spawn({
    cmd: [
      process.execPath,
      new URL("../../fleetctl.ts", import.meta.url).pathname,
      ...args,
      "--board",
      boardUrl,
    ],
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    fleetctl.exited,
    new Response(fleetctl.stdout).text(),
    new Response(fleetctl.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

test("fleetctl event emits a machine-attributed lifecycle event readable via GET /events", async () => {
  const joined = await joinMachine(board, "emit-writer")
  await seedActiveMachine(board, "emit-writer")
  const boardUrl = (await board.ready).origin

  const baselineResponse = await board.dispatchFetch("http://board.local/events?since=0")
  const baselineEvents = (await baselineResponse.json()) as Array<{ seq: number }>
  const baseline = baselineEvents.at(-1)?.seq ?? 0

  const emit = await runFleetctl(boardUrl, [
    "event",
    "BUILT",
    "--chunk",
    "build-99",
    "--machine",
    "emit-writer",
    "--epic",
    "fleet-build-mm",
    "--gist",
    "commit abc123 green gates",
    "--token",
    joined.token,
  ])
  expect(emit.stderr).toBe("")
  expect(emit.exitCode).toBe(0)

  const replayResponse = await board.dispatchFetch(
    `http://board.local/events?since=${baseline}`,
  )
  expect(replayResponse.status).toBe(200)
  const replay = (await replayResponse.json()) as Array<{
    seq: number
    type: string
    stage: string
    chunk: string
    machine: string
    payload: { gist?: string }
  }>
  expect(replay).toHaveLength(1)
  expect(replay[0]).toMatchObject({
    type: "BUILT",
    stage: "BUILT",
    chunk: "emit-writer/build-99",
    machine: "emit-writer",
    payload: { gist: "commit abc123 green gates" },
  })
}, 30_000)

test("fleetctl event rejects a stage outside the lifecycle vocabulary with a clear non-zero error", async () => {
  const boardUrl = (await board.ready).origin

  const baselineResponse = await board.dispatchFetch("http://board.local/events?since=0")
  const baselineEvents = (await baselineResponse.json()) as Array<{ seq: number }>
  const baseline = baselineEvents.at(-1)?.seq ?? 0

  const emit = await runFleetctl(boardUrl, [
    "event",
    "DEPLOYED",
    "--chunk",
    "build-99",
    "--machine",
    "emit-writer",
    "--token",
    "irrelevant",
  ])
  expect(emit.exitCode).toBe(2)
  expect(emit.stderr).toContain('invalid stage "DEPLOYED"')
  expect(emit.stderr).toContain("ASSIGNED|PLANNED|BUILT|IN_REVIEW|GATED|MERGED|DOGFOODED")
  expect(emit.stderr).not.toContain("    at ") // no stack trace

  const afterResponse = await board.dispatchFetch(
    `http://board.local/events?since=${baseline}`,
  )
  expect(await afterResponse.json()).toEqual([]) // nothing appended
}, 30_000)

test("fleetctl event without --chunk or token exits 2 with usage", async () => {
  const boardUrl = (await board.ready).origin
  const noChunk = await runFleetctl(boardUrl, ["event", "BUILT", "--token", "x"])
  expect(noChunk.exitCode).toBe(2)
  expect(noChunk.stderr).toContain("usage: fleetctl event")
}, 30_000)
```

- [ ] **Step 2: Run it, verify red**

Run from `~/Projects/fleetboard/.worktrees/build-28/v2`: `bun test test/board-events-emit-cli.contract.test.ts`
Expected: FAIL - fleetctl exits 2 with the generic usage line (`event` is an unknown command today).

- [ ] **Step 3: Implement**

Create `v2/src/lifecycle.ts`:

```ts
/** Chunk lifecycle vocabulary - spec-fixed 7 stages (Necmttn/skills#28, owned by #15). */
export const LIFECYCLE_STAGES = [
  "ASSIGNED",
  "PLANNED",
  "BUILT",
  "IN_REVIEW",
  "GATED",
  "MERGED",
  "DOGFOODED",
] as const

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]
```

In `board-do.ts`: delete the local `LIFECYCLE_STAGES` const (lines 22-30), add `import { LIFECYCLE_STAGES } from "./lifecycle.ts"` (keep `const lifecycleStages = new Set<string>(LIFECYCLE_STAGES)` as is).

In `fleetctl.ts`: add import `import { LIFECYCLE_STAGES } from "./v2/src/lifecycle.ts";` and before `case "events"`:

```ts
  case "event": {
    const stage = rest[0];
    const stageList = LIFECYCLE_STAGES.join("|");
    const usage = `usage: fleetctl event <${stageList}> --chunk <chunk-id> [--machine <slug>] [--epic <epic>] [--gist "<one-line>"] [--board <url>] [--token <machine-token>]`;
    if (stage === undefined || stage.startsWith("--")) {
      console.error(usage);
      process.exit(2);
    }
    if (!(LIFECYCLE_STAGES as readonly string[]).includes(stage)) {
      console.error(`fleetctl event: invalid stage "${stage}" (expected ${stageList})`);
      process.exit(2);
    }
    const chunk = flag("chunk");
    if (chunk === undefined || chunk.trim().length === 0 || TOKEN === undefined) {
      console.error(usage);
      process.exit(2);
    }
    const machine = flag("machine") ?? (await readStoredSlug());
    const qualifiedChunk =
      machine !== undefined && !chunk.includes("/") ? `${machine}/${chunk}` : chunk;
    const epic = flag("epic");
    const gist = flag("gist");
    await post("/events", {
      type: stage,
      stage,
      chunk: qualifiedChunk,
      ...(epic === undefined ? {} : { epic }),
      ...(gist === undefined ? {} : { gist }),
    }, true);
    break;
  }
```

Add next to `readStoredToken` (refactor: `readStoredToken` should reuse it):

```ts
const readStoredSlug = async (): Promise<string | undefined> => {
  try {
    const slug = (await readFile(joinPath(CONFIG_DIR, "machine"), "utf8")).trim();
    return slug.length === 0 ? undefined : slug;
  } catch {
    return undefined;
  }
};
```

Update the usage comment header (add `fleetctl event <stage> --chunk <id> [--machine <slug>] [--epic <epic>] [--gist "..."]` line above the events line) and the final `default:` usage string (`...attn|event|events|watch...`).

- [ ] **Step 4: Run test, verify green**

From `v2/`: `bun test test/board-events-emit-cli.contract.test.ts` → all 3 pass.

- [ ] **Step 5: Regression + gates**

From `v2/`:
- `bun test test/board-events.contract.test.ts` → green (board-do refactor didn't change validation).
- `bun test test/board-events-cli.contract.test.ts` → green.
- `bun run typecheck`; then `echo $?` → 0 (no pipes).

- [ ] **Step 6: Commit (fleetboard worktree)**

```bash
cd ~/Projects/fleetboard/.worktrees/build-28
git add fleetctl.ts v2/src/lifecycle.ts v2/src/board-do.ts v2/test/board-events-emit-cli.contract.test.ts
git status --porcelain   # verify: no BRIEF.md/REPORT.md staged
git commit -m "feat(fleetctl): lifecycle event emit subcommand posting to board /events (#28)"
```

### Task 2: SKILL.md - lifecycle stages wired into the per-chunk loop + event log as wake source of truth

**Files:**
- Modify: `skills/engineering/fleet-ship/SKILL.md` (skills worktree; use `superpowers:writing-skills`)

**Changes (each maps to an acceptance criterion):**

1. **Intro fleetctl verb list (line ~15):** `<register|heartbeat|claim|release|attn|deregister>` → add `event` and `events`.
2. **Per-chunk loop stage emissions (criterion 2)** - name the emitting stage at each numbered step, emitted via `bun ~/Projects/fleetboard/fleetctl.ts event <STAGE> --machine <slug> --chunk <chunk-id> --epic <epic> --gist "<one-line>"`:
   - Step 3 spawn → orchestrator emits `ASSIGNED`.
   - Step 4 brief: when the pane's plan is written/approved (autonomous parallel-explore: when the options doc decision lands) → orchestrator emits `PLANNED`.
   - Step 5/6 waiter READY (commit+report) → pane already emitted `BUILT` in its SIGNAL STEP; orchestrator verifies it in the event log and emits `BUILT` itself only on the READY_UNCOMMITTED path (pane couldn't).
   - Step 6a cross-engine review start → `IN_REVIEW`; consensus-pass (merge gate passes) → `GATED`; after squash-merge → `MERGED`.
   - Step 8 tracer-report received → `DOGFOODED`.
3. **Rewrite "Child→parent signals" section (criteria 3/4/5)** - retitle to "Child→parent lifecycle events - panes PUSH via fleetctl; the signals file is the offline fallback":
   - Vocabulary line: `ASSIGNED → PLANNED → BUILT → IN_REVIEW → GATED → MERGED → DOGFOODED` (board-validated; bad stage = non-zero error).
   - At fleet start: record the event cursor (last `seq` from `fleetctl events --since 0`, or the ledger's stored cursor) in the ledger; still set `SIGNALS=/tmp/fleet-<epic>.signals` - now the OFFLINE FALLBACK only.
   - Pane push: SIGNAL STEP emits `fleetctl event BUILT ... --gist "<gist>"` at commit (DONE→BUILT); BLOCKED/ERROR have no lifecycle stage → `fleetctl attn <fleet-id> "<report-name> BLOCKED|ERROR: <gist>"` + REPORT.md; board unreachable (emit exits non-zero) → append the old one-line signals record to $SIGNALS as fallback.
   - **Wake reads the EVENT LOG FIRST (criterion 4):** `fleetctl events --since <cursor>` (optionally per `--machine`), reconcile BEFORE trusting waiters (BUILT → gate even if the waiter never fired), advance the cursor in the ledger; THEN read each machine's $SIGNALS (remote via ssh) as the fallback path for board-unreachable panes and reconcile the same way.
   - Orphan sweep: "appears in the event log (or fallback $SIGNALS) but has no live waiter" wording.
   - Closing spine line: waiter = fast wake; monitor = liveness; **event log = the durable truth**; signals file = offline fallback of the event log. A chunk may only be considered lost if all are silent AND the worktree shows no commits.
4. **Rotation section (line ~390):** handoff sources list "signals file" → "event-log cursor + fallback signals file".
5. **Consistency sweep:** `rg -n "SIGNALS|signals" SKILL.md` - no remaining prose treating the signals file as the primary/first-read path.

### Task 3: REFERENCE.md - both discipline blocks' SIGNAL STEP + handoff schema

**Files:**
- Modify: `skills/engineering/fleet-ship/REFERENCE.md` (skills worktree; `superpowers:writing-skills`)

**Changes:**

1. **Claude-pane discipline block SIGNAL STEP** (criterion 3) - replace the signals-append sentence with:
   > SIGNAL STEP (mandatory, LAST, even on failure): emit the lifecycle event - on DONE (work committed) run `bun ~/Projects/fleetboard/fleetctl.ts event BUILT --machine <machine-slug> --chunk <chunk-id> --gist "<one-line gist>"` (DONE maps to BUILT at commit); on BLOCKED/ERROR there is no lifecycle stage - ring `bun ~/Projects/fleetboard/fleetctl.ts attn <fleet-id> "<report-name> BLOCKED|ERROR: <one-line gist>"` and write the detail + what you need into REPORT.md at the worktree root. FALLBACK (only if the board is unreachable - the fleetctl command exits non-zero): append one line `date -Iseconds` + " <report-name> DONE|BLOCKED|ERROR <one-line gist>" to <signals-path>. Stopping without signaling means the orchestrator may never see your result.
2. **Non-Claude discipline block SIGNAL STEP** - same text (blocks stay parallel).
3. **Rotation handoff schema:** `- Signals file: <path> - unreconciled DONE|BLOCKED|ERROR lines` → `- Event log: last reconciled seq <cursor> (ledger) - unreconciled lifecycle events since it; Signals fallback file: <path> - unreconciled offline DONE|BLOCKED|ERROR lines`.
4. **Consistency sweep:** `rg -n "signal" REFERENCE.md` - SIGNAL STEP mentions elsewhere (codex-exec note "skips final commit/signal steps" is still fine) must not contradict the demotion.

### Task 4: Doc gate + commit (skills worktree)

- [ ] Re-read acceptance criteria 2-5 against the final prose; check each literally satisfied.
- [ ] `rg -n "signals" skills/engineering/fleet-ship/` - every remaining mention is the fallback framing.
- [ ] Commit:

```bash
cd ~/Projects/necmttn-skills/.worktrees/build-28
git add skills/engineering/fleet-ship/SKILL.md skills/engineering/fleet-ship/REFERENCE.md docs/superpowers/plans/2026-07-17-build-28-lifecycle-events.md
git status --porcelain   # verify: no BRIEF.md/REPORT.md staged
git commit -m "docs(fleet-ship): lifecycle events via fleetctl replace /tmp signals as stage-transition truth (#28)"
```

### Task 5: Signal

- [ ] Append `` `date -Iseconds` build-28 DONE|BLOCKED|ERROR <gist>`` to `/tmp/fleet-multi-machine.signals`; on BLOCKED/ERROR also write REPORT.md at the skills worktree root. (This run predates the merged docs - the old signals protocol is still this fleet's active one.)

## Unresolved questions
- None blocking. Note for the report: `epic` is sent in the POST body but the v2 board drops it (decodeEventPost ignores unknown keys) - visible epic attribution would need a board-side field, out of this chunk's scope (events owned by #15).
