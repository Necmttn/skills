# kb-site

One app knowledge base with two views over the same data:

- **Records** (`data/*.jsonl`): sources, requirements (checks and guidelines, revisioned), apps, conflicts, and per-app tracking. The records are the truth for checks and state.
- **Prose** (markdown): current SOTA verdicts, the experiment ledger, and the source documents (onboarding catalog, UX psychology rules, paywall/growth/ASO playbooks, design law). The records point at the prose through `data/sources.jsonl`.

The CLI (`cli.ts`) and the HTML browser (`build.ts`) read the records through the same core (`src/`): `Store.load`, `derive.checklist`, `derive.compare`, `views.refViews`, `Roots`. Plan: [docs/PLAN.md](./docs/PLAN.md). Contributing and sync: [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md). How the records were seeded: [docs/MIGRATION.md](./docs/MIGRATION.md).

**Added 2026-09-19 - the store is private.** The `origin` of this repository is a PUBLIC GitHub repository. `data/`, `inventory/`, and `docs/MIGRATION.md` paraphrase private rules closely and cite them by id. They must live in a private remote that the owner has not chosen yet. Nothing from this work has been pushed. The code works without `data/`: `cli.ts` and `build.ts` print one line that names `--data <dir>` and `--roots <file>`, and the tests that need the real store are skipped. `sync` refuses every remote that was not approved with `approve-remote <remote> --i-verified-private`. Details: [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md).

## Build and view

```
bun kb-site/build.ts --open                              # local page: kb-site/dist/index.html
bun kb-site/build.ts --public --out /tmp/kb-public.html  # collaborator-visible page
```

Output: one self-contained HTML file (no server, no external assets, works from `file://`). `/` focuses the filter box.

| Flag | Meaning |
|---|---|
| `--open` | Open the page after the build. |
| `--public` | Show text only for sources with `publishable: true`. Every other source becomes a citation card. No private text is in the output. |
| `--out <file>` | Output file. Default: `kb-site/dist/index.html`. |
| `--stamp <text>` | Fixed text for the "Generated" footer (or env `KB_BUILD_STAMP`). With a fixed stamp, two builds of the same inputs are byte-identical. |
| `--data <dir>` | Data directory. Default: `kb-site/data`. |
| `--roots <file>` | Roots file (or env `KB_ROOTS_FILE`). Default: `kb.roots.json` next to the data dir's parent. Use it with `--data` on a copy elsewhere. |

Exit code 1 means the record store has validation errors. The page is still written, with a banner that lists them. Fix them with `bun kb-site/cli.ts validate`.

The page has a **Tracking** section first, generated from the records:

- Apps overview: release, counts per derived state, progress bar.
- Compare matrix: checks (by phase, in plan order) x apps, one state chip per cell. Filters: app, phase, state, cadence, rule acceptance, and the `/` text filter.
- One checklist per app: state, cadence, release binding, owner, notes, evidence, "needs review" for stale items, owner-gate and evidence-required markers.
- Requirement registry: anchor `#req-<id>`, rule acceptance, revision, what, how, applicability, references, conflicts.
- Conflicts: sides (source, locator, claim) and affected requirements.

Round chips are app completion (`complete`, `stale`, `blocked`, `unverified`, `in_progress`, `todo`, `excluded`, `retired`). Square `rule:` tags are acceptance of the rule (`candidate`, `decided`, `verified`, `retired`). The two are never the same mark. All record text is escaped; only `http`, `https` and `mailto` references become links.

## CLI

```
bun kb-site/cli.ts --help
```

List apps and checks, show a checklist or one item, compare apps, print references, set status/owner/notes/evidence, validate, format. Every read command takes `--json`.

```
bun kb-site/cli.ts checklist lockin-chinese --phase submission --state todo   # also --cadence, --owner-gate, --acceptance
bun kb-site/cli.ts compare lockin-chinese lockin-japanese --diff              # only rows where the states differ
bun kb-site/cli.ts revise <req> --how "<text>" --note "<why>"                 # material edit: revision + 1, done records become stale
bun kb-site/cli.ts approve-remote <remote> --i-verified-private               # sync refuses every remote without this
```

Global flags: `--data <dir>`, `--roots <file>`. Date-only stamps (evidence `date`, `revised_at`) use the local calendar date; `updated_at` is UTC.

## Content roots

No record and no manifest entry holds an absolute path. A source has a `root` and a root-relative `path`. `kb` and `skills` resolve from this repository. The private roots come from `kb-site/kb.roots.json` (gitignored; copy `kb.roots.example.json`) or from env `KB_ROOT_<NAME>`:

```json
{ "apps": "~/Projects/apps", "wiki": "~/wiki", "home-skills": "~/.claude/skills" }
```

A root that is not mapped on this machine is not an error: the doc renders as a citation card ("unavailable here: private root "apps"; map it in kb.roots.json or KB_ROOT_APPS; with --data elsewhere, name the roots file with --roots <file> or KB_ROOTS_FILE") and the build succeeds. Every doc header shows the access and license boundary of its source (`repo`, `private-repo`, `private-wiki`, `local-only`, `vendored MIT`, `linked-only`, ...). A `linked-only` source renders as the link plus our notes; its text is never fetched or inlined.

## Structure

- `data/` - the records. See [docs/PLAN.md](./docs/PLAN.md) section 2 for the contract. Edit them with the CLI (`set`, `fmt`), or by hand and then run `validate`.
- `src/` - runtime-agnostic Effect core. `src/html/` holds the HTML view: `manifest.ts` (sections, order, titles; each doc names a source id), `markdown.ts` (the renderer), `tracking.ts`, `site.ts`, `command.ts`, `styles.ts`, `client.ts`. `build.ts` and `cli.ts` are the thin Bun entries.
- `SOTA.md` - one verdict per line with a `[sota]` / `[directional]` / `[retired]` status, evidence link, and date. This file is the answer to "what do we currently call SOTA". Append; never silently delete - flip to `[retired]` instead.
- `IDEA-ROAST.md` - the negative checklist for new app ideas: hard kills (one-sentence, sound-off, tarpit, mechanism, promo-picture, willingness-to-pay, App Review exposure) + soft flags, with a recorded ROAST verdict per idea. No recorded roast, no build.
- Motion vocabulary lives in `skills/engineering/motion-principles/SKILL.md` (the twelve classic principles mapped to UI rules + our house rules), rendered in the Motion section; the source essay is linked there, not vendored (copyrighted).
- `EXPERIMENTS.md` - cross-repo index of our own experiments. The authoritative per-experiment ledger files live in the apps repo under `docs/experiments/` (growth-ops rule).
- `REJECTIONS.md` - App Review rejection ledger: what Apple said, the real root cause, the fix, the guard, the lesson. Companion rule: every rejection also adds a rule with a verify command to the submission playbook.
- `SHIPPING.md` - the "ship an app" SOP: eight ordered phases from code-landing to launch week, with the owner gates (TF-first, tag/submit only on explicit go) and the document that owns each phase.
- Tooling section (added 2026-09-03) renders the apps-repo `docs/playbooks/mobile-iteration-loop.md` (the inner loop: affected tests, shared caches, seeded launch, AXe-driven simulator checks, batch merges) plus the `sim-test`, `axe` and `xcodebuildmcp` skills from the `home-skills` root (`~/.claude/skills/`). Simulator verdicts live in `SOTA.md` under Tooling.
- `external/` - vendored third-party knowledge, mirrored verbatim with an `UPSTREAM.md` naming the source, license and pinned commit. Never edit these to record our own verdicts; those go in `SOTA.md`. Currently: `vibe-aso` (Kronop, MIT) - the six-phase ASO pipeline (keywords, 50-locale metadata, localized screenshots, worldwide pricing, in-app strings, ASC field checklist). `aso-skills` (eronred, MIT) - Custom Product Pages, In-App Events, PPO tests, screenshots, preview video, featuring, launch, rejection recovery. And `rork-guide` (Rork/Daniel, pasted 2026-08-17) - the $0 -> $10k/mo consumer-app playbook: idea selection, the gotcha moment, MRR ladder, and creator/meme-page/paid-ads distribution mechanics; adopted verdicts live in `SOTA.md` (Idea Selection, Distribution) and `IDEA-ROAST.md`. `rork-guide` states no license: its source record is `vendored`, `publishable: false`, so `--public` and `publish` leave its text out.
  Sources with no license, or a copyrighted one, are **linked, never mirrored** - the directory then holds only our own notes (`ua-skills`). The upstream itself is the source record `url.ua-skills` with access `linked-only`.
- `build.ts` - ~~reads the manifest of sources (these two files, the knowledge skills in `skills/engineering/`, and playbooks in `~/Projects/apps/docs/playbooks/`) and renders the site. A missing source renders as a note, not an error.~~ Retracted 2026-09-18: the manifest held absolute paths of one machine, which collaborators cannot use. Now: a thin Bun entry. The manifest is `src/html/manifest.ts`; each doc names a source id from `data/sources.jsonl`, and the path resolves through the content roots. A missing or unmapped source renders as a citation card, not an error. The "updated" file date is no longer shown: it made the output differ between clones.

## Updating

~~The markdown files are the truth. Edit them (or the skills/playbooks they point at), rerun the build, refresh the page.~~ Retracted 2026-09-18: this holds for prose only. The page now also shows checks and per-app state, and those do not live in markdown.

- **Prose**: the markdown files are the truth. Edit them (or the skills/playbooks they point at), rerun the build, refresh the page.
- **Checks, rule acceptance, per-app state, evidence, conflicts**: the records in `data/` are the truth. Change them with `bun kb-site/cli.ts set ...` (or by hand, then `validate`), rerun the build. Do not track completion in markdown checklists.
- **A new prose doc**: add a source record to `data/sources.jsonl` first (root, path, access, license, publishable), then name its id in `src/html/manifest.ts`.

## Tests

```
cd kb-site && bun run typecheck && bun run test
```

`test/html/` covers the markdown renderer, the eight derived states, escaping, citation cards, `--public`, linked-only sources, byte-identical builds, and one build against the real `data/`. The two tests that need the real `data/` are skipped when it is absent; every other test builds its own fixture store.
