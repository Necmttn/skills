# Fleet Ship - Reference

## Engine lanes
**Live routing config: [`fleet-routing.json`](fleet-routing.json) in THIS skill dir** — the canonical lane
table the orchestrator reads at fleet start (symlinked from `~/.ax/fleet-routing.json`, which is the path
SKILL.md names; edit either, same file). The table below is the narrative companion; the JSON wins.

| Lane | CLI (unattended) | Use | herdr tracks status? |
|---|---|---|---|
| codex (gpt-5.5) | `codex --dangerously-bypass-approvals-and-sandbox` | mechanical build (effectively free) + `codex review` extra review perspective | yes |
| codex-spark (gpt-5.3-codex-spark) | `codex --dangerously-bypass-approvals-and-sandbox -m gpt-5.3-codex-spark` | SMALL well-defined mechanical (crisp spec, 1-3 files, renames/mop-ups/precise edits); 1000+ tok/s on Cerebras, near-instant | yes |
| codex fast-mode | `codex --dangerously-bypass-approvals-and-sandbox -c 'service_tier="fast"' -c features.fast_mode=true` | critical-path mechanical needing FULL gpt-5.5 capability + speed; 1.5x speed at **2.5x credit burn** — per chunk only, never bulk | yes |
| pigrok (Grok-4.3) | `pi --model xai-oauth/grok-4.3 --approve` | burst overflow only (codex saturated) | verify on first spawn; fall back to codex if not |
| fable (Claude) | `claude --model fable --dangerously-skip-permissions` | orchestrator, judgment, user-facing (UI/copy/API design), review, dogfood | yes |
| opus (Claude) | `claude --model opus --dangerously-skip-permissions` | fallback for fable lane; review co-owner | yes |
| opus fast-mode | `claude --model opus --settings '{"fastMode": true}' --dangerously-skip-permissions` | critical-path judgment chunk where latency beats cost; billed higher while active | yes |
| sonnet (Claude) | `claude --model sonnet --dangerously-skip-permissions` | taste-floor user-facing work when fable/opus lanes busy; thin codex-exec wrapper in subagents | yes |

Never Haiku. Always pin `--model` on claude panes. Escalation: gate failure on a cheaper lane = re-spawn same worktree on smarter lane, no asking (intelligence > taste > cost).

**Fast-lane mechanics (verified live 2026-07-02):**
- **Claude:** NO `--fast` CLI flag exists. Launch opt-in = `--settings '{"fastMode": true}'` (the `flagSettings`
  source is the exact check in the binary, and the only path that works headless/SDK). Opus 4.8/4.7 only —
  no effect on fable/sonnet panes. Org allowlist + overage/cooldown can silently drop fast mode mid-run.
  In-session toggle: `/fast`. Kill-switch env: `CLAUDE_CODE_DISABLE_FAST_MODE`.
- **Codex fast mode:** persistent form is `service_tier = "fast"` + `[features] fast_mode = true` in
  `~/.codex/config.toml` (don't — flips every codex run); per-pane `-c` overrides above. Post-launch fallback
  for TUI panes: send `/fast on` + separate `send-keys Enter`; `codex exec` panes have no slash commands →
  `-c` at launch is the ONLY way. ChatGPT sign-in only; API-key auth ignores it (bills standard API pricing).
- **Spark:** research-preview (Pro) — access can vanish; on model-not-found fall back to the plain codex lane.
  Smaller model (above gpt-5.1-codex-mini, below full gpt-5.5-codex): gate HARD, escalate on any ambiguity.
  Docs: https://developers.openai.com/codex/speed

## Pane briefs = CONTEXT section + DISCIPLINE BLOCK
Every brief has two parts. The **CONTEXT section** varies per chunk (spec, bug + repro, files, constraints,
preferred fix, invariants) - write it as richly as the chunk deserves. The **DISCIPLINE BLOCK** is FIXED -
copy the matching variant below verbatim onto the end of EVERY brief, whatever the chunk shape (build, bug
fix, refactor, spike). Live lesson (2026-07-02): a freehanded bug-fix brief had excellent context and even a
TDD sentence, but never told the pane to plan first or use subagent-driven development - the pane ran
unstructured. Rich context does not substitute for the block; the block is what makes panes run the chain.

### Discipline block - Claude panes (fable/opus/sonnet; they have the Skill tool - name the skills)
> WORKFLOW (mandatory): FIRST invoke superpowers:writing-plans and write a short plan (decompose into tasks,
> name files+tests, sequence). THEN build with superpowers:subagent-driven-development - strict TDD per task,
> failing test FIRST (red), then green, then refactor. SEAM RULE (superpowers testing-anti-patterns.md): mock
> ONLY non-deterministic leaves (model/LLM, clock, net), NEVER the code path this chunk is named after; add
> one test asserting the real observable effect at the real seam, not that a mocked dispatch was called
> (delete-the-mock heuristic). GATES before done (superpowers:verification-before-completion): <repo gates,
> e.g. bun run typecheck 0, bun run verify:effect 0, named suites green>. Then run git add -A && git commit
> (one conventional commit; an uncommitted worktree is treated as UNFINISHED), STOP and report commit SHA +
> test summary + concerns. Do NOT pause to ask how to finish; do NOT push, open a PR, or merge - the
> orchestrator owns review + merge.

### Discipline block - non-Claude panes (codex/pi; no Skill tool - same discipline spelled out)
> WORKFLOW (mandatory): FIRST write a short plan before touching code (decompose into tasks, name files+tests,
> sequence). THEN strict TDD per task: write the failing test FIRST (<repo test framework note, e.g. vitest -
> import from "vitest", NO bun:test, no toStartWith>), run it and see it fail, make it pass, refactor. SEAM
> RULE: mock ONLY non-deterministic leaves (model/LLM, clock, net), NEVER the code path this chunk is named
> after; add one test asserting the real observable effect at the real seam, not that a mocked dispatch was
> called (if the test still passes with the mock removed, it tests nothing). Read CLAUDE.md for repo
> conventions. GATES before done: <repo gates>. Then run git add -A && git commit (one conventional commit;
> an uncommitted worktree is treated as UNFINISHED), STOP and report commit SHA + test summary + concerns.
> Do NOT pause to ask how to finish; do NOT push, open a PR, or merge - the orchestrator owns review + merge.

## Build-pane brief template (one line - no newlines/apostrophes; send + `send-keys Enter`)
Example of CONTEXT + block fused for a standard build chunk; for other shapes (bug fix, refactor) write your
own context and append the block above.
> Act as a focused implementer for ONE chunk. Read <goal-brief path> (ship-style + chunk specs). Your
> chunk: <ID> - <objective>. You are ALREADY in the isolated worktree on branch <branch> off main; work
> here. FIRST write a short plan (decompose into tasks, name files+tests, sequence) - claude panes: use
> superpowers:writing-plans. THEN build test-first per task (red→green→refactor) - claude panes: use
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

## Archive a pane result before close (housekeeping)
```sh
# 1. capture (name-addressed) → the git-tracked run archive
mkdir -p docs/superpowers/fleet-runs
{ echo "## $NAME"; echo "PR #$PR · $COMMIT · gate: $VERDICT"; echo;
  herdr agent read "$NAME" --source recent --lines 400 \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["read"]["text"])'; echo;
} >> "docs/superpowers/fleet-runs/$EPIC.md"
git add "docs/superpowers/fleet-runs/$EPIC.md" && git commit -m "chore(fleet): archive $NAME result"
# 2. THEN teardown
PID=$(herdr agent get "$NAME" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["pane_id"])')
herdr pane close "$PID"; git worktree remove .claude/worktrees/$NAME --force; git branch -D feat/$NAME
```
Restore: `cat docs/superpowers/fleet-runs/$EPIC.md` (authority) or `herdr session attach $NAME` (live, while it persists).
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
