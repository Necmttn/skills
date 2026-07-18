# Fleet Ship - Reference

## Machine-namespaced identity
The slug minted by `fleetctl join --name <slug>` is the machine id. Keep these three values distinct:

- `NAME=<chunk-id>` — bare, server-local herdr agent name; the pane label displays the same chunk id.
- `REPORT_NAME=<machine-slug>/<chunk-id>` — required in every ledger/card/map entry, lifecycle event,
  attention line, archive/handoff, and report that leaves the machine.
- `FLEET_TAB_LABEL=fleet:<epic>` on primary; `fleet:<epic>@<slug>` on every non-primary machine.

Template placeholders `<name>` mean the bare local herdr name; `<report-name>` means the qualified external
identity. Drive another server only by executing the whole command there, for example
`ssh <host> 'herdr agent send <name> "..."'`; keep `<host>` explicit on every read/send/wait/pane/tab call.
Never assume names are globally unique, point a local client at a remote socket, or combine a driving
subcommand with `herdr --remote`; `--remote` is interactive UI-attach only.

## Engine lanes
**Live routing config: [`fleet-routing.json`](fleet-routing.json) in THIS skill dir** — the canonical lane
table the orchestrator reads at fleet start (symlinked from `~/.ax/fleet-routing.json`, which is the path
SKILL.md names; edit either, same file). The table below is the narrative companion; the JSON wins.

| Lane | CLI (unattended) | Use | herdr tracks status? |
|---|---|---|---|
| codex (gpt-5.5) | `codex --dangerously-bypass-approvals-and-sandbox -c model_reasoning_effort="medium"` | mechanical build (effectively free) + `codex review` extra review perspective | yes |
| codex-spark (gpt-5.3-codex-spark) | `codex --dangerously-bypass-approvals-and-sandbox -m gpt-5.3-codex-spark` | SMALL well-defined mechanical (crisp spec, 1-3 files, renames/mop-ups/precise edits); 1000+ tok/s on Cerebras, near-instant | yes |
| codex fast-mode | `codex --dangerously-bypass-approvals-and-sandbox -c 'service_tier="fast"' -c features.fast_mode=true` | critical-path mechanical needing FULL gpt-5.5 capability + speed; 1.5x speed at **2.5x credit burn** — per chunk only, never bulk | yes |
| pigrok (Grok-4.3) | `pi --model xai-oauth/grok-4.3 --approve` | burst overflow only (codex saturated) | verify on first spawn; fall back to codex if not |
| fable (Claude) | `claude --model fable --dangerously-skip-permissions` | orchestrator, scoping/planning/spec authoring, review of plans/reports/diffs ONLY (2026-07-12 steer - never a build or dogfood lane) | yes |
| opus (Claude) | `claude --model opus --dangerously-skip-permissions` | judgment lane (reactor-subtle, security, multi-file design); review co-owner; fable fallback | yes |
| opus fast-mode | `claude --model opus --settings '{"fastMode": true}' --dangerously-skip-permissions` | critical-path judgment chunk where latency beats cost; billed higher while active | yes |
| sonnet (Claude) | `claude --model sonnet --dangerously-skip-permissions` | taste-floor user-facing work when opus lane busy; **dogfood default**; thin codex-exec wrapper in subagents | yes |

Never Haiku on panes or any review/judgment (read-only locate SUBAGENT dispatches may use it per
`efficient-dispatch`). Always pin `--model` on claude panes. Thinking level is pinnable per claude pane too:
`--effort low|medium|high|xhigh|max` (verified 2026-07-16) - dogfood/mechanical-ish claude spawns take
`--effort low` or `medium`; judgment/review panes leave it unset (session default). CAUTION: an invalid
effort value only WARNS and silently falls back to the default - spell it exactly. Subagent dispatches from the orchestrator or
inside Claude panes follow `efficient-dispatch`: mechanical → explicit `model:'sonnet'`, pure locate →
`'haiku'`, judgment/review → strong model. Escalation: gate failure on a cheaper lane = re-spawn same
worktree on smarter lane, no asking (intelligence > taste > cost).

**Codex thinking level:** global `~/.codex/config.toml` sets `model_reasoning_effort = "max"` — right for
tandem/review, wasteful on mechanical lanes. Mechanical + spark lanes pin `-c model_reasoning_effort="medium"`
(2026-07-16); tandem pins `"max"` explicitly. Escalate effort together with the lane on gate failure.

### Fleet-ship script location
The bundled launch verifier resolves its sibling `monitor-tail.py` itself. `FLEET_SHIP_DIR` is only a shell
shorthand for the directory containing this `REFERENCE.md`; set it once when a copied `/tmp` monitor needs to
call `monitor-tail.py`:

```sh
# From a source checkout (run at that checkout's root):
export FLEET_SHIP_DIR="$PWD/skills/engineering/fleet-ship"
# From an installed skill: use the actual directory/symlink target that contains REFERENCE.md.
# Example: export FLEET_SHIP_DIR="$HOME/.claude/skills/fleet-ship"
test -f "$FLEET_SHIP_DIR/scripts/monitor-tail.py" || { echo "fleet-ship scripts not found"; exit 2; }
```

**Codex pane launch protocol (verified live 2026-07-16 - REQUIRED, panes die otherwise):** codex TUI
launched with `--dangerously-bypass-approvals-and-sandbox` boots into a Yes/No trust MODAL, and ANY text
delivered while the modal is up (`agent send`, `pane send-text`) CRASHES the pane - this reads as "codex
died on brief". `working` alone is NOT proof that the argv prompt ran: the startup spinner also reports
`working`. Protocol: (1) pass the brief pointer plus a unique turn token AS AN ARGUMENT at spawn; (2) wait
for boot (~10s), then send ONE bare `herdr pane send-keys <pane> Enter` on that server to accept the modal;
(3) before any further send or waiter, use the bounded check below. It requires an acceptable status
(`working|idle|done`), the token in the normalized tail, **and substantive Codex `•` activity after that
prompt**. The echoed prompt itself is not evidence. A deadline emits `BOOT_HUNG` and rings; it NEVER
auto-kills the pane.

```sh
# Run this on the pane's server. The bundled command resolves monitor-tail.py beside itself.
N=<chunk-id>; WT=<worktree>; TAB=<fleet-tab-id>; REPORT_NAME=<machine-slug>/<chunk-id>
bash "$FLEET_SHIP_DIR/scripts/verify-codex-launch.sh" "$N" "$WT" "$TAB" "$REPORT_NAME" <fleet-id>
```

For a remote pane, the script must exist on that server (source checkout or installed skill). Run this
**Bash** caller locally; `%q` encodes every dynamic argument into one remote command, so the script's own
Python snippets never collide with an outer `ssh` quote:

```bash
REMOTE_FLEET_SHIP_DIR=/absolute/path/to/fleet-ship
FLEET_ID=<fleet-id>
remote_command=(bash "$REMOTE_FLEET_SHIP_DIR/scripts/verify-codex-launch.sh" "$N" "$WT" "$TAB" "$REPORT_NAME" "$FLEET_ID")
ssh "$HOST" "$(printf '%q ' "${remote_command[@]}")"
```

Do not send more text until `BOOT_READY`; the argv brief is the first turn. A quickly completed argv brief
may already be `idle` or `done`, which is valid proof and then follows the normal waiter contract. Headless
alternative when no steering is needed: `codex exec --dangerously-bypass-approvals-and-sandbox "<brief>"`
(no TUI, no modal; terminal status `done`; NOTE codex exec often skips final commit/signal steps - expect the
waiter's READY_UNCOMMITTED path). Unquoted `-c key=value` overrides are a separate instant-death (TOML parse):
always single-quote, e.g. `-c 'model_reasoning_effort="medium"'`.

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

### Skill availability probe (run BEFORE choosing the brief variant)
A brief never loads a skill - the pane resolves skills from ITS OWN machine+user environment. Per
machine+user (once per fleet run, ledger-cached):
- probe: `ls ~/.claude/skills` locally, or `ssh <target> 'ls ~/.claude/skills'` for a remote pane
  (the PANE user's home). Plugin-namespaced skills (`superpowers:*`, `caveman:*`) need the plugin
  installed under that user - a file listing won't show them; check `claude plugins list` there if in doubt.
- every skill the Claude-variant block names must be present; ANY miss -> use the non-Claude variant
  (inline discipline) for that pane, or sync skills to the box first and re-probe.
- force-triggering a skill/command in a claude pane: send the slash command as its OWN message -
  `herdr agent send <name> "/skill-name <args>"` then `herdr pane send-keys <pane> Enter` - then
  `agent read` to confirm the command/skill banner loaded before sending follow-up context. A skill
  named mid-paragraph in a long brief is advisory prose, not a trigger. For a remote pane, execute each
  of those commands separately as `ssh <host> 'herdr ...'`.
- failure mode this prevents (2026-07-16 workbox): a remote pane briefed with skill names it didn't
  have "followed along" without plan/TDD/verification gates - output looked compliant, wasn't.

### Discipline block - Claude panes (fable/opus/sonnet; they have the Skill tool - name the skills)
> WORKFLOW (mandatory): FIRST invoke superpowers:writing-plans and write a short plan (decompose into tasks,
> name files+tests, sequence). THEN build with superpowers:subagent-driven-development - strict TDD per task,
> failing test FIRST (red), then green, then refactor. SEAM RULE (superpowers testing-anti-patterns.md): mock
> ONLY non-deterministic leaves (model/LLM, clock, net), NEVER the code path this chunk is named after; add
> one test asserting the real observable effect at the real seam, not that a mocked dispatch was called
> (delete-the-mock heuristic). SUBAGENT ROUTING (efficient-dispatch): every implementer/mechanical subagent
> you dispatch sets model:'sonnet' explicitly (pure search/locate: 'haiku'); reviewer/judgment subagents keep
> your model - never send review to a cheaper model, never let a mechanical dispatch inherit yours.
> WORKTREE GUARD: you and EVERY subagent you dispatch work ONLY in this worktree
> (pwd must match it before any git command); NEVER cd to or commit in the primary checkout - two live
> incidents (2026-07-04/05) had task subagents commit to main's checkout (recovered by cherry-pick + reset,
> uncommitted work at risk). Run gates FROM the worktree too (a gate run from the main checkout silently
> tests the wrong tree). GATES before done (superpowers:verification-before-completion): <repo gates,
> e.g. bun run typecheck 0, bun run verify:effect 0, named suites green - capture tsc's REAL exit code, never
> pipe it through tail/grep before checking $? (a piped exit masked a real TS error twice)>. Then run git add -A && git commit
> (one conventional commit; an uncommitted worktree is treated as UNFINISHED), STOP and report as
> `<report-name>`: commit SHA + test summary + concerns. Do NOT pause to ask how to finish; do NOT push,
> open a PR, or merge - the orchestrator owns review + merge. SIGNAL STEP (mandatory, LAST, even on failure):
> emit the lifecycle event - on DONE (work committed) run `bun ~/Projects/fleetboard/fleetctl.ts event
> BUILT --machine <machine-slug> --chunk <chunk-id> --gist "<one-line gist>"` (DONE maps to BUILT at
> commit); on BLOCKED/ERROR there is no lifecycle stage - ring
> `bun ~/Projects/fleetboard/fleetctl.ts attn <fleet-id> "<report-name> BLOCKED|ERROR: <one-line gist>"`
> and write the detail + what you need into REPORT.md at the worktree root. FALLBACK only when the board
> is unreachable (the fleetctl command exits non-zero): append one line
> `date -Iseconds` + " <report-name> DONE|BLOCKED|ERROR <one-line gist>" to <signals-path>. Stopping
> without signaling means the orchestrator may never see your result.

### Discipline block - non-Claude panes (codex/pi; no Skill tool - same discipline spelled out)
> WORKFLOW (mandatory): FIRST write a short plan before touching code (decompose into tasks, name files+tests,
> sequence). THEN strict TDD per task: write the failing test FIRST (<repo test framework note, e.g. vitest -
> import from "vitest", NO bun:test, no toStartWith>), run it and see it fail, make it pass, refactor. SEAM
> RULE: mock ONLY non-deterministic leaves (model/LLM, clock, net), NEVER the code path this chunk is named
> after; add one test asserting the real observable effect at the real seam, not that a mocked dispatch was
> called (if the test still passes with the mock removed, it tests nothing). Read CLAUDE.md for repo
> conventions. WORKTREE GUARD: work ONLY in this worktree; never cd to or commit in the primary checkout;
> run gates from the worktree. GATES before done: <repo gates, real exit codes - never pipe tsc through
> tail/grep before checking $?>. Then run git add -A && git commit (one conventional commit;
> an uncommitted worktree is treated as UNFINISHED), STOP and report as `<report-name>`: commit SHA + test
> summary + concerns.
> Do NOT pause to ask how to finish; do NOT push, open a PR, or merge - the orchestrator owns review + merge. SIGNAL
> STEP (mandatory, LAST, even on failure): emit the lifecycle event - on DONE (work committed) run
> `bun ~/Projects/fleetboard/fleetctl.ts event BUILT --machine <machine-slug> --chunk <chunk-id> --gist
> "<one-line gist>"` (DONE maps to BUILT at commit); on BLOCKED/ERROR there is no lifecycle stage - ring
> `bun ~/Projects/fleetboard/fleetctl.ts attn <fleet-id> "<report-name> BLOCKED|ERROR: <one-line gist>"`
> and write the detail + what you need into REPORT.md at the worktree root. FALLBACK only when the board
> is unreachable (the fleetctl command exits non-zero): append one line `date -Iseconds` + " <report-name>
> DONE|BLOCKED|ERROR <one-line gist>" to <signals-path>. Stopping without signaling means the orchestrator
> may never see your result.

## Build-pane brief template (one line - no newlines/apostrophes; send + `send-keys Enter`)
Example of CONTEXT + block fused for a standard build chunk; for other shapes (bug fix, refactor) write your
own context and append the block above.
> Act as a focused implementer for ONE chunk. Read <goal-brief path> (ship-style + chunk specs). Your
> chunk: local herdr name <ID>, external report name <report-name> - <objective>. You are ALREADY in the
> isolated worktree on branch <branch> off main; work
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
idle↔working → notification storm. Gate the waiter on a polled `idle|done` status plus a real
**commit beyond origin/main** (= chunk done).
`/tmp/herdr_wait.sh`:
```sh
P="$1"; WT="$2"; REPORT_NAME="${3:?pass machine-slug/chunk-id}"   # P stays the bare local agent name
st(){ herdr agent get "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null; }
for i in $(seq 1 160); do
  herdr agent wait "$P" --status idle --timeout 90000 >/dev/null 2>&1 || :  # backpressure only; ignore its exit code
  case "$(st)" in idle|done) ;; *) sleep 2; continue;; esac
  if [ -n "$WT" ]; then
    c=$(git -C "$WT" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
    [ "${c:-0}" -gt 0 ] && { echo "DONE:$REPORT_NAME committed=$c"; exit 0; }
    sleep 25   # idle but uncommitted = still holding → keep waiting
  else echo "IDLE_OR_DONE:$REPORT_NAME"; exit 0; fi
done
echo "TIMEOUT:$REPORT_NAME"; exit 0
```
NOTE (2026-07-05): if the orchestrator's harness reaps long-running background shells (waiters killed
repeatedly), fall back to ScheduleWakeup/timed polling - less responsive, kill-proof.
Run **on the pane's machine** in the background per active pane:
`bash /tmp/herdr_wait.sh <name> <worktree> <report-name>` (through `ssh <host> '...'` when remote) →
it exits only on polled `idle|done` plus a real commit → the harness re-invokes the orchestrator → sweep.
(Pass the worktree to commit-gate; omit it only for doc/spec panes that may legitimately finish with no
further commit.)

**Refinement (canonical build waiter): commit-gate fires on the FIRST commit — but a pane doing logical/incremental commits (task-by-task) isn't done at commit #1.** Require BOTH stable terminal status (two `agent get` polls accepting explicit `idle|done`, separated by a settle) AND `>=1` commit: `wait idle (exit ignored) → poll status → settle → poll status && commits>0 → DONE`. Live lesson: a multi-task G0 pane committed Task 1 then kept working; the bare commit-gate merged mid-chunk.

**Refinement 2 (LIVE define_view run — three failures the commit-only gate can't see):**
1. **A build pane can finish gated-green but NOT `git commit`.** Codex is *inconsistent*: same brief, some chunks committed, one finished with work staged/modified but uncommitted -> `rev-list origin/main..HEAD` empty forever -> waiter spins to TIMEOUT (~silent 30-40 min), orchestrator never advances. SAME failure as a dogfood pane leaving work uncommitted -- NOT dogfood-specific. **Gate build panes on stable-idle AND (commit OR dirty-working-tree)**: `dirty=$(git -C "$WT" status --porcelain)`. Emit a DISTINCT signal -- `READY` (committed) vs `READY_UNCOMMITTED` (idle+dirty); on the latter the orchestrator commits the pane's work ITSELF (`git add -A && git commit`) before gating. Belt: every brief must say *"run `git add -A && git commit` before you stop -- an uncommitted worktree is treated as UNFINISHED."*
2. **Panes finish in status `done`, not `idle`.** Codex ends a chunk in `agent_status: done` (terminal), so a waiter gating on `= idle` only loops past a finished pane to TIMEOUT. ALWAYS accept `idle|done` (build AND dogfood waiters).
3. **Wait trap (verified live): `herdr agent wait --status idle` is LEVEL-triggered and only a backpressure hint.** Against a real `done` pane it resolves in ~10ms but exits 1, while its payload's `agent_status` remains `done`; ignore that exit code and poll `herdr agent get`, accepting `idle|done`. Never pass `--status done` to `herdr agent wait` — it is hard-rejected. When `done` must be a first-class wait target, resolve the pane id with `agent get` and use `herdr wait agent-status <pane_id> --status done`. herdr has **no native turn-finished event/webhook**; the only true edge-trigger is `herdr wait output <pane_id> --match <sentinel> --regex` (blocks for NEW output; pane-id ONLY — names rejected, resolve via `agent get <name>`) -- optional fast-path if the pane echoes a sentinel last. Otherwise the git-state gate (commit OR dirty) is the authority.

Corrected canonical build waiter:
```sh
P="$1"; WT="$2"; REPORT_NAME="${3:?pass machine-slug/chunk-id}"   # P stays the bare local name
st(){ herdr agent get "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null; }
for i in $(seq 1 240); do
  herdr agent wait "$P" --status idle --timeout 8000 >/dev/null 2>&1 || :  # backpressure only; ignore its exit code
  case "$(st)" in idle|done) ;; *) sleep 2; continue;; esac
  sleep 4; case "$(st)" in idle|done) ;; *) continue;; esac              # settle; guard idle flaps
  c=$(git -C "$WT" rev-list --count origin/main..HEAD 2>/dev/null)
  [ "${c:-0}" -gt 0 ] && { echo "READY:$REPORT_NAME committed=$c"; exit 0; }
  [ -n "$(git -C "$WT" status --porcelain 2>/dev/null)" ] && { echo "READY_UNCOMMITTED:$REPORT_NAME idle+dirty"; exit 0; }
  sleep 4
done
echo "TIMEOUT:$REPORT_NAME"; exit 1
```

**Dogfood / non-committing panes need a STABLE-IDLE gate** (they never commit, and flap idle↔working while
driving a running app, so commit-gate and bare-idle both fail). "Done" = a polled `idle|done` status both
before AND after a settle pause:
```sh
P="$1"; REPORT_NAME="${2:?pass machine-slug/chunk-id}"   # P stays the bare local name
st(){ herdr agent get "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null; }
for i in $(seq 1 120); do
  herdr agent wait "$P" --status idle --timeout 90000 >/dev/null 2>&1 || :  # backpressure only; ignore its exit code
  case "$(st)" in idle|done) ;; *) sleep 2; continue;; esac
  sleep 45                                                               # settle
  case "$(st)" in idle|done) echo "STABLE-IDLE:$REPORT_NAME"; exit 0;; esac # parse failure/unknown stays running
done
```

## Liveness monitor (the SECOND spine - catches stuck/errored/dead; waiters only catch done)
The idle-waiter blocks until `idle|done`, so it is BLIND to a pane that errored, froze mid-`working`, or went
`unknown` - that pane just spins to a silent ~30-40 min TIMEOUT. Run ONE monitor loop for the whole fleet
(`run_in_background`, re-arming) alongside the per-pane waiters. It **rings** the orchestrator on a caught
pane (via `fleetctl attn` + PushNotification); it never auto-kills - the orchestrator classifies the tail and
recovers (close dead pane → re-spawn grok→codex→fable/opus in the same installed worktree).

Error signatures (grep the tail case-insensitively - extend per engine):
`out of credits|rate.?limit|429|403|5[0-9][0-9] (Bad Gateway|Internal|Service)|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network error|connection (refused|reset|closed)|socket hang up|fetch failed|panic|Traceback|FATAL|command not found|No such file`

Use the tracked `scripts/monitor-tail.py` helper rather than copying terminal-UI regexes into monitor loops.
It normalizes only known volatile Codex chrome: startup spinner elapsed time, `esc to interrupt`, and
context-percentage footers. It preserves real commands, logs, model output, and errors. Its public regression
check is `python3 scripts/test-monitor-tail.py` from this skill directory.

`/tmp/herdr_monitor.sh` - sweeps ALL active fleet panes; state file diffs normalized progress across sweeps:
```sh
STATE="${1:-/tmp/herdr_monitor_state}"; STALL_SWEEPS="${2:-4}"   # 4 sweeps × ~120s ≈ 8 min stuck-threshold
MACHINE_SLUG="${MACHINE_SLUG:?export the fleetctl join machine slug}"
NORMALIZER="${FLEET_SHIP_DIR:-}/scripts/monitor-tail.py"
[ -f "$NORMALIZER" ] || { echo "ERRORED:monitor missing monitor-tail helper; set FLEET_SHIP_DIR as above"; exit 2; }
# export NAMES="chunk-a chunk-b …" (your fleet's chunk ids) OR export FLEET_TAB=<fleet tab id> (filtered client-side; herdr agent list takes no flags) before running - scoping is mandatory
SIG='out of credits|rate.?limit|429| 403 | 5[0-9][0-9] |ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network error|connection (refused|reset|closed)|socket hang up|fetch failed|panic|Traceback|FATAL|command not found'
touch "$STATE"
for sweep in $(seq 1 720); do          # ~24h at 120s; re-arm from the orchestrator on exit
  # Scope to THIS fleet's chunk names ONLY - never ring on the orchestrator or a sibling fleet's panes.
  # Set NAMES to your chunk ids ("chunk-a chunk-b …") OR filter agent list by your fleet tab id.
  NAMES="${NAMES:-$(herdr agent list | python3 -c 'import sys,json,os;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name") and a.get("tab_id")==os.environ.get("FLEET_TAB")]' 2>/dev/null)}"
  for N in $NAMES; do
    REPORT_NAME="$MACHINE_SLUG/$N"
    WT=".claude/worktrees/$N"
    g=$(herdr agent get "$N" 2>/dev/null); [ -z "$g" ] && { echo "DEAD:$REPORT_NAME gone from agent list"; continue; }   # vanished → ring+respawn
    st=$(printf '%s' "$g" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null)
    tail=$(herdr agent read "$N" --source recent --lines 40 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["read"]["text"])' 2>/dev/null)
    # ERRORED - ring NOW, don't wait out the stall window
    if printf '%s' "$tail" | grep -Eiq "$SIG"; then
      line=$(printf '%s' "$tail" | grep -Ei "$SIG" | tail -1)
      echo "ERRORED:$REPORT_NAME :: $line"; continue
    fi
    # progress fingerprint: status + normalized-tail fingerprint + commits-beyond-main.
    # A spinner that changes only elapsed time now remains unchanged; real output still changes it.
    c=$(git -C "$WT" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
    h=$(printf '%s' "$tail" | python3 "$NORMALIZER" fingerprint)
    fp="$st:$h:$c"
    prev=$(grep "^$N	" "$STATE" | cut -f2); cnt=$(grep "^$N	" "$STATE" | cut -f3); cnt=${cnt:-0}
    if [ "$fp" = "$prev" ]; then cnt=$((cnt+1)); else cnt=0; fi
    grep -v "^$N	" "$STATE" > "$STATE.tmp" 2>/dev/null; printf '%s\t%s\t%s\n' "$N" "$fp" "$cnt" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"
    # STUCK - no change for STALL_SWEEPS while NOT idle/done (idle/done is the waiter's job, not a stall)
    case "$st" in idle|done) : ;; *) [ "$cnt" -ge "$STALL_SWEEPS" ] && echo "STUCK:$REPORT_NAME status=$st unchanged ${cnt}×";; esac
  done
  sleep 120   # backpressure between sweeps (fine inside a background script - same as the waiter scripts above)
done
```
Any `ERRORED:` / `STUCK:` / `DEAD:` / `BOOT_HUNG:` line the orchestrator sees on the background task's output → read that
pane's tail, classify (real long compile vs frozen), and recover per Hard rules. `STALL_SWEEPS` guards a legit long suite:
a pane running tests has *meaningful changing* output (fingerprint moves → cnt resets); only an inert pane, including a
timer-only boot spinner, accumulates cnt. Tune the threshold up for repos with multi-minute compiles. `BOOT_HUNG` is
raised by the separate bounded spawn verifier, not by the waiter; preserve that pane and classify it before any recovery.
NOTE: if the harness reaps this background shell (same risk as the waiters), fall back to a `ScheduleWakeup`-timed sweep
that runs the loop body ONCE per orchestrator wake - kill-proof, less responsive.

## Read a pane (JSON → text)
```sh
herdr agent read <name> --source visible --lines 30 | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["read"]["text"])'
herdr agent get <name>   # {agent_status: idle|working|blocked|done|unknown}; .result.agent.pane_id → pane id for pane-only cmds
ssh <host> 'herdr agent read <name> --source visible --lines 30'   # required form from another machine
```

## Archive a pane result before close (housekeeping)
```sh
# NAME is the bare local herdr target; REPORT_NAME is <machine-slug>/<chunk-id>.
# Run each herdr command on the pane's server; from elsewhere use ssh <host> 'herdr ...'.
# 1. capture (name-addressed) → the git-tracked run archive
mkdir -p docs/superpowers/fleet-runs
{ echo "## $REPORT_NAME"; echo "PR #$PR · $COMMIT · gate: $VERDICT"; echo;
  herdr agent read "$NAME" --source recent --lines 400 \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["read"]["text"])'; echo;
} >> "docs/superpowers/fleet-runs/$EPIC.md"
git add "docs/superpowers/fleet-runs/$EPIC.md" && git commit -m "chore(fleet): archive $REPORT_NAME result"
# 2. THEN teardown (capture the worktree's ABSOLUTE path before removing it)
PID=$(herdr agent get "$NAME" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["pane_id"])')
WT="$(cd ".claude/worktrees/$NAME" && pwd)"
herdr pane close "$PID"; git worktree remove .claude/worktrees/$NAME --force; git branch -D feat/$NAME
# 3. DerivedData sweep - each Xcode build in a worktree mints ~/Library/Developer/Xcode/DerivedData/<App>-<hash>,
#    5-9GB per app; unswept they pile up (394GB / 80 dirs, live lesson 2026-07-17).
#    Match ONLY by exact WorkspacePath inside the removed worktree - never by app-name pattern
#    (concurrent fleets build the same app from other worktrees).
for p in ~/Library/Developer/Xcode/DerivedData/*/info.plist; do
  case "$(/usr/libexec/PlistBuddy -c 'Print :WorkspacePath' "$p" 2>/dev/null)" in
    "$WT"/*) rm -rf "$(dirname "$p")";;
  esac
done
```
Restore: `cat docs/superpowers/fleet-runs/$EPIC.md` (authority) or local
`herdr session attach $NAME`; for a remote interactive re-entry use
`herdr --remote <host> --session <session>` (UI attach only, never a driving-command prefix).

## Teardown

```sh
scripts/fleet-teardown.sh <ledger-path> --epic <epic> [--archive-dir docs/superpowers/fleet-runs] [--execute]
```

| Flag | Meaning |
|---|---|
| `--epic <epic>` | Required archive filename stem. |
| `--archive-dir <dir>` | Capture destination; defaults to `docs/superpowers/fleet-runs`. |
| `--execute` | Archive and close exact ledger resources. Without it, the script only prints its dry-run plan. |

The ledger grammar is `RES <tab|pane|agent|workspace> <id> <label>` for minted resources,
`CLOSED <id>` after each resource is reconciled, and
`TEARDOWN-DONE <n closed> <timestamp>` after teardown verifies no recorded panes or agents survive.
Re-running the dry-run against the last run's ledger is the teardown smoke test; every resource should
show `already-closed`.

## Kanban (GitHub Project v2 via gh; needs `project` scope)
```sh
gh project create --owner <user> --title "<title>" --format json        # → number + id (PVT_…)
gh project field-list <num> --owner <user> --format json                # → Status field id + option ids
# add a card (draft) + set Status:
IID=$(gh project item-create <num> --owner <user> --title "<report-name>" --body "<wave·engine·branch·pane=<report-name>·PR>" --format json | jq -r .id)
gh project item-edit --id "$IID" --project-id <PVT_id> --field-id <STATUS_field_id> --single-select-option-id <option_id>
```
Move a card: re-run `item-edit` with the target Status option id (Todo→In Progress→Done). Dogfood findings
= new Todo cards linked (in body) to the chunk.

## Tandem orchestrator brief (codex, max reasoning - spawn into the orchestrator tab)
> You are the TANDEM co-orchestrator for fleet <epic>. The orchestrator is agent <orchestrator-name>
> (fable). Your job, on a ~10 min loop: (1) WATCHDOG - read the orchestrator pane tail
> (herdr agent read <orchestrator-name> --lines 40), the run ledger at <ledger-path>, and herdr agent list;
> flag starvation (no wake progress AND no new commits on fleet branches - always check commits before
> flagging), context bloat past the rotation threshold, parked drafts blocking steering (log the draft,
> then follow the submit protocol), dead waiters/monitor. On a finding: send ONE terse message to the
> orchestrator (herdr agent send <orchestrator-name> "TANDEM: <finding + suggested action>" then a separate
> Enter); if the same cause blocks 2 consecutive cycles, ring the bell (fleetctl attn <fleet-id> "...").
> (1b) ROTATION TRIGGERS - you, not the orchestrator, hold these. Each loop: read the orchestrator
> pane's VISIBLE bottom lines (herdr agent read <orchestrator-name> --source visible --lines 8) and grep
> for the context indicator (percent + "auto-compact"/"context left"); if context usage >= ~70-75%, OR the
> ledger's last rotation/start stamp is > 5h old, OR the same rotation-blocking cause appears 2 loops in a
> row, send EXACTLY ONE atomic instruction: "ROTATE NOW: write the rotation handoff per REFERENCE schema,
> commit it, then park with an empty prompt" - then verify next loop that a fresh handoff commit exists and
> the prompt is empty; if not after 2 loops, ring the bell (incident).
> (2) JUDGE - when you receive a message starting TANDEM-JUDGE:, read ONLY the pointers given (plan
> section, diff paths, review verdicts) and reply with a terse verdict + 3-line reasoning. You are ADVISORY:
> never edit files, merge, spawn, or kill anything. Read-only on the repo.

## Steward brief (spawn-on-assign contract - see SKILL.md 'Steward mode')
The Mac orchestrator spawns a steward when the scheduler assigns chunks to a machine - fable (opus
fallback), local pane name `steward:<epic>`, into that machine's `fleet:<epic>@<slug>` tab (intentional:
ONE tab per machine - the steward shares its machine's fleet tab rather than minting its own, unlike the
Mac orchestrator's dedicated pane). Long briefs
travel as files (hard rule): write this template to the machine, spawn with a short pointer, e.g.
`ssh <host> 'herdr agent start steward:<epic> --tab <tab_id> -- claude --model fable
--dangerously-skip-permissions'` then send "Read <brief path> and execute it fully". This template IS a
CONTEXT + discipline contract - send it whole, placeholders filled; do not freehand it.
> You are the STEWARD for machine <slug> in fleet <epic> - the on-demand per-machine orchestrator
> (read fleet-ship SKILL.md, esp. 'Steward mode' + 'Per-chunk loop'). Register on fleetboard as a new
> instance; heartbeat each wake. QUEUE: read THIS machine's assigned chunks from the board (the placement
> interface assigns chunks to <slug>; you never place chunks yourself). HOLD TAGS: a hold-tagged chunk is
> NOT yours to spawn - leave it queued and list it in your handoff. Per assigned chunk run the fleet-ship
> per-chunk loop LOCALLY on this machine: worktree + install → spawn engine-routed pane into the
> fleet:<epic>@<slug> tab (local herdr name = bare <chunk-id>; RES ledger line at mint) → brief = CONTEXT
> + verbatim DISCIPLINE BLOCK → arm the commit-gated waiter AND the liveness monitor ON THIS MACHINE
> (never held open over ssh) → cross-model consensus gate → merge under the main-merge claim →
> archive-then-close. Emit the lifecycle event at EVERY stage transition you own -
> `bun ~/Projects/fleetboard/fleetctl.ts event <STAGE> --machine <slug> --chunk <chunk-id> --epic <epic>
> --gist "<one-line>"`, vocabulary ASSIGNED→PLANNED→BUILT→IN_REVIEW→GATED→MERGED (BUILT is pane-pushed by
> your panes' SIGNAL STEP - emit it yourself only on READY_UNCOMMITTED, never a duplicate); DOGFOODED
> belongs to the Mac orchestrator - never emit it. File `follow-up` issues at your own gate triage. NAMING: every off-machine surface (events, ledger, archive,
> attn/bell, handoff, reports) says <slug>/<chunk-id>; local herdr names stay bare. NOT YOURS: wave
> planning, chunk placement, hold tagging, kanban/run-map edits, dogfood triggering, the human interface -
> the Mac orchestrator keeps those; ring `fleetctl attn <fleet-id> "<slug>/... <ask>"` for anything
> needing a human. ROTATION: the orchestrator rotation triggers apply to you VERBATIM (~70-75% context,
> 4-6h wall clock, 2 same-cause blocked cycles, user says rotate) - on any trigger write the rotation
> handoff (REFERENCE schema incl. Machine + hold-tag lines), commit it, park with an empty prompt; your
> successor re-derives from the board + local herdr state. EXIT-ON-EMPTY (mandatory): queue empty →
> ledger-driven teardown (archive-then-close every RES-line resource by exact id, verify zero remain) →
> write the same rotation handoff (machine slug + held-claim state filled) → confirm the last chunk's
> terminal lifecycle event is on the board → release held claims → fleetctl deregister → park/exit. No
> idle steward stays resident - an idle machine runs only the heartbeat daemon.

## Dogfood (tracer-bullet) brief
> Dogfood ONE merged chunk on latest main. Build + run the app (start its datastore, daemon, web). Exercise
> <the chunk's new behavior> end-to-end + a core-flow smoke; capture repro evidence (screenshots/steps). Use
> the dogfood skill. Report as <report-name> with a structured findings list (what worked, what broke,
> repro). Do NOT fix - the orchestrator triages findings into kanban cards. If the local stack will not
> come up cleanly, that IS the top finding - report it.

Spawn dogfood panes on **sonnet** (`claude --model sonnet --dangerously-skip-permissions`); opus for
reactor-subtle merges; never fable (scoping/planning/review only).
Run dogfood only when test/build panes are quiescent (shared ports/DB collide).
> GATE dogfood panes on the REPORT FILE, not pane status: brief them to write findings to a known path (e.g. scratchpad/dogfood-output/report.md); the waiter polls for that file's existence. herdr status for app-driving panes flickers to `unknown` and breaks status-based waiters (a real 'stuck' — the loop went blind while the dogfood was actually done).

## Rotation handoff schema (pointers + fresh queries — only Known-blockers is prose)
```markdown
# Handoff: <epic> - rotation N
## Goal (pointer, not restated)
Run-map issue: <url>
## State snapshot (as of <ts>, derived fresh - not memory)
- Machine: <slug> (role: primary orchestrator | steward - stewards always fill this)
- Ledger: <path> - last line: "<verbatim>"
- Kanban: <url> - Todo:N InProgress:N Done:N
- Fleetboard claims held: <list|none> (steward: also claims just released at exit)
- Hold-tagged chunks left queued (never spawned - honor the hold): <list|none>
- Fleet-tab panes: <machine-slug>/<chunk-id> (<pane_id>): <status> each
- Event log: last reconciled seq <cursor> (from the ledger) - unreconciled lifecycle events since it
- Signals fallback file: <path> - unreconciled offline DONE|BLOCKED|ERROR lines
## In-flight per chunk (unmerged only)
- <machine-slug>/<chunk-id>: worktree, branch, pane <machine-slug>/<chunk-id> (<pane_id>), stage,
  waiter/monitor armed y/n
## Active steering overrides (must survive rotation)
## Open bell items / unresolved human asks
## Known blockers (ONLY freeform section)
## Resume checklist (successor's first 5 actions)
1. cat <ledger>  2. kanban query  3. herdr agent list  4. fleetctl heartbeat  5. reconcile in-flight vs 1-3
```
ONE schema, both roles: a steward's rotation handoff AND its exit-on-empty handoff use THIS schema - the
Machine + hold-tag lines are what a steward adds; triggers + successor protocol are the orchestrator's
verbatim (a successor steward re-derives from the board + local herdr state, same as any successor).
Full rationale + sources: `docs/research/orchestrator-context-reduction.md` (apps repo).

## Sweep checklist (each wake)
1. `herdr agent list` locally plus `ssh <host> 'herdr agent list'` per remote machine, and
   `git worktree list` on each target - map state.
2. For the woken pane: read → finished? gate (`/review-all` + judgment) → merge → move card → dogfood.
   Blocked? read the blocker, unblock.
3. Re-arm waiters for still-working panes; spawn next-wave independent chunks (engine-routed).
4. **Woken by an `ERRORED:`/`STUCK:`/`DEAD:` from the liveness monitor?** Read that pane's tail → classify
   (real long compile → re-arm, leave it; frozen/errored → close dead pane, re-spawn on fallback engine in the
   same worktree, re-arm waiter + monitor). Confirm the monitor loop is still running; re-arm it if reaped.
5. Update the ledger (`.superpowers/sdd/…progress.md`) - survives compaction; trust it + `git log` over memory.

## Vitest pool on this box
Do NOT pass `--pool=threads --poolOptions.threads.singleThread` to force worker-spawn under EAGAIN — it DISABLES vitest isolation, so jsdom/global state leaks across files and web suites throw false `found multiple elements` failures (verified on unmodified main). Use the DEFAULT run (isolated forks). If the box is EAGAIN-starved, reduce concurrency (fewer live panes) rather than singleThread.
