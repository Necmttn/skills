# Plan 001: Fix three verified defects in fleet-ship docs (monitor scoping, send semantics, broken fences)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan
> in `plans/README.md` - unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a4ba253..HEAD -- skills/engineering/fleet-ship/ skills/engineering/herdr-agent-orchestration/`
> Note: an uncommitted or recently committed "Resource ledger + deterministic
> teardown" section in fleet-ship/SKILL.md is EXPECTED (added 2026-07-16) and
> not drift. Any other mismatch with the "Current state" excerpts is a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a4ba253`, 2026-07-16

## Why this matters

Three defects were verified live against the herdr CLI on 2026-07-16:

1. The fleet liveness monitor script in REFERENCE.md falls back to
   `herdr agent list --tab "$FLEET_TAB"` - that flag does not exist
   (running it prints `usage: herdr agent list`), so `NAMES` resolves empty
   and the monitor silently sweeps ZERO panes. The monitor is the only spine
   that catches stuck/errored/dead panes; when it is blind, a frozen pane
   stalls a fleet invisibly for 30–40 minutes.
2. The two skills contradict each other on `herdr agent send` semantics:
   fleet-ship (live-tested 2026-07-10, bit twice) says send REPLACES the
   prompt line; herdr-agent-orchestration and herdr-cli.md say it APPENDS.
   Agents following the low-level skill run the wrong prompt-hygiene
   protocol.
3. REFERENCE.md has unbalanced code fences around lines 249–268: the
   `## Archive a pane result before close` heading is swallowed inside the
   previous code block, so renderers and section-parsing agents miss the
   archive-before-close protocol entirely.

## Current state

Files (all under the repo root `~/Projects/necmttn-skills`):

- `skills/engineering/fleet-ship/REFERENCE.md` - fleet-ship's operational
  reference. Contains the monitor script (defect 1, line ~219) and the broken
  fences (defect 3, lines ~249–268).
- `skills/engineering/herdr-agent-orchestration/SKILL.md` - low-level pane
  driving skill. Line ~37 carries the wrong "appends" claim (defect 2).
- `skills/engineering/herdr-agent-orchestration/herdr-cli.md` - CLI cheat
  sheet. Line ~27 carries the wrong "appends" claim (defect 2).
- `skills/engineering/fleet-ship/SKILL.md` - carries the CORRECT "replaces"
  claim in its Hard rules; do not change its semantics, only cross-check.

Exact excerpts as of `a4ba253`:

`REFERENCE.md:219` (inside the `/tmp/herdr_monitor.sh` code block):

```sh
  NAMES="${NAMES:-$(herdr agent list --tab "$FLEET_TAB" | python3 -c 'import sys,json;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name")]' 2>/dev/null)}"
```

Verified live: `herdr agent list` takes NO flags. Its JSON output DOES carry
`tab_id` and `name` per agent (confirmed against a running server), so the
filter must move into the python.

`REFERENCE.md:249–268` (fence structure; `>` marks fence lines):

```
249  ## Read a pane (JSON → text)
250  ```sh                                  <- opens block A
251  herdr agent read <name> ...
252  herdr agent get <name>   # {...}
253
254  ## Archive a pane result before close (housekeeping)   <- INSIDE block A
255  ```sh                                  <- closes A instead of opening B
...
266  ```                                    <- opens a stray block
267  Restore: `cat docs/superpowers/...` or `herdr session attach ...`
268  ```                                    <- closes the stray block
```

`herdr-agent-orchestration/SKILL.md:37`:

```
Before every `send`, clear the prompt line: dismiss rating and approval overlays, and delete any unsent text the user left typed - `send` appends, so stray text corrupts your command. **Done when: a fresh `read` of the target shows idle with an empty prompt.**
```

`herdr-agent-orchestration/herdr-cli.md:27`:

```
Before `send`: `read --source visible` and confirm an empty prompt. Dismiss rating prompts (`0`), trust/hook prompts (select + `Enter`), and clear any user-typed text. `send` appends to whatever is already there.
```

`fleet-ship/SKILL.md` Hard rules (the authoritative claim, keep as-is):

```
**`agent send` REPLACES the prompt line - it does NOT append; and `send-keys Enter` alone CANNOT submit a human-typed parked draft (2026-07-10, bit twice in one session).**
```

Repo conventions: markdown skill docs, no build step. Commit style is
conventional commits, e.g. `fix(fleet-ship): waiter gates on polled
agent_status {idle,done}, never wait exit codes (closes #25)` (from `git log`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Fence balance | `awk '/^```/{n++} END{print n%2==0?"balanced":"UNBALANCED"}' skills/engineering/fleet-ship/REFERENCE.md` | `balanced` |
| Heading visible | `rg -n '^## Archive a pane result' skills/engineering/fleet-ship/REFERENCE.md` | one match |
| Monitor snippet dry-run | see Step 1 verify | prints agent names or nothing, exit 0 |
| No stale claim | `rg -n 'send appends|appends to whatever' skills/engineering/herdr-agent-orchestration/` | no matches |

## Scope

**In scope** (the only files you should modify):
- `skills/engineering/fleet-ship/REFERENCE.md`
- `skills/engineering/herdr-agent-orchestration/SKILL.md`
- `skills/engineering/herdr-agent-orchestration/herdr-cli.md`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `skills/engineering/fleet-ship/SKILL.md` - its send-semantics hard rule is
  the authority; plan 002 owns any restructuring of it.
- `skills/engineering/fleet-ship/fleet-routing.json`
- Any live herdr pane belonging to another session (see Step 2 rules).

## Git workflow

This repo has an ax hook that BLOCKS writes on `main`. Work in a worktree:

```sh
git -C ~/Projects/necmttn-skills worktree add .claude/worktrees/001-doc-fixes -b fix/fleet-ship-doc-fixes
```

Make all edits inside the worktree. One conventional commit, e.g.
`fix(fleet-ship): monitor tab-scoping, send-semantics reconcile, fence repair`.
Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the monitor's FLEET_TAB fallback

In `REFERENCE.md`, replace line 219 (the `NAMES=` line quoted above) with:

```sh
  NAMES="${NAMES:-$(herdr agent list | python3 -c 'import sys,json,os;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name") and a.get("tab_id")==os.environ.get("FLEET_TAB")]' 2>/dev/null)}"
```

Also update the comment on line ~213 from `OR FLEET_TAB=<fleet tab id>` to
`OR export FLEET_TAB=<fleet tab id> (filtered client-side; herdr agent list takes no flags)`.

**Verify** (read-only against the live server; harmless if no fleet running):

```sh
FLEET_TAB=nonexistent herdr agent list | python3 -c 'import sys,json,os;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name") and a.get("tab_id")==os.environ.get("FLEET_TAB")]'
```

→ exits 0, prints nothing. Then rerun with a real `tab_id` taken from
`herdr agent list` output → prints the names of agents in that tab.

### Step 2: Verify send semantics live, then reconcile the three docs

Live test (uses one disposable pane; total cost ~1 minute):

```sh
# spawn a scratch claude pane in an isolated cwd; note the workspace you use
herdr agent start sendtest-001 --cwd /tmp -- claude --model sonnet
sleep 15   # boot
herdr agent send sendtest-001 "AAA"
herdr agent read sendtest-001 --source visible --lines 6   # prompt should show AAA
herdr agent send sendtest-001 "BBB"
herdr agent read sendtest-001 --source visible --lines 6
```

- Prompt shows `BBB` only → send REPLACES (expected; matches fleet-ship).
- Prompt shows `AAABBB` → send APPENDS (fleet-ship's hard rule is wrong -
  STOP condition, see below).

Teardown the scratch pane regardless of outcome:

```sh
PID=$(herdr agent get sendtest-001 | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["agent"]["pane_id"])')
herdr pane close "$PID"
```

If you cannot spawn a pane (no herdr server, no claude auth): proceed with
REPLACES as the assumed truth (it is the newer, twice-live-tested claim) and
add `(assumed from fleet-ship 2026-07-10 evidence; re-verify live)` to the
edited sentences.

Then, assuming REPLACES:

- `herdr-agent-orchestration/SKILL.md:37` → rewrite the sentence to:
  `Before every send, dismiss rating and approval overlays, and capture any unsent text the user left typed (log it) - send REPLACES the whole prompt line, so an unlogged draft is silently destroyed. **Done when: a fresh read of the target shows idle with an empty or intentionally-replaced prompt.**`
- `herdr-cli.md:27` → rewrite the final sentence to:
  `send REPLACES the prompt line (it does not append) - capture user-typed drafts with read before sending over them.`

**Verify**: `rg -n 'send appends|appends to whatever' skills/engineering/herdr-agent-orchestration/` → no matches; `rg -cn 'REPLACES' skills/engineering/herdr-agent-orchestration/` → ≥2 matches.

### Step 3: Repair REFERENCE.md fences

Insert a closing ```` ``` ```` line after the `herdr agent get <name>` line
(current line 252), and delete the stray closing fence at current line 268
(the one after the `Restore:` line). The `Restore:` line stays as normal prose.

**Verify**:
- `awk '/^```/{n++} END{print n%2==0?"balanced":"UNBALANCED"}' skills/engineering/fleet-ship/REFERENCE.md` → `balanced`
- `rg -n '^## Archive a pane result' skills/engineering/fleet-ship/REFERENCE.md` → one match
- Render sanity: `rg -n '^```' skills/engineering/fleet-ship/REFERENCE.md` → fences come in open/close pairs around each script only.

## Test plan

No test suite exists in this repo (docs-only). The verification commands per
step ARE the tests. Additionally run the fence-balance awk on
herdr-agent-orchestration files to confirm no collateral fence damage.

## Done criteria

- [ ] Fence-balance awk prints `balanced` for REFERENCE.md
- [ ] `rg -n 'agent list --tab' skills/` → no matches
- [ ] `rg -n 'send appends|appends to whatever' skills/engineering/herdr-agent-orchestration/` → no matches
- [ ] Scratch pane `sendtest-001` no longer in `herdr agent list`
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The live send test shows APPEND behavior: do NOT edit anything; report the
  observation - fleet-ship's hard rule and its draft-submit protocol would
  need redesign, which is out of this plan's scope.
- The excerpts in "Current state" don't match the files (beyond the expected
  teardown-ledger section in fleet-ship/SKILL.md).
- `herdr agent list` output lacks `tab_id` or `name` fields (herdr changed
  its JSON shape - the Step 1 replacement would be wrong too).

## Maintenance notes

- Anything that edits the monitor script again must keep the constraint:
  `herdr agent list` takes no flags; all scoping is client-side JSON filtering.
- Reviewer should eyeball the rendered REFERENCE.md (or a markdown preview)
  to confirm the Archive section renders as a heading again.
- Plan 002 (dedupe/restructure) builds on these corrected texts - land this
  first.
