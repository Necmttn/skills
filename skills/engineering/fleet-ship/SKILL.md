---
name: fleet-ship
description: Orchestrate a fleet of herdr agent panes to ship a multi-chunk backlog in parallel - one labeled pane per chunk (own git worktree), engine-routed (mechanical→codex/gpt-5.5+grok-4.5 twin lanes, judgment→fable-5, review→fable-5/opus-4.8), each chunk plan→TDD→cross-model-consensus-gate→merge, follow-up concerns filed as issues, tracked on a GitHub Project kanban, advanced by event-driven idle-waiters + a fleet-wide liveness monitor that catches stuck/errored/dead panes, dogfooded tracer-bullet after each merge. Use when the user wants to run many build tasks in parallel across herdr panes, act as orchestrator over claude/codex/pi agents, "ship the backlog", "orchestrate the fleet", keep an autonomous overnight build loop going, or fan out a wave-graph of chunks. Builds on herdr-agent-orchestration (low-level pane driving).
---

# Fleet Ship - parallel herdr orchestration

You are the **orchestrator** (run on fable-5 or opus-4.8). Panes do the building; you plan the waves, route engines,
gate reviews, merge, track on a kanban, and dogfood. This skill *composes* our normal ship workflow -
it just runs it across many parallel herdr panes instead of one session.

## Multi-orchestrator coordination (MANDATORY - several fleets run this repo concurrently)
The registry is **fleetboard** - a live board at `$FLEET_BOARD_URL` (default `http://localhost:7777`,
server + CLI in `~/Projects/fleetboard`; VPS fleets set FLEET_BOARD_URL to the Mac's tailscale addr).
Drive it with `bun ~/Projects/fleetboard/fleetctl.ts <register|heartbeat|claim|release|attn|event|events|deregister>`
- claim returns exit 1 + holder when a resource is taken. Heartbeat each orchestrator wake. If the
board is unreachable, fall back to `docs/superpowers/fleet-runs/ACTIVE.md` in the target repo.
Live lessons that forced this: a fleet rebased main under another fleet's staged merge; three merges
landed vitest-breaking test files; a port cleanup killed a sibling fleet's dev servers and a native
build mid-compile.
1. **Register on run start** (epic, status), **deregister on run end**, heartbeat between.
2. **Claims are exclusive, TTL'd + FIFO** (Fleetboard v2 Durable Object alarm; #15 owns the mechanics -
   this documents the protocol you follow, not the DO internals). A taken claim returns exit 1 + the
   holder + your FIFO queue position; the queue position is HONORED - your turn comes in order, never
   jump it or poll-race it. A claim whose TTL expires **auto-releases** - an expired holder has LOST the
   claim (mid-merge expiry: see Merge under claim). **Claim discipline is REQUIRED, not nice-to-have:**
   several gating machines merge this repo concurrently and the claim is the ONLY serialization.
   Resources: `main-merge` (only the holder merges/rebases main - the full flow is Merge under claim
   below; others hold their gated branches and wait their queue turn), `sim:<udid>` (boot a SEPARATE
   simulator per fleet - `xcrun simctl list devices available` then `boot`; never install/launch on a
   claimed sim), `ports:<app>` (better: run dev stacks from YOUR worktree so `scripts/worktree-ports.sh`
   + portless auto-offset - then no port claim is needed), `neon:<project>` (dev-DB migrations).
3. **Before killing anything shared** (kill-port-listeners, `just * kill`, pkill, sim uninstall):
   check the registry; if another fleet holds the claim, work around it or queue.
4. **Shared merge gate**: `bun run test:vitest` from the repo root must be green before ANY merge to
   main, whatever the fleet's own runner is (bun-runner-only gates shipped broken files three times).
5. **The bell - single attention surface**: when blocked on a human decision or a must-see finding,
   `fleetctl attn <fleet-id> "<one-line ask>"` (shows on the board + ntfy phone push) - plus
   PushNotification when running on the user's Mac. Never ring for routine progress; the user watches
   the board's attention list as the only inbox and expects silence otherwise. Poll `/state` for the
   user's typed answer on your item after ringing.
6. **Name your orchestrator pane/tab** (`herdr tab create --label "orchestrator:<epic>"`) so
   `herdr agent list` yields a truthful census.

### Merge under claim - the ONLY way anything lands on main
Merge-worthiness = the FULL fleet-ship workflow passed WHEREVER the chunk ran (plan → cheap-lane build →
multi-agent review → feedback traced → final smart-model review - i.e. per-chunk-loop step 6's cross-model
consensus gate, UNCHANGED and referenced here, not redefined). Run that gate on YOUR OWN machine BEFORE
claiming - a claim held while you still review starves the queue. Passing the chain on ANY machine is
sufficient - NO central re-review. Central merge queue REJECTED (#6, verbatim): it "re-runs suites already
run, idles branches on one machine's availability, recreates the single-machine dependency" - that is why
the passing-workflow-on-any-machine model is used instead. The flow (ordered; no step skippable):
1. **Claim** `main-merge` - or take your FIFO queue position and wait your turn (do other work; never
   poll-race or jump the queue).
2. **Rebase** the gated branch on latest main (only the holder may touch main).
3. **Repo-root gate LOCALLY:** the repo's FULL root gate (`bun run test:vitest`-equivalent from the repo
   root, whatever the fleet's own runner - the Shared merge gate rule above) runs green on the MERGING
   machine, before the merge.
4. **Re-assert the claim, then squash-merge** to main. Step 3's local root gate can outrun the TTL, so at
   this irreversible instant re-verify the claim is STILL yours; merge + push ONLY under a live claim - if it
   expired, do NOT merge, drop to abort + re-queue below. (#15's DO fences the push so an expired holder's
   merge is rejected - naming the re-check point here; the enforcement is #15's.)
5. **Emit `MERGED`** (`fleetctl event MERGED --machine <slug> --chunk <chunk-id> …` - the lifecycle
   event; see Child→parent lifecycle events).
6. **Release** the claim.
**TTL expiry mid-merge: abort + re-queue, NEVER half-merge.** The expired claim auto-releases and the next
holder may touch main - so on expiry (or on noticing you have outlived the TTL): abort the in-flight
rebase/merge (`git rebase --abort` / `git merge --abort`; main stays untouched, your gated branch is
durable), re-enter the FIFO queue, and on reacquire restart from step 2 - main has moved. Steps 2-5 happen
ONLY while you verifiably hold the claim.
Hold-tagged chunks stop at GATED for the human before this flow - see Held chunks below (#33). Forward
pointers, out of scope here: chunk→machine placement stays on the Mac (#35); claim DO/alarm internals are
Fleetboard v2 (#15). This protocol is E2E-verified by the tracer bullet (skills#13), not a unit suite.

### Held chunks - hold:human stops at GATED (skills#33)
Autonomous merge on workflow pass is the DEFAULT - a hold is the named exception, never a new gate on
everything. The Mac scheduler tags `hold:human` (or `hold:central`) at ASSIGNMENT on exactly three chunk
classes: **reactor-subtle, security-critical, user-facing design** (tagging + placement are #35's - here
you only honor a tag that arrives). The tag travels in the chunk's queue entry; whoever runs the chunk
(steward or orchestrator) honors it per chunk:
1. Run the FULL per-chunk loop unchanged through the consensus gate → emit `GATED` (the lifecycle
   event) → **STOP. Do NOT claim `main-merge`.**
2. **Ring the bell:** `fleetctl attn <fleet-id> "<slug>/<chunk-id> <one-line gate verdict> <link>"` -
   machine-namespaced chunk id + gate verdict + a LINK the owner can open: today a PR/compare URL or the
   chunk's run-archive section; when the access-plane link surface lands (#11) the link upgrades to its
   artifact URL - forward pointer only, do not block on it.
3. Flip the pane label to `✋ <chunk-id>` (the existing needs-a-HUMAN glyph, already paired with
   `fleetctl attn`) - mirrored on the board's attention list per the sidebar invariant.
4. **Poll `/state` for the owner's answer on YOUR attn item** (the bell rule's existing poll). Two
   branches, both explicit:
   - **approve** → proceed to Merge under claim above, UNCHANGED (claim/FIFO → rebase → local root gate →
     squash-merge → `MERGED` → release).
   - **reject / changes** → SEND-BACK: re-open the chunk with the owner's findings as the brief - a fresh
     spawn in the SAME worktree (the Housekeeping send-back pattern), findings judged via
     `superpowers:receiving-code-review`; the chunk re-enters the loop at build and re-rings on its next
     `GATED`.

## Skills this composes (the chain - invoke these, don't reinvent)
- **Drive panes:** `herdr-agent-orchestration` (read FIRST - `agent list/read/send/wait`, `pane send-keys`, `agent start`).
- **Plan:** mechanical chunks → `superpowers:writing-plans` only. Design/ambiguous chunks in *autonomous*
  fleet mode → **parallel design-exploration** (`superpowers:dispatching-parallel-agents` / `design-an-interface`:
  N independent *lens* subagents → 1 synthesizer → an options doc + recommendation, **marked AWAITING-DECISION**).
  Interactive `superpowers:brainstorming` interviews the user - only run it when YOU/the user drive it live, never
  in an unattended pane. (Parallel-explore generates options; it does NOT replace the user's decision.)
- **Build:** `superpowers:subagent-driven-development` (runs `superpowers:test-driven-development` +
  `superpowers:using-git-worktrees` internally). **Seam discipline:** its `testing-anti-patterns.md` is the authority — mock only non-deterministic *leaves* (model/LLM, clock, net), NEVER the code path the test is named after.
- **Review:** `/review-all` = `simplify` + `/codex:review` + `/codex:adversarial-review`; plus
  `superpowers:requesting-code-review` / `superpowers:receiving-code-review` for the judgment on findings.
- **Route dispatches:** `efficient-dispatch` - every Agent-tool dispatch (orchestrator or Claude pane) is
  classified mechanical-vs-judgment and mechanical ones carry an explicit cheap `model:`; `ax dispatches`
  measures the inherit rate afterwards.
- **Finish:** `superpowers:verification-before-completion` (gates) → `superpowers:finishing-a-development-branch`
  (PR) → orchestrator merges → `commit` conventions.
- **Dogfood:** `dogfood` (+ `verify` / `run` to launch the app).

Claude panes (fable/opus/sonnet) invoke these directly. **pigrok/codex panes lack the Skill tool → bake the discipline
(plan-first, red→green TDD, gates) into their brief text.** The orchestrator (fable/opus) always owns Review + Finish.

## Model axes (rankings, higher = better; cost = what the user actually pays, not list price)
Intelligence = how hard a problem the model handles unsupervised. Taste = UI/UX, code quality, API design, copy.
| model | cost | intelligence | taste | how to run |
|---|---|---|---|---|
| gpt-5.5 | 9 | 8 | 5 | Codex CLI ONLY - `codex exec` / `codex review` (`~/.codex/config.toml` defaults to gpt-5.5); herdr pane = codex argv below |
| grok-4.5 | 8 | 7 | 4 | grok CLI - `grok --always-approve` (`-m` to pin model); second mechanical lane, peer of codex (2026-07-10). **BUILD lane only - grok STALLS on review workloads (live 2026-07-10): never route reviews to grok.** Cross-engine review of grok-built work → codex; review of codex-built work → fable/opus adversarial (not grok) |
| sonnet-5 | 5 | 5 | 7 | `claude --model sonnet` / Agent `model:'sonnet'` |
| opus-4.8 | 4 | 7 | 8 | `claude --model opus` / Agent `model:'opus'` |
| fable-5 | 2 | 9 | 9 | `claude --model fable` / Agent `model:'fable'` |

**How to apply (defaults, NOT limits):**
- **Standing permission to escalate:** cheaper model's output doesn't meet the bar / fails the gate ->
  re-run or re-spawn the chunk on a smarter model in the SAME worktree, without asking. Judge the output,
  not the price tag. Escalating costs less than shipping mediocre work.
- **Cost is a tie-breaker only.** Anything that ships: **intelligence > taste > cost**.
- **Bulk/mechanical** (clear-spec implementation, data analysis, migrations) -> gpt-5.5, effectively free.
- **User-facing** (UI, copy, API design) needs **taste >= 7** -> sonnet-5/opus-4.8/fable-5, never gpt-5.5 solo.
- **Reviews of plans/implementations** -> fable-5 or opus-4.8, optionally gpt-5.5 (`codex review`) as an
  extra independent perspective (`/review-all` already includes it).
- **Subagent dispatches (Agent tool) - classify EVERY dispatch before sending, then the model field follows
  (REQUIRED SUB-SKILL: `efficient-dispatch`).** A bare dispatch silently inherits the caller's model - from
  the orchestrator that is fable-5, the most expensive lane (same trap as an unpinned `claude` pane; live
  lesson 2026-07-16: fleet runs bled tokens on default-model launches for non-judgment work). Routing:
  pure search/locate/pattern-find → `model:'haiku'`; mechanical implementer / fix subagents / bulk
  reads-for-a-fact / codex-exec wrappers → `model:'sonnet'`; judgment (review verdicts, design synthesis,
  gate decisions) → keep the strong model (inherit fable/opus deliberately - cheap reviewers miss real bugs).
  Applies to the orchestrator AND to Claude panes (their discipline block carries the same rule).
- **NEVER use Haiku for panes, builds, or any review/judgment.** The one sanctioned use is read-only
  search/locate subagent dispatches per `efficient-dispatch`.
- **gpt-5.5 inside subagents/Workflows** (the `model` param takes Claude models only): thin Claude wrapper
  agent `model:'sonnet', effort:'low'` whose prompt writes a self-contained codex prompt, runs `codex exec`
  via Bash, and returns the result; investigation/data-analysis -> `codex exec -s read-only` with a
  self-contained prompt. In herdr panes skip the wrapper - spawn the codex CLI directly.

## Engine routing (default policy — USER-STEERABLE via ~/.ax/fleet-routing.json)
**At fleet start (and on any steering sentence), read `~/.ax/fleet-routing.json`** — the ax-idiom lane table
(`{lanes:[{id, match, engine, argv, enabled, reason, origin}]}`). It OVERRIDES the table below; the table is
the fallback when the file is absent/invalid. Route each chunk to the enabled lane whose `match` best fits;
skip `enabled:false` lanes. The user edits the file to re-route (e.g. flip judgment→opus) without touching
this skill; record which lane file version a run used in the ledger. Resolution order:
**user sentence override (ledger) > ~/.ax/fleet-routing.json > table below.**
| work class | engine | notes |
|---|---|---|
| mechanical (clear spec, schema/validator/wiring, 1-3 files, migrations, data analysis) | **codex / gpt-5.5** `codex --dangerously-bypass-approvals-and-sandbox` **AND grok-4.5** `grok --always-approve` - TWO peer lanes; route each unblocked mechanical chunk to whichever has free capacity, run both in parallel when several chunks are unblocked | codex: effectively free, reads CLAUDE.md. grok: same brief discipline (no Skill tool - spell it out); escalation ladder grok/codex → fable/opus in the SAME worktree. Keep >1 lane funded |
| burst overflow only (both mechanical lanes saturated) | pigrok `pi --model xai-oauth/grok-4.3 --approve` | expect convention mop-ups (bun:test/catchAll) + credit risk; gate hard |
| judgment / reactor-subtle / security / hard-unsupervised | **fable-5** `claude --model fable --dangerously-skip-permissions` (fallback opus-4.8) | int 9; always pin `--model` |
| user-facing: UI / copy / API design | **fable-5 or opus-4.8** (taste ≥ 7) | never gpt-5.5 solo (taste 5); sonnet-5 acceptable floor |
| review + gate + merge | orchestrator (fable-5 or opus-4.8) + `codex review` as extra independent perspective | never delegated |

**Steering:** the user can override routing at ANY time with one sentence ("route all mechanical to codex",
"no pigrok this run", "everything on opus tonight"). Apply it for the remainder of the run, write the active
override into the run ledger (so a resumed orchestrator keeps honoring it), and ask once whether to persist
it into this table as the new default.

### Placement - after lane selection: (chunk, lane) → (machine slug, steward assignment) (skills#35)
Lane selection above picks WHAT engine runs a chunk; placement picks WHERE. The **Mac orchestrator** - and
only it, placement is a kept duty (#6 point 6) - composes per chunk:
**chunk → lane (engine, resolution order above) → machine (registry match) → steward assignment.**
- **Pinned contract (the stable interface):** inputs `(chunk, lane)` → outputs `(machine slug, steward
  assignment incl. hold tags)`. The slug is the machine id minted by `fleetctl join --name <slug>`; the
  assignment lands in that machine's queue on the fleetboard - the steward is the assignment TARGET
  (Steward mode below, skills#30), or the Mac orchestrator runs the chunk itself when the target machine
  is the Mac (a Mac-local chunk has no separate steward) - with any hold tags attached to the queue entry.
- **Machine match = registry match (#5 schema), all tiers:** **engines-with-account** (the lane's engine
  authed there AND its quota pool owner-consented) · **static** (capability vs the chunk's declared needs)
  · **dynamic** (in-window now, free slot, not stale) · **policy** (owner limits honored).
- **`~/.ax/fleet-routing.json` stays engine-policy-only (#5 point 4):** lanes never name machines - NO
  machine-qualified lanes, NO lane×machine cross-product file. Machines live in the registry; engine
  policy lives in the lane file; the two meet only here, at placement.
- **Hold tagging happens HERE - at assignment, on the Mac orchestrator (#6 points 5-6):** the three held
  classes (reactor-subtle, security-critical, user-facing design) get `hold:human` (or `hold:central`)
  attached to the assignment; whoever runs the chunk honors the tag per Held chunks above (skills#33).
- **Placement algorithm - filter-then-priority (deliberately dumb v1, resolved in skills#10):** WHICH
  eligible machine wins among registry-match survivors is decided by two deterministic passes over the
  registry fields (#5 schema). **Hard filters - a machine must pass ALL:** machine `state === "active"`
  (drop pending/stale) · the lane's engine is authed on the machine **AND** owner-consented per the
  machine's per-engine consent policy (default `owner-only` on machines the operator doesn't own - see gap
  below) · **capability match** of the chunk's declared `needs` (scheduler-declared at wave planning,
  default none -> every machine passes) against the static tier (e.g. an Xcode-needing chunk requires
  non-null `xcodeVersion` and/or the required `simRuntimes` entry) · `inWindowNow` (window FILTER only -
  never place out-of-window; the graceful close/drain + hard grace cap is steward RUNTIME behavior spec'd in
  skills#10 point 3, not yet landed in Steward mode - follow-up) · `freeSlots > 0` · a chunk flagged long/judgment is filtered OUT of
  `preemptible === true` machines. **Priority among survivors (first differing key wins, fully
  reproducible):** pinned (`policy.preemptible === false`) before preemptible -> warm worktree/cache for the
  repo (**skipped when the signal is absent** - no registry field carries it today, a v1 no-op; see gap) ->
  most `freeSlots` -> alphabetical machine slug. **No migration after placement.** Mid-chunk account-dry
  raises the existing escalation and `BLOCKED: quota` stops further placement of that engine on that machine
  for the run. Rejected for v1 (all learnable later from the event log): scoring, quota-remaining
  weighting, latency-aware placement. This is the policy resolved in skills#10; like the rest of the fleet
  protocol, placement is E2E-verified by the tracer bullet (skills#13), not a unit suite.
- **Registry gaps this v1 degrades around (documented, not invented - follow-up candidates):** (1) the
  policy tier carries no `enginesPolicy` per-engine consent field yet (skills#10 spells it `engines_policy`) - the authed-AND-consented filter is
  specified but reads `owner-only` on non-owned machines until that field lands; (2) no per-repo
  warm-worktree/cache signal exists - that priority tier is a no-op today; (3) chunks carry no declared
  `needs` capability channel beyond the scheduler's default-none - capability match passes every machine
  until chunks declare `needs`. All three degrade gracefully now and keep the algorithm executable from
  today's fields.

## Sidebar legibility — the herdr sidebar IS the human's status board
The user reads the sidebar to know *what needs me* vs *what's fine* — an unnamed pane, a duplicate
workspace label, or a stale label is a housekeeping DEFECT (live audit 2026-07-16: 6 of 8 agents unnamed,
two workspaces both labeled "apps" — illegible). Two independent surfaces, verified live:
**agent NAME = server-local addressing** (waiters/commands target it — set once to the bare chunk id,
NEVER rename mid-run)
and **pane LABEL = display** (`herdr pane rename <pane_id> "<glyph> <chunk-id>"` — safe to change freely;
name-addressing survives it). The slug minted by `fleetctl join --name <slug>` is the machine id: keep
local herdr names/labels bare, but write `<slug>/<chunk-id>` on every surface that leaves that machine.
- **On spawn** every fleet pane gets BOTH: local agent name = `<chunk-id>` AND local pane label
  `▶ <chunk-id>`. The enclosing tab identifies a non-primary machine: `fleet:<epic>@<slug>`; keep
  `fleet:<epic>` on the primary machine.
- **Status glyphs (fixed vocabulary, update the label at every transition):**
  `▶` building · `⏳` built, queued for gate · `🔎` under review/gate · `✋` needs a HUMAN decision
  (always paired with `fleetctl attn`) · `❌` errored/stuck (monitor caught). No ✅ glyph — a finished pane
  is archived-then-closed, so "done" lives on the kanban + run archive, never as sidebar clutter.
- **Tab label carries live counts** for at-a-glance triage: `herdr tab rename <fleet-tab>
  "fleet:<epic> ▶3 ⏳1 ✋1"` on primary or `"fleet:<epic>@<slug> ▶3 ⏳1 ✋1"` elsewhere — refresh on
  each wake.
- **The invariant the user relies on:** everything visible is working or queued; `✋`/`❌` means "needs me"
  (mirrored on the fleetboard attention list); everything else is fine by construction.
- **Sweep duty (every wake):** reconcile every fleet pane's label against its true state, refresh tab
  counts, and archive+close any pane whose job ended. Unnamed/mislabeled panes in a fleet tab: fix on sight.

## Tandem orchestrator — codex co-pilot watching the fable orchestrator
For autonomous/overnight runs (default on; skip for short attended runs), spawn ONE codex pane at max
reasoning alongside the orchestrator as a second pair of frontier eyes:
`herdr agent start tandem:<epic> --tab <orchestrator-tab> -- codex --dangerously-bypass-approvals-and-sandbox -c model_reasoning_effort="max"`
(pane label `tandem:<epic>`; brief template in REFERENCE.md).
- **Watchdog over the orchestrator itself** (~10 min cadence): read the orchestrator pane tail + ledger +
  `herdr agent list`; catch starvation (no wake progress), context bloat past the rotation threshold,
  parked-draft blocking, dead waiters/monitor. Follows the hard rules: commits-alive check before flagging
  stuck; parked-draft submit protocol; 2 same-cause blocked cycles = incident, ring the bell.
- **Rotation trigger-holder (skills#2):** tandem computes the rotation triggers EXTERNALLY — the
  orchestrator's own judgment degrades exactly when its window fills, so it never self-reports. Each sweep:
  grep the orchestrator pane's visible bottom lines for the context indicator (Claude Code prints
  "% ... auto-compact" / "context left" once the window fills); read the ledger's last rotation stamp for
  the 4-6h wall-clock ceiling. On ANY trigger: send the orchestrator the ONE atomic instruction — "ROTATE
  NOW: write the handoff doc (REFERENCE schema), commit it, park with an empty prompt" — and ring the bell
  if it hasn't parked within 2 sweeps (2 same-cause blocked cycles = incident).
- **Judgment assist:** the orchestrator sends `TANDEM-JUDGE: <question> + pointers (plan section, diff
  paths, both reviews)` for gate tiebreaks, risky merges, ambiguous designs; tandem returns a terse verdict
  + reasoning. ADVISORY ONLY — the orchestrator still owns review+gate+merge (never delegated).
- **Boundaries:** tandem is read-only on the repo — it never edits, merges, spawns, or kills panes; its only
  outputs are `agent send` to the orchestrator and the bell. It is a fleet-spawned pane: archive-then-close
  at run end like every other.

## Child→parent lifecycle events — panes PUSH on stop; the signals file is only the offline fallback
Polling alone (waiter + monitor) babysits panes but gives a child NO way to tell the parent "done" or
"stuck" — if the waiter dies (harness reap, orchestrator compaction/rotation) the pane finishes silently
and becomes an ORPHAN (live complaint 2026-07-16). So every pane also PUSHES a durable record the
orchestrator reads on every wake, independent of any live waiter. That record is a **lifecycle event on
the fleetboard event log** (append-only, machine-attributed via the machine token, survives pane AND
orchestrator death); the local `/tmp/fleet-<epic>.signals` file is kept ONLY as the offline fallback for
when the board is unreachable:
- **Lifecycle vocabulary (spec-fixed 7 stages; the board rejects anything else):**
  `ASSIGNED → PLANNED → BUILT → IN_REVIEW → GATED → MERGED → DOGFOODED`. Emit with
  `bun ~/Projects/fleetboard/fleetctl.ts event <STAGE> --machine <slug> --chunk <chunk-id> --epic <epic>
  --gist "<one-line>"` — auth is the machine token minted by `fleetctl join`; the event's chunk id is
  machine-namespaced `<slug>/<chunk-id>`; a bad stage exits non-zero listing the valid stages.
- **At fleet start** record the event cursor in the ledger (last `seq` from `fleetctl events --since 0`,
  or the cursor the ledger already holds) AND still set the fallback file
  `SIGNALS=/tmp/fleet-<epic>.signals` (one per run; note both in the ledger).
- **Every brief ends with the SIGNAL STEP** (in the discipline block): on STOP — done, blocked, OR
  errored — the pane pushes its lifecycle event: DONE (work committed) →
  `fleetctl event BUILT --machine <slug> --chunk <chunk-id> --gist "<gist>"`; BLOCKED/ERROR have no
  lifecycle stage → ring `fleetctl attn <fleet-id> "<slug>/<chunk-id> BLOCKED|ERROR: <gist>"` and put the
  detail (what's wrong, what you need) in REPORT.md at the worktree root. FALLBACK only when the board is
  unreachable (the fleetctl command exits non-zero): append one line
  `date-time <machine-slug>/<chunk-id> DONE|BLOCKED|ERROR <one-line gist>` to $SIGNALS. A pane that can
  still run a shell can always signal, even when its engine can't finish the chunk.
- **Every orchestrator wake reads the EVENT LOG first** — `fleetctl events --since <cursor>` (filter
  `--machine <slug>` / `--chunk` as needed) — and reconciles BEFORE trusting waiters: BUILT → gate it
  (even if the waiter never fired); a BLOCKED/ERROR attention item → read REPORT.md, unblock or re-spawn;
  then advance the cursor in the ledger. THEN read each machine's $SIGNALS (remote via
  `ssh <host> 'cat <signals-path>'`) as the fallback path — lines from board-unreachable panes — and
  reconcile them the same way; any evented/signaled pane still open after its chunk closed =
  archive+close now.
- **Orphan sweep (every wake):** cross-check fleet-tab panes (`herdr agent list`) against the ledger/kanban —
  a pane whose chunk is already merged/abandoned, or that appears in the event log (or fallback $SIGNALS)
  but has no live waiter, is an orphan: archive-then-close it and re-arm whatever should have caught it.
- Events COMPLEMENT the two spines: waiter = fast wake on done; monitor = liveness; the **event log = the
  durable truth** that survives both dying ($SIGNALS is only its offline shadow). A chunk may only be
  considered lost if all of these are silent AND the worktree shows no commits.

## Run map — wayfinder-inspired: ONE issue the human reads to understand the whole run
The kanban shows status and the archive holds detail, but neither answers "where is this effort and what
has been decided?" at a glance. Borrow the `wayfinder` skill's map (see that skill for the full pattern):
- **One GitHub issue per epic, labeled `fleet:map`** — an INDEX, never a store: **Destination** (1-2 lines,
  what shipped means), **Decisions so far** (one line per merged chunk: chunk name wrapping its PR link +
  a one-line gist; detail stays in the PR/archive — the map never restates it), **Not yet specified** (the
  fog), **Out of scope** (ruled out + why, so it never resurfaces). Update it in the same wake that merges
  + archives a chunk.
- **Refer by machine-qualified NAME everywhere** (extends the pane rule to chunks/cards/issues):
  `<machine-slug>/<chunk-id>` wraps links in the run map, cards, lifecycle entries, and human-facing
  reports; a bare chunk name or wall of bare `#42 #43` is ambiguous and illegible.
- **Frontier discipline:** express chunk dependencies as native GitHub blocked-by relations where available
  (falls back to a checklist on the map) so the tracker renders ready-vs-blocked visually. The frontier =
  open + unblocked + unclaimed chunks — the ONLY things a wave may spawn. **Claim-first:** assign the chunk
  issue/card to this fleet BEFORE spawning its pane (complements fleetboard claims; dedups concurrent
  orchestrators the same way wayfinder claims tickets by assignee).
- **Fog of war:** do NOT pre-slice unclear work into chunks at backlog time — park it in Not-yet-specified
  and graduate it into real chunks when merges sharpen the question (test: can you state the spec precisely
  NOW? — not "can you answer it"). Design/ambiguous chunks stay HITL: parallel-explore produces options
  marked AWAITING-DECISION → `✋` + bell; the fleet NEVER answers the human's side of a decision.

## Setup (once)
1. A **backlog** with a wave-graph (chunks + deps + acceptance). None? build it with `superpowers:writing-plans`
   (after `superpowers:brainstorming` if the shape is unclear). Commit to main so every worktree pane reads it.
2. `herdr status` up. A **GitHub Project** board (`gh project create`) - see [REFERENCE.md](REFERENCE.md).
3. Two notification spines (REFERENCE): one **idle-waiter** background task per active pane (catches *done*)
   AND one fleet-wide **liveness monitor** loop (catches *stuck/errored/dead*). Start the monitor when the
   first pane spawns; keep it running the whole fleet.

## Per-chunk loop
Each transition below emits its lifecycle stage to the event log (`fleetctl event <STAGE> …` - see
Child→parent lifecycle events): spawn=`ASSIGNED` · plan-approved=`PLANNED` · commit+report=`BUILT`
(pane-side, via its SIGNAL STEP) · cross-review-started=`IN_REVIEW` · consensus-pass=`GATED` ·
squash-merge=`MERGED` · tracer-report=`DOGFOODED`.
1. **Map FIRST.** `herdr agent list` + `git worktree list`. Never spawn into an occupied worktree or
   duplicate work a user/agent already started. (Live lesson: this bit us.)
2. **Worktree** (`superpowers:using-git-worktrees`): `git worktree add .claude/worktrees/<chunk> -b feat/<chunk> origin/main`
   **then `bun install` (or the repo's install) in the new worktree** - fresh worktrees don't share the root
   `node_modules`, and a pane may skip install → `Cannot find module @workbench/*` gate failures that look
   like code bugs but aren't. Do it at the orchestrator before spawning, so the pane + your gates both resolve.
3. **Spawn, engine-routed + NAMED, into the FLEET TAB.** At placement, bind the machine slug registered by
   `fleetctl join --name <slug>` and keep both identities: local herdr name `<chunk-id>`; external/reporting
   name `<slug>/<chunk-id>`. Spawn locally with `herdr agent start <chunk-id> --cwd <worktree> --tab
   <fleet-tab-id> -- <engine argv>`. For a non-primary machine, execute the whole command there:
   `ssh <host> 'herdr agent start <chunk-id> --cwd <worktree> --tab <fleet-tab-id> -- <engine argv>'`.
   The remote agent NAME is still the bare chunk id; append the RES ledger line for the new pane (and any tab
   you just created) in this same wake (see Housekeeping: Resource ledger); set its local pane label too
   (`ssh <host> 'herdr pane rename <pane_id> "▶ <chunk-id>"'` - see Sidebar legibility). Every later
   remote read/send/wait/rename/close follows the same host-explicit SSH form. Never use `herdr --remote` for
   driving; it is UI-attach only.
   Placement hierarchy (once per fleet run, not per chunk):
   **workspace = the project/space** (existing, human-labeled) → **tab 1 = the human's interactive sessions
   (NEVER spawn there)** → **one fleet tab per run**: `herdr tab create --workspace <ws-id> --label
   "fleet:<epic>" --no-focus` on primary; `ssh <host> 'herdr tab create --workspace <ws-id> --label
   "fleet:<epic>@<slug>" --no-focus'` on a non-primary machine. Keep its `tab_id`, and spawn EVERY chunk
   pane with `--tab <tab_id>`. The human's sidebar then reads: space → machine-identifying fleet tab →
   bare named chunk panes. `herdr tab rename` retrofits.
   **Tab hygiene (live lesson - user caught both):** (a) run `herdr tab list --workspace <ws>` on the target
   server (through SSH when remote) BEFORE creating; reuse the expected `fleet:<epic>` or
   `fleet:<epic>@<slug>` tab instead of minting a duplicate; (b) `tab create` ships an empty root SHELL pane
   (`result.root_pane` in the create response) - after the first chunk pane spawns into the tab, close that
   root pane and sweep `herdr pane list --workspace <ws>` on the same target (no stray `shell` panes in
   fleet tabs). Note a tab dies with its last pane - re-check `tab list` before reusing a stored id.
   Engine per the **Engine routing** table above (+ any active user steering override from the ledger).
   **ALWAYS pin `--model` explicitly** — a bare `claude` inherits the user's CURRENT default, which can change
   mid-fleet (live lesson: user switched their default mid-run and the next pane silently ran on it; caught
   only by reading the pane status line). Pane spawned → emit `ASSIGNED`
   (`fleetctl event ASSIGNED --machine <slug> --chunk <chunk-id> --epic <epic> --gist "spawned <engine>"`).
4. **Brief** (literal `agent send`, then a separate `pane send-keys Enter`). A brief = **CONTEXT section
   (varies per chunk: spec/bug/repro/files/constraints — write it as richly as you like) + DISCIPLINE BLOCK
   (fixed — copy it VERBATIM from REFERENCE.md, never freehand it)**. The block carries the whole chain:
   PLAN first (`superpowers:writing-plans`) → BUILD via `superpowers:subagent-driven-development` (TDD) →
   seam rule (point at `testing-anti-patterns.md`; a behavior-bearing chunk asserts the *observable effect
   at the real seam*, e.g. the repo's `e2e-*.test.ts` /rpc pattern — the goal actually appears — NOT that a
   mocked dispatch was called) → gates (`superpowers:verification-before-completion`: `bun run typecheck` 0,
   `verify:effect` 0, suites green) → **`git add -A && git commit` before STOP, then report as
   `<slug>/<chunk-id>`; do NOT push/PR/merge** (uncommitted worktree = UNFINISHED to the waiter). Claude
   panes get the skill NAMES (they
   have the Skill tool); codex/pi panes get the non-Claude variant with the discipline spelled out as text.
   **Live lesson (2026-07-02): a freehanded bug-fix brief had excellent context + a TDD sentence but never
   told the pane to plan or use subagent-driven development — rich context is NOT the discipline; ANY chunk
   shape (build, bug fix, refactor, spike) ends with the verbatim block.**
   **Skill availability + command triggering (2026-07-16, workbox lesson): a brief NEVER loads a skill by
   itself.** Skills resolve from the PANE's environment — `~/.claude/skills` of that machine+USER plus its
   installed plugins — not from the orchestrator's. Before any brief names a skill: (a) **probe the target
   env once per machine+user** (`ls ~/.claude/skills/<name>`; for a remote pane `ssh <target> 'ls
   ~/.claude/skills'` — the pane user's home, not yours) and cache the result in the ledger; (b) a named
   skill that's absent **silently degrades to prose** — the pane "sort of follows" the workflow with no
   gates loaded, which reads as compliance and isn't — so on a miss either sync skills to the box first or
   fall back to the non-Claude discipline variant (inline text works on every engine and every machine);
   (c) to **force-trigger** a skill/command in a claude pane, send the slash command as its OWN message
   (`agent send "/skill-name <args>"` → `send-keys Enter`), never buried mid-paragraph, then `agent read`
   and confirm the command/skill banner appears before sending the follow-up context; plugin-namespaced
   skills (`superpowers:*`) additionally require that plugin installed under the pane's user — file-sync
   alone never provides them. Plan approved (the pane's written plan lands; AWAITING-DECISION design
   chunks: when the user's decision arrives) → emit `PLANNED`.
5. **Arm waiter + monitor.** Run the canonical background waiter from REFERENCE: `herdr agent wait` supplies
   bounded backpressure only, then `herdr agent get` payloads gate on `agent_status` in `idle|done`; never
   treat the wait command's exit code as completion. AND ensure the fleet **liveness monitor** loop is
   running (it sweeps this pane for stuck/errored/dead).
6. **Gate (you, fable/opus): CROSS-MODEL CONSENSUS (2026-07-10, user rule).** On idle, read the pane (its commit+report already emitted `BUILT` via the SIGNAL STEP; on READY_UNCOMMITTED you commit the pane's work and emit `BUILT` yourself), then three passes before your judgment:
   a. **Cross-engine review** (dispatching it = emit `IN_REVIEW`)**:** the chunk's diff is reviewed by the OTHER mechanical engine (codex-built chunk → grok review; grok-built → `codex review`). Reviewer gets plan section + diff; hunts correctness bugs + plan deviations. **An engine NEVER reviews its own work; a chunk NEVER self-approves.**
   b. **Reuse/simplicity pass** on the same diff (either engine or fable): hand-rolled code that a shared package / the repo's package index already owns = must-fix; needless complexity = should-fix.
   c. `/review-all` → **seam check** (the
   `superpowers:requesting-code-review` task-reviewer rubric already asks *"tests verify real behavior, not
   mocks?"* — enforce it; heuristic: *delete the mock — if the test still passes, it tests the mock, not the
   code*; a behavior-bearing chunk with only mocked-dispatch tests is NOT done → send back) →
   `superpowers:receiving-code-review` judgment → one fix subagent (`model:'sonnet'` - mechanical, findings
   are its spec; escalate on a failed re-gate) for Critical/Important →
   `superpowers:finishing-a-development-branch`.
   **Merge gate = consensus:** merge only when the cross-engine reviewer has zero unresolved must-fix AND the
   reuse pass is clean-or-fixed AND your judgment review passes. Builder-vs-reviewer disagreement → fable/opus
   tiebreak, never a coin flip. Consensus pass → emit `GATED`. **Hold-tagged chunk: STOP here - the
   Held-chunks flow (bell + the owner's board answer) owns the merge decision.** Untagged (the default):
   merge **under the `main-merge` claim** - the ordered Merge-under-claim flow (claim/queue FIFO → rebase
   on main → LOCAL repo-root gate → squash-merge → emit `MERGED` → release); never merge outside it.
7. **Track + housekeep + FILE FOLLOW-UPS (2026-07-10, user rule).** Move the kanban card Todo→In Progress→Done; attach the PR. Append the chunk\u2019s decision line to the run map (see Run map). **Follow-up capture:** any concern a builder/reviewer/roaster raised that is NOT resolved within the chunk (fragile spot, "fix later", out-of-scope bug, deferred improvement) → file a repo issue labeled `follow-up` (title `[follow-up][<area>] <gist>`; body: source chunk, agent, what+why+suggested fix, severity) AT TRIAGE TIME, not batched, and link it from the card + run archive. Sweeps: at every /review-all checkpoint scan recent chunk reports for un-filed concerns; before each final PR do a full-run sweep and list all follow-ups in the PR body under "Deferred concerns". Then **archive-then-close** the pane (see Housekeeping — NEVER close before archiving).
8. **Dogfood (tracer-bullet).** After a runtime-affecting merge, when test panes are quiescent, spawn a
   **sonnet-5** `dogfood` pane (drive-app-and-report is taste-floor work; opus-4.8 for reactor-subtle merges;
   never fable - scoping/planning/review only per the 2026-07-12 steer): run the app, exercise the chunk's new
   behavior + a core smoke, report → findings become **new kanban cards** linked to the chunk. Tracer
   report received → emit `DOGFOODED` (the chunk's final lifecycle stage).
9. **Fan out.** Spawn the next wave's *independent* chunks in parallel; sequence shared-file/reactor chunks.

## Liveness monitor - the SECOND spine (waiters catch *done*; the monitor catches *stuck/errored/dead*)
The idle-waiter only fires on `idle|done`. A pane that **errors** (network drop, `403 out of credits`, crash,
connection-refused, rate-limit, model API 5xx), **freezes** mid-`working`, or flickers to `unknown` NEVER
reaches idle → its waiter blocks to a **silent ~30-40 min TIMEOUT** and the chunk stalls invisibly while you
think it's building. Waiters alone are blind to this - so run ONE wall-clock monitor loop for the WHOLE fleet,
in parallel with the per-pane waiters. It RINGS; it does not auto-kill (classify via tail first - never kill a
genuinely-`working` pane).
1. **Sweep every ~2 min** (`run_in_background`, re-arming): `herdr agent list` → for each active fleet pane
   snapshot `{status, output-tail hash, commits-beyond-main, dirty}` and diff vs the last snapshot in a state
   file (survives orchestrator compaction - the monitor is stateless per wake, like the waiters).
2. **ERRORED** - tail matches an error signature (list in REFERENCE monitor script) → ring immediately
   (`fleetctl attn <fleet-id> "<machine-slug>/<chunk-id> errored: <line>"` + PushNotification on the
   user's Mac); don't wait out K sweeps.
3. **STUCK** - status + output-hash + commit-count ALL unchanged for K sweeps (~6-10 min) while status ∉
   `{idle,done}` → ring. Read the tail to classify: real long compile/suite (re-arm, leave it) vs frozen
   (recover). A pane legitimately on a background shell shows *changing* output/logs - a frozen one is inert.
4. **DEAD/gone** - pane vanished from `agent list` (crashed / user closed) but its chunk isn't merged → ring +
   re-spawn on the fallback engine in the SAME already-installed worktree.
5. **Recover a caught pane** via the Hard-rules credits/frozen path: close the dead pane → re-spawn
   grok→codex→fable/opus (ascending intelligence) in the same worktree → re-arm BOTH its waiter and the monitor.
6. **Distinct from the idle-waiter, not a replacement.** Waiter = "did it finish?" (git-state gate). Monitor =
   "is it still alive + progressing?" (liveness gate). Both run per active pane; a chunk is advanced only by the
   waiter's DONE/READY, rescued only by the monitor's STUCK/ERRORED/DEAD. See REFERENCE 'Liveness monitor'.

## Housekeeping — close done panes, KEEP their results (restorable)
A pane's scrollback/result is LOST on `herdr pane close` (herdr has no transcript export; only the *session* persists, and even that is not guaranteed re-attachable after close). So **capture before you close**, into a git-tracked run archive — the durable, restorable record of what each agent actually did.

Per chunk, right after merge (step 7), BEFORE closing:
1. **Capture the pane's final report:** `herdr agent read <name> --source recent --lines 400` → the report text (files, commit, test summary, concerns).
2. **Append to the run archive** (git-tracked → permanent, greppable, travels with the code): `docs/superpowers/fleet-runs/<epic>.md`, one section per chunk: `## <machine-slug>/<chunk-id>` + PR# + merge commit + gate verdict + test summary + the captured report + concerns. Commit it (part of the merge or a follow-up housekeeping commit). Link it on the kanban card.
3. **THEN teardown:** `herdr pane close <pane_id>` (resolve id from the local bare name; use SSH when remote) → `git worktree remove` → `git branch -D` → **DerivedData sweep** (every Xcode build in a worktree mints a fresh `~/Library/Developer/Xcode/DerivedData/<App>-<hash>` dir, 5-9GB each; 80 leaked dirs = 394GB, live lesson 2026-07-17). Match by exact `WorkspacePath` inside the removed worktree - never by app-name pattern (concurrent fleets build the same app from other worktrees). See REFERENCE 'Archive a pane result before close' for the snippet. Last chunk of the run: rename the tab `fleet:<epic> ✓done` on primary or `fleet:<epic>@<slug> ✓done` on a non-primary machine (or close it).
4. **Restore** later: read `docs/superpowers/fleet-runs/<epic>.md` (the authority), use
   `herdr session attach <name>` for a local live re-entry, or `herdr --remote <host> --session <session>`
   for remote UI attach WHILE the session still persists; never use `--remote` to drive subcommands.
**Archive-then-close applies to ALL fleet-spawned panes: review, dogfood, fix, and supervisor panes included, not just chunk panes** (live lesson 2026-07-10: a spent cross-review pane + a gated-out chunk pane lingered unclosed; the rule read as chunk-only). A review pane's verdict goes into the run archive under the chunk it reviewed.
Do NOT let done panes pile up (they clutter the fleet tab + hold worktrees) — but never trade the result for the cleanup.
**Close at COMMIT+REPORT, not at merge (2026-07-13, user rule — 11 idle panes piled up waiting out a long review queue).**
A build pane's job ends when its branch is committed and its report is captured; the WORKTREE + BRANCH are the durable
artifacts the gate/merge needs — the pane is not. As soon as the waiter fires READY and you've archived
`agent read --source recent`, CLOSE the pane; run cross-review/gates against the worktree, and only tear down the
worktree+branch after merge. Exception: a pane you expect to send back imminently (review already running, verdict
minutes away) may stay for ONE gate cycle — a send-back to a closed pane costs a fresh spawn in the same worktree with
the findings as the brief, which is acceptable and often cleaner (fresh context) than keeping N idle panes alive.
Idle panes with no live job are a defect: every fleet-tab pane must be `working` or awaiting an imminent send-back.

### Resource ledger + deterministic teardown (2026-07-16 — structure over sweep-rules)
Empty tabs/panes kept surviving runs DESPITE sweep duty + archive-then-close: those rules live in
orchestrator context and decay under compaction/rotation. Cleanup is therefore LEDGER-driven, never
memory-driven — the same law that already governs worktrees ("housekeep only what THIS run created,
tracked by exact path") extended to every herdr resource:
- **Mint = record.** Every command that mints a herdr resource — `tab create`, `agent start`,
  `pane split`, workspace create — appends one ledger line IN THE SAME wake, never batched:
  `RES <tab|pane|agent|workspace> <id> <name/label>`. The empty root SHELL pane a `tab create` ships
  (`result.root_pane`) gets its own RES line until closed. No RES line = not yours = you may not close it.
- **Teardown reads the ledger, never the sidebar.** At run end (and before any rotation handoff):
  list still-open RES lines → archive-then-close each pane by exact id → close tabs last → VERIFY
  (`herdr pane list --workspace <ws>` + `tab list`: zero fleet-minted resources remain) → append
  `TEARDOWN-DONE <n closed>` to the ledger. Run it, don't hand-roll it:
  `scripts/fleet-teardown.sh <ledger> --epic <epic>` (dry-run), then add `--execute`.
  `fleetctl deregister` only AFTER teardown-verify.
- **Exact ids only** — never pattern-match labels (`fleet:*`) to find things to close; concurrent
  fleets share the namespace (same live lesson as the worktree cleanup regex).
- **Rotation-safe:** the handoff doc carries the open RES lines; the successor inherits the teardown
  obligation with the resources and re-verifies them like every other snapshot field.

## Context hygiene (you, the orchestrator) - keep yourself clean + resumable
Your state lives in the **ledger + kanban + git**, NOT your context. So you survive compaction and a fresh
orchestrator can resume from those alone.
- **Per wake, re-derive from sources of truth** (`cat <ledger>`, `gh project item-list`, `git log`,
  `herdr agent list`) - do NOT trust memory.
- **Read pane *tails* only** (`agent read --lines 30`), never full transcripts. Never `cat` a subagent
  `.output` transcript into context.
- **Offload bulk to files:** diffs via `review-package`, pane reports + briefs as files, review verdicts
  returned terse. Read the *verdict*, not the diff.
- **Each wake is small + stateless:** read tail → gate (`/review-all`) → merge → move card → spawn next →
  append one ledger line → done. Don't accumulate; the board + ledger are the memory.
- **Prompt hygiene when parking (2026-07-10):** never leave unsubmitted draft text on your prompt line when
  you yield/idle - supervisors and humans steer you through that line, and a watchdog that finds text there
  must defer its message (live lesson: a starvation steering was correctly deferred for a full cycle because
  the orchestrator parked with a half-typed draft). Submit or clear before yielding.
- Spawn the *building* on panes; keep heavy reading/searching in **subagents** (they return conclusions,
  not file dumps), so your window holds coordination only - and those dispatches are mechanical, so they
  carry `model:'sonnet'` (`'haiku'` for pure locate), never the inherited orchestrator model.

## Orchestrator rotation — proactive, not incident-driven (2026-07-16)
Orchestrator main-loops were ~78% of a measured 2-week fleet spend (ax cost split) — cost per wake grows
with window size, so cap the window by ROTATING on schedule instead of riding to auto-compact (research +
sources: `docs/research/orchestrator-context-reduction.md` in the apps repo).
- **Triggers (single-condition each, never ANDed — the 954k livelock came from conjoined preconditions):**
  (a) ~70-75% of context window (leaves room to write the handoff BEFORE auto-compact can fire mid-handoff);
  (b) 4-6h of active wakes as a hard wall-clock ceiling; (c) any rotation-blocking cause observed 2 cycles
  in a row = incident, rotate now; (d) user says "rotate" — immediate.
- **Rotation is ONE atomic instruction:** write the handoff doc + commit + park with an empty prompt — never
  a sequence a watchdog must observe from outside.
- **Handoff = pointers + fresh query results, never narrative summary** (schema in REFERENCE.md). The
  successor gets the same SOURCES the predecessor had (ledger path, kanban, agent list, event-log
  cursor + fallback signals file,
  steering overrides), not the predecessor's interpretation; the only prose section is Known-blockers.
- **Successor protocol:** treat every snapshot field as stale — re-run the command behind it; reconcile
  (orphan sweep) before spawning; re-arm waiters + monitor (process-local, never inherited); register on
  fleetboard as a new instance; only then read Known-blockers.
- Keep the handoff REFRESHED as part of parking (existing hard rule) so an unplanned death degrades into a
  planned rotation.

## Steward mode - on-demand per-machine orchestrator (skills#30; spec #24 + #6)
A **steward** is this skill's orchestrator run ON a non-primary machine: spawned when the Mac
orchestrator's scheduler assigns chunks to that machine (the steward is the assignment TARGET - the
placement interface/algorithm stays on the Mac and out of scope here), gone when its queue empties.
Idle machines run ONLY the heartbeat daemon - no idle steward stays resident.
- **Division of labor (spec #6, exact):** the **Mac orchestrator keeps** wave planning, chunk-to-machine
  placement, hold tagging, kanban/run-map upkeep, dogfood triggering, and the human interface. The
  **steward runs the FULL fleet-ship workflow locally** on its own machine: worktrees, pane spawn/brief,
  idle-waiters + the liveness monitor, the cross-model consensus gate (on its OWN machine, BEFORE
  claiming), and the merge (under the `main-merge` claim like any orchestrator - the Merge-under-claim
  flow, TTL'd + FIFO).
- **Locality is the point:** waiters, monitor loops, and gates ALWAYS run on the steward's own machine -
  NEVER held open over ssh (a held-open remote loop dies with the connection; that fragility is why
  steward mode exists). ssh from the Mac stays for one-shot reads/spawns only. The monitor's "whole
  fleet" scope reads per-machine in steward mode: each steward runs ONE monitor loop covering ITS panes.
- **Events, not cards:** the steward emits the lifecycle stages it owns (`ASSIGNED → … → MERGED`, always
  `--machine <slug>` - see Child→parent lifecycle events); `BUILT` is pane-pushed by the discipline
  block's SIGNAL STEP, so the steward emits BUILT itself ONLY on `READY_UNCOMMITTED` (never a duplicate);
  `DOGFOODED` stays Mac-emitted (dogfood triggering is a kept duty). The steward DOES file `follow-up`
  issues at its own gate triage (its gate, its findings); but the Mac reconciles kanban cards + run map
  from the event log on its wakes - a steward never edits cards or the map.
- **Hold tags honored (skills#33):** the hold tag arrives in the chunk's queue entry at assignment. The
  steward runs the held chunk's FULL workflow but follows Held chunks above: stop at `GATED`, bell with
  `<slug>/<chunk-id>` + verdict + link, `✋` pending the owner's answer; merge (under claim) only on
  approve, send back on reject. A chunk still awaiting its answer at rotation/exit is listed in the handoff.
- **Rotation - same policy, VERBATIM:** the Orchestrator-rotation triggers above apply to stewards
  unchanged (~70-75% context, 4-6h wall clock, 2 same-cause blocked cycles, user says rotate), and the
  same successor protocol holds - the successor steward re-derives from the board + local herdr state.
  ONE rotation policy; steward mode does not fork a second one.
- **Exit-on-empty:** queue empty → ledger-driven teardown-verify (Resource ledger rules) → write the
  rotation handoff (the REFERENCE schema, extended with machine slug + held-claim state) → confirm the
  last chunk's terminal lifecycle event is on the board → `fleetctl deregister` → park/exit.
- **Naming (#26 rules, unchanged):** local herdr names stay bare (`<chunk-id>`; the steward's own pane is
  `steward:<epic>`), tab `fleet:<epic>@<slug>`, and EVERY off-machine surface - events, ledgers, reports,
  attention/bell lines, archives, handoffs - says `<slug>/<chunk-id>`.
Spawn-on-assign contract + brief template: REFERENCE.md 'Steward brief'.

## Hard rules (live-dogfood lessons)
- **One agent per worktree.** Map before spawning. **Never interrupt a `working` pane;** clear prompt
  before `send`; submit is a separate `send-keys Enter`.
- **`agent send` REPLACES the prompt line - it does NOT append; and `send-keys Enter` alone CANNOT submit
  a human-typed parked draft (2026-07-10, bit twice in one session).** A bare Enter on a user-typed draft
  silently no-ops (pane stays idle, draft stays parked - verify status flipped to `working` after EVERY
  submit, never assume). And steering a pane that holds a parked draft CLOBBERS the draft (a user's
  'ping me when A14 lands' was overwritten by a steer). Correct protocol to submit a parked draft:
  (1) `agent read` to capture the draft text + log it, (2) `agent send <the same text>` (the replace
  makes it submittable), (3) `send-keys Enter`, (4) confirm status = `working`. Only then send your own
  steering as the next message.
- **Name everything locally; qualify everything externally.** `agent start <chunk-id>` — the herdr NAME is
  the bare chunk id, unique only inside that server's own agent table (never generic like `codex`: detected
  labels are also targets → ambiguous locally). ALL `herdr agent *` commands (get/read/send/wait/rename/
  focus/attach) accept that bare local NAME. Pane id is required ONLY for `herdr pane *`
  (send-keys/run/close) and `herdr wait output|agent-status` — resolve on that server:
  `herdr agent get <chunk-id> | jq -r .result.agent.pane_id`. Every reference that leaves the machine —
  ledger, kanban card, run map, lifecycle/signal/monitor event, `fleetctl attn` line, run archive, rotation
  handoff, and report to the human — MUST use `<machine-slug>/<chunk-id>`. Human reports say
  `<machine-slug>/<chunk-id> (<pane_id>)`, never a bare name or pane id.
- **There is no cross-host herdr namespace.** Two servers may both have a bare agent named `sdk-migrate`;
  herdr detects no collision, so recording or driving bare `sdk-migrate` across machines can silently
  attribute work to the wrong pane. Prevention is the pair above: qualify every off-machine reference, and
  drive another server only as `ssh <host> 'herdr <subcommand> ...'`, with the host explicit at each call
  site. Never point a local client at a remote socket or write `herdr --remote <host> agent ...`;
  `--remote` only opens the interactive UI attach and is not composable with driving subcommands.
- **Three-level placement: workspace=space · tab=fleet run · pane=chunk.** The workspace is the human's
  project space — do NOT create one per chunk. Tab 1 of a workspace belongs to the human's interactive
  sessions — NEVER spawn fleet panes there or into whatever tab has focus. Create ONE `fleet:<epic>` tab on
  primary or `fleet:<epic>@<slug>` on each non-primary machine and spawn that server's bare-named chunk
  panes into it (`agent start ... --tab <tab_id>`); close or rename the machine-local tab when the run ends.
  **Retrofit/moves (dogfooded on a LIVE working codex pane — survives untouched):** `herdr pane move <pane_id>
  --tab <tab_id>` (existing tab) / `--new-tab --workspace <ws> --label TEXT` / `--new-workspace --label TEXT
  --tab-label TEXT` (creates workspace+tab+moves in one command; use `--no-focus`). CRITICAL: the pane_id
  CHANGES on move (wV:pC → w0:p1) but the agent NAME resolves seamlessly across it — one more reason waiters
  and every reference must target the NAME; any pane-id-addressed waiter dies silently on a move (re-arm by
  name).
- **Idle != done — and `done`, not `idle`, is how panes often END.** Codex chunks finish in status `done` (terminal); gate on polled `agent get` payloads in `idle|done`, never `= idle` alone (else the waiter loops past a finished pane to TIMEOUT). `herdr agent wait --status idle` is LEVEL-triggered; against `done` it resolves quickly but exits 1, so its exit code is never the gate. Never request `done` through `agent wait`; use pane-addressed `herdr wait agent-status` only when `done` must be a first-class target. A pane can finish **gated-green but uncommitted** → gate on stable-idle AND (commit OR dirty tree); on idle+dirty the orchestrator commits the pane's work itself (`READY_UNCOMMITTED`). See REFERENCE 'Refinement 2'.
- **Idle != done (background-shell flap).** A pane reports idle/`done` while merely *holding on a background shell* (a test suite,
  a forked review). Gate on a REAL signal: a **commit beyond `origin/main`** + a final report/STOP - not bare
  idle. Make the waiter **commit-gated** (re-arm until a commit appears). Live lesson: a pane mid `+2292/-11510`
  with the suite running flapped `idle`→`working`, storming the naive idle-waiter.
- **Non-Claude panes miss repo conventions Claude Code auto-absorbs — point them at CLAUDE.md; the gate catches the rest.** Grok wrote
  `import from "bun:test"` + `toStartWith` in a vitest repo: **typecheck + verify:effect PASSED**, but the
  test file failed to load → 0 tests ran. So (a) name the repo's test framework + matcher set in the brief
  (e.g. "vitest, import from 'vitest', no bun:test/toStartWith"); (b) the orchestrator's gate must
  **actually run the new tests** - typecheck/verify alone pass over a non-loading or wrong-matcher test.
- **Gate completeness: enumerate the FULL verification matrix, per chunk, from the plan (2026-07-10).** A gate
  once ran only a boot test on a multi-scheme app and passed a chunk the plan gated on 4 schemes. The gate
  step must LIST what the plan's phase names (every scheme, every suite, sim build, screenshots) and check
  each off - "some test ran green" is not a gate.
- **Liveness = branch commits, not board deltas (2026-07-10).** Any monitor/waiter/watchdog deciding
  starved/stuck/unresponsive must check recent COMMITS on the fleet's branches before flagging - gh-closed
  deltas batch behind gate queues (a watchdog false-alarmed 6x in one night on that signal alone; adding a
  commits-alive check eliminated them).
- **A safety protocol must have AUTHORITY to cause its own preconditions (2026-07-10 rotation livelock).**
  The orchestrator context-rotation protocol required (fresh handoff) AND (idle + empty prompt) - the
  watchdog could only wait for both, they never aligned, and a human had to rotate manually at 954k ctx.
  When designing any monitor-triggered maneuver: every precondition needs either an action that CAUSES it
  (submit the blocking draft after logging it; order "checkpoint + park empty" as ONE atomic instruction)
  or a hard-ceiling override; freshness checks compare against content (newer than last state commit),
  never wall-clock windows; and 2 consecutive same-cause blocked cycles = an incident, not patience.
  Orchestrators: keep the handoff refreshed as part of PARKING, not as a favor when asked.
- **Green != correct — enforce SEAM discipline (define_view dogfood lesson).** A chunk shipped 31 green unit
  tests yet the feature hung in prod because they **mocked the dispatch (`CreateGoal`) — the behavior under
  test**; "green" meant "called the mock." The rules already existed (`testing-anti-patterns.md` + both review
  rubrics ask *"tests verify real behavior, not mocks?"*) — the miss was not wiring them into the fleet. So:
  (a) every brief names the seam rule + points at `testing-anti-patterns.md`; (b) the gate runs the seam check
  (delete-the-mock heuristic + task-reviewer rubric) and REJECTS behavior-bearing chunks whose tests mock their
  own dispatch; (c) such chunks carry a real-seam acceptance assertion (mock only non-deterministic leaves).
  UAT/dogfood is the backstop, not the primary catch.
- **Never close a pane before archiving its result.** `close` is where the transcript dies (no herdr export; session-attach not guaranteed post-close). Capture `agent read --source recent` → the git-tracked run archive (`docs/superpowers/fleet-runs/<epic>.md`) FIRST, then close. The archive — not the live pane — is the restorable record.
- **Housekeep ONLY worktrees THIS run created — never pattern-match names.** Same law for herdr panes/tabs — close from the ledger's RES lines (see Housekeeping: Resource ledger), never by label pattern. Track each worktree you `git worktree add` (by exact path) and remove only those. A broad `grep`/regex over `git worktree list` WILL catch other sessions' parked branches (live lesson: a cleanup regex removed byo-cloudflare/channels/fix-* worktrees from prior streams). Committed work survives on the branch (recreate with `git worktree add <path> <branch>`), but **uncommitted edits in someone's idle worktree are lost**. Before removing ANY worktree you didn't just create: confirm no live agent is cwd'd there AND it has no uncommitted changes (`git -C <wt> status --porcelain`).
- **Orchestrator gates the merge** - panes never auto-merge to main (checkpoint + avoid collisions).
- **Never brief `git add -A` while worktree-root scratch exists (live lesson - BRIEF.md/REPORT.md shipped to main twice).** Pane briefs and reports live at the worktree root; `add -A` commits them, the squash-merge lands them on main, and every later worktree "inherits" a stale brief. Fix: gitignore the scratch names (`/BRIEF.md`, `/REPORT.md`) in the repo once, AND write briefs with explicit `git add <paths>` or `git add -A ':!BRIEF.md' ':!REPORT.md'`. Gate check: the review diff must not contain the brief/report files.
- **Long briefs travel as files, not keystrokes (2026-07-10 API-drop lessons).** Spawning/briefing with a
  large prompt over `agent send` during API instability drops mid-stream and leaves half-briefed panes +
  stale drafts. Write the brief to the worktree as BRIEF.md and SEND A SHORT POINTER ("read BRIEF.md and
  execute"); same for any steering over ~10 lines.
- **Waiter timeout != stuck: verify liveness before acting (2026-07-10).** Commit-gated waiters time out
  under legitimately long chunks (a pane on task 8 with 8 commits got flagged twice). On waiter exit:
  check pane status + recent commits FIRST; alive -> re-arm with a longer timeout (or require heartbeat
  commits in the brief); only dead/commit-silent panes get the stuck treatment. An "API Error: Connection
  closed mid-response" tail + clean worktree = RECOVERABLE mid-turn drop: nudge the same pane, don't respawn.
- **A wrapper agent completing is NOT a review verdict (2026-07-10).** Review-wrapper subagents drop under
  API instability and can return without a verdict; the gate must check a verdict EXISTS, and on wrapper
  failure fall back to direct CLI (`codex review` / `grok` via Bash), logging the wrapper failure. Never
  count a wrapper's clean exit as a PASS.
- **Event-driven, not timed.** Canonical background waiters use `herdr agent wait` only for bounded
  backpressure; polled `agent get` status plus git state is the completion gate. `send_later`/
  `ScheduleWakeup` may be unavailable (no CCR session). If herdr can't track an engine's status, fall that
  chunk back to one it can (codex/claude). **Engines run out of credits/quota mid-run** (grok hit a
  `403: run out of credits`, pane frozen) - detect via a pane read, close the dead pane, and re-spawn the
  chunk on a fallback engine (grok→codex→fable/opus, ascending intelligence) in the SAME already-installed worktree. Keep >1 lane funded.
  **The idle-waiter will NOT catch a frozen/errored pane** (it never goes idle) - the **liveness monitor** (above) is the
  proactive spine that catches it. Always run BOTH per active pane: the git-state waiter for *done*, the monitor for *stuck/errored/dead*.
- **Parallelize only within a wave where chunks don't share files.** **Verify "already done" claims**
  against current code before building (recent merges shift things).

See [REFERENCE.md](REFERENCE.md) for brief templates, kanban `gh` commands, the waiter script, engine flags.
