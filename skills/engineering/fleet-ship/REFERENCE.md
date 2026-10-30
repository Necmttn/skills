# Fleet Ship - Reference

Before writing a brief, accepting a result, or closing a pane, read [Durable task
delivery](../herdr-agent-orchestration/references/durable-delivery.md). Multi-machine placement, stewards,
tandem co-orchestrator, and dead-pane rescue live in
[`references/multi-machine.md`](references/multi-machine.md).

## Identity, Placement & Prompt Hygiene
Keep three identifiers distinct (`<slug>` is minted by `fleetctl join --name <slug>`):
- `NAME=<chunk-id>` — bare, server-local herdr agent name matching `[a-z][a-z0-9_-]{0,31}` (e.g. `chunk-1`,
  `tandem-<epic>`, `steward-<epic>`; set once at `agent start`, never renamed; survives `herdr pane move` even
  though `pane_id` changes on move). **`fleetctl event <STAGE> --machine <slug> --chunk <chunk-id> [--epic
  <epic>]` also takes bare `<chunk-id>`** (`--machine` scopes it; never prefix `--chunk`, or board
  reads/filters silently match nothing).
- `REPORT_NAME=<slug>/<chunk-id>` — required on every other off-machine or durable surface (`fleet log`,
  `fleetctl attn`, kanban cards, run map, archive headings, rotation handoffs, and human reports
  `<slug>/<chunk-id> (<pane_id>)`).
- `FLEET_TAB_LABEL=fleet:<epic>` on primary; `fleet:<epic>@<slug>` on non-primary machines (pane/tab display
  labels allow `:`).

Every fleet resource runs inside session `fleet-<epic>`: prefix every call with `herdr --session fleet-<epic>`
(remote: `ssh <host> 'herdr --session fleet-<epic> ...'`; never point a local client at a remote socket or
combine `--remote` with driving subcommands).
- **Tab reuse & root shell:** run `herdr --session fleet-<epic> tab list --workspace <ws>` before creating. `tab
  create` returns `.result.root_pane.pane_id` (an object) — spawn chunk 1 into that root pane (`agent start
  <chunk-id> --kind <kind> --pane <root_pane_id> -- ...`), split subsequent chunks (`pane split <pane>
  --direction down --cwd <wt> --no-focus`), and close any unused shell panes.
- **Retrofit move:** `herdr --session fleet-<epic> pane move <pane_id> --tab <tab_id> --no-focus` (or
  `--new-workspace --label <epic> --tab-label "fleet:<epic>" --no-focus`). Re-resolve `pane_id` via `agent get
  <name>` if needed; name-targeted waiters survive.
- **Parked-draft submit protocol:** `agent prompt` **appends** to existing prompt-line text. Never prompt onto a
  non-empty line: (1) `agent read <t> --source visible --lines 15` to capture + log any draft; (2) `agent
  send-keys <t> Ctrl+U` and re-read to confirm empty; (3) `agent prompt <t> "<full intended text>" --wait
  --until working` and confirm `working`.
- **Backchannel limits:** every pane has `HERDR_ENV=1`, `HERDR_PANE_ID`, `HERDR_SOCKET_PATH` (`herdr
  notification show` works inside panes; `pane report-agent` only labels raw shell panes and cannot override
  live agent detection). Claude Code >=2.1 collapses tool output, so `pane wait-output` screen sentinels fail on
  Claude panes — always wake on `agent wait` + git state, and read `.result.agent.tokens` (`context`, `limit`)
  from `agent get` rather than scraping footers.

## Engine Launch Mechanics
Canonical config: [`fleet-routing.json`](fleet-routing.json) (symlinked from `~/.ax/fleet-routing.json`).
Interactive shell aliases: `xx="codex --yolo"`, `cc="claude --dangerously-skip-permissions"`, `aa="agy
--dangerously-skip-permissions"`. `herdr agent start --kind <codex|claude|agy>` execs the binary directly (no
zsh alias expansion), so pass `--yolo` or `--dangerously-skip-permissions` after `--`.

| Lane | Unattended launch / CLI | Notes |
|---|---|---|
| `review` / `review-hard` | `agy --model gemini-4-argon-medium --mode plan --print "$BRIEF"` (`-high` for `review-hard`); fallbacks in `fleet-routing.json` | Headless reviewers cannot prompt for read approvals — embed the full diff/artifact and check results in `$BRIEF` |
| `design-plan` | `codex --yolo -m gpt-6-astra -c 'model_reasoning_effort="high"'` | Takes precedence over `judgment`/`frontier` for wave, design & implementation plans |
| `copy` / `copy-high` | `agy --dangerously-skip-permissions --model gemini-4-argon-medium` (`-high` for high-stakes positioning/comms) | `herdr agent start <id> --kind agy --pane <pid> -- --dangerously-skip-permissions --model gemini-4-argon-medium` |
| `computer-use` | `codex --yolo -m gpt-6.1-terra -c 'model_reasoning_effort="medium"'` | Browser, iOS/Android simulator, desktop/GUI driving, interactive app/device dogfood |
| `mechanical` / `-luna` / `-fast` | `codex --yolo -m gpt-6.1-sol -c 'model_reasoning_effort="medium"'` (`-m gpt-6-luna` for small crisp sweeps; add `-c 'service_tier="fast"' -c features.fast_mode=true` per blocking chunk only) | Pin `-m` and effort; `~/.codex/config.toml` defaults to `gpt-6.1-terra` at `low`; non-UI clear-spec work only |
| `mechanical-claude` / `dogfood` | `claude --dangerously-skip-permissions --model claude-sonnet-5-5 --effort medium` | Non-Codex mechanical capacity, UI taste floor when Opus is busy, and headless/CLI smoke |
| `judgment` / `-fast` | `claude --dangerously-skip-permissions --model claude-opus-5-5 --effort high` (add `--settings '{"fastMode": true}'` for blocking wave chunks) | Multi-file seams, user-facing UI/API design, reactor-subtle, security-critical (no `--fast` CLI flag on Claude) |
| `frontier` | `claude --model claude-fable-5-1 --effort medium -p "$BRIEF"` | Review/tiebreaks only; never a build or dogfood lane |
| `tandem` | `codex --yolo -m gpt-6-astra -c 'model_reasoning_effort="high"'` (Codex-dry: `agy --dangerously-skip-permissions --model gemini-4-argon-medium` for Claude orchestrator) | Cross-engine autonomous/overnight watchdog + `TANDEM-JUDGE`; never pin `max` |

**Codex inside Claude subagents/workflows:** Claude's `Agent` `model` parameter accepts Claude models only; use
a thin `model:'sonnet', effort:'low'` wrapper subagent that runs `codex exec -m gpt-6.1-sol -c
'model_reasoning_effort="medium"'` (or `-s read-only` for analysis) via Bash. In herdr panes, spawn `codex`
directly.

### Codex TUI launch verifier & quota fallback
Untrusted cwds trigger a Codex Yes/No trust modal where early text input crashes the pane; cwds under a
`trust_level = "trusted"` ancestor in `~/.codex/config.toml` skip the modal automatically (do not send a bare
`Enter` on trusted paths). `scripts/verify-codex-launch.sh` detects trust, passes the argv brief with a unique
turn token, and verifies post-prompt Codex `•` activity before returning `BOOT_READY` (always single-quote `-c
'key="val"'` overrides):

```sh
export FLEET_SHIP_DIR="$HOME/.claude/skills/fleet-ship"   # or "$PWD/skills/engineering/fleet-ship"
bash "$FLEET_SHIP_DIR/scripts/verify-codex-launch.sh" "$CHUNK_ID" "$WT" "$TAB_ID" "$SLUG/$CHUNK_ID" "$FLEET_ID" \
  -m gpt-6.1-sol -c 'model_reasoning_effort="medium"'
# Remote: encode dynamic args safely so quotes survive ssh:
# cmd=(bash "$REMOTE_FLEET_SHIP_DIR/scripts/verify-codex-launch.sh" "$CHUNK_ID" "$WT" "$TAB_ID" "$SLUG/$CHUNK_ID" "$FLEET_ID" -m gpt-6.1-sol -c 'model_reasoning_effort="medium"')
# ssh "$HOST" "$(printf '%q ' "${cmd[@]}")"
```

Headless alternative when no interactive steering is needed: `codex exec --yolo -m gpt-6.1-sol -c
'model_reasoning_effort="medium"' "<brief>"` (expect `READY_UNCOMMITTED` if it skips the final commit step).

**Codex 7d quota fallback (when no live Codex pane exposes `agent get` `.tokens.limit`):**
```sh
for f in $(ls -t ~/.codex/sessions/*/*/*/rollout-*.jsonl 2>/dev/null | head -5); do
  jq -r '.payload.rate_limits? // empty | [.primary,.secondary] | map(select(.!=null and .window_minutes==10080)) | .[0] | select(.!=null) | 100-.used_percent' "$f" | tail -1
done | head -1
```

## Pane Briefs = CONTEXT + Verbatim Discipline Block
Write `BRIEF.md` at the worktree root (CONTEXT + `fleet status <dir> <chunk>` + `attempt_id=<token>` + the
matching DISCIPLINE BLOCK verbatim) and send a short pointer. Ensure `/BRIEF.md` and `/REPORT.md` are listed in
the repo's `.gitignore` in addition to the `:!BRIEF.md :!REPORT.md` pathspec guard.

### Skill availability probe (once per machine+user, cached in ledger)
Skills resolve from the **pane user's** environment (`ls ~/.claude/skills` and `claude plugins list`, locally or
via `ssh <host>`), never from the orchestrator's. If any named skill/plugin (`superpowers:*`,
`efficient-dispatch`) is missing on that host, sync first or use the **non-Claude** inline block so instructions
do not silently degrade to ungated prose. To force-trigger a slash command in a Claude pane, send `/skill-name
<args>` as its **own** `agent prompt` message and confirm the banner via `agent read` before sending follow-up
context.

### Discipline block - Claude panes (`claude-opus-5-5` / `claude-sonnet-5-5`)
> SCOPE PIN: deliver exactly what the chunk spec asks, at the scope intended; if an adjacent improvement exists,
> note it in ONE sentence in REPORT.md and continue as briefed - never widen, narrow, or transform the chunk.
> WORKFLOW (mandatory): FIRST invoke superpowers:writing-plans and write a short plan (tasks, files+tests,
> sequence). THEN build with superpowers:subagent-driven-development - strict TDD per task (failing test FIRST,
> green, refactor). SEAM RULE (testing-anti-patterns.md): mock ONLY non-deterministic leaves (LLM, clock, net),
> NEVER the code path under test; assert the real observable effect at the real seam (delete-the-mock
> heuristic). SUBAGENT ROUTING (efficient-dispatch): set model:'sonnet', effort:'low' on mechanical/implementer
> subagents and model:'haiku' on pure search/locate; judgment/review subagents keep a frontier model (never
> Haiku/Flash/Luna for review).
> WORKTREE GUARD: you and every subagent work ONLY in this worktree (verify pwd before git/gate commands; NEVER
> touch the primary checkout). GATES before done: <concrete repo gates, e.g. bun run typecheck, bun run
> verify:effect, bun run test:vitest - check real unpiped $? exit codes and confirm new test files execute>.
> Then run `git add -A ':!BRIEF.md' ':!REPORT.md' && git commit` (scratch files never ship; uncommitted worktree
> = UNFINISHED), push `git push -u origin HEAD`, update the draft PR, commit the recovery record, and verify the
> remote delivery receipt before STOP. Report as `<report-name>` with `attempt_id`, verified remote SHA, draft
> PR URL, test summary, and concerns. The orchestrator owns review and merge.
> SIGNAL STEP (mandatory, LAST, even on failure): on DONE (verified remote receipt) run `bun
> ~/Projects/fleetboard/fleetctl.ts event BUILT --machine <slug> --chunk <chunk-id> --epic <epic> --gist
> "<one-line gist>"` (pass bare `<chunk-id>`, never prefixed); on BLOCKED/ERROR run `bun
> ~/Projects/fleetboard/fleetctl.ts attn <fleet-id> "<report-name> BLOCKED|ERROR: <gist>"` plus `herdr
> notification show "<report-name> BLOCKED" --sound request` and write details into REPORT.md. Offline fallback
> (only if fleetctl exits non-zero): append `"$(date -Iseconds) <report-name> DONE|BLOCKED|ERROR <gist>"` to
> `<signals-path>`.

### Discipline block - Non-Claude code panes (`codex` / `agy` — inline discipline, no `Skill` tool)
> SCOPE PIN: deliver exactly what the chunk spec asks, at the scope intended; if an adjacent improvement exists,
> note it in ONE sentence in REPORT.md and continue as briefed - never widen, narrow, or transform the chunk.
> WORKFLOW (mandatory): FIRST write a short plan before editing code (tasks, files+tests, sequence). Read
> CLAUDE.md/AGENTS.md for repo conventions. THEN strict TDD per task: write a failing test FIRST using the
> repo's exact test runner (<e.g. vitest - import from "vitest", NEVER bun:test or toStartWith>), watch it fail,
> make it pass, refactor. SEAM RULE: mock ONLY non-deterministic leaves (LLM, clock, net), NEVER the code path
> under test; assert the real observable effect at the real seam (if the test still passes with the mock
> deleted, it tests nothing).
> WORKTREE GUARD: work ONLY in this worktree; never cd to or commit in the primary checkout; run all gates from
> this worktree. GATES before done: <concrete repo gates, real unpiped $? exit codes, confirming new test files
> load and run>. Then run `git add -A ':!BRIEF.md' ':!REPORT.md' && git commit` (scratch files never ship;
> uncommitted worktree = UNFINISHED), push `git push -u origin HEAD`, update the draft PR, commit the recovery
> record, and verify the remote delivery receipt before STOP. Report as `<report-name>` with `attempt_id`,
> verified remote SHA, draft PR URL, test summary, and concerns. The orchestrator owns review and merge.
> SIGNAL STEP (mandatory, LAST, even on failure): on DONE (verified remote receipt) run `bun
> ~/Projects/fleetboard/fleetctl.ts event BUILT --machine <slug> --chunk <chunk-id> --epic <epic> --gist
> "<one-line gist>"` (pass bare `<chunk-id>`, never prefixed); on BLOCKED/ERROR run `bun
> ~/Projects/fleetboard/fleetctl.ts attn <fleet-id> "<report-name> BLOCKED|ERROR: <gist>"` plus `herdr
> notification show "<report-name> BLOCKED" --sound request` and write details into REPORT.md. Offline fallback
> (only if fleetctl exits non-zero): append `"$(date -Iseconds) <report-name> DONE|BLOCKED|ERROR <gist>"` to
> `<signals-path>`.

### Discipline block - Non-code artifacts (`design-plan` Astra / `copy` & `copy-high` Argon)
> SCOPE PIN: deliver only the requested plan, spec, or copy artifact at `<target-paths>`; note adjacent ideas in
> ONE sentence in REPORT.md and never edit unrelated code or widen scope.
> WORKFLOW & ARTIFACT GATES (mandatory): read CLAUDE.md/AGENTS.md and cited files first. For `design-plan`:
> define independent chunk boundaries, exact file/seam ownership, `hold:human` + fog items, and concrete
> verification commands per chunk (run `fleet graph check <dir>` if emitting `graph.json`). For
> `copy`/`copy-high`: match target voice, audience, locale/length limits, and formatting/links (run repo
> typecheck/lint/build if editing in-app string or MDX files).
> WORKTREE GUARD: work ONLY in this worktree; never touch the primary checkout. Run `git add -A ':!BRIEF.md'
> ':!REPORT.md' && git commit`, push `git push -u origin HEAD`, update the draft PR, commit the recovery record,
> and verify the remote delivery receipt before STOP. Report as `<report-name>` with `attempt_id`, verified
> remote SHA, draft PR URL, artifact gate summary, and open questions. The orchestrator owns review and merge.
> SIGNAL STEP (mandatory, LAST, even on failure): on DONE (verified remote receipt) run `bun
> ~/Projects/fleetboard/fleetctl.ts event BUILT --machine <slug> --chunk <chunk-id> --epic <epic> --gist
> "<one-line gist>"` (pass bare `<chunk-id>`, never prefixed); on BLOCKED/ERROR run `bun
> ~/Projects/fleetboard/fleetctl.ts attn <fleet-id> "<report-name> BLOCKED|ERROR: <gist>"` plus `herdr
> notification show "<report-name> BLOCKED" --sound request` and write details into REPORT.md. Offline fallback
> (only if fleetctl exits non-zero): append `"$(date -Iseconds) <report-name> DONE|BLOCKED|ERROR <gist>"` to
> `<signals-path>`.

### Dogfood (`computer-use` Terra / `dogfood` Sonnet) brief
Run only when build/test panes are quiescent so shared ports/DB/simulators do not collide. Boot an isolated
simulator when needed (`sim:<udid>` claim) and gate on the **report file** (app-driving panes can flicker status
to `unknown`):
> Dogfood ONE merged chunk on latest main. Build and run the stack; exercise `<chunk behavior>` end-to-end plus
> a core smoke flow, capturing screenshots and repro steps. Write your structured report (worked, broke, repro,
> evidence paths) to `<report-file-path>` and report as `<report-name>`. Do NOT fix code - the orchestrator
> triages findings into kanban cards. If the stack fails to boot, report that as finding #1.

## Canonical Waiters
Run on the pane's machine in the background (`H="herdr --session fleet-$EPIC"`). Waiters use `agent wait` for
backpressure only and verify settled `idle|done` status plus git state (`blocked` wakes route to unblock, not
gate). On `TIMEOUT`, verify status + recent branch commits first and re-arm active long chunks; if the harness
reaps background shells, run one poll pass per `ScheduleWakeup` tick.

**Build waiter (`/tmp/herdr_wait.sh` — commit-or-dirty gated with settle-poll against background-shell flaps):**
```sh
P="$1"; WT="$2"; REPORT_NAME="${3:?pass slug/chunk-id}"; H="herdr --session ${FLEET_SESSION:?set FLEET_SESSION}"
st(){ $H agent get "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null; }
for i in $(seq 1 240); do
  $H agent wait "$P" --timeout 8000 >/dev/null 2>&1 || :
  case "$(st)" in idle|done) ;; *) sleep 2; continue;; esac
  sleep 4; case "$(st)" in idle|done) ;; *) continue;; esac
  c=$(git -C "$WT" rev-list --count origin/main..HEAD 2>/dev/null)
  [ "${c:-0}" -gt 0 ] && { echo "READY:$REPORT_NAME committed=$c"; exit 0; }
  [ -n "$(git -C "$WT" status --porcelain 2>/dev/null)" ] && { echo "READY_UNCOMMITTED:$REPORT_NAME idle+dirty"; exit 0; }
  sleep 4
done
echo "TIMEOUT:$REPORT_NAME"; exit 1
```

**Dogfood / non-committing waiter (report-file + stable-idle gated):**
```sh
P="$1"; REPORT_NAME="${2:?pass slug/chunk-id}"; REPORT_FILE="${3:-}"; H="herdr --session ${FLEET_SESSION:?set FLEET_SESSION}"
st(){ $H agent get "$P" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null; }
for i in $(seq 1 120); do
  [ -n "$REPORT_FILE" ] && [ -s "$REPORT_FILE" ] && { echo "STABLE-IDLE:$REPORT_NAME report=$REPORT_FILE"; exit 0; }
  $H agent wait "$P" --timeout 45000 >/dev/null 2>&1 || :
  case "$(st)" in idle|done) ;; *) sleep 2; continue;; esac
  sleep 30
  [ -n "$REPORT_FILE" ] && [ -s "$REPORT_FILE" ] && { echo "STABLE-IDLE:$REPORT_NAME report=$REPORT_FILE"; exit 0; }
  case "$(st)" in idle|done) echo "STABLE-IDLE:$REPORT_NAME"; exit 0;; esac
done
echo "TIMEOUT:$REPORT_NAME"; exit 1
```

## Liveness Monitor
One loop per machine (`run_in_background`, re-arming) catches `QUOTA_LOW`, `QUOTA_HALT`, `ERRORED`, `STUCK`, and
`DEAD` panes that never reach `idle|done`. Uses `scripts/monitor-tail.py` (regression check: `python3
scripts/test-monitor-tail.py`) so spinner timers do not mask stalls; never auto-kills panes. An `"API Error:
Connection closed mid-response"` tail with a clean worktree is a recoverable drop — nudge the existing pane
rather than respawning.

```sh
STATE="${1:-/tmp/herdr_monitor_state}"; STALL_SWEEPS="${2:-4}"   # 4 × 120s ≈ 8 min
MACHINE_SLUG="${MACHINE_SLUG:?export machine slug}"; H="herdr --session ${FLEET_SESSION:?export FLEET_SESSION}"
NORMALIZER="${FLEET_SHIP_DIR:?export FLEET_SHIP_DIR}/scripts/monitor-tail.py"
[ -f "$NORMALIZER" ] || { echo "ERRORED:monitor missing $NORMALIZER"; exit 2; }
SIG='out of credits|usage limit|hit your (usage|rate) limit|try again at|rate.?limit|429| 403 | 5[0-9][0-9] |ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network error|connection (refused|reset|closed)|socket hang up|fetch failed|panic|Traceback|FATAL|command not found'
touch "$STATE"
for sweep in $(seq 1 720); do
  ACTIVE="${NAMES:-$($H agent list | python3 -c 'import sys,json,os;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name") and a.get("tab_id")==os.environ.get("FLEET_TAB")]' 2>/dev/null)}"
  for N in $ACTIVE; do
    REPORT_NAME="$MACHINE_SLUG/$N"; WT=".claude/worktrees/$N"
    g=$($H agent get "$N" 2>/dev/null); [ -z "$g" ] && { echo "DEAD:$REPORT_NAME gone from agent list"; continue; }
    st=$(printf '%s' "$g" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["agent_status"])' 2>/dev/null)
    lim=$(printf '%s' "$g" | python3 -c 'import sys,json,re;t=json.load(sys.stdin)["result"]["agent"].get("tokens") or {};m=re.findall(r"(\d+)%",t.get("limit",""));print(min(map(int,m)) if m else "")' 2>/dev/null)
    wk=$(printf '%s' "$g" | python3 -c 'import sys,json,re;a=json.load(sys.stdin)["result"]["agent"];t=a.get("tokens") or {};m=re.search(r"7d (\d+)%",t.get("limit",""));print(m.group(1) if (m and (t.get("provider")=="codex" or a.get("agent")=="codex")) else "")' 2>/dev/null)
    if [ -n "$wk" ] && [ "$wk" -le "${FLEET_CODEX_RESERVE:-20}" ] && ! grep -q "^quota_halt	codex$" "$STATE"; then
      printf 'quota_halt\tcodex\n' >> "$STATE"
      echo "QUOTA_HALT:$REPORT_NAME codex weekly=${wk}% left <= reserve ${FLEET_CODEX_RESERVE:-20}%"
    fi
    if [ -n "$lim" ] && [ "$lim" -le "${QUOTA_MIN:-10}" ] && ! grep -q "^quota	$N$" "$STATE"; then
      printf 'quota\t%s\n' "$N" >> "$STATE"; echo "QUOTA_LOW:$REPORT_NAME limit=${lim}% left"
      case "$st" in working) : ;; *) $H agent prompt "$N" "ROTATE NOW: commit and push a recovery handoff (branch, checkpoint SHA, remaining work), update your draft PR, then park with an empty prompt." >/dev/null 2>&1 ;; esac
      continue
    fi
    tail=$($H agent read "$N" --source recent --lines 40 2>/dev/null)
    if printf '%s' "$tail" | grep -Eiq "$SIG"; then
      line=$(printf '%s' "$tail" | grep -Ei "$SIG" | tail -1)
      echo "ERRORED:$REPORT_NAME :: $line"; continue
    fi
    c=$(git -C "$WT" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
    h=$(printf '%s' "$tail" | python3 "$NORMALIZER" fingerprint)
    fp="$st:$h:$c"
    prev=$(grep "^$N	" "$STATE" | cut -f2); cnt=$(grep "^$N	" "$STATE" | cut -f3); cnt=${cnt:-0}
    if [ "$fp" = "$prev" ]; then cnt=$((cnt+1)); else cnt=0; fi
    grep -v "^$N	" "$STATE" > "$STATE.tmp" 2>/dev/null; printf '%s\t%s\t%s\n' "$N" "$fp" "$cnt" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"
    case "$st" in idle|done) : ;; *) [ "$cnt" -ge "$STALL_SWEEPS" ] && echo "STUCK:$REPORT_NAME status=$st unchanged ${cnt}x";; esac
  done
  sleep 120
done
```

## Archive, Teardown, Ledger & Kanban Recipes

### Archive a pane before close + worktree & DerivedData cleanup
Archive-then-close applies to **all** fleet-spawned panes (build, review, fix, dogfood, tandem, steward). Close
build panes at verified remote receipt + archived report; remove the worktree and local branch only **after**
merge and clean-tree verification:
```sh
H="herdr --session fleet-$EPIC"; FLEET="bun $HOME/.claude/skills/fleet-ship/scripts/fleet.ts"
mkdir -p docs/superpowers/fleet-runs
{ echo "## $REPORT_NAME"; echo "PR #$PR · $COMMIT · gate: $VERDICT"; echo;
  $H agent read "$NAME" --source recent --lines 400; echo;
} >> "docs/superpowers/fleet-runs/$EPIC.md"
$FLEET log "$LEDGER" fleet.chunk.archived "$REPORT_NAME" pr="$PR" commit="$COMMIT"
git add "docs/superpowers/fleet-runs/$EPIC.md" && git commit -m "chore(fleet): archive $REPORT_NAME result"
PID=$($H agent get "$NAME" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["pane_id"])')
$H pane close "$PID"; $FLEET log "$LEDGER" fleet.resource.closed "pane:$PID"

# Post-merge worktree + exact-WorkspacePath Xcode DerivedData sweep (never match by app name):
WT="$(cd ".claude/worktrees/$NAME" && pwd)"
[ -z "$(git -C "$WT" status --porcelain)" ] || { echo "refusing to remove dirty worktree: $WT" >&2; exit 1; }
git worktree remove "$WT" && git branch -D "feat/$NAME"
for p in ~/Library/Developer/Xcode/DerivedData/*/info.plist; do
  case "$(/usr/libexec/PlistBuddy -c 'Print :WorkspacePath' "$p" 2>/dev/null)" in
    "$WT"/*) trash "$(dirname "$p")";;
  esac
done
```

### Deterministic run teardown
```sh
fleet teardown <ledger-or-epic-dir> --epic <epic> --session fleet-<epic> [--archive-dir docs/superpowers/fleet-runs] [--execute]
```
Dry-run first (no `--execute`), then `--execute`: archives and closes open `fleet.resource.minted` panes → tabs
→ workspaces by exact ID, verifies zero survivors, stops + deletes `fleet-<epic>`, and appends
`fleet.run.teardown`. Confirm `herdr session list` omits `fleet-<epic>` before `fleetctl deregister`.

### CloudEvents 1.0 JSONL ledger & epic-mode CLI
Set `FLEET_SOURCE=fleet/<epic>/<slug>` per machine. Never hand-edit JSONL; `scripts/fleet.ts` enforces
transitions, `workflow.json` steps, `attempt_id` tokens, commit-bound gate receipts, and rolling-window capacity
(`max_in_flight`, `max_gate_queue`, `pilot`, `spawn-paused`). Self-test: `cd
skills/engineering/fleet-ship/scripts && bun test && bun run typecheck && python3 test-monitor-tail.py`.

| Command / Event `fleet.*` | Usage / Required keys |
|---|---|
| `fleet init <home> <epic> --repo <owner/name> --plan <path>` | Creates epic dir (`graph.json` with `safeguards:true`, `DECISIONS.md`); validate with `fleet graph check <dir>` |
| `fleet state <dir\|ledger> --live` · `fleet next <dir>` · `fleet status <dir> <chunk>` · `fleet stats <dir>` | Per-wake state view · spawnable frontier · single-chunk brief header · dwell/retry stats |
| `fleet check-gate <dir> <slug>/<chunk> --worktree <wt>` | Pre-merge check: clean tree, `HEAD == gated receipt commit`, and `hold=approved` if held |
| `run.started` · `run.teardown` (`<epic>`) | `session` `runmap` `kanban` · `closed` |
| `policy.set` (`routing`\|`steer`\|`lane-file`\|`spawn-paused`) · `quota.gate` (`-`) | `text` (`spawn-paused`: reason or `off`) · `engine` `left` `reserve` `verdict` |
| `resource.minted` · `resource.closed` (`<session\|workspace\|tab\|pane\|agent>:<id>`) | `label` |
| `chunk.<stage>` (`assigned` `spawned` `planned` `building` `built` `in_review` `gated` `merged` `dogfooded` `blocked` `error` `archived` `closed`) | `pane` `engine` `wt` `pr` `commit` `gist`; safeguards require `attempt_id` (minted at `building`), `commit`+`ref` (`built`), `verdict=PASS evidence=verified checks=<path> commit=<sha>` (`gated`), `input_commit=<reviewed-sha> commit=<squash-sha>` (`merged`) |
| `attn.opened` · `attn.closed` (`<slug>/<chunk>`) · `cursor.advanced` (`fleetboard`) · `note` | `ask` · `events` `signals` · `text` |

### Kanban (GitHub Project v2)
```sh
gh project create --owner <user> --title "<title>" --format json
gh project field-list <num> --owner <user> --format json
IID=$(gh project item-create <num> --owner <user> --title "<report-name>" --body "<wave·lane·branch·PR>" --format json | jq -r .id)
gh project item-edit --id "$IID" --project-id <PVT_id> --field-id <STATUS_field_id> --single-select-option-id <option_id>
```

## Rotation Handoff Schema
Pointers and fresh query outputs only — `Known blockers` is the sole prose section (shared by primary
orchestrators and stewards):
```markdown
# Handoff: <epic> - rotation N
## Goal
Run-map issue: <url> · Run draft PR: <url>
## State snapshot (derived fresh at <ISO-ts>)
<paste `fleet state <dir|ledger> --live` verbatim>
- Machine: <slug> (role: primary orchestrator | steward)
- Kanban: <url> · Claims held/released: <list|none>
- Hold-tagged chunks awaiting owner answer at GATED: <list|none>
- Event cursor: seq <cursor> · Fallback signals file: <path> (unreconciled lines)
## In-flight chunks (unmerged)
- <slug>/<chunk-id>: worktree, branch, PR, pane_id, stage, attempt_id, waiter/monitor armed (y/n)
## Active steering overrides & open bell items
## Known blockers (freeform)
## Successor resume checklist
1. fleet state <dir|ledger> --live  2. fleetctl events --since <cursor>  3. gh project item-list  4. fleetctl register/heartbeat  5. sweep orphans & re-arm waiters + monitor
```

## Vitest Pool Note
Never pass `--pool=threads --poolOptions.threads.singleThread` to work around `EAGAIN` process limits — it
disables Vitest isolation and leaks jsdom/globals across test files. Keep default isolated forks and reduce
concurrent active panes instead.
