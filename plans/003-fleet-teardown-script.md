# Plan 003: Ship a deterministic fleet teardown script driven by ledger RES lines

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan
> in `plans/README.md` - unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a4ba253..HEAD -- skills/engineering/fleet-ship/`
> The "Resource ledger + deterministic teardown" section in SKILL.md
> Housekeeping is REQUIRED context for this plan (added 2026-07-16). If it is
> absent, STOP - this plan implements that section's contract.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED - the script closes panes; a scoping bug kills another
  fleet's work. Mitigated: exact-id-only input, dry-run default, refuse
  without ledger.
- **Depends on**: none (001/002 are independent)
- **Category**: dx
- **Planned at**: commit `a4ba253`, 2026-07-16

## Why this matters

Fleet runs keep leaving orphan tabs/panes in the user's herdr sidebar
(live complaint 2026-07-16) because cleanup is enforced by prose rules the
orchestrator must remember across compactions and rotations. SKILL.md's
Housekeeping now specifies a ledger contract: every minted herdr resource
gets a `RES <type> <id> <label>` line; teardown closes exactly those ids.
This plan turns that contract into an executable script so teardown becomes
one deterministic command instead of LLM compliance.

## Current state

- `skills/engineering/fleet-ship/SKILL.md` - Housekeeping section
  "Resource ledger + deterministic teardown" defines the contract:
  - ledger line format: `RES <tab|pane|agent|workspace> <id> <name/label>`
  - teardown order: archive-then-close panes by exact id → tabs last →
    verify zero fleet-minted resources → append `TEARDOWN-DONE <n closed>`
  - never pattern-match labels; exact ids only
- `skills/engineering/fleet-ship/REFERENCE.md` - "Archive a pane result
  before close" shows the archive recipe this script must reuse:
  `herdr agent read "$NAME" --source recent --lines 400` → append to
  `docs/superpowers/fleet-runs/$EPIC.md`.
- There is NO `scripts/` dir under the fleet-ship skill yet; other skills in
  this repo bundle scripts (see `~/Projects/necmttn-skills/scripts/` for
  repo-level examples of plain bash style).
- `~/Projects/fleetboard/fleetctl.ts` - fleetboard CLI (register/heartbeat/
  claim/attn/deregister via HTTP to the board). It does NOT drive herdr.
  Integration with it is explicitly DEFERRED (see Maintenance notes);
  this plan keeps the script self-contained in the skill dir.

Verified herdr CLI facts (live, 2026-07-16) the script must respect:
- `herdr agent list` takes NO flags; JSON at `.result.agents[]` with
  `pane_id`, `tab_id`, `workspace_id`, optional `name`.
- `herdr agent get <name>` → `.result.agent.pane_id`;
  `herdr agent read <name> --source recent --lines N` → `.result.read.text`.
- `herdr pane close <pane_id>`; `herdr tab close <tab_id>`;
  `herdr workspace close <workspace_id>`; `herdr tab list [--workspace <ws>]`.
- A tab dies with its last pane - closing a tab whose panes are already
  closed can fail benignly; treat "not found" on close as already-gone.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax check | `bash -n skills/engineering/fleet-ship/scripts/fleet-teardown.sh` | exit 0 |
| Shellcheck (if installed) | `shellcheck skills/engineering/fleet-ship/scripts/fleet-teardown.sh` | no errors (warnings OK) |
| Dry-run test | see Step 3 | prints plan, closes nothing |

## Scope

**In scope**:
- `skills/engineering/fleet-ship/scripts/fleet-teardown.sh` (create)
- `skills/engineering/fleet-ship/SKILL.md` - ONLY the teardown bullet in
  "Resource ledger + deterministic teardown": point it at the script.
- `skills/engineering/fleet-ship/REFERENCE.md` - add a short "Teardown"
  section documenting flags.
- `plans/README.md` (status row)

**Out of scope**:
- `~/Projects/fleetboard/**` - deferred integration.
- Any OTHER section of SKILL.md (plan 002 owns restructuring).
- Running a real (non-dry) teardown against the user's live herdr - testing
  is dry-run only plus a self-created scratch tab.

## Git workflow

Repo hook blocks main writes; use a worktree:

```sh
git -C ~/Projects/necmttn-skills worktree add .claude/worktrees/003-teardown -b feat/fleet-teardown-script
```

Commit style: `feat(fleet-ship): deterministic ledger-driven teardown script`.
Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the script

Create `skills/engineering/fleet-ship/scripts/fleet-teardown.sh`, plain bash
(no bun/node deps; python3 only for JSON, matching the skill's existing
one-liners). Contract:

```
fleet-teardown.sh <ledger-path> --epic <epic> [--archive-dir docs/superpowers/fleet-runs] [--execute]
```

Behavior:
1. Refuse (exit 2, message) if `<ledger-path>` missing or contains no `RES `
   lines. Never fall back to `herdr agent list` scanning - exact ids only.
2. Parse RES lines: `RES <type> <id> <rest-of-line-is-label>`. Skip a RES
   line if a later `CLOSED <id>` line exists in the ledger (idempotence).
3. DRY-RUN is the DEFAULT: print a table of what WOULD happen (`type id
   label action`) and exit 0. Only `--execute` mutates.
4. On `--execute`, in this order:
   a. For each `agent`/`pane` RES id still alive (probe: `herdr agent get
      <id-or-name>` / presence in `herdr agent list` JSON): capture
      `herdr agent read <name> --source recent --lines 400` text and append
      under `## <label> (teardown capture)` to
      `<archive-dir>/<epic>.md` (create dir if needed), THEN
      `herdr pane close <pane_id>`. A read failure on a dead pane is logged,
      not fatal; the close still runs.
   b. Then each `tab` RES id: `herdr tab close <id>` ("not found" → treat as
      already gone, log `gone`).
   c. Then each `workspace` RES id: `herdr workspace close <id>` (same
      tolerance).
   d. Verify: re-fetch `herdr agent list`; any RES pane id still present →
      exit 1 listing survivors. Otherwise append
      `TEARDOWN-DONE <n_closed> $(date -Iseconds)` to the ledger and exit 0.
5. Every close it performs appends `CLOSED <id>` to the ledger immediately
   (crash-safe resume).

Style: `set -euo pipefail`, small functions, python3 one-liners for JSON
exactly like REFERENCE.md's existing snippets.

**Verify**: `bash -n <script>` → exit 0.

### Step 2: Unit-test the parser without herdr

```sh
cat > /tmp/ledger-test <<'EOF'
2026-07-16T10:00:00 start fleet:test
RES tab wX:t9 fleet:test
RES pane wX:p1 ▶ chunk-a
RES agent chunk-a chunk-a
CLOSED wX:p1
EOF
skills/engineering/fleet-ship/scripts/fleet-teardown.sh /tmp/ledger-test --epic test
```

**Verify**: dry-run output lists `tab wX:t9` and `agent chunk-a` as
would-close, marks `wX:p1` as already-closed, exits 0, and NOTHING was
closed (`herdr agent list` unchanged).

### Step 3: Integration test against a self-created scratch tab

Only resources the test itself mints:

```sh
WS=$(herdr agent list | python3 -c 'import sys,json;a=json.load(sys.stdin)["result"]["agents"];print(a[0]["workspace_id"])')
OUT=$(herdr tab create --workspace "$WS" --label "teardown-selftest" --no-focus)
TAB=$(printf '%s' "$OUT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["tab_id"])')
ROOT=$(printf '%s' "$OUT" | python3 -c 'import sys,json;print(json.load(sys.stdin)["result"]["root_pane"])')
printf 'RES tab %s teardown-selftest\nRES pane %s root-shell\n' "$TAB" "$ROOT" > /tmp/ledger-selftest
skills/engineering/fleet-ship/scripts/fleet-teardown.sh /tmp/ledger-selftest --epic selftest            # dry-run first
skills/engineering/fleet-ship/scripts/fleet-teardown.sh /tmp/ledger-selftest --epic selftest --execute
```

(Adjust the JSON field names if `tab create`'s response differs - inspect
`$OUT` first; the create-response shape was not re-verified for this plan.)

**Verify**: exit 0; `herdr tab list --workspace "$WS"` no longer shows
`teardown-selftest`; `/tmp/ledger-selftest` ends with `TEARDOWN-DONE`;
`docs/superpowers/fleet-runs/selftest.md` was NOT committed (test artifact -
delete it).

### Step 4: Wire the skill docs to the script

- SKILL.md "Resource ledger + deterministic teardown", the "Teardown reads
  the ledger" bullet: append `Run it, don't hand-roll it:
  scripts/fleet-teardown.sh <ledger> --epic <epic> (dry-run) then --execute.`
- REFERENCE.md: add a `## Teardown` section (after "Archive a pane result")
  with the usage line, the flag table, and the RES/CLOSED/TEARDOWN-DONE
  ledger grammar.

**Verify**: `rg -n 'fleet-teardown.sh' skills/engineering/fleet-ship/` → ≥2
matches (SKILL.md + REFERENCE.md).

## Test plan

Steps 2 and 3 are the tests (parser unit test + scratch-tab integration).
No repo test framework exists; the script's dry-run mode is the permanent
regression harness - document in REFERENCE.md that dry-run against the last
run's ledger is the smoke test.

## Done criteria

- [ ] `bash -n` exits 0
- [ ] Dry-run on `/tmp/ledger-test` produces the Step 2 table, closes nothing
- [ ] Self-test tab created and torn down by `--execute`; `TEARDOWN-DONE`
      appended
- [ ] `rg -n 'fleet-teardown.sh' skills/engineering/fleet-ship/` ≥2 matches
- [ ] `git status`: only in-scope files modified; no selftest archive file
      committed
- [ ] `plans/README.md` status row updated

## STOP conditions

- SKILL.md lacks the "Resource ledger" section (contract missing).
- `herdr tab create` response lacks `tab_id`/`root_pane` fields and you
  cannot determine the actual shape from the raw JSON - report the JSON.
- Any test path would close a pane/tab/workspace you did not create in
  Step 3 - abort the test, report.
- No herdr server running (`herdr agent list` fails): implement + Step 2
  only, mark Step 3 BLOCKED in the report.

## Maintenance notes

- Deferred: `fleetctl teardown` wrapper in `~/Projects/fleetboard` that
  calls this script then `deregister` - do it when fleetboard grows a test
  setup; the script's interface (ledger path + epic) was designed for that
  composition.
- If herdr ever grows per-session CLI targeting (see plan 004 / the herdr
  feature request), the script needs a `--socket`/session flag passthrough.
- Reviewers: scrutinize Step 1.4d's verify loop - survivors must fail loudly
  (exit 1), never silently succeed.
