# Plan: unified app knowledge + JSONL tracking

Status: approved by brief (`APP-KNOWLEDGE-BRIEF.md`). Corrections are retracted in place (strike + reason), never deleted.

## 1. Shape

One record store (`kb-site/data/*.jsonl`), one Effect v4 core (`kb-site/src/`), two views: CLI (`kb-site/cli.ts`) and HTML (`kb-site/build.ts` -> `dist/index.html`). Markdown stays for prose; records point at it through `sources`.

```
kb-site/
  package.json            own Bun package (effect 4.x, vitest). Root stays npm/changesets.
  kb.roots.example.json   content-root map (no absolute paths in records)
  data/
    sources.jsonl         where knowledge lives + license/access boundary
    requirements.jsonl    checks and guidelines, revisioned
    apps.jsonl            app registry
    conflicts.jsonl       unresolved source conflicts
    tracking/<app>.jsonl  per-app completion, one file per app (fewer merge conflicts)
  src/                    runtime-agnostic core (Context.Service + Layer)
  cli.ts                  thin entry: BunServices.layer + Command
  test/                   vitest + @effect/vitest
  inventory/              source inventory (raw input for seeding)
  docs/                   PLAN, REPORT, CONTRIBUTING, MIGRATION
```

## 2. Record contract (the seam between all builders)

All records: one JSON object per line, keys in the fixed order below, files sorted by primary key, `\n` terminated, UTF-8. IDs match `^[a-z0-9][a-z0-9.-]*$`.

### sources.jsonl - key `id`
`id`, `title`, `kind` (`playbook|skill|ledger|wiki|checklist|template|external|url`), `root` (`kb|skills|apps|wiki|home-skills|url`), `path` (root-relative, or full URL when root=`url`), `access` (`repo|private-repo|private-wiki|local-only|vendored|linked-only|public-url`), `license` (string|null), `publishable` (bool), `notes` (string, optional).

- `linked-only` and `private-wiki` sources are never copied by `publish`. `vendored` copies only when `license` permits (rork-guide: no license -> not publishable).
- **Added 2026-09-19:** one policy module, `src/access.ts`. `mayPublish(source)` = `publishable` AND root not in (`wiki`, `apps`, `home-skills`) AND access in (`repo`, `vendored`, `public-url`) AND (vendored => license). `publish`, `build.ts --public`, and `validate` all use it; `validate` reports `publishable: true` in a private root as an error. `containedRealPath(rootDir, file)` resolves real paths and fails when a symlink or `..` leaves the root; `Roots.resolve` (so `refs` and both HTML builds) and every file `publish` copies go through it.

### requirements.jsonl - key `id`
`id`, `kind` (`check|guideline`), `title`, `acceptance` (`candidate|decided|verified|retired`), `revision` (int >= 1), `revised_at` (date), `revision_note`, `phase` (`idea|setup|build|monetization|analytics|aso|submission|release|post-launch`), `cadence` (`once|every_release`; guidelines use `once`), `applies_to` (`{platforms?: string[], tags?: string[]}`; empty = all apps), `evidence_required` (bool), `owner_gate` (bool), `what`, `how`, `refs` (`[{source, locator?, upstream_id?, upstream_status?}]`), `supersedes` (id[], optional), `conflicts` (conflict id[], optional).

- `acceptance` is about the rule. It says nothing about any app.
- `revision` increments on a material change to `what`/`how`/`evidence_required`/`applies_to`. Current-state model: one line per requirement, Git holds older revisions.
- **Added 2026-09-19:** `revise <req>` is the safe rule edit (`Store.revise` -> `applyRevise` -> `Store.commit`: lock + validate). When the VALUE of a material field changes it adds exactly 1 to `revision`, sets `revised_at` (today) and `revision_note` (`--note`, mandatory then). `--title` and `--acceptance` do not bump; `--note` without a material change is refused; `--acceptance` prints the reminder that acceptance is the owner's call; a `retired` requirement accepts only `--acceptance`. The output counts the tracking records that BECAME stale (current before, stale after) and names the apps.
- `upstream_id`/`upstream_status` preserve wiki rule IDs and their wiki status verbatim.

### apps.jsonl - key `id`
`id`, `name`, `bundle_id` (nullable), `app_store_id` (nullable), `platforms`, `tags`, `root`+`path` (location of the app), `current_release` (`{version, build?}` | null), `notes`.

### tracking/<app>.jsonl - key `(requirement, release)`
`app`, `requirement`, `release` (`null` for cadence `once`; `"<version>"` or `"<version>(<build>)"` for `every_release`), `status` (`todo|in_progress|blocked|done|not_applicable`), `requirement_revision` (int; the revision this status was judged against), `owner` (nullable), `notes`, `evidence` (`[{kind: link|commit|build|command|screenshot|doc|note, ref, date, release?, note?}]`), `updated_at`, `updated_by`.

`updated_at` accepts a date or an ISO timestamp (`set` writes UTC to the second). **Corrected 2026-09-19:** date-only stamps (evidence `date`, `revised_at`) ~~use the UTC date~~ use the LOCAL calendar date. Why the first version failed: an edit made on 2026-09-19 local time (UTC+8, before 08:00) was stamped 2026-09-18. Mechanism: `src/today.ts` holds `Today`, a `Context.Reference` from epoch milliseconds to `YYYY-MM-DD` with a UTC default, so `src/` needs no runtime global; `runtime.ts` provides `dateInZone(DateTime.zoneMakeLocal())` for `cli.ts` and `build.ts`. `updated_at` stays a UTC timestamp. `release.build` is a string. Absent record = `todo`. No record is ever seeded as `done` without a dated source statement; seeded history carries `evidence.kind=doc` pointing at the source doc and its date.

### conflicts.jsonl - key `id`
`id`, `summary`, `sides` (`[{source, locator, claim}]`), `requirements` (id[]), `status` (`open|resolved`), `resolution` (nullable), `recorded_at`.

## 3. Derived state (what `checklist` and `compare` show)

Precedence (added 2026-09-18): `applies_to` exclusion, then `retired`, then the record status. `applies_to.platforms` and `.tags` each match on any listed value; when both are given, both must match.

For app A, check R, target release = `A.current_release` when R is `every_release`:

| Derived | Condition |
|---|---|
| `excluded` | R does not apply to A (`applies_to`), or status `not_applicable` (note required) |
| `retired` | R.acceptance = `retired` (hidden by default) |
| `blocked` | status `blocked` (note required) |
| `stale` | status `done` and `requirement_revision < R.revision` - evidence needs review |
| `unverified` | status `done`, `R.evidence_required`, ~~no evidence~~ no evidence that counts (only reachable via hand edits; `validate` reports it). **Corrected 2026-09-19:** for an `every_release` record, an evidence item whose `release` is set and differs from the record's `release` does not count. Why the first text failed: a record for `1.7.16` whose only evidence said `release: "1.0(171)"` validated and derived `complete`, which broke the rule in the `todo` row. Comparison is exact string equality: `1.0` and `1.0(171)` are different releases. Evidence without `release` counts; `once` records count everything. |
| `complete` | status `done`, same revision, evidence rule satisfied |
| `in_progress` | status `in_progress` |
| `todo` | no record for the target release. A `done` record for an OLDER release shows as `todo` with `last_done: <release>`; old evidence never counts for a new build |

## 4. Validation and transitions

Errors are values with file + line + id + plain-English message. `validate` reports all, exits 1.

- malformed JSON line; schema violation (field path named); duplicate key; unsorted file (warning, `fmt` fixes)
- dangling: requirement->source, requirement->conflict, tracking->requirement, tracking->app, tracking file name != `app`
- tracking on a `guideline` or `retired` requirement (retired: only `not_applicable` allowed)
- `done` + `evidence_required` without evidence (**Corrected 2026-09-19, second:** a STALE record is exempt from this error. Why: `revise --evidence-required true` made every older `done` record without evidence an error, so the store refused the revision itself. A stale record derives `stale`, never `complete`, and `set --ack-revision` applies the evidence rule when the record is re-confirmed. **2026-09-19:** evidence stamped with another release does not count; the error names that release; `set` applies the same rule and stamps new evidence with the record release); `blocked`/`not_applicable` without notes; `requirement_revision > R.revision`; `release` set on a `once` check or missing on `every_release`
- transitions (`set`): any -> `done` needs evidence when required; `done` -> anything else needs `--note` (reopen reason); ~~`set` always stamps current `R.revision`~~ **Corrected 2026-09-18:** `set` stamps the current revision, EXCEPT that a `set` which keeps `done` on a stale record is rejected without `--ack-revision`. Why the first text failed: an owner-only or note-only edit would have cleared staleness silently. `--ack-revision` re-confirms a stale item and demands a note or new evidence. **Corrected 2026-09-19:** "new" is judged AFTER de-duplication by `(kind, ref, date)`. Why the first version failed: the check ran before de-duplication, so passing evidence the record already held, with no note, cleared staleness.
- **Added 2026-09-18 (core builder):** a write is refused while the store has any validation error in any file; warnings do not block. Extra errors: dangling `supersedes` / conflict sides / conflict requirements; absolute path or `..` in a `path`; guideline with cadence other than `once`; `resolved` conflict without `resolution`; unknown key; blank line. Extra warnings: tracking record on a check that does not apply to the app; non-canonical key order or spacing (`fmt` fixes).

~~Writes: decode whole store -> apply -> validate -> encode deterministically -> write temp file -> rename. Refuse to write if the file changed on disk since read (hash check).~~ **Corrected 2026-09-19:** Writes: decode whole store -> apply -> validate -> encode deterministically -> take the store lock (`data/.kb.lock`, exclusive create, holds time + `$KB_USER`, released in a finalizer) -> re-hash EVERY loaded file and every target -> write ALL temp files (exclusive create) -> rename all -> release. A held lock fails with `StoreLocked` ("another kb write is in progress (lock file ...)"); a lock older than 60 s is broken (by rename, so one breaker wins) with a printed warning. Any failure before the first rename writes nothing; a failure after one names the files written and not written (`PartialWrite`). Why the first version failed: the hash check ran per file BEFORE temp creation and rename, so a second writer between check and rename was silently overwritten, and a two-file commit wrote file 1, then failed on file 2 with a message that said nothing was written. Limit: the lock stops other `kb` writers; an editor that saves between the re-hash and the rename is still not seen (a window of milliseconds).

## 5. CLI (`bun kb-site/cli.ts <cmd>`, every read cmd takes `--json`)

`apps` | `checks [--phase --cadence --acceptance --kind]` | `checklist <app> [--release --state]` | `show <req> [--app]` (what, how, refs, per-app state) | `compare <app> <app>...` | `refs [<req>]` (resolved location + access + availability) | `conflicts` | `set <app> <req> [--status --owner --note --evidence kind=ref ... --release --ack-revision]` | `validate` | `fmt` | `sync` | `merge-driver %O %A %B %P` | `install-merge-driver` | `publish --out <dir>` | `set-release <app> <version> [--build n]` (added 2026-09-18)

**Added 2026-09-19:**
- `checklist` filters `--phase` (repeatable), `--cadence`, `--owner-gate`, `--acceptance` (shows every state, `retired` included). `counts` covers the checks that pass these filters (before `--state`); the counts line says so (`filtered: ...; counts cover N of M checks, K shown`); JSON has `filters`, `matched`, `total`.
- `compare` gets `--diff` (only rows where the apps' derived states differ), `--phase` (repeatable), `--cadence`. The per-app count table stays; it covers the `--phase`/`--cadence` set and `--diff` does not reduce it.
- `revise <req> [--what --how --evidence-required true|false --platform... --tag... --all-apps] --note | [--title --acceptance]` (section 2).
- `approve-remote <remote-name-or-url> --i-verified-private` (section 6).
- Global `--roots <file>` (section 7).
- When `--by`/`KB_USER` resolves to `unknown`, `set`, `set-release`, and `revise` still work and print one stderr line `warning: no author name; pass --by <name> or set KB_USER`; with `--json` the text is in a `warnings` array. `apps.jsonl` and `requirements.jsonl` have no author field, so for `set-release` and `revise` `--by` only silences the warning.
- A missing DEFAULT data dir gives one line that names `--data` and `--roots` (the code may live in a public repository and the store in a private one). Tests that need the real `data/` are skipped when it is absent; the pipe test builds its own fixture store.

## 6. Collaboration (git-backed, first approach)

- `.gitattributes`: `kb-site/data/**/*.jsonl merge=kbjsonl`. `install-merge-driver` writes the local git config (git never ships driver config in a clone).
- `merge-driver`: record-level 3-way merge by primary key. Different records -> union. Same record, different fields -> field merge. ~~`evidence` -> union by `(kind, ref, date)`.~~ **Corrected 2026-09-19:** in a tracking record `status` + `requirement_revision` + `release` + `evidence` are one atomic group: changed on one side -> that side's whole group; changed on both sides and not identical -> when `status` and `requirement_revision` are equal, `evidence` unions by `(kind, ref, date)`, otherwise a conflict on the group. ~~`requirement_revision` takes the higher value~~ (this was in the code, not in this text) is gone. Why the first version failed: a field merge combined side A's `done` + evidence judged at revision 1 with side B's `requirement_revision: 2` and fabricated a current, complete record. Also: a read error on %O/%A/%B is exit 2 with "ours" untouched (only a MISSING base path reads as empty; git passes an empty temp file for an add/add). Why: every read error became empty text, so an unreadable "ours" was merged as empty, written, and exit 0. Same field, different values -> conflict: exit 1, file gets a readable conflict block naming record + field + both values; `validate` refuses the file until fixed. Requirement edited on both sides with same `revision` number but different text -> conflict.
- `sync`: require clean `data/`, `git fetch`, `git pull --rebase`, `validate`, `git push`. Any failure stops with the state named. No remote configured -> says so, exit non-zero. Tested against local bare repos.
- **Added 2026-09-19 (approved-remote guard):** the `origin` of this repository is `git@github.com:Necmttn/skills.git`, a PUBLIC repository, and the store holds private paraphrased material. So `sync` refuses, in every mode (`--dry-run` included) and BEFORE any commit, fetch, or push, unless every fetch and push URL of the resolved remote (`git remote get-url [--push] --all`, so after `insteadOf`) equals a value in the LOCAL git config key `kb.approvedRemote` (multi-valued). State `remote-not-approved`; the message names the URL, says that kb cannot verify visibility by itself, and prints the exact `approve-remote` command. `approve-remote <remote-name-or-url> --i-verified-private` stores the exact URL(s); without the flag it explains why and exits 1. A changed URL needs a new approval. ~~The no-remote and no-upstream hints suggested `git push -u origin <branch>`~~ Retracted: that hint made a push of the store to the public `origin` one paste away. The hints now say: pick a private remote, add it, approve it, set the upstream (`git config branch.<b>.remote/merge`); `sync` does the first push itself, after the guard and `validate`. Git access stays behind the `Git` service.
- Without the driver, git's line merge still works for most cases (one record per line, sorted, per-app files); `validate` catches damage.
- **Corrected 2026-09-19 (bundle docs):** `publish` now copies `docs/PLAN.md` too and generates the bundle's OWN `README.md` (what the bundle is, `bun install`, `bun cli.ts --help`, `bun build.ts`, the manifest, what was excluded and why, "handle as private"). The repository `README.md` (source `kb.readme`) is listed under `excluded` and not copied. Why: it was copied to `content/kb/README.md` with links to `docs/PLAN.md` and `docs/MIGRATION.md`, which were not in the bundle. A test resolves every relative link of the bundle README inside the bundle. `docs/MIGRATION.md` and `inventory/` stay out: they describe private sources.
- `publish --out`: copies `data/`, docs, CLI, and only `publishable` source text; writes `MANIFEST.json` listing included/excluded sources with reason; regex secret scan fails the command. Roots (`wiki`, `apps`, `home-skills`) are never copied wholesale.
- **Corrected 2026-09-19 (publish):** (a) every copied file and directory entry, companion `LICENSE`/`NOTICE`/`UPSTREAM` files included, passes `containedRealPath`; an escaping symlink is skipped and listed under `warnings`. Why: only the source file itself was checked, so companion, tool, and data copies followed symlinks out of the permitted directory. (b) The scanner no longer returns no findings for text with a NUL byte: NULs are dropped for matching, the file is scanned anyway and gets the warning `unscannable-binary`. Why: one NUL byte hid every secret in a file (two tool files held raw NULs and were never scanned; they now use `\u0000`). (c) The bundle gets its own `kb.roots.json` (`kb` -> `content/kb`, `skills` -> `content/skills`) and a `.gitignore` without the `kb.roots.json` line. Why: text sat under `content/<root>/` while records said `root: "kb"`, so `refs` and `build.ts` in a bundle found no copied source.
- Remote choice is an owner decision. Nothing is pushed or created by this work.

## 7. Content roots

Records hold `root` + relative `path`. `kb.roots.json` (gitignored) or env `KB_ROOT_<NAME>` maps roots to local dirs; ~~`kb` and `skills` resolve from the repo itself~~ **Corrected 2026-09-19:** `kb` and `skills` resolve from the repo itself only when unmapped; the roots file or env may override ANY root, and a relative value resolves against the roots file's directory. Why: a bundle keeps source text under `content/`, so it must remap `kb` and `skills` (the code allowed the override; the plan and `publish` did not use it). A resolved path must also stay inside its root after symlinks are resolved. **Added 2026-09-19:** the roots file is looked up next to the data dir's parent, so `--data /tmp/copy/data` lost the private-root map. The global flag `--roots <file>` (then env `KB_ROOTS_FILE`, then the default place) names the file; relative values resolve against that file's directory; `build.ts` takes `--roots` too; the "unavailable here" reason names both. Unmapped root -> `refs` shows `unavailable here (private root "apps")`, HTML shows the citation without text. No absolute path in any record.

## 8. Builders (file ownership, concurrent)

| Builder | Owns | Depends on |
|---|---|---|
| A core | `package.json`, `src/**`, `cli.ts`, `test/**` except sync/html, `vitest.config.ts` | this plan, Effect cheat-sheet |
| B seed | `data/**`, `docs/MIGRATION.md`, `inventory/RECONCILIATION.md` | this plan, inventories |
| C sync | `src/sync/**`, `test/sync/**`, `.gitattributes`, `docs/CONTRIBUTING.md`, `src/publish/**` | A's store API |
| D html | `build.ts`, `src/html/**`, `test/html/**`, `README.md` | A's store API |

A lands first (store + schema + validate), then C and D run concurrently with B finishing. Orchestrator integrates, runs real CLI workflows, then sends the whole thing to an adversarial reviewer (second model) and fixes findings.

## 9. Out of scope

No server, no DB, no hosting, no push, ~~no public repo~~ (**Corrected 2026-09-19:** this repository's `origin` IS a public repo; the rule is: the store never goes there), no apps-repo edits, no wiki edits. DuckDB is not needed: the store is small and already structured; add it when analytical queries appear.

## Unresolved questions (owner)

1. Which private remote hosts the shared data (~~this repo,~~ a new private repo, or the apps repo)? **Corrected 2026-09-19:** "this repo" is retracted as an option. Its `origin` is `git@github.com:Necmttn/skills.git`, which is PUBLIC, and the store (`data/`, `inventory/`, `docs/MIGRATION.md`, tracking notes, conflict records) paraphrases private wiki and apps-repo rules closely and cites them by id. Why the inference failed: the option was written from "the code lives here", without a check of the remote's visibility. Nothing from this work has been pushed. Follow-up question: does the tool CODE stay in this public repo while `data/` moves out (the code and tests now work without `data/`), and how is `data/` kept out of commits on this branch until then?
2. Who are the trusted contributors, and do they get the apps repo (private playbooks) or only the published bundle?
