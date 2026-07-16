# Plan 002: Single-source every rule in fleet-ship - dedupe SKILL.md/REFERENCE.md without losing behavior

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report - do not improvise. When done, update the status row for this plan
> in `plans/README.md` - unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a4ba253..HEAD -- skills/engineering/fleet-ship/`
> Plans 001's fixes and the 2026-07-16 "Resource ledger + deterministic
> teardown" section are EXPECTED drift. Anything else: compare "Current
> state" excerpts before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED - this restructures the operating manual of live fleet runs; a
  lost rule reappears as a production incident, which is why the plan is
  mapping-table-driven and ends with a fresh-context behavior check.
- **Depends on**: plans/001-fleet-ship-doc-fixes.md
- **Category**: tech-debt
- **Planned at**: commit `a4ba253`, 2026-07-16

## Why this matters

fleet-ship/SKILL.md (~465 lines) and REFERENCE.md (~350 lines) restate the
same lessons two to three times. Restating caused real drift already: the two
skills contradicted each other on `agent send` semantics until plan 001 fixed
it. Separately, the ENTIRE SKILL.md loads into the orchestrator's context on
every fleet run, and orchestrator main-loops were measured at ~78% of a
2-week fleet token spend - every duplicated paragraph is paid for on every
wake, in every rotation successor, forever. Goal: each rule has exactly ONE
canonical home; the other mention (if needed at all) is a one-line pointer.

## Current state

Files (repo root `~/Projects/necmttn-skills`):

- `skills/engineering/fleet-ship/SKILL.md` - orchestrator operating manual,
  loaded whole into context each run. Sections: Multi-orchestrator
  coordination, Skills this composes, Model axes, Engine routing, Sidebar
  legibility, Tandem orchestrator, Child→parent signals, Run map, Setup,
  Per-chunk loop, Liveness monitor, Housekeeping (incl. Resource ledger),
  Context hygiene, Orchestrator rotation, Hard rules.
- `skills/engineering/fleet-ship/REFERENCE.md` - scripts, brief templates,
  waiter/monitor code, kanban commands. Loaded on demand, not per-wake.

Known duplication clusters (verify each against the live file; line numbers
are as of `a4ba253` and will have shifted slightly):

1. **idle≠done stated as TWO separate Hard rules** - `SKILL.md:383`
   ("**Idle != done - and `done`, not `idle`, is how panes often END.**...")
   and `SKILL.md:387` ("**Idle != done (background-shell flap).**..."). The
   full mechanics (level-triggered wait, READY_UNCOMMITTED, settle-poll) also
   live in REFERENCE.md "Idle-waiter" + "Refinement"/"Refinement 2" sections.
2. **Tab/workspace placement stated twice in SKILL.md** - Per-chunk loop
   step 3 (`SKILL.md:213-223`, "Placement hierarchy... Tab hygiene...") and
   Hard rule "**Three-level placement: workspace=space · tab=fleet run ·
   pane=chunk.**" (`SKILL.md:372-382`). Both carry the same rules (never tab 1,
   one fleet tab per run, reuse-before-create, kill root shell, `pane move`).
3. **Commit-gated waiter rationale in both files** - Hard rules restate what
   REFERENCE.md's waiter sections specify precisely (commit OR dirty gate,
   `idle|done` acceptance, flap guard).
4. **Sidebar label rules stated twice** - "Sidebar legibility" section
   (`SKILL.md:114-131`) and again inside Per-chunk step 3 + step 7 pointers.
5. **Monitor described twice in SKILL.md** - "Liveness monitor" section
   (`SKILL.md:275-296`) overlaps the Hard rule "Event-driven, not timed" and
   "Waiter timeout != stuck" bullets, and REFERENCE.md's monitor section.

Repo conventions: conventional commits (`docs(fleet-ship): ...` /
`fix(fleet-ship): ...`). No build/test tooling - verification is grep + word
count + the behavior check below.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Size before/after | `wc -w skills/engineering/fleet-ship/SKILL.md` | after < before by ≥15% |
| Anchor uniqueness | `rg -c '<anchor phrase>' skills/engineering/fleet-ship/SKILL.md` | 1 per canonical anchor |
| Fence balance | `awk '/^```/{n++} END{print n%2==0?"balanced":"UNBALANCED"}' <file>` | `balanced` |

## Scope

**In scope**:
- `skills/engineering/fleet-ship/SKILL.md`
- `skills/engineering/fleet-ship/REFERENCE.md`
- `plans/README.md` (status row)

**Out of scope**:
- `skills/engineering/herdr-agent-orchestration/**` - the low-level skill
  legitimately restates pane mechanics for its own audience; cross-skill
  dedupe is NOT this plan.
- `fleet-routing.json`.
- The skill's MEANING: no rule may be weakened, no threshold changed, no live
  lesson dropped. This is a move-and-point refactor, not an edit.
- The frontmatter `description:` - it is load-bearing for skill discovery.

## Git workflow

Repo hook blocks main writes; use a worktree:

```sh
git -C ~/Projects/necmttn-skills worktree add .claude/worktrees/002-dedupe -b refactor/fleet-ship-dedupe
```

Commit style: `docs(fleet-ship): single-source duplicated rules (SKILL 15-25% smaller)`.
Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Build the mapping table FIRST

Before editing, write `dedupe-map.md` at the WORKTREE root (scratch file, do
not commit) with one row per duplicated statement:

| Rule | Canonical home (keep full text) | Other sites (reduce to pointer) |

Populate it from the five clusters above PLUS any additional duplicates you
find by reading both files end to end. Every row's "canonical home" must be
the site with the most operational detail today.

**Verify**: the table has ≥5 rows and covers all five known clusters.

### Step 2: Merge the two idle≠done hard rules

Merge `SKILL.md:383` and `:387` into ONE hard rule bullet that keeps: (a)
gate on `idle|done` never `= idle`; (b) `done` is terminal for codex; (c)
commit-OR-dirty is the real signal, bare idle flaps; (d) READY_UNCOMMITTED →
orchestrator commits itself; (e) pointer "mechanics + scripts: REFERENCE
'Idle-waiter' + 'Refinement 2'". Delete waiter mechanics prose that
REFERENCE.md already specifies.

**Verify**: `rg -c 'Idle != done' skills/engineering/fleet-ship/SKILL.md` → 1.

### Step 3: Collapse placement/tab-hygiene to one home

Canonical home: the Hard rule "Three-level placement" (it is the fuller one -
keeps pane-move retrofit, tab-1 rule, root-shell kill). Per-chunk step 3
keeps ONLY: the spawn command line, "placement per the Three-level placement
hard rule", and the engine-routing sentence. Delete the duplicated hygiene
prose from step 3.

**Verify**: `rg -c 'root SHELL pane|root_pane' skills/engineering/fleet-ship/SKILL.md` → 1 (in the hard rule; REFERENCE/ledger mentions excluded - scope the grep to SKILL.md).

### Step 4: Sweep remaining clusters (3, 4, 5 + your table rows)

Same operation per row: canonical site keeps full text; every other site
becomes at most one line ending in a `(see <section>)` pointer. Rules of the
refactor:

- A pointer names the section, never "above"/"below".
- Live-lesson dates and incident one-liners stay attached to the canonical
  text (they are the skill's evidence base).
- REFERENCE.md keeps ALL scripts and templates; SKILL.md keeps ALL policy.
  Where SKILL.md currently embeds script behavior in prose, replace with a
  pointer to the REFERENCE section.

**Verify**: for each mapping-table row, `rg -c '<distinctive phrase>'` on
SKILL.md returns exactly 1.

### Step 5: Fresh-context behavior check (the regression gate)

Dispatch a fresh-context subagent (no access to this session) with ONLY the
restructured SKILL.md + REFERENCE.md file paths and these 10 questions; its
answers must match the expected answers, which you derive FIRST from the
pre-edit files (git stash or `git show a4ba253:...`):

1. A pane's waiter fired but the worktree has no commit and is dirty - what
   do you do? (expect: READY_UNCOMMITTED → orchestrator commits it)
2. What status values may a finished codex pane show? (idle AND done)
3. Where do fleet chunk panes spawn - which tab? (one fleet:<epic> tab per
   run, never tab 1 / focused tab)
4. What must happen BEFORE `herdr pane close` on a done pane? (archive
   `agent read --source recent` into docs/superpowers/fleet-runs/<epic>.md)
5. When may a pane be closed relative to merge? (at COMMIT+REPORT, before
   merge; worktree+branch survive until merge)
6. How do you find things to tear down at run end? (ledger RES lines, exact
   ids, never label patterns)
7. Who merges to main? (orchestrator only, after cross-model consensus gate)
8. What does the liveness monitor catch that waiters don't? (stuck/errored/
   dead - errored rings immediately)
9. What happens when `agent send` targets a pane holding a user's parked
   draft? (REPLACES → capture/log draft first, submit protocol)
10. Which engine reviews a codex-built chunk? (the OTHER lane - grok; never
    self-review; grok never reviews)

**Verify**: 10/10 answers match. Any miss → the canonical text lost
information; restore it and re-run.

## Test plan

Step 5 IS the test. Additionally: fence-balance awk on both files →
`balanced`; `wc -w` on SKILL.md shows ≥15% reduction vs pre-edit.

## Done criteria

- [ ] SKILL.md word count reduced ≥15% vs `git show a4ba253:skills/engineering/fleet-ship/SKILL.md | wc -w`
- [ ] Every mapping-table phrase greps exactly once in SKILL.md
- [ ] Fresh-context check: 10/10
- [ ] Fences balanced in both files
- [ ] `git status`: only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 001 has not landed (`rg -n 'agent list --tab' skills/` still matches).
- You find yourself REWRITING a rule's meaning rather than moving it - this
  plan forbids semantic edits; report the rule instead.
- The fresh-context check fails twice on the same question after restoring
  text.
- SKILL.md sections exist that this plan's cluster list doesn't mention AND
  whose dedupe would require judgment about which copy is right - list them
  in the report instead of choosing.

## Maintenance notes

- Future live lessons get ONE home on arrival: policy → SKILL.md section,
  mechanics/scripts → REFERENCE.md, and at most a one-line pointer from the
  other file. Reviewers should reject PRs that restate.
- The 10-question behavior check is reusable - keep `dedupe-map.md`'s
  questions with the PR description for the reviewer.
- Deferred: cross-skill dedupe with herdr-agent-orchestration (different
  audiences; revisit only if another cross-skill contradiction appears).
