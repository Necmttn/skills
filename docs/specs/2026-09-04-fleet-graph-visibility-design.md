# Fleet graph visibility - design

Date: 2026-09-04. Status: approved by the owner 2026-09-04; open questions resolved in section 17. Scope: the `fleet-ship` skill and its `scripts/fleet.ts` tooling.

## 1. Problem

A fleet run has two structures that nobody can see today:

- **The graph.** Which chunks exist, which chunk blocks which, and what the frontier is right now.
- **The workflow.** Where each chunk stands in its state machine: assigned, planned, building, built, in review, gated, merged, dogfooded, blocked, error. And inside a stage, which step runs: plan review, TDD, codex review, adversarial review, consensus gate.

Both structures exist only as discipline in prose. The plan markdown holds an ASCII sketch of the graph. The run-map issue holds one "Blocked-by:" prose line. The ledger records a stage when the orchestrator remembers to log it. Nothing records the edges. The human cannot answer "what is done, what is next, what is stuck" without reading panes. The agents in the panes cannot answer it at all.

Evidence from the live `forge-web` run on 2026-09-04:

| Object | Observed |
|---|---|
| Cards on GitHub Project 8 | 25, every one a `DraftIssue` |
| Sub-issues under the run-map issue #15 | 0 |
| Native blocked-by edges on #15 | 0 |
| Follow-up issues with no parent | 11 |

`SKILL.md` says "express chunk dependencies as native GitHub blocked-by relations". The recipe in `REFERENCE.md` under "Kanban" runs `gh project item-create`, which creates drafts. The recipe contradicts the rule. This is why the board never links.

A second gap: the run-time record (ledger, archive, decisions) lives in the code repo under `docs/superpowers/fleet-runs/`. Panes work in separate worktrees and never see files the orchestrator writes in the root checkout. Ledger commits also land in the code history and in every PR diff.

A third gap: what one agent learns about the repo (a faster test command, a flaky gate, a trap in the build) dies with its pane. The next agent starts from zero.

## 2. Goals and non-goals

Goals:

1. The graph and the workflow are data, validated by code, not prose.
2. One fold produces one run state. Every surface (text view, dagr pane, GitHub) is a projection of it.
3. Agents can read their own position: stage, step, blockers, dependents, acceptance.
4. Git carries a structured record through trailers, so the ledger is rebuildable and searchable.
5. The run-time record is visible from every worktree and every machine.
6. Know-how about the repo accumulates across runs and reaches the next agent's brief.

Non-goals:

- No new scheduler or workflow engine. The orchestrator keeps authority. The tooling records, validates, derives, and projects.
- No search tool. The record is made searchable (fixed headings, one id vocabulary, one directory). qmd or ax index it later.
- No pane-to-pane communication protocol. The orchestrator stays the hub. See section 12.
- No custom herdr plugin in this design. herdr-dagr renders the graph. An own plugin is a later option behind the same fold.
- No second personal wiki. The know-how board is repo-scoped. Cross-repo lessons go to `~/wiki` through the existing wiki-ingest flow.

## 3. Decisions taken with the owner

| Decision | Choice |
|---|---|
| Source of truth for the graph | A committed graph file per epic. GitHub, dagr, and the text view are projections. |
| Graph schema | Own small plan-only schema. `fleet dagr` projects it plus the ledger into dagr contract v3. |
| Surfaces | Core in `fleet.ts` + herdr-dagr pane + GitHub sync. Own plugin deferred. |
| Merge model | Epic integration branch with stacked sub-PRs. One epic PR to main. |
| Fleet home | Orphan branch `fleet` in the same repo, checked out at `~/.fleet/<repo>`. |
| Know-how | A repo-scoped board in the fleet home, an exit survey in every brief, a librarian pane that curates. |

## 4. Fleet home - where the record lives

`FLEET_HOME` is a directory outside every code worktree. Default `~/.fleet/<repo>`, where `<repo>` is the repository name. It is a git worktree of the orphan branch `fleet` in the same repository. `fleet init` creates the branch on first use and adds the worktree. Every fleet command takes `--home <dir>` or reads `FLEET_HOME`.

Layout:

```
~/.fleet/<repo>/
  knowhow/              # section 13, repo-scoped, survives epics
    KNOWHOW.md          # curated, the only file briefs inject
    inbox/              # raw entries from agents, one file each
    archive/            # promoted or rejected entries, with a pointer
  <epic>/
    graph.json          # section 5, committed
    ledger.<slug>.jsonl # section 6, one per machine, append-only, committed
    DECISIONS.md        # live mirror of the run map's decisions, committed
    archive.md          # one section per merged chunk, committed
    log.md              # derived from git trailers, regenerated, committed
    briefs/             # delivered briefs, committed
    shots/              # dogfood screenshots, committed
    handoff-<n>.md      # rotation handoffs, committed
    .dagr/run.json      # dagr projection, gitignored on the fleet branch
    ACTIVE.md           # offline fallback for the fleetboard registry
```

Rules:

- Specs and plans stay in the code repo on `main`. They are inputs written before the run. Every worktree branches from main and already has them. `graph.json` references the plan by path and commit SHA.
- Every brief tells the pane to read `DECISIONS.md` at start and again before its gate. This is how every worktree gets the same mid-run context.
- Remote machines pull and push the `fleet` branch. Per-machine ledger files avoid append conflicts. The fold reads every `ledger.*.jsonl` in the epic directory and orders by `time`.
- The code repo's history carries only trailers (section 8). The fleet branch carries the record. The chunk id joins the two.
- The derived `log.md` and the folded state are regenerated. They are never hand-edited.
- One qmd collection over `~/.fleet/` indexes every project's record and know-how.

## 5. The graph file

`~/.fleet/<repo>/<epic>/graph.json`. Plan-only. Written when the plan is written, updated when the fog graduates into chunks. Never holds run-time state.

```json
{
  "version": 1,
  "epic": "forge-web",
  "repo": "Necmttn/forge-interviews",
  "plan": { "path": "docs/superpowers/plans/2026-09-03-forge-web-plan.md", "sha": "8d6e39b" },
  "integration_branch": "epic/forge-web",
  "runmap_issue": 15,
  "project_number": 8,
  "chunks": [
    {
      "id": "b3-d1-store",
      "title": "D1 Store",
      "kind": "impl",
      "lane": "mechanical",
      "deps": ["a1-schemas", "a3-store-interface"],
      "conflicts": ["a4-shared-coach"],
      "needs": { "platform": "any" },
      "hold": null,
      "areas": ["web", "d1", "test"],
      "acceptance": "gates green in the worktree; REPORT.md with gate output; review verdict MERGE",
      "plan_ref": "Task B3"
    }
  ]
}
```

Field rules:

- `id` is the bare chunk id, unique in the file, `[a-z0-9-]+`. Ledger subjects qualify it as `<slug>/<id>`.
- `kind` is `impl`, `verify`, `gate`, or `question`. `verify` is a throwaway spike whose deliverable is a document. `gate` is an explicit fan-in with no code. `question` exists to be answered by a human; it never spawns a build pane.
- `lane` is `mechanical`, `judgment`, or `design`, the vocabulary `fleet-routing.json` already routes on.
- `deps` is the only hard edge. Waves are not authored. Readiness is derived (section 7).
- `conflicts` is a soft edge. Two chunks that edit the same files must not be active at the same time, but neither depends on the other. Today this rule is prose ("parallelize only within a wave where chunks don't share files"). It becomes data. The relation is symmetric; the checker normalizes it.
- `needs` is an object in the vocabulary of skills issue #67 (`platform`, `xcode`, `simRuntimes`, `ram`). The graph file is the declaration channel #67 says does not exist. Placement reads it unchanged.
- `hold` is `null` or `human`. A held chunk runs the full loop, stops at `gated`, and waits for the owner. It replaces the hold-tag prose.
- `areas` is a list of free tags. Know-how entries carry the same tags; the brief injects the know-how that matches (section 13).
- `acceptance` is one sentence. `plan_ref` points into the plan.
- The epic PR is an implicit final gate. Every chunk with no dependents is its input. The projection renders it. The file does not list it.

`fleet graph check <home> <epic>` rejects: a dependency cycle, a dangling `deps` or `conflicts` id, a duplicate id, a self-conflict, an unknown `kind`, `lane`, or `hold` value. It warns on a `question` chunk with `impl` dependents. Exit 2 on error. It runs before the first spawn and inside every `fleet gh sync`.

## 6. The ledger, unchanged shape, three additions

The ledger stays JSON Lines of CloudEvents 1.0 records in the `fleet.*` namespace. `fleet log` remains the only writer. Three additions:

1. **`step`** - an optional data key on any `chunk.<stage>` event. It marks progress inside a stage. Example: `fleet log <home>/<epic> chunk.in_review mac/b3-d1-store step=adversarial-review`. Allowed step names per stage come from the workflow template (section 7.3). An unknown step fails with exit 2.
2. **`evidence`** - a data key on `chunk.built`, `chunk.gated`, and `chunk.merged`. Values are `verified`, `reported`, `asserted`. A pane's own signal is `reported`. A hand-logged line from the orchestrator defaults to `asserted`. Only `fleet reconcile` writes `verified`. Missing means `asserted`.
3. **`run.landed`** - a run-level event. Subject is the epic. Data carries the epic PR url and the merge commit on main.

Attempts need no new event. The fold derives them (section 7.2).

## 7. The state machine and the fold

### 7.1 Stages and transitions

The stage vocabulary is the one the ledger uses today:

```
assigned -> spawned -> planned -> building -> built -> in_review -> gated -> merged -> dogfooded -> archived -> closed
```

Transition table, enforced by `fleet log`:

| From | Allowed to |
|---|---|
| (none) | assigned, spawned |
| assigned | spawned, blocked, error, closed |
| spawned | planned, building, blocked, error |
| planned | building, blocked, error |
| building | built, blocked, error |
| built | in_review, building (gate_failed), blocked, error |
| in_review | gated, building (sent_back), blocked, error |
| gated | merged, building (sent_back), blocked, error |
| merged | dogfooded, archived |
| dogfooded | archived, building (followup) |
| archived | closed |
| blocked | the stage it left, building |
| error | the stage it left, building, closed |

> Retracted 2026-09-04 during chunk 1: the first draft allowed only `(none) -> assigned`. Every existing ledger starts at `spawned` or `building`, and a spawn implies assignment, so `spawned` is also a legal first stage. The inference that every chunk gets an explicit assign event before a pane exists was wrong; the orchestrator assigns and spawns in one wake.

- `blocked` and `error` remember the stage they interrupted. Leaving them returns to that stage or to `building`.
- An illegal transition fails with exit 2 and prints the current stage and the allowed targets. `--force reason="..."` records the transition with `forced=true` and the reason in data.
- An unknown chunk id, one not in `graph.json`, fails with exit 2. `--adhoc` allows it and marks the chunk `adhoc=true`, for the rare hotfix chunk the plan did not foresee. The graph check warns about adhoc chunks older than one day, so they get filed into the graph.

### 7.2 Attempts, derived

An attempt starts at the first `building` event for a chunk and ends at the next `built`, `error`, or a stage return. A return to `building` from `built`, `in_review`, `gated`, or `dogfooded` opens a new attempt. The fold numbers attempts from 1 and records the cause from the transition: `gate_failed` when the return comes from `built` or `gated` with `verdict=FAIL` in data, `sent_back` when it comes from `in_review` or `gated` otherwise, `followup` when it comes from `dogfooded`, `initial` for the first. Each attempt carries its pane, engine, start and end times, and the evidence of its terminal event.

### 7.3 The workflow template

The per-chunk workflow is a fixed template that lives in the skill as data, `workflow.json` next to `fleet-routing.json`:

```json
{
  "version": 1,
  "steps": {
    "planned":   ["plan-drafted", "plan-approved"],
    "building":  ["tdd-red", "tdd-green", "self-review", "report", "survey"],
    "in_review": ["review-all", "codex-review", "adversarial-review"],
    "gated":     ["consensus", "hold-approved"],
    "merged":    ["main-synced", "archived-report"],
    "dogfooded": ["tracer-run", "findings-filed"]
  }
}
```

The `step` key on an event must name a step under its stage. The fold records the last step per chunk. The projection renders a chunk as a dagr project and its steps as tasks under it, so the pane shows "b3 in review, adversarial review running, consensus next". The template is the only place the pipeline is spelled out; the brief and the orchestrator loop reference it. `survey` is the exit survey from section 13.

### 7.4 The fold

The fold joins `graph.json` and every ledger file into one run state. Pure, tested with fixtures. Per chunk it holds: stage, step, attempt list, blocked-by (deps not yet `merged` or later), dependents, conflict holds (conflicting chunks that are active), readiness, hold state, pane, engine, PR, evidence.

Readiness: a chunk is **ready** when every dep is `merged` or later, it has no stage yet or is `assigned`, and no conflicting chunk is active (`spawned` through `gated`, including `blocked` and `error`). `hold` does not affect readiness: a held chunk is spawned and built like any other and stops at `gated`. The guard enforces the hold on the `gated -> merged` transition, which needs `hold=approved` on that event or on the chunk's folded data.

> Retracted 2026-09-04 during chunk 1: the first draft made readiness depend on "the hold was approved". That conflated spawn readiness with merge permission. A hold gates the merge, not the start; the Held-chunks rule in SKILL.md already says "runs the full loop, stops at GATED".

The **frontier** is the set of ready chunks. A `question` chunk is ready but renders as `needs answer` and is never spawned as a build pane.

### 7.5 Commands

All commands take `<home>/<epic>` as the epic directory. Exit codes stay: 0 ok, 1 external failure, 2 usage or invalid input.

- `fleet init <home> <epic> --repo <owner/name> --plan <path>` creates the fleet branch and worktree if missing, the `knowhow/` directory if missing, the epic directory, an empty graph file, and the first ledger.
- `fleet graph check` (section 5).
- `fleet log` gains the transition guard, the `step` and `evidence` checks, `--force`, `--adhoc`.
- `fleet next` prints the frontier, one chunk per line: id, kind, lane, needs, hold, and the reason it is ready. Below it, every not-ready chunk with its blockers. The orchestrator spawns only from the frontier.
- `fleet status <chunk>` prints one chunk for a pane: stage, step, attempt number and cause, blockers with their stages, dependents with their pane ids, conflicts, acceptance, PR, hold, and the know-how entries whose tags match the chunk's `areas`. Every brief contains this command with the absolute epic path.
- `fleet state` gains a blocked-by column, groups chunks by derived depth, and prints the frontier count in the checklist. It reads all ledger files.
- `fleet stats` prints time-in-stage per lane and per engine, attempts per chunk, gate-failure causes, and the slowest steps. It is a fold query. The librarian reads it (section 13).
- `fleet reconcile` (section 8).
- `fleet dagr` (section 9).
- `fleet gh sync` (section 10).
- `fleet knowhow` (section 13).
- `fleet render log` regenerates `log.md` from git trailers.
- `fleet teardown` is unchanged, except that it reads from the epic directory.

## 8. Git as the record - trailers and reconcile

### 8.1 Trailers

Every fleet commit on a chunk branch, every squash-merge commit into the epic branch, and every PR body carries git trailers:

```
feat(web): D1 store behind the Store interface

Fleet-Epic: forge-web
Fleet-Chunk: mac/b3-d1-store
Fleet-Attempt: 2
Fleet-Gate: PASS
Fleet-Evidence: verified
Fleet-Issue: #31
```

`Fleet-Epic` and `Fleet-Chunk` are required on every fleet commit. `Fleet-Gate`, `Fleet-Evidence`, and `Fleet-Issue` are required on the merge commit. The brief's discipline block states the contract. The merge step writes them. `git interpret-trailers --parse` reads them; no regex over prose.

### 8.2 Reconcile

`fleet reconcile [--live]` observes facts and emits ledger events with `evidence=verified`. It only emits when the observed fact differs from the folded stage, so it is idempotent and safe on every wake.

| Observation | Source | Emits |
|---|---|---|
| A merge commit with `Fleet-Chunk: <id>` on the integration branch | `git log` trailers, offline | `chunk.merged` with `commit`, `pr` from `Fleet-Issue` |
| An open PR from the chunk branch while the stage is `built` | GitHub | `chunk.in_review` |
| A PR closed unmerged while the stage is `in_review` or `gated` | GitHub | `chunk.error` with `reason=pr-closed` |
| A pane recorded on an active chunk that no longer exists | herdr agent list, `--live` | `chunk.error` with `reason=pane-gone` |
| The epic PR merged into main | `git log` on main | `run.landed` |

Git is read first. GitHub is read only for the two PR facts. herdr is read only with `--live`. A failure of any source prints a warning and skips that source; reconcile never fails the wake.

### 8.3 Rebuild, later

Because merges are recoverable from trailers and PR bodies, `fleet rebuild` can regenerate the `merged` and `in_review` history of a lost ledger. It is out of the first cut. The design keeps it possible by never putting a fact only in the ledger that git or GitHub also holds.

## 9. The dagr projection

`fleet dagr` writes `.dagr/run.json` in the epic directory in dagr contract v3. It runs at the end of every orchestrator wake and after every `fleet log`. It writes `run.json.tmp`, runs `dagr check --strict --json` when the binary resolves (`$DAGR_BIN`, then `PATH`, then `$HERDR_PLUGIN_ROOT/bin/dagr`), and renames atomically. Without a binary it renames with a warning on stderr; `fleet graph check` already guards structure.

Mapping:

| Fleet | dagr |
|---|---|
| epic | run; `run.orchestrator.pane` from `FLEET_ORCH_PANE` or the ledger's orchestrator resource |
| lane | top-level project |
| chunk | project under its lane, plus one task per template step under it; a chunk with no steps yet is one task |
| `kind` | task `kind`; `verify` maps to `test` |
| machine slug | `owner` |
| assigned, spawned | `queued` |
| planned, building | `working` |
| built, in_review, gated | `review` |
| merged, dogfooded, archived, closed | `done` |
| blocked | `blocked`, `unblock` from the open attn ask |
| error | `failed` |
| derived attempt | attempt with `cause`, `model` from engine, `locator.pane`, timestamps, `outcome.evidence` |
| `deps` | `deps` |
| `conflicts` | `note` on both tasks, never a dep |
| epic PR | final `gate` task at the run root, `inputs` = every chunk with no dependents |
| attn opened, closed | `directive` events, verb `unblock` |
| `hold` waiting | task `blocked` with `unblock=owner` |

The dagr pane opens with `herdr plugin action invoke open-dagr --plugin herdr-dagr` from the fleet tab. dagr looks for `.dagr/run.json` under the pane's workspace cwd, which is the code repo root, not the fleet home. A plugin pane does not inherit the fleet tab's shell environment, so `DAGR_RUN` is not reliable. `fleet init` therefore symlinks `<repo>/.dagr` to `~/.fleet/<repo>/<epic>/.dagr` and adds `.dagr` to the code repo's `.git/info/exclude`, so the code repo's tracked files never change. The `m` key in dagr sends operator messages to the orchestrator pane through herdr's `agent.prompt`; dagr journals them in `messages.jsonl` in the same directory, which stays untracked.

Install is `herdr plugin install aemrebarut/herdr-dagr`. The setup checklist adds it next to the pi.orchestrator plugin. dagr is version 0.3.1, one maintainer, last push 2026-08-23. It is a projection target, not a dependency: if it dies, the projection is one file to retarget.

## 10. GitHub sync

`fleet gh sync [--execute]` is idempotent and dry-run by default. Each run:

1. Runs `fleet graph check`.
2. Finds or creates one issue per chunk in the code repo. Title: `[<epic>] <id>: <title>`. The body starts with a marker comment `<!-- fleet:chunk=<epic>/<id> -->` and holds acceptance, plan ref, lane, needs, hold, and the placement block from #67. Reruns find the issue by searching the marker, never by title.
3. Adds each chunk issue as a sub-issue of the run-map issue with `addSubIssue`.
4. Wires `addBlockedBy` for every `deps` edge, and removes edges that left the graph with `removeBlockedBy`. GitHub then renders blocked and blocking in the issue sidebar. The frontier is visible without the map.
5. Adds each issue to the project with `addProjectV2ItemById`. Sets `Status` from the stage: no stage or `assigned` is Todo, `spawned` through `gated` is In Progress, `merged` and later is Done. Creates a `Stage` single-select field with the full stage vocabulary if missing and sets it, so the board can group by stage. Creates a `Lane` single-select field the same way.
6. Adds the label `fleet:<slug>` as the claim when the chunk is `spawned` or later.
7. Closes the issue when the chunk reaches `merged`. The sub-PR body carries `Closes #<n>`, so GitHub links the PR.
8. Posts one comment on the run-map issue per sync that changed anything: the frontier and the counts per stage. Never more than one comment per wake.

The follow-up recipe in the skill changes: a follow-up issue gets the chunk issue as its parent through `addSubIssue`. The UAT issue stays one per app per build window.

The run-map issue keeps its role as the index: destination, decisions, fog, out of scope. Its wave sections go away. The sub-issue list with blocked-by renders that now. `DECISIONS.md` in the fleet home is the live mirror of its decisions section; the sync copies `DECISIONS.md` into the run map body under "Decisions so far".

GitHub access sits behind a `GitHub` Effect service with a live layer over `gh api graphql` through the existing child-process pattern (`HerdrCli` is the model), and a test layer over recorded responses. The `project` scope is present on the current token; the sync checks scopes first and fails with a clear message otherwise.

## 11. The merge model - epic branch and stacked sub-PRs

- `fleet init` creates `epic/<epic>` from `main` and opens the epic PR against main as a draft. The epic PR body is the run map in short: destination, plan link, graph summary, and the list of sub-PRs, regenerated by `fleet gh sync`.
- Chunk worktrees branch from the integration branch. Chunk PRs target it. Chunk `merged` means merged into the integration branch.
- The claim on main disappears for chunk merges. Only the landing takes it.
- Main-sync cadence: merge `main` into the integration branch after every third chunk merge and before landing. The orchestrator logs the step `main-synced` on the merged chunk.
- The dogfood tracer bullet runs on the integration branch.
- `run.landed` closes the run. Wrap-up follows as today.

Concurrent fleets on one repo each own an integration branch and only meet at landing.

## 12. Agents' view

Every brief gains four lines:

1. `fleet status <home>/<epic> <chunk>` with the absolute path, run at start and before the gate. Its output includes the matching know-how.
2. Read `<home>/<epic>/DECISIONS.md` at start and before the gate.
3. The trailer contract from section 8.1.
4. The know-how contract from section 13: file a problem when stuck, file a solution when unstuck, answer the exit survey before the BUILT signal.

`fleet status` prints each dependent chunk with its pane id, so an agent that must coordinate with a neighbour knows the target for `herdr agent prompt`. Pane-to-pane protocol beyond that is a follow-up issue.

## 13. The know-how board - agents improve the repo's flow

### 13.1 Purpose

Agents learn things about a repo while they work: a faster way to run one test file, a gate that needs a warm cache, a build step that lies about success, a review finding that recurs. Today that knowledge dies with the pane. The board keeps it, curates it, and puts it into the next agent's brief. Over runs, the flow gets faster because the repo teaches its agents.

The board is repo-scoped, not epic-scoped. It lives at `~/.fleet/<repo>/knowhow/` on the fleet branch, so every worktree and every machine sees it, and qmd indexes it with the rest.

### 13.2 Entries

`fleet knowhow add <kind> --area <tag>... [--solves <id>] "<text>"` writes one markdown file into `knowhow/inbox/` with frontmatter. The command mints the id and time; nobody hand-writes a file.

```markdown
---
id: kh-20260904-1432-b3
kind: problem | solution | tip | survey
areas: [web, d1, test]
epic: forge-web
chunk: mac/b3-d1-store
engine: codex
stage: building
solves: kh-20260903-0911-a1   # solution entries only
status: open                  # open | promoted | rejected | superseded
---
`bun --cwd web run test` prints usage and exits 0 without running tests. Use `bun run --cwd web test` or the gate passes on nothing.
```

Kinds:

- `problem` - something that slowed or stopped the agent and is not the chunk's own bug. Open until a solution or the librarian closes it.
- `solution` - an answer to an open problem, with `solves`. Another agent, a later run, or the same agent after it got unstuck.
- `tip` - a standalone know-how: a faster command, a trap, a working recipe.
- `survey` - the exit survey (13.3).

Entries are data written by agents. They are injected into later briefs, so the librarian treats them as untrusted until promoted, and only the curated file reaches a brief (13.5). Raw inbox entries never enter a prompt.

### 13.3 The exit survey

The `survey` step in the `building` stage is mandatory before the BUILT signal. The discipline block asks three questions and the pane answers with one command:

```
fleet knowhow survey --chunk mac/b3-d1-store \
  --slowed "vitest pool config; two gate runs wasted on a stale dist" \
  --helped "fleet status showed a3 merged before I asked" \
  --change "add a warm-dist check to the brief for web chunks"
```

Three fields, each one sentence: what slowed you, what helped you, what should change. The idle-waiter treats a missing survey like a missing report: the chunk cannot pass `built` without it. Dogfood and review panes answer the same survey at the end of their brief. The survey is the cheapest signal the board gets, and the librarian's main input.

### 13.4 Reading the board

- `fleet knowhow show --area <tag>...` prints the promoted entries in `KNOWHOW.md` whose areas intersect the tags. `fleet status` calls this with the chunk's `areas` and appends the result, capped at 40 lines, most recent first. An agent that starts a web chunk sees the web tips before it types a command.
- `fleet knowhow open` lists open problems. The orchestrator reads it on every wake. An open problem that matches a chunk's areas is appended to that chunk's brief as "known open problem, if you solve it file a solution".
- `KNOWHOW.md` has one section per area and a fixed entry format: one line of claim, one line of how to apply, one link to the source entry. It is bounded: the librarian keeps each section under 30 entries and retires the rest to `archive/` with `status: superseded`.

### 13.5 The librarian

The librarian is a pane, not a daemon. Its brief is a template in `REFERENCE.md`. It runs on a judgment engine because it edits documents that later agents trust.

Triggers, any of:

- The orchestrator's wake sees five or more new inbox entries since the last librarian run.
- A run reaches wrap-up. Every run ends with at least one librarian pass.
- The owner asks.

The librarian's loop, in order:

1. Read `knowhow/inbox/`, `KNOWHOW.md`, `fleet stats` for the epics since its last run, and the repo's `CLAUDE.md`, playbooks, and scripts.
2. Dedup. Match new entries against `KNOWHOW.md` and each other. A repeated problem raises the existing entry's `seen` count instead of a new entry.
3. Verify. A `tip` or `solution` that names a command is run once in a scratch worktree before promotion. A claim the librarian cannot verify is promoted with `evidence: reported`, and the entry says so.
4. Promote. Write the verified entries into `KNOWHOW.md` under their areas. Move the inbox files to `archive/` with `status: promoted` and a pointer to the section.
5. Escalate. When a promoted entry says a script, a playbook, `CLAUDE.md`, a brief template, or the workflow template should change, the librarian files an issue labeled `knowhow`. It never implements the change itself, in any repo. The issue goes to the skills repo when the change is inside the fleet tooling or the skill, and to the code repo otherwise. Every `knowhow` issue uses one fixed template so a later executor needs no further context: **Change** (one sentence), **Why** (the observed cost, with the entry id and the `fleet stats` number when one exists), **Where** (file paths), **Proposed diff or exact steps**, **Acceptance** (how the executor proves it worked), **Source entries** (links). A separate loop executes these issues: the existing `improve-loop` skill picks up open `knowhow` issues as tickets, routes them by lane, and PRs them through the normal gate. The librarian stays on curation; the executor stays on implementation.
6. Reject. An entry that is wrong, a duplicate, or the chunk's own bug in disguise moves to `archive/` with `status: rejected` and one line of reason.
7. Report. One `fleet.note` event in the current epic's ledger with counts: read, promoted, rejected, escalated. One comment on the run-map issue with the same counts and links.

The librarian never edits code in the code repo directly. It never deletes an inbox entry; archive is the only exit. It reads `fleet stats` to name the slowest stage and step per lane in its report, so the owner sees where the time goes without asking.

### 13.6 What improves, and how you see it

The board closes three loops:

- **Within a run.** A problem filed by one pane reaches the next pane in the same area through `fleet status` once promoted, or as an open problem before that.
- **Across runs.** `KNOWHOW.md` is read at the start of every chunk. The second run on a repo starts with the first run's lessons.
- **Into the tooling.** Surveys that name the brief, the gate, or a script become PRs on the skills repo or `knowhow` issues on the code repo. The flow itself changes.

`fleet stats` across epics is the measurement: time-in-stage per lane, attempts per chunk, and gate-failure causes should fall from run to run on the same repo. The librarian prints the delta against the previous epic in its report.

Cross-repo lessons, the ones that are about the fleet itself and not about one repo, are proposed by the librarian to `~/wiki/inbox/` through the existing wiki-ingest flow. The board does not become a second wiki.

## 14. Skill and recipe changes

`SKILL.md`:

- Setup step 1 becomes: plan, then `fleet init`, then write `graph.json`, then `fleet graph check`, then `fleet gh sync --execute`, then confirm the epic PR exists.
- Per-chunk loop step 1 becomes `fleet next`. Step 7 ("track + housekeep") becomes `fleet log`, `fleet reconcile`, `fleet dagr`, `fleet gh sync --execute`, in that order, in the merge wake.
- The run-map section drops the wave checklist and points at the sub-issues.
- The merge-under-claim section targets the integration branch and keeps the claim only for landing.
- The ledger section documents `step`, `evidence`, `run.landed`, the transition table, and the fleet home.
- A new "Know-how board" section states the four agent duties and the librarian triggers.
- The housekeeping section adds `fleet render log`. The wrap-up section adds the librarian pass.

`REFERENCE.md`:

- The "Kanban" section is replaced by `fleet gh sync`. The draft-item recipe is deleted.
- The brief templates gain the four lines from section 12 and the survey command.
- A librarian brief template is added.
- The archive recipe writes to the fleet home.

`fleet-routing.json` is unchanged. `workflow.json` is added next to it.

## 15. Testing

All in `bun test`, Effect test layers where an external touchpoint exists.

- Fold, readiness, transitions, attempts: pure, fixtures for a diamond graph, a conflict pair, a held chunk, a gate fail and retry, a send-back, a gone pane, two machines' ledgers interleaved.
- Graph check: cycle, dangling, duplicate, self-conflict, unknown enum, question-with-impl-dependents warning.
- `fleet log` guard: each row of the transition table, `--force`, `--adhoc`, unknown step.
- Reconcile: a `Git` service with a test layer of trailer fixtures, a `GitHub` service with recorded responses, `Herdr` test layer for pane-gone. Idempotence: a second run emits nothing.
- dagr projection: a golden `run.json` from the fixture ledger. When the `dagr` binary resolves, the test runs `dagr check --strict` on it; otherwise the test is skipped and says so.
- GitHub sync: dry-run output against recorded responses; the create, addSubIssue, addBlockedBy, and field-set mutations asserted by call, not by mocking the logic.
- Know-how: `add` and `survey` mint valid frontmatter; `show` filters by area and caps lines; `open` lists only `status: open` problems; a solution with `solves` flips the problem's status in the fold of the board.
- `fleet stats`: fixture ledger with known durations gives known numbers.
- No test mocks the fold, the readiness rule, or the board's status rule.

## 16. Rollout

Four chunks, each its own PR on the skills repo.

1. **Core.** Fleet home and `fleet init`, `graph.json` and `fleet graph check`, the fold extension, the transition guard, `step` and `evidence`, `fleet next`, `fleet status`, `fleet state` changes, `fleet stats`, `workflow.json`. No external calls.
2. **Record and pane.** Trailers in the brief and merge step, `fleet reconcile`, `fleet dagr`, `fleet render log`. Install herdr-dagr and view the `forge-web` run through it.
3. **GitHub and merge model.** `fleet gh sync`, the epic branch rule, the skill and recipe rewrite for sections 10 to 12. Validation run: retrofit `forge-web`. Move its record to `~/.fleet/forge-interviews/forge-web/`, leave a pointer file in the code repo, write its `graph.json` from the plan, create 25 chunk issues under run map #15 with blocked-by from the plan, reparent the 11 follow-ups, and replace the 25 drafts.
4. **Know-how board.** `fleet knowhow add|survey|show|open`, the survey step in the waiter, the librarian brief, the skill section. Validation: run the librarian once over the `forge-web` archive and REPORT sections as a seeded inbox, and read what it promotes.

Related open issues on the skills repo: #67 (chunk-needs contract, closed by the graph file's `needs`), #84 (move claim and lifecycle mechanics into code, partly served by the transition guard), #83 (risk-tiered review gate, orthogonal, the `step` vocabulary leaves room for it).

## 17. Owner answers (2026-09-04)

The questions in the first draft are resolved. They stay here so the reasoning is not lost.

1. Default home path is `~/.fleet/<repo>`.
2. Both `Status` and `Stage` stay. `Status` keeps the three kanban columns the board renders by default. `Stage` carries the full vocabulary for grouping and filtering. One field cannot do both without a custom board layout on every project.
3. Main-sync cadence is every third merge and before landing.
4. Librarian trigger threshold is five new inbox entries, plus every run wrap-up.
5. The librarian always files an issue and never implements. A separate loop, the `improve-loop` skill, executes `knowhow` issues. The librarian's output must be instructions clear enough that the executor needs no further context; section 13.5 step 5 fixes the issue template.
