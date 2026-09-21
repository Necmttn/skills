# Report: unified app knowledge and JSONL tracking

Date: 2026-09-19, updated 2026-09-21 with the owner decisions. Branch: `feat/app-knowledge-tracking`. Brief: `APP-KNOWLEDGE-BRIEF.md`. Plan: [PLAN.md](PLAN.md).

## 1. Status

~~The local system is built, tested, and reviewed. **Nothing is pushed. No PR exists. Nothing is online.**~~
**Updated 2026-09-21:** the owner decided on 2026-09-21: one git repo for now (this one), the code may go to `origin` as a PR, the already-public files stay, the seeded acceptance mapping is confirmed, all conflicts are to be resolved, and the owner works solo. The branch is pushed to `origin` and a PR is open (link in section 8). The two raw inventory files (`inventory/wiki.md`, `inventory/apps-repo.md`) stay local and gitignored: they name unreleased ideas, private repository layout, and account ids, and the records do not need them.

~~**Blocker for any push:**~~ Fact, kept for the record: `origin` is a PUBLIC repository (`gh repo view Necmttn/skills` -> `PUBLIC`, checked 2026-09-19). The store paraphrases private wiki rules and private playbooks, and the inventories name private repository paths. A push or PR from this branch publishes that material. The brief forbade that without explicit authorization; the owner gave it on 2026-09-21 (decision 1 and 2), with the raw inventories kept local.

The work is in these commits (all on `origin` after 2026-09-21):

1. **code** - public-safe: `src/`, `test/`, `cli.ts`, `build.ts`, `runtime.ts`, package files, `README.md`, `docs/PLAN.md`, `docs/CONTRIBUTING.md`, `.gitattributes`.
2. **store**: `data/`, `inventory/RECONCILIATION.md` + cheat-sheet, `docs/MIGRATION.md`, this report.
3. **decisions** (2026-09-21): 30 conflicts resolved, raw inventories removed from git, docs updated.

The test suite passes without `data/` (2 real-data files skip), so commit 1 can go to `origin` alone.

## 2. What exists

| Part | Where | Notes |
|---|---|---|
| Records | `data/*.jsonl`, `data/tracking/<app>.jsonl` | 82 sources, 226 requirements (212 checks, 14 guidelines), 6 apps, 34 conflicts, 36 tracking records |
| Core | `src/` | Effect v4 rc.112, `Context.Service` + `Layer`; no `process`/`Bun`/`node:*` in `src/` (rg count 0) |
| CLI | `cli.ts` | `apps checks checklist show compare refs conflicts set set-release revise validate fmt sync approve-remote merge-driver install-merge-driver publish`; all read commands take `--json` |
| HTML | `build.ts` -> `dist/index.html` | Tracking section from the same store; `--public` leaves out private text |
| Collaboration | `src/sync/`, `.gitattributes` | record-level 3-way merge driver; guarded `sync`; tested on local bare repos only |
| Publication prep | `src/publish/` | bundle + `MANIFEST.json` + secret scan; publishes nothing |
| Docs | `docs/` | PLAN (corrections retracted in place), CONTRIBUTING, MIGRATION, this report |
| Inventory | `inventory/` | wiki (43 rules), apps repo (181 candidates, 25 conflicts), reconciliation, Effect v4 cheat-sheet |

Requirements by acceptance (2026-09-21): decided 203, candidate 20, verified 2, retired 1. All 34 conflicts resolved. By cadence: once 111, every_release 115.

## 3. Commands

```
cd kb-site && bun install
bun cli.ts apps
bun cli.ts checklist lockin-japanese --phase submission --owner-gate
bun cli.ts show monetization.no-trial-toggle --app lockin-chinese
bun cli.ts compare lockin-chinese lockin-japanese --diff
bun cli.ts refs submission.privacy-manifest
bun cli.ts conflicts --status open
bun cli.ts set <app> <req> --status done --evidence build=<n> --note "..." --by <name>
bun cli.ts set-release <app> <version> [--build n]
bun cli.ts revise <req> --how "..." --note "why"      # bumps revision; other apps' evidence goes stale
bun cli.ts validate | fmt
bun build.ts --open            # local page, all mapped roots
bun build.ts --public --out <file>
bun cli.ts publish --out <dir-outside-repo>
bun run typecheck && bun run test
```

## 4. Test results (orchestrator runs, 2026-09-19)

- `tsc --noEmit`: clean.
- `bun --bun vitest run`: 18 files, 161 tests passed. Without `data/`: 16 files passed, 2 skipped (fix builder's run).
- `bun cli.ts validate` on real data: 0 errors, 0 warnings.
- Real CLI workflows on a copy of the real data: `done` without evidence refused; `done` with evidence accepted; manual revision bump -> `stale`; `set-release 1.7.17` -> `todo (last done 1.7.16)`; compare separates excluded / blocked / complete / in_progress / todo.
- Two-clone git integration (real `git`, real driver subprocess): different records merge; different fields merge; conflicting `status` stops the sync, writes a conflict block, `validate` refuses it, nothing is pushed; double rule revision conflicts; invalid data is never pushed; unapproved remote refused.
- `bun cli.ts sync --dry-run` here: refused, exit 1, nothing fetched (`origin` not approved).
- HTML: local build 51 docs rendered; public build cites private docs without text; a private collection URL occurs 0 times in the public page. A headless browser check of filters ran in dark mode only (HTML builder's report).
- Publish to `/tmp/kb-bundle`: 27 sources copied, 55 excluded with reasons, `MANIFEST.json` ok; the bundle installs, validates, and builds by itself.

## 5. Review

Two adversarial reviews ran on the first integrated commit: Codex (code) and a separate Claude agent (spec, data honesty, docs).

| Finding | Severity | Result |
|---|---|---|
| `origin` is public; docs said "nothing is online" | critical | No push, no PR. Docs corrected. `sync` refuses any remote not approved with `approve-remote --i-verified-private` |
| Write race between hash check and rename | high | Exclusive lock file; all hashes re-checked before any write; `PartialWrite` names files |
| Merge driver wrote an empty file on a read error | high | exit 2, `ours` untouched |
| Merge could join `done` + old evidence with a newer revision | high | status + revision + release + evidence merge as one group |
| Evidence of an old release verified a new release | high | evidence for another release does not count (validate, derive, set) |
| `--public` HTML and publish could leak via flags or symlinks | high | one access policy (`src/access.ts`) + real-path containment everywhere; validate rejects a publishable private-root source |
| Two seeded `done` records overstated the source | high | now `in_progress`, evidence kept |
| `--ack-revision` passed with duplicate evidence | medium | de-duplicate first |
| NUL byte disabled the secret scan | medium | always scan |
| Bundle refs did not resolve | medium | bundle `kb.roots.json` |
| No rule-revision command; filters missing; doc examples failed; no report | medium | `revise`, `checklist`/`compare` filters, docs re-run (29 commands), this report |
| Piped `--json` truncated at 64 KiB (found by orchestrator) | high | Bun `console.log` drops data after `process.stdout` is touched; console now writes through the streams (`runtime.ts`), regression test added |

Not changed, by decision: `submission.build-state-valid` keeps release `1.0(171)`. The reviewer read the source differently; the record note states the limit. Owner can correct it.

## 6. Exact limitations

- **Online:** the branch is on the public `origin` (owner decision, 2026-09-21). `sync` is not approved for `origin` and has never run against a hosted remote; plain `git push` is the solo workflow. A remote-moved push is tested with a scripted git layer only.
- `kb` cannot verify that a remote is private. The approval flag is a human statement.
- `sync` pushes the branch `HEAD`, so code and store travel together. A private store repo is the clean answer (owner decision 1).
- The lock stops other `kb` writers. It does not stop a text editor that saves during a write.
- Staleness depends on `revise` (or a manual `revision` bump). A hand edit of `what`/`how` without a bump is not detected.
- `--evidence note=...` satisfies `evidence_required`. The tool checks presence, not quality.
- The secret scan is regex-based. It cannot see revenue numbers or pasted private prose.
- Record text (`what`/`how`) paraphrases private sources closely. `publish` copies records by design, so review the bundle before it leaves the machine.
- `bun` must be on `PATH` when git runs the merge driver. `install-merge-driver` writes to the git config that all linked worktrees share. It was not run in this repository.
- HTML: state filters are single-select; the local page is 2.5 MB; light mode and narrow layout were not inspected.
- Root `bun.lock` (bootstrap artifact from `bun install --ignore-scripts`) was removed and not committed; the root stays npm-managed. `kb-site/bun.lock` is committed.

## 7. Owner decisions (answered 2026-09-21)

1. **Answered: one git repo for now (this one).** ~~**Where does the store live?**~~ It needs a private remote. Options: a new private repo for `kb-site/data` + `inventory` + `MIGRATION.md` + this report, or the private apps repo. Then: `git remote add`, `approve-remote <name> --i-verified-private`, set upstream, `sync`.
2. **Answered: yes.** Pushed with the store, per decision 1.
3. **Already public before this work:** `origin/main` holds `kb-site/external/rork-guide/GUIDE.md` (its `UPSTREAM.md` says "do not republish"), `kb-site/REJECTIONS.md`, and `kb-site/SHIPPING.md`. **Answered: they stay.**
4. **Acceptance mapping:** the seed set 137 non-wiki rules to `decided` and 2 to `verified`. **Answered: confirmed.**
5. **Answered: resolve them.** All 30 resolved from the sources on 2026-09-21 with a stated precedence rule each (`MIGRATION.md` section 9). 23 requirements moved `candidate` -> `decided`; 4 got revision 2; 0 stale records. Acceptance now: decided 203, candidate 20, verified 2, retired 1.
6. **Answered: solo for now.** `sync` stays unapproved for `origin`; plain `git push` is the workflow. Approve a remote only when a collaborator appears.

## 8. Delivery links

- PR: https://github.com/Necmttn/skills/pull/102
- Branch: `feat/app-knowledge-tracking` on https://github.com/Necmttn/skills
