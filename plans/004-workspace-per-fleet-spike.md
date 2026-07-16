# Plan 004: Spike - workspace-per-fleet as the isolation boundary (design doc, not a build)

> **Executor instructions**: This is a DESIGN SPIKE: the deliverable is a
> findings doc + a PROPOSED skill diff, nothing applied to SKILL.md. Follow
> steps in order; run every verification command. On any STOP condition,
> stop and report.
>
> **Drift check (run first)**: `git diff --stat a4ba253..HEAD -- skills/engineering/fleet-ship/SKILL.md`
> Expected drift: plan 001 fixes, the 2026-07-16 teardown-ledger section,
> possibly plan 002's restructure. None of it blocks this spike.

## Status

- **Priority**: P3
- **Effort**: S–M (spike; estimate coarse by nature)
- **Risk**: LOW - read-mostly; the only mutations are scratch resources the
  spike itself creates.
- **Depends on**: none (composes with 003: teardown script would gain
  `workspace` as its outermost close)
- **Category**: direction
- **Planned at**: commit `a4ba253`, 2026-07-16

## Why this matters

Fleet runs currently share the human's workspace: one `fleet:<epic>` tab
inside the project workspace. Ownership boundary = prose rules; orphans leak
into the human's sidebar (live complaint 2026-07-16). Full session-per-fleet
isolation is BLOCKED upstream (verified 2026-07-16: herdr subcommands only
reach the default session's socket; `--session` on subcommands errors;
`HERDR_SOCKET` env is ignored). The middle option is buildable today:
`herdr workspace create --no-focus` + `herdr workspace close <id>` both
exist (verified against the live CLI). A fleet-owned workspace would give a
one-command teardown boundary while (hypothesis) staying visible in the
user's sidebar. This spike answers whether the hypothesis holds and what the
skill change would look like.

## Current state

- `skills/engineering/fleet-ship/SKILL.md` - Hard rule "Three-level
  placement: workspace=space · tab=fleet run · pane=chunk": "The workspace is
  the human's project space - do NOT create one per chunk. ... Create ONE
  `fleet:<epic>` tab per run". Note: it forbids workspace-per-CHUNK; a
  workspace-per-FLEET-RUN is a design change to this rule, not a violation
  of its incident history (the incidents were about spawning into focused/
  human tabs).
- "Sidebar legibility" section: the sidebar is the human's status board -
  glyph labels + tab counts. Any proposal must preserve at-a-glance triage.
- Verified herdr workspace CLI surface:
  `workspace list | create [--cwd PATH] [--label TEXT] [--no-focus] | get |
  focus | rename | close <id>`; `tab create --workspace <id>`;
  `agent start ... --workspace ID`.
- Unverified (this spike verifies): whether `workspace close` cascades to
  live panes; whether a `--no-focus` workspace is visible in the GUI sidebar
  without being focused; how `agent list` census + fleetboard interplay
  changes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Create scratch ws | `herdr workspace create --cwd /tmp --label "spike-wpf" --no-focus` | JSON with workspace id |
| Inspect | `herdr workspace get <id>` / `herdr tab list --workspace <id>` | JSON |
| Cascade probe | `herdr workspace close <id>` with a live pane inside | observe: refuses? closes all? |

## Scope

**In scope**:
- Live probes against scratch resources ONLY (label everything `spike-wpf*`).
- New file: `docs/spikes/workspace-per-fleet.md` (findings; create `docs/spikes/`).
- A PROPOSED diff to SKILL.md's placement rules, embedded in the findings
  doc as a fenced block - NOT applied.
- `plans/README.md` (status row).

**Out of scope**:
- Applying any SKILL.md change.
- Touching any workspace/tab/pane you did not create in this spike.
- The blocked session-per-fleet path (only reference it in the doc).

## Git workflow

Worktree (main-write hook): `git -C ~/Projects/necmttn-skills worktree add
.claude/worktrees/004-spike -b spike/workspace-per-fleet`.
Commit: `docs(fleet-ship): workspace-per-fleet spike findings`.
Do NOT push/PR unless the operator instructed it.

## Steps

### Step 1: Cascade + lifecycle probe

Create scratch workspace `spike-wpf` (--no-focus), a tab in it, and one
cheap pane (`herdr agent start spike-wpf-pane --cwd /tmp --workspace <ws-id>
-- bash` - if `bash` is rejected as an agent argv, use
`codex exec --dangerously-bypass-approvals-and-sandbox "sleep 300"` or note
the constraint). Record in the findings doc:

- Does `workspace close` on a workspace with a live pane succeed, refuse, or
  orphan the pane? (`herdr agent list` before/after.)
- Do pane/tab ids inside survive anything, or die with the workspace?
- Is a `--no-focus` workspace listed by `herdr workspace list` and does the
  create response carry its id + label?

Clean up: ensure NOTHING labeled `spike-wpf*` remains in `workspace list` /
`agent list`.

**Verify**: `herdr workspace list | rg spike-wpf` → no matches after cleanup.

### Step 2: Sidebar visibility (HITL - requires the user)

Ask the user (via the session's attention mechanism or directly if
interactive): with a `--no-focus` workspace `spike-wpf` present, (a) is it
visible in the GUI sidebar without switching to it? (b) are its tab label
counts (`fleet:<epic> ▶3 ⏳1`) readable from the workspace list, or only
after entering the workspace? Recreate the scratch workspace for the demo,
then clean up again. If the user is unavailable, record the question as OPEN
in the findings doc and continue - do not guess.

**Verify**: findings doc has a "Sidebar visibility" section with either the
user's answer or OPEN.

### Step 3: Write the findings doc + proposed diff

`docs/spikes/workspace-per-fleet.md` sections:

1. **Question** - one paragraph (isolation boundary vs sidebar legibility).
2. **Verified facts** - from Steps 1–2, plus the session-per-fleet blockers
   (quote them: subcommands hit default socket; `--session` errors;
   `HERDR_SOCKET` ignored; verified 2026-07-16).
3. **Proposal** - placement becomes: workspace = `fleet:<epic>` (fleet-owned,
   `--no-focus`) → tabs = waves or functional groups (build/review/dogfood)
   → panes = chunks. Teardown outermost = `workspace close` (and plan 003's
   script closes workspace RES lines last). Human's project workspace never
   hosts fleet panes.
4. **Costs/risks** - sidebar behavior per Step 2; census/fleetboard changes;
   migration of the Sidebar-legibility glyph rules to workspace labels;
   what the Three-level placement hard rule's incident history still forbids.
5. **Proposed SKILL.md diff** - fenced ```diff block rewriting the
   "Three-level placement" hard rule + Per-chunk step 3 placement sentence.
   NOT applied.
6. **Recommendation + open questions** - honest verdict: adopt / adopt for
   unattended runs only / drop. If Step 2 shows a --no-focus workspace is
   invisible or illegible in the sidebar, the expected verdict is "drop or
   unattended-only" - say so plainly.

**Verify**: `rg -n '^## ' docs/spikes/workspace-per-fleet.md` shows all six
sections; the diff block parses (`rg -c '^```diff' → 1`).

## Test plan

Spike - the probes in Steps 1–2 are the evidence; no code ships. The
findings doc's "Verified facts" section must contain only statements backed
by a probe transcript or the user's answer (paste command + output snippets).

## Done criteria

- [ ] `docs/spikes/workspace-per-fleet.md` exists with all six sections
- [ ] Zero `spike-wpf*` resources left (`herdr workspace list`, `herdr agent list`)
- [ ] Proposed diff present but SKILL.md untouched (`git diff --stat` shows
      only the new doc + plans/README.md)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Any probe would touch a non-`spike-wpf` resource.
- `workspace close` errors leave a zombie workspace you cannot remove -
  report the state, do not force-kill herdr.
- No herdr server running: write the doc with Step 1 marked BLOCKED.

## Maintenance notes

- If adopted, plan 003's teardown script and the Resource-ledger rule need
  `workspace` RES lines to become the standard outermost entry.
- File the herdr feature request for per-session CLI targeting separately -
  it upgrades this middle option to full session isolation later; link it in
  the findings doc when filed.
- Revisit after herdr updates: `workspace close` cascade semantics may
  change between channels (user runs preview builds).
