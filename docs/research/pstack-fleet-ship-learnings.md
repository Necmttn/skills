# pstack learnings for `fleet-ship`

Date: 2026-09-04

Question: does [`backnotprop/pstack`](https://github.com/backnotprop/pstack/tree/18e0e908a13553b0e58d065ab26dbc9a972ec8ba) contain ideas that `fleet-ship` should absorb?

Short answer: yes. `fleet-ship` is already stronger on multi-machine state, merge serialization, liveness, and teardown. The useful differences concern pre-fanout calibration, stale results, durable worker output, verification records, and drain discipline.

## Additive ideas

### 1. Add an explicit pilot-before-scale rule

`pstack` requires one unit to go through the full path before fanout. The goal is to falsify the brief template, verify recipe, and unit size while the blast radius is still one unit.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L62-L65`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L62-L65)

Why it matters:
- `fleet-ship` has a tracer bullet after runtime-affecting merges and requires per-chunk plan and gate flow, but it does not state a mandatory first-unit pilot before broad fanout.
- Current `fleet-ship` references are close, but not the same thing:
  - [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:427) starts the per-chunk loop.
  - [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:565) runs dogfood after merges.

Suggested import:
- Add a rule near setup or wave planning: first run one representative chunk through spawn, brief, wait, review, merge, and dogfood.
- Only then allow wide fanout for that chunk class or lane.

### 2. Split verification status into a first-class verdict ledger

`pstack` keeps a separate verification ledger keyed by PR plus head SHA. A new SHA invalidates the old verdict.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L87-L93`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L87-L93)

Why it matters:
- `fleet-ship` has strong stage logging and event replay, but its ledger is stage-oriented. It records `chunk.<stage>` transitions and some `evidence=` validation in epic mode, but it does not define a compact, queryable verification verdict record that becomes stale on head change.
- Relevant `fleet-ship` references:
  - [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:632) epic mode validation.
  - [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:644) type vocabulary.

Suggested import:
- Add a `verification verdict` field or event family keyed by `<slug>/<chunk-id> + commit`.
- Make re-review and re-verify state explicit when a chunk gets a new commit after a gate result.

### 3. Add queue-drain batching as an explicit protocol

`pstack` treats completions as queue events, not interrupts. It drains in batches after critical sections.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L70-L77`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L70-L77)

Why it matters:
- `fleet-ship` already says each wake starts from `fleet state --live` and stays small and stateless.
- It does not define a sharp rule for when arrivals are queued and when they are processed, so an orchestrator can still get dragged into inline handling.
- Relevant `fleet-ship` references:
  - [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:654) state view.
  - [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:677) context hygiene.

Suggested import:
- Add one rule: completion events append only.
- Reconcile them only at defined drain points such as after a merge, after a spawn wave, after a review batch, and before a human report.

### 4. Reject stale results from superseded attempts

`pstack` checks late worker results against the current frontier and verification ledger. It never merges a late result without new reconciliation.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L95-L103`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L95-L103)

Why it matters:
- `fleet-ship` counts attempts, but its events do not carry an attempt identifier.
- A delayed `BUILT` event from an old pane can be mistaken for the current attempt.
- This risk increases after quota recovery, pane replacement, or machine failure.

Suggested import:
- Mint an `attempt_id` when a chunk enters `building`.
- Put that identifier in every pane event and verification record.
- Reject events from an attempt that is not current.
- Reconcile useful late work through a new attempt instead of merging it directly.

This proposal is an inference from the `pstack` zombie rule. `pstack` does not specify this exact event field.

### 5. Externalize completed worker output before closing its pane

`pstack` does not treat work on one machine as durable. The worker publishes its branch, and the verifier publishes its receipt.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L87-L100`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L87-L100)

Why it matters:
- `fleet-ship` closes a build pane after commit and report capture.
- Its standard brief also tells workers not to push.
- A remote machine failure can therefore remove the only copy of a completed branch before merge.

Suggested import:
- Publish each completed branch to a run-owned remote reference before pane closure.
- A git bundle in shared storage is an acceptable fallback.
- Record the reference and commit in the ledger.
- Keep the existing rule that workers do not open PRs or merge.

### 6. Use a rolling window and a landing deadline

`pstack` limits active workers to the number that the coordinator can drain. It refills that window as work finishes. It also stops new work near 70 percent of the time budget.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L15-L21`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L15-L21)
- [`skills/poteto-mode/playbooks/orchestrate.md#L60-L68`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L60-L68)

Why it matters:
- `fleet-ship` limits placement by machine slots, but it does not limit work by review and merge capacity.
- Large waves can create a long gate queue and many completed branches.

Suggested import:
- Set a run-level active chunk limit from gate capacity, not only machine capacity.
- Refill from `fleet next` whenever a slot becomes free.
- For a fixed deadline, stop new assignments near 70 percent of the available time.
- Use the remaining time to gate, merge, dogfood, and close completed work.

### 7. Add explicit scope and time limits to each chunk

`pstack` briefs name allowed paths, forbidden paths, exact checks, time limits, and required report fields.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L36-L58`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L36-L58)

Why it matters:
- `fleet-ship` has a scope sentence and a fixed discipline block.
- Its graph does not define an allowed write set, a denied write set, or a time limit.

Suggested import:
- Add optional `writes`, `forbidden`, and `timebox` fields to `graph.json`.
- Put these fields in every brief.
- Make the gate compare changed paths with the declared write set.
- On time expiry, require a partial report instead of continued work.

### 8. Add a global stop-line for bad upstream conditions

`pstack` has a concrete pause rule for tree-wide bad conditions. It writes a stop line in standing orders, lets in-flight work finish, fixes the cause, then clears it.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L101-L103`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L101-L103)

Why it matters:
- `fleet-ship` has strong per-pane recovery and escalation, but no simple fleet-wide freeze switch for cases such as a broken shared acceptance rule or poisoned upstream output.

Suggested import:
- Add a ledger policy or run-map flag such as `spawn-paused`.
- State that no new panes spawn while the flag is open.

### 9. Move repeated rules from prose into checks

`pstack` says that repeated corrections belong in types, lint rules, helpers, runtime checks, or scripts. It also tests retryable operations against repeated runs and crash points.

Sources:
- [`skills/principle-encode-lessons-in-structure/SKILL.md#L7-L26`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/principle-encode-lessons-in-structure/SKILL.md#L7-L26)
- [`skills/principle-make-operations-idempotent/SKILL.md#L7-L24`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/principle-make-operations-idempotent/SKILL.md#L7-L24)

Why it matters:
- `fleet-ship` already enforces several rules through `fleet.ts`.
- Many incident rules remain only in the long skill text.

Suggested import:
- Keep a list of prose-only safety rules.
- Move each repeat incident into `fleet.ts`, a schema, or a test when possible.
- Add crash-point tests for spawn, event append, gate, merge claim, archive, and teardown.
- Delete duplicate prose after the check becomes authoritative.

### 10. Add feature-map maintenance to dogfood and verify workflows

`pstack` has a concrete pattern for generating and maintaining a repo-local verification skill and feature map. The valuable part is not Cursor-specific skill scaffolding. The valuable part is the concept that real-user verification paths become a maintained artifact and get audited over time.

Sources:
- [`skills/create-verification-skill/SKILL.md#L23-L44`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/create-verification-skill/SKILL.md#L23-L44)
- [`skills/maintain-verification-skill/SKILL.md#L23-L39`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/maintain-verification-skill/SKILL.md#L23-L39)

Why it matters:
- `fleet-ship` already dogfoods after merges, but it does not define a maintained feature inventory or a recurring audit loop for the verification surface.
- Relevant `fleet-ship` reference:
  - [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:565) dogfood step.

Suggested import:
- Add a recommendation that apps with real UI flows keep a feature map beside the dogfood harness.
- Add a maintenance pass that checks top user flows against source and live behavior.

## Overlaps that `fleet-ship` already handles well

### 1. Durable audit trail

`pstack` uses `decisions.tsv` for a decision trail.

Source:
- [`skills/show-me-your-work/SKILL.md#L11-L18`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/show-me-your-work/SKILL.md#L11-L18)
- [`skills/show-me-your-work/SKILL.md#L54-L74`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/show-me-your-work/SKILL.md#L54-L74)

`fleet-ship` already goes further with CloudEvents ledger, run archive, live state rendering, and teardown tracking.

Relevant `fleet-ship` references:
- [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:623)
- [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:584)

Conclusion:
- Do not copy `decisions.tsv` as-is.
- If imported at all, import only the idea of a tighter decision/verdict surface, not the file format.

### 2. One writer per shared artifact

`pstack` says one writer per worktree or branch.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L17-L19`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L17-L19)

`fleet-ship` already encodes this strongly with one agent per worktree, exact resource ownership, and ledger-driven teardown.

Relevant `fleet-ship` references:
- [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:755)
- [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:606)

### 3. Resume from durable state, not memory

`pstack` says reattach from stored state after restart.

Source:
- [`skills/poteto-mode/playbooks/orchestrate.md#L97-L103`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L97-L103)

`fleet-ship` already has this principle in stronger form with `fleet state --live`, cursor replay, orphan sweep, and rotation protocol.

Relevant `fleet-ship` references:
- [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:339)
- [SKILL.md](/Users/necmttn/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md:697)

## Ideas that do not fit `fleet-ship` well

### 1. Cursor cloud and Task-tool assumptions

Large parts of `pstack` orchestration assume Cursor cloud agents, Task-tool spawning, and PR-stack workflows.

Sources:
- [`skills/poteto-mode/playbooks/orchestrate.md#L17-L25`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L17-L25)
- [`skills/poteto-mode/playbooks/orchestrate.md#L79-L85`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L79-L85)

Why not:
- `fleet-ship` is herdr-first and machine-placement-first.
- Direct import would fight the local pane, steward, and claim model.

### 2. Graphite stacker model

`pstack` spends a lot of design on stack frontier, restacks, and one stacker per stack.

Sources:
- [`skills/poteto-mode/playbooks/orchestrate.md#L79-L85`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/poteto-mode/playbooks/orchestrate.md#L79-L85)

Why not:
- `fleet-ship` lands to `main` under a single serialized merge claim.
- The problem shape is different enough that the stacker rules are not portable.

### 3. Local uncommitted trail as the default

`pstack` keeps the decision trail local by default and commits only when needed.

Source:
- [`skills/show-me-your-work/SKILL.md#L42-L46`](https://github.com/backnotprop/pstack/blob/18e0e908a13553b0e58d065ab26dbc9a972ec8ba/skills/show-me-your-work/SKILL.md#L42-L46)

Why not:
- `fleet-ship` needs machine-shared, crash-safe state for multi-host orchestration.
- Local-only trail is weaker than the current ledger plus board design.

## Recommended changes to `fleet-ship`

If we take anything, I would take these in this order:

1. First-class verification verdict records keyed by commit.
2. Attempt identifiers that reject stale worker events.
3. Durable remote references for completed worker commits.
4. A mandatory pilot chunk before broad fanout.
5. A rolling active window based on gate capacity.
6. Explicit drain points for completion handling.
7. A fleet-wide `spawn-paused` rule for bad upstream conditions.
8. Enforced write scopes and time limits in `graph.json`.
9. Crash-point tests and structural checks for repeated incident rules.
10. Optional feature-map maintenance for apps with user interfaces.

## Status (2026-09-05, branch `chore/fleet-ship-pstack-learnings`)

What landed in `skills/engineering/fleet-ship` (enforced in `scripts/fleet.ts`, tested in `src/ledger/safety.test.ts`,
`src/run/scheduling.test.ts`, and `fleet.test.ts`; documented under "Safeguards + scheduling" in SKILL.md):

| # | Item | Status |
|---|---|---|
| 1 | Verification verdict keyed by commit | Landed. `gated` needs `verdict=PASS evidence=verified checks= commit=<built sha>`; a new commit drops the receipt; `merged` needs `input_commit=`; `fleet check-gate` checks a clean worktree HEAD against the receipt. |
| 2 | Attempt identifiers | Landed. `building` mints `attempt_id`; stale, missing, or ended tokens are rejected at write time and on replay (`state.rejected`, shown in `fleet state`). |
| 3 | Durable remote refs before pane close | Prose rule only (Housekeeping step 3 + `ref=` on `built`). No code check yet: the ledger cannot see the remote. |
| 4 | Pilot before fanout | Landed. `scheduling.pilot`; nothing else is ready until the pilot is `dogfooded`. |
| 5 | Rolling window by gate capacity | Landed. `scheduling.max_in_flight` + `max_gate_queue`, enforced by `fleet next` and by `fleet log assigned|spawned`. |
| 6 | Drain points | Prose rule only. |
| 7 | `spawn-paused` freeze switch | Landed. `fleet.policy.set spawn-paused text=<why>` / `text=off`. |
| 8 | Write scopes + timebox in `graph.json` | Not started. Follow-up. |
| 9 | Rules into checks + crash tests | Landed for the items above (replay, duplicate delivery, late completion, retry clears approval, abandoned dependency does not count as merged). |
| 10 | Feature-map maintenance | Not started. Out of scope for fleet-ship; belongs to the dogfood skill. |

Correction to item 2 above: the first draft proposed a separate event family. The shipped form reuses `chunk.gated`
with required data keys and folds a `gate` receipt into chunk state. One vocabulary, no second ledger.

## Bottom line

`fleet-ship` already exceeds `pstack` on distributed orchestration mechanics. The best additions protect verification validity and completed work across retries and machine failure.
