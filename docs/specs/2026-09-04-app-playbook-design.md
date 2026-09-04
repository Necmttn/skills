# App playbook: golden track + `/app-idea` skill

Date: 2026-09-04. Status: approved in chat (3 sections), pending written review.

## Problem

Consumer-app know-how is spread across: `~/Projects/apps/docs/playbooks/` (20 tactical files),
`~/Projects/apps/docs/knowledge/` (Superwall synthesis, App Store assets), wiki concept pages
(`funnel-native-consumer-apps`, `entitlements-are-product-architecture`,
`mobile-subscription-attribution-pipelines`, `paying-intent-market-sizing`), and the
2026-08-28 app-ideas query. None of it is a decided doctrine. A new idea starts from "here are
resources", not from "here is what we have decided and verified".

## Goal

One golden track: a single doctrine page whose rules carry a status and a date, ratcheted by
owner decisions and shipped-app evidence. One skill that runs intake -> verdict for a new or
existing app idea, writes a verdict card, and feeds owner overrides back into the doctrine.

## Decisions taken (owner, 2026-09-04)

- Home = wiki page (doctrine) + skill (workflow). Not the apps repo, not skill-only.
- Scope per run = intake to verdict. Build starts only on explicit go.
- Ratchet = two-tier status per rule: `decided` (owner call) / `verified` (measured in a
  shipped app). Everything else stays `candidate`. Retired rules stay visible, struck, with reason.

## Component 1: doctrine page

Path: `~/wiki/playbook/apps.md`. Frontmatter `type: playbook` (new type, added to SCHEMA.md,
precedent: `media-company/` uses `type: workspace`). Keep under ~200 lines; split by section
when exceeded.

Sections, in order:

1. How to read this page. Status legend: `candidate | decided | verified | retired`. Each rule
   line = `- [status YYYY-MM-DD] rule text. (provenance link)`.
2. Idea gate. Questions a verdict must answer: demand receipts; paying-intent band estimate
   (5/15/30/50 prior); one-sentence promise; monetization boundary (free/paid line, price
   anchor); built-in distribution loop; hardest risk; kill criterion.
3. Product rules. Onboarding, first value before paywall, entitlements as architecture,
   paywall placement/timing.
4. Growth rules. Distribution before approval, funnel metrics over vanity, attribution pipe
   verified before spend, creator CAC = full cost.
5. Autonomy boundary. Copied from `apps/docs/playbooks/growth-ops.md` §4 (ratified
   2026-08-01) -> enters as `decided 2026-08-01`.
6. Decision log. Append-only: `YYYY-MM-DD | rule-id | old -> new | reason | evidence link`.
7. Retired. Struck rules + reason.

Seed sources (all enter as `candidate` except §5): the four wiki concept pages,
`growth-ops.md`, `paywall-experiments.md`, `growth-tricks.md`,
`docs/knowledge/superwall/SYNTHESIS.md`, `queries/2026-08-28-app-ideas-from-knowledge-base.md`.
Each rule gets a stable id (`P-01`, `G-03`, ...) so verdict cards and the log can cite it.

## Component 2: `/app-idea` skill

Path: `~/Projects/necmttn-skills/skills/misc/app-idea/` (SKILL.md + `templates/verdict-card.md`),
linked into `~/.claude/skills` by `scripts/link-skills.sh`. `user-invocable: true`.

Triggers: "new app idea", "should I build", "audit this app", "re-score <app>", or pasted idea text
in a product context.

Procedure:

1. Orient. Read `~/wiki/playbook/apps.md`, `~/wiki/index.md`, the app-ideas query page.
   Existing app: also read `apps/<app>/docs/METRICS.md`, `docs/experiments/<app>/`,
   `docs/reports/<app>/` when present.
2. Intake. Restate idea in one sentence. Not possible -> stop, ask. First gate.
3. Evidence sweep. New idea: web search + Appllama cache (`~/.cache/appllama/`) when present.
   Existing app: ledger/metrics/reports only, never the web. Every receipt = URL or path.
4. Score. Apply §2 idea gate. Bands estimate. Evidence / monetization / built-in loop, each 0-5.
   Hardest risk + one kill criterion.
5. Verdict card. Write `~/wiki/playbook/verdicts/YYYY-MM-DD-<slug>.md` from the template.
   Fields: one-liner; receipts; band estimate; scores; verdict (`build | park | kill` for new,
   `keep | fix | sunset` for existing); kill criterion; rules applied (ids + status);
   `## Owner override` (empty).
6. Stop. Present card in chat. Wait.
7. Feedback loop. Owner override on a score/rule -> append decision-log line to doctrine, flip
   rule status (`candidate -> decided`). Owner cites a shipped measurement (experiment file
   with DECIDED line, report) -> link it, flip to `verified`. Owner strikes a rule -> move to
   §7 with reason.

Rules: the skill holds procedure only; never hardcodes a rule. Doctrine changes without a
skill edit.

Write path: shell writes under `~/wiki/playbook/` with `ALLOW_MAIN_WRITE=1` (write-guard
bypass). One `log.md` entry per run. SCHEMA.md gains a line naming `/app-idea` as the second
sanctioned wiki writer, scoped to `playbook/**` + `log.md` + `index.md` playbook section.
Never `git commit` in `~/wiki`.

## Existing-app audits (seed)

One audit card each for the owned apps: `ailifestory`, `lockin-chinese`, `dotself`, `rove`.
Verdict options `keep | fix | sunset`. Evidence from repo artifacts only.

## Testing

Three dry runs; statuses frozen during dry runs (owner review only moves them):

1. Fresh idea, strong receipts -> expected `build`.
2. Fresh idea, no receipts -> expected `park` + the named receipt to go find.
3. Existing-app audit -> card cites ledger/METRICS.md, no web receipts.

## Out of scope

- No build step; card links to `apps/docs/playbooks/new-app.md` as the build entry.
- No automatic rule promotion; ingest/harvest feeds still write candidates only.
- No edits to `apps/docs/playbooks/*`; doctrine links to them as the tactical layer.

## Deliverables

1. SCHEMA.md: `playbook` type + second-writer note.
2. `~/wiki/playbook/apps.md` seeded (candidates + one decided section).
3. `~/wiki/playbook/verdicts/`: 4 audit cards + 3 dry-run cards.
4. Skill folder: SKILL.md + `templates/verdict-card.md`; link script updated.
5. `index.md` playbook section + `log.md` entries.

## Unresolved questions

- Rule-id scheme: prefix by section (`P-`, `G-`, `A-`) or flat `R-NN`? Default: by section.
- Should dry-run cards stay in `verdicts/` or be deleted after review? Default: keep, tagged `dry-run`.
- Owner override captured how: edit the card's `## Owner override` block, or say it in chat? Default: either; skill reads both.
