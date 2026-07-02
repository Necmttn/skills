# Fleet Ship - Reference

## Engine lanes
| Lane | CLI (unattended) | Use | herdr tracks status? |
|---|---|---|---|
| pigrok (Grok-4.3, fast/cheap) | `pi --model xai-oauth/grok-4.3 --approve` | mechanical build | verify on first spawn; fall back to codex if not |
| codex (GPT-5) | `codex --dangerously-bypass-approvals-and-sandbox` | mechanical build + `/codex:review` | yes |
| opus (Claude) | `claude --dangerously-skip-permissions` | orchestrator, judgment, reactor-subtle, dogfood | yes |

## Build-pane brief template (one line - no newlines/apostrophes; send + `send-keys Enter`)
> Act as a focused implementer for ONE chunk. Read <goal-brief path> (ship-style + chunk specs). Your
> chunk: <ID> - <objective>. You are ALREADY in the isolated worktree on branch <branch> off main; work
> here. FIRST write a short plan (decompose into tasks, name files+tests, sequence) - opus: use
> superpowers:writing-plans. THEN build test-first per task (red→green→refactor) - opus: use
> superpowers:subagent-driven-development. SEAM RULE: mock ONLY non-deterministic leaves (model/LLM, clock,
> net) - NEVER the code path this chunk is named after; if the behavior is user/agent-visible, add one test
> that asserts the real observable effect (e.g. a goal actually appears) at the real seam, not that a mocked
> dispatch was called (delete-the-mock heuristic: if the test still passes with the mock removed, it tests
> nothing). Gates before done: bun run typecheck exits 0, bun run
> verify:effect 0 errors, the <named> suites green. Keep <invariant, e.g. daemon-mode> unchanged. Then
> COMMIT your work on the branch as one conventional commit, then STOP and report commit SHAs, a test
> summary, and any concerns. Do NOT pause to ask how to finish, and do NOT open a PR or push or merge; the
> orchestrator handles review + merge. Begin now.

## Idle-waiter (the notification spine) - COMMIT-GATED
Bare idle false-fires: a pane reports idle while *holding on a background shell* (suite/review), flapping
idle↔working → notification storm. Gate the waiter on a real **commit beyond origin/main** (= chunk done).
`/tmp/herdr_wait.sh`:
```sh
P="$1"; WT="$2"   # agent NAME (chunk id; pane id also works), worktree path (commit-gate)
for i in $(seq 1 160); do
  herdr agent wait "$P" --status idle --timeout 90000 >/dev/null 2>&1   # block efficiently until idle
  if [ -n "$WT" ]; then
    c=$(git -C "$WT" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
    [ "${c:-0}" -gt 0 ] && { echo "DONE: pane $P committed $c"; exit 0; }
    sleep 25   # idle but uncommitted = still holding → keep waiting
  else echo "IDLE: pane $P"; exit 0; fi
done
echo "TIMEOUT: $P"; exit 0
```
Run **in the background** per active pane: `bash /tmp/herdr_wait.sh <name> <worktree>` (run_in_background) →
it exits only on a real commit → the harness re-invokes the orchestrator → sweep. (Pass the worktree to
commit-gate; omit it only for doc/spec panes that may legitimately finish with no further commit.)

**Refinement (canonical build waiter): commit-gate fires on the FIRST commit — but a pane doing logical/incremental commits (task-by-task) isn't done at commit #1.** Require BOTH stable-idle (idle after a ~40s settle, explicit idle/done only) AND `>=1` commit: `wait idle → sleep 40 → status∈{idle,done} && commits>0 → DONE`. Live lesson: a multi-task G0 pane committed Task 1 then kept working; the bare commit-gate merged mid-chunk.

**Refinement 2 (LIVE define_view run — three failures the commit-only gate can't see):**
1. **A build pane can finish gated-green but NOT `git commit`.** Codex is *inconsistent*: same brief, some chunks committed, one finished with work staged/modified but uncommitted -> `rev-list origin/main..HEAD` empty forever -> waiter spins to TIMEOUT (~silent 30-40 min), orchestrator never advances. SAME failure as a dogfood pane leaving work uncommitted -- NOT dogfood-specific. **Gate build panes on stable-idle AND (commit OR dirty-working-tree)**: `dirty=$(git -C "$WT" status --porcelain)`. Emit a DISTINCT signal -- `READY` (committed) vs `READY_UNCOMMITTED` (idle+dirty); on the latter the orchestrator commits the pane's work ITSELF (`git add -A && git commit`) before gating. Belt: every brief must say *"run `git add -A && git commit` before you stop -- an uncommitted worktree is treated as UNFINISHED."*
2. **Panes finish in status `done`, not `idle`.** Codex ends a chunk in `agent_status: done` (terminal), so a waiter gating on `= idle` only loops past a finished pane to TIMEOUT. ALWAYS accept `idle|done` (build AND dogfood waiters).
3. **`herdr agent wait --status idle` is LEVEL-triggered, not edge-triggered** -- returns in ~5ms if already idle, so `wait -> check -> sleep -> loop` gives zero backpressure (just a sleep-poll). `--status done` is a SEPARATE terminal state an idle pane never satisfies -- not a drop-in for "finished a turn." herdr has **no native turn-finished event/webhook**; the only true edge-trigger is `herdr wait output <pane_id> --match <sentinel> --regex` (blocks for NEW output; pane-id ONLY — names rejected, resolve via `agent get <name>`) -- optional fast-path if the pane echoes a sentinel last. Otherwise the git-state gate (commit OR dirty) is the authority.

Corrected canonical build waiter:
```sh
P="$1"; WT="$2"; NAME="${3:-$1}"   # P = agent name (chunk id); agent wait/get resolve names natively
st(){ herdr agent get "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null; }
for i in $(seq 1 240); do
  herdr agent wait "$P" --status idle --timeout 8000 >/dev/null 2>&1   # level-triggered; backpressure via --timeout
  case "$(st)" in idle|done) ;; *) sleep 2; continue;; esac
  sleep 4; case "$(st)" in idle|done) ;; *) continue;; esac              # settle; guard idle flaps
  c=$(git -C "$WT" rev-list --count origin/main..HEAD 2>/dev/null)
  [ "${c:-0}" -gt 0 ] && { echo "READY:$NAME committed=$c"; exit 0; }
  [ -n "$(git -C "$WT" status --porcelain 2>/dev/null)" ] && { echo "READY_UNCOMMITTED:$NAME idle+dirty"; exit 0; }
  sleep 4
done
echo "TIMEOUT:$NAME"; exit 1
```

**Dogfood / non-committing panes need a STABLE-IDLE gate** (they never commit, and flap idle↔working while
driving a running app, so commit-gate and bare-idle both fail). "Done" = idle AND still not-working after a
settle pause:
```sh
P="$1"
for i in $(seq 1 120); do
  herdr agent wait "$P" --status idle --timeout 90000 >/dev/null 2>&1   # block until idle
  sleep 45                                                              # settle
  s=$(herdr agent get "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"].get("agent_status","unknown"))')
  { [ "$s" = idle ] || [ "$s" = done ]; } && { echo "STABLE-IDLE: $P"; exit 0; }  # EXPLICIT idle/done only - treat "unknown" (parse flicker) as still-running, never as done
done
```

## Read a pane (JSON → text)
```sh
herdr agent read <name> --source visible --lines 30 | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["read"]["text"])'
herdr agent get <name>   # {agent_status: idle|working|blocked|done|unknown}; .result.agent.pane_id → pane id for pane-only cmds
```

## Kanban (GitHub Project v2 via gh; needs `project` scope)
```sh
gh project create --owner <user> --title "<title>" --format json        # → number + id (PVT_…)
gh project field-list <num> --owner <user> --format json                # → Status field id + option ids
# add a card (draft) + set Status:
IID=$(gh project item-create <num> --owner <user> --title "<chunk>" --body "<wave·engine·branch·pane·PR>" --format json | jq -r .id)
gh project item-edit --id "$IID" --project-id <PVT_id> --field-id <STATUS_field_id> --single-select-option-id <option_id>
```
Move a card: re-run `item-edit` with the target Status option id (Todo→In Progress→Done). Dogfood findings
= new Todo cards linked (in body) to the chunk.

## Dogfood (tracer-bullet) brief
> Dogfood ONE merged chunk on latest main. Build + run the app (start its datastore, daemon, web). Exercise
> <the chunk's new behavior> end-to-end + a core-flow smoke; capture repro evidence (screenshots/steps). Use
> the dogfood skill. Report a structured findings list (what worked, what broke, repro). Do NOT fix - the
> orchestrator triages findings into kanban cards. If the local stack will not come up cleanly, that IS the
> top finding - report it.

Run dogfood only when test/build panes are quiescent (shared ports/DB collide).
> GATE dogfood panes on the REPORT FILE, not pane status: brief them to write findings to a known path (e.g. scratchpad/dogfood-output/report.md); the waiter polls for that file's existence. herdr status for app-driving panes flickers to `unknown` and breaks status-based waiters (a real 'stuck' — the loop went blind while the dogfood was actually done).

## Sweep checklist (each wake)
1. `herdr agent list` + `git worktree list` - map state.
2. For the woken pane: read → finished? gate (`/review-all` + judgment) → merge → move card → dogfood.
   Blocked? read the blocker, unblock.
3. Re-arm waiters for still-working panes; spawn next-wave independent chunks (engine-routed).
4. Update the ledger (`.superpowers/sdd/…progress.md`) - survives compaction; trust it + `git log` over memory.
