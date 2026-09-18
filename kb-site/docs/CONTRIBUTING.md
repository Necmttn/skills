# Contributing to the app knowledge store

For a trusted collaborator who starts with no context. Read this once; keep the command list at the end.

## Status of online hosting

**Nothing from this work is online.** This work provisions NO remote, creates no repository, and pushes nothing. Nothing has been pushed.

**Corrected 2026-09-19.** An earlier text of this section treated "this repository" as a safe place for the store. That was wrong. The facts:

- The `origin` of this repository is `git@github.com:Necmttn/skills.git`, a **PUBLIC** GitHub repository. "Everyone with this repository" is the public.
- The store (`kb-site/data/`, `kb-site/inventory/`, `kb-site/docs/MIGRATION.md`, tracking notes, conflict records) holds **private paraphrased material**. It MUST live in a **private remote**. The owner has not chosen that remote yet.
- ~~Records hold no wiki text.~~ That statement was too strong. Records do not copy wiki prose, but they **paraphrase private wiki and apps-repository rules closely and cite them by id** (`upstream_id`). A close paraphrase of a private rule is private. That is why the store is private.
- Therefore: do not commit the store to a branch that goes to `origin`, and do not open a pull request that contains it, until the owner has decided where the store lives. The tool code can live in the public repository without the data; `cli.ts` and the tests work without `kb-site/data/` (tests that need the real store are skipped).
- The git collaboration path (`sync`, the merge driver) is tested against **local bare repositories only**, never against GitHub or any hosted service.
- `publish` builds a bundle directory on the local disk. It uploads nothing. A bundle contains `data/`, so a bundle is private too.
- Two decisions belong to the owner and are still open: **which private remote hosts the shared store**, and **who is on the contributor list** (and whether contributors also get the private apps repository or only a bundle).

### The approved-remote guard

`sync` cannot tell a private remote from a public one. So it refuses every remote that the owner did not approve by hand, in every mode, `--dry-run` included, **before** it commits, fetches, or pushes:

```
remote "origin" is not approved for this store: git@github.com:Necmttn/skills.git
the store holds private material; kb cannot verify by itself whether a remote is private or public
check the remote's visibility yourself. Only when it is private, run: bun kb-site/cli.ts approve-remote origin --i-verified-private
nothing was committed, fetched, or pushed
```

```sh
bun kb-site/cli.ts approve-remote <remote-name-or-url> --i-verified-private
```

- The flag is mandatory. Without it the command explains why (`the store holds private material; confirm the remote is private before approving`), approves nothing, and exits 1.
- A remote NAME is resolved to its URLs at that moment (fetch and push URLs, after `insteadOf` rewrites). The approval is the **exact URL**, stored in this clone's LOCAL git config under `kb.approvedRemote` (multi-valued). `git remote set-url` after an approval makes `sync` refuse again. A push URL that differs from the fetch URL needs its own approval.
- Git never copies local config into a clone: each contributor approves once per clone, after they checked the remote themselves.
- To withdraw every approval: `git config --local --unset-all kb.approvedRemote`.
- **Do not approve `origin` of this repository. It is public.**

With no remote at all `sync` says `no remote configured: ... this store is local only until the owner picks a remote`; with no upstream it lists each remote with its URL and `approved` / `NOT approved for this store`. Both print the same steps (pick a private remote, `git remote add`, `approve-remote`, set the upstream) and exit 1. No message suggests a `git push`: `sync` does the first push itself, after the guard and `validate`. That is the correct behaviour, not a bug.

## What the store is

`kb-site/data/` holds JSONL records: one JSON object per line, fixed key order, sorted by key.

| File | Holds | Key |
|---|---|---|
| `sources.jsonl` | where knowledge lives, plus its license and access boundary | `id` |
| `requirements.jsonl` | checks and guidelines, each with a `revision` | `id` |
| `apps.jsonl` | the app registry | `id` |
| `conflicts.jsonl` | places where two sources disagree and nobody has decided | `id` |
| `tracking/<app>.jsonl` | one app's completion state, one file per app | `(requirement, release)` |

Two ideas stay separate. **Acceptance** (`candidate`, `decided`, `verified`, `retired`) is about the rule. **Status** (`todo`, `in_progress`, `blocked`, `done`, `not_applicable`) is about one app. A rule can be `verified` and an app can still be `todo`.

The CLI (`bun kb-site/cli.ts`) and the HTML browser read the same records. Long prose stays in Markdown; records point at it through `sources`.

## Access model: what you can read

Records never carry an absolute path. A source has a `root` and a root-relative `path`. Each machine maps roots to local directories.

| Root | What it is | Who has it |
|---|---|---|
| `kb` | this `kb-site/` directory (playbooks, `external/`) | everyone with this repository. **Corrected 2026-09-19:** `origin` is public, so for every file that is pushed there this means the public |
| `skills` | `skills/` in this repository | the same: the public, for every pushed file |
| `url` | a web link | everyone |
| `apps` | the private apps repository (playbooks, per-app docs) | only people the owner gives that repository |
| `wiki` | the owner's personal wiki | **owner only**; never shared, never copied |
| `home-skills` | skills on the owner's machine | owner only |

~~With only this repository you can read every record~~ **Corrected 2026-09-19:** the records are NOT part of what the public repository may carry (see "Status of online hosting"). With the code AND the store (from the private remote, or from a bundle) you can read every record, every check's `what` and `how`, and the text of `kb`, `skills`, and `url` sources. For an `apps` or `wiki` source you see the citation (title, locator, upstream rule id) but not the text; `refs` prints `unavailable here (private root "apps"; ...)`.

To map a private root you were given, copy `kb-site/kb.roots.example.json` to `kb-site/kb.roots.json` (gitignored) and set your own directory, or set `KB_ROOT_APPS=/your/path`. Never commit `kb.roots.json`. Never put a machine path in a record.

```sh
bun kb-site/cli.ts refs submission.privacy-manifest     # location, access, and availability on THIS machine
```

The roots file is looked up next to the data dir's parent. With `--data <dir>` on a copy elsewhere (`--data /tmp/copy/data`) that lookup finds nothing and every private root becomes `unavailable here`. Name the file with the global flag `--roots <file>` (or env `KB_ROOTS_FILE`); a relative value inside the file resolves against the file's own directory. `build.ts` takes `--roots` too.

```sh
bun kb-site/cli.ts --data /tmp/copy/data --roots kb-site/kb.roots.json refs submission.privacy-manifest
```

## Setup

```sh
cd kb-site && bun install
cd .. && bun kb-site/cli.ts install-merge-driver
export KB_USER="your-name"                 # stamped into updated_by
bun kb-site/cli.ts validate
```

Without `KB_USER` and without `--by`, `set`, `set-release`, and `revise` still work, stamp `unknown`, and print one line on stderr: `warning: no author name; pass --by <name> or set KB_USER` (with `--json` the text is in a `warnings` array instead). `requirements.jsonl` and `apps.jsonl` have no author field; for `set-release` and `revise` the name only silences the warning, and `git log` holds the author.

If `kb-site/data/` is not there (the code can live in a public repository, the store in a private one), `cli.ts` and `build.ts` say so in one line and name `--data <dir>` and `--roots <file>`.

`install-merge-driver` writes two keys into this clone's **local** git config (`merge.kbjsonl.name`, `merge.kbjsonl.driver = bun kb-site/cli.ts merge-driver %O %A %B %P`). Git never copies that config into a clone, so every contributor runs it once per clone. It is safe to run again. The repository's `.gitattributes` routes `kb-site/data/**/*.jsonl` to the driver. Without the driver, git falls back to its line merge; `validate` still catches damage, but you get more conflicts.

## Propose a requirement

There is no `add` command. Edit `kb-site/data/requirements.jsonl` and add one line. Start from a similar record.

- `id`: lowercase, `phase.topic` style (`^[a-z0-9][a-z0-9.-]*$`). An id is permanent; never reuse one.
- `acceptance`: **`candidate`**. Only the owner moves a rule to `decided` or `verified`.
- `revision`: `1`. `revised_at`: today. `revision_note`: why the rule exists.
- `what`: the outcome to reach. `how`: the steps. Write them for a person who has not seen the source.
- `refs`: at least one `{ "source": "<source id>", "locator": "#heading or line" }`. If the source is new, add it to `sources.jsonl` first, with an honest `access`, `license`, and `publishable`.
- `cadence`: `once`, or `every_release` when the check must be redone for each build.
- If your rule disagrees with an existing one, do not pick a winner. Add a record to `conflicts.jsonl` and list its id in `conflicts` on both requirements.

Then run `fmt` and `validate`.

## Improve instructions, and when to bump `revision`

Use `revise`. It goes through the same lock and validation as `set`, and it cannot forget a field:

```sh
bun kb-site/cli.ts revise submission.privacy-manifest \
  --how "Run the manifest check on the archive, not on the source tree." \
  --note "the source tree check missed SDK manifests"
bun kb-site/cli.ts revise submission.privacy-manifest --title "Privacy manifest is complete"      # no bump
```

- MATERIAL flags: `--what`, `--how`, `--evidence-required true|false`, `--platform <p>` / `--tag <t>` (repeatable; together they replace `applies_to`), `--all-apps` (clears `applies_to`). When a value really changes, `revise` adds exactly 1 to `revision`, sets `revised_at` to today (the local calendar date), and sets `revision_note` from `--note`. `--note` is mandatory then. A value equal to the current one is not a change.
- NOT material: `--title`, `--acceptance`. No bump. `--note` without a material change is refused (it would overwrite the revision note). `--acceptance` is allowed but prints a reminder: acceptance is the owner's call.
- The output says how many tracking records across all apps became stale, and in which apps. `--json` gives `bumped`, `material`, `became_stale`, `stale_records`.
- A `retired` requirement accepts only `--acceptance`.
- A record that is already stale is exempt from the "done needs evidence" validation error until it is re-confirmed; so `--evidence-required true` does not make the store invalid. `--ack-revision` applies the evidence rule.

Bump `revision` (add 1, set `revised_at`, write `revision_note`) when you change the **meaning** of `what`, `how`, `evidence_required`, or `applies_to`: a new step, a stricter threshold, a wider audience.

Do **not** bump it for a typo, clearer wording with the same meaning, a new `ref`, or a `title` change.

Why this matters: every tracking record stores the `requirement_revision` it was judged against. After a bump, each app that was `done` at the older revision shows as **`stale`**: its evidence needs review. Nobody's `done` is deleted, but every app owner gets work. An owner clears it with `set <app> <req> --ack-revision` plus a note or new evidence. So bump when the old evidence may no longer prove the rule, and only then.

If two people revise the same requirement at the same time, the merge driver reports a conflict even when they edited different fields. That is deliberate: two "revision 2" texts must be merged by a person.

## Update an app's status with evidence

```sh
bun kb-site/cli.ts checklist lockin-chinese
bun kb-site/cli.ts checklist lockin-chinese --phase submission --phase release --state todo
bun kb-site/cli.ts checklist lockin-chinese --cadence every_release --owner-gate
bun kb-site/cli.ts compare lockin-chinese lockin-japanese --diff --phase submission
bun kb-site/cli.ts show submission.privacy-manifest --app lockin-chinese        # what, how, references, current state
bun kb-site/cli.ts set lockin-chinese submission.privacy-manifest --status in_progress --owner your-name
bun kb-site/cli.ts set lockin-chinese submission.privacy-manifest --status done \
  --evidence command="plutil -lint PrivacyInfo.xcprivacy" --evidence-note "OK on the 1.7.16 archive"
```

- `checklist` filters: `--phase` (repeatable), `--cadence`, `--owner-gate` (only owner-gated checks), `--acceptance` (shows every state, `retired` included), `--state` (repeatable). With a filter the counts line covers the filtered checks and says so: `... (filtered: phase=submission,release; state=todo; counts cover 61 of 210 checks, 40 shown)`. `--json` has `filters`, `matched`, `total`.
- `compare` filters: `--phase` (repeatable), `--cadence`, and `--diff` (only rows where the apps' derived states differ). The per-app count table stays and covers the `--phase` / `--cadence` set; `--diff` does not reduce it.
- Date-only stamps (evidence `date`, `revised_at`) are the **local calendar date** of the machine that runs the command. `updated_at` is a UTC timestamp.

- `done` on a check with `evidence_required` needs evidence: `kind=ref`, kinds `link`, `commit`, `build`, `command`, `screenshot`, `doc`, `note`.
- `blocked` and `not_applicable` need `--note`. Reopening a `done` item needs `--note` (the reason).
- `every_release` checks are tracked per release. Evidence for build 41 never counts for build 42. `set` stamps new evidence with the record's release. An evidence item whose `release` differs from the record's `release` does **not** count: a `done` record needs at least one item with no `release` or the same `release`, or `validate` reports an error that names the release the evidence belongs to (and the item derives `unverified`). The comparison is exact text: `1.0` and `1.0(171)` are different releases.
- `--ack-revision` needs a non-empty `--note` or at least one evidence item the record does not hold yet. Evidence that is already on the record is dropped first and proves nothing new.
- One writer at a time. A write takes the lock file `kb-site/data/.kb.lock` (gitignored; it holds the time and `$KB_USER`). If another `kb` command is writing you get `another kb write is in progress (lock file ...)` and nothing is written: run the command again. A lock older than 60 s belongs to a run that died; the next write breaks it and prints a warning. Under the lock every store file is hashed again, all temp files are written, then all are renamed, so a multi-file write fails before it writes anything. If a rename fails after an earlier one succeeded, the error lists which files were and were not written.
- Never mark something `done` because it was probably done. No evidence, no `done`.

## `validate` and `fmt`

```sh
bun kb-site/cli.ts fmt        # canonical form: key order, sorted, one record per line
bun kb-site/cli.ts validate   # every file and every rule; exit 1 on any error
```

Each problem names the file, the line, the record id, and what to do. Run both before every commit. `sync` runs `validate` too and refuses to push an invalid store.

## The sync flow

`sync` works when the owner has named a PRIVATE remote, you approved it in this clone (`approve-remote`), and your branch tracks it. Until then see "Status of online hosting".

```sh
bun kb-site/cli.ts approve-remote <name> --i-verified-private   # once per clone, after YOU checked that the remote is private
bun kb-site/cli.ts sync --dry-run                      # fetch, show ahead/behind and the plan; changes nothing
bun kb-site/cli.ts sync --commit -m "lockin: privacy check done"
```

What it does, in order, stopping with the state named at the first problem:

1. Finds the repository and the branch's upstream (`--remote` / `--branch` override it). No remote: exit 1, "local only".
   Then the approved-remote guard: every fetch and push URL of the remote must be in `kb.approvedRemote`. If not: exit 1, state `remote-not-approved`, nothing committed, fetched, or pushed.
2. Refuses a data dir with uncommitted changes. With `--commit -m <msg>` it validates, then commits **only** paths under `kb-site/data/`.
3. `git fetch`.
4. `git rebase --merge` onto the remote branch (this is what `git pull --rebase` does after a fetch). The merge driver merges records: different records union, different fields of one record merge. In a tracking record `status`, `requirement_revision`, `release`, and `evidence` are ONE group: changed on one side, that side's whole group is taken; changed on both sides with the same `status` and `requirement_revision`, the `evidence` lists union; anything else is a conflict on the group (a `done` judged at revision 1 is never combined with the other side's revision 2).
5. On a conflict it stops. It never picks a side.
6. Runs `validate`. An invalid result is not pushed.
7. `git push`. If someone pushed meanwhile: "remote moved, run sync again".

`--no-push` stops after step 6. `--json` prints the outcome as JSON. `sync` never force-pushes, resets, stashes, or edits files itself. If tracked files outside the data dir are modified and a rebase is needed, it stops and asks you to commit or stash them yourself.

### Resolve a conflict block, step by step

A conflict looks like this in the file. The record line comes first, then one block per undecided field:

```
{"app":"lockin-chinese","requirement":"submission.privacy-manifest","release":"1.7.16","status":"done",...}
<<<<<<< kb-conflict record "submission.privacy-manifest@1.7.16" field "status+requirement_revision+release+evidence"
ours: {"status":"done","requirement_revision":1,"release":"1.7.16","evidence":[...]}
=======
theirs: {"status":"blocked","requirement_revision":1,"release":"1.7.16","evidence":[]}
>>>>>>> kb-conflict
```

A block for `status+requirement_revision+release+evidence` holds the whole judgement of each side. Take ONE side's four values together (add evidence from the other side only when it supports the status you keep). Other fields (`owner`, `notes`, ...) get their own one-field block.

**Which side is which:** `sync` rebases your commits onto the remote. During a rebase git calls the **remote** version "ours" and **your local change** "theirs". (In a plain `git merge` it is the reverse.) The driver makes the same decisions either way; only the labels swap. The record line holds the "ours" value as a placeholder; every field that did not conflict is already merged in it.

1. Open each file that `sync` listed.
2. For each block, decide the value. Put it into the field of the record line above the block. Talk to the other person if you are not sure; both names are in `updated_by` and `git log`.
3. Delete the block: every line from `<<<<<<< kb-conflict` to `>>>>>>> kb-conflict`.
4. For field `(record)`: one side deleted the record and the other changed it. Keep the record line, or delete it; then delete the block.
5. `bun kb-site/cli.ts fmt && bun kb-site/cli.ts validate`. `validate` reports `ConflictMarker` until every block is gone.
6. `git add <the files>`
7. `git -c core.editor=true rebase --continue`
8. `bun kb-site/cli.ts sync` again.

To give up and return to your commits as they were: `git rebase --abort`. Nothing was pushed.

If the driver says it "cannot read" a version, it merged nothing, left your file untouched, and exited 2; an unreadable file is never treated as empty. If the driver says an input "does not parse", one version of the file was already broken. The driver then leaves your file untouched and merges nothing. Fix the broken version (`validate` shows the line), then run the merge again.

## Licensing boundaries for `external/`

`kb-site/external/` holds third-party material. Each pack has an `UPSTREAM.md` with its origin and license.

- A source with `access: "linked-only"` **stays linked-only**. Cite the URL and a locator. Never paste its text into a record, a playbook, or a commit.
- `vendored` with `license: null` (for example `rork-guide`) is on disk for reading only. It is never redistributed; `publish` refuses to copy it whatever `publishable` says.
- `vendored` with a license (MIT packs) may be copied, together with its license file. `publish` copies the pack's `LICENSE` and `UPSTREAM.md` next to the text.
- **Never paste unlicensed text.** Write the requirement in your own words and point at the source with `refs`. A short quotation with attribution is the limit.
- When you add a source, set `access`, `license`, and `publishable` honestly. When in doubt: `publishable: false`.

## What must never be committed

- Secrets: API keys, tokens, `.env` contents, private keys, `Authorization` headers, passwords.
- App Review **reviewer credentials** (demo account logins). Record that they exist and where the owner keeps them, never the values.
- **Revenue numbers**, MRR, conversion rates, ad spend, or any private business metric. Evidence may say "dashboard checked on 2026-09-10", not the figure.
- **Private wiki text.** Records keep the wiki rule id and status (`upstream_id`, `upstream_status`), not the prose. **Corrected 2026-09-19:** this does not make a record public material. `what` and `how` paraphrase the rule closely; the store stays in a private remote.
- **The store in a public place.** `kb-site/data/`, `kb-site/inventory/`, `kb-site/docs/MIGRATION.md`, and bundles never go to `origin` of this repository (public) or to any remote you did not check yourself.
- Text from the private apps repository beyond a short citation.
- Personal data: private e-mail addresses, phone numbers, customer names.
- Machine paths (`/Users/<you>/...`) and `kb.roots.json`.

`publish` scans every bundled file, including the JSONL records, for key patterns, e-mail addresses, and home paths. That scan is a last net, not permission to be careless: it cannot recognise a revenue number or a pasted paragraph.

## Preparing a bundle (owner)

```sh
bun kb-site/cli.ts publish --out /tmp/kb-bundle      # a directory OUTSIDE the repository, empty
```

The bundle holds `data/`, the tool (`src/`, `cli.ts`, package files), this document, `docs/PLAN.md`, its OWN generated `README.md` (what the bundle is, `bun install`, `bun cli.ts --help`, `bun build.ts`, where the manifest is, what was excluded and why; every link in it resolves inside the bundle), and under `content/<root>/<path>` the text of sources that are `publishable` **and** `repo` or licensed `vendored`. Roots `wiki`, `apps`, and `home-skills` are never copied, whatever a record says; `validate` already reports such a record (`publishable: true` in a private root) as an error, so no bundle is started. The same policy (`src/access.ts`, `mayPublish`) decides what `build.ts --public` renders. Every copied file and directory (data, tool, source text, `LICENSE`/`NOTICE`/`UPSTREAM` companions) is resolved to its real path first: a symlink that leaves its permitted directory is skipped and listed under `warnings`. The same containment applies to `refs` and to the local HTML build: a record `path` never reads outside its root.

The bundle is self-contained. `publish` writes `kb.roots.json` into it (`kb` -> `content/kb`, `skills` -> `content/skills`; relative values resolve against that file's directory), so `bun cli.ts refs` and `bun build.ts` inside the bundle find the copied text. In the repository `kb.roots.json` is machine-specific and gitignored, and it is never copied; in the bundle it is content, so the bundle's own `.gitignore` does not list it. A file with NUL bytes is scanned anyway (NULs are ignored for matching) and listed as the warning `unscannable-binary`. `MANIFEST.json` lists every file with its sha256, every excluded source with the reason, and every scan finding (file, line, pattern name; never the value). A secret finding leaves the bundle in place, sets `"ok": false`, and exits 1. `--force` replaces a previous bundle only (a directory that holds a `MANIFEST.json`).

Not in a bundle: `docs/MIGRATION.md` and `inventory/` (they describe how private sources were read), `test/`, and the repository `README.md` (source `kb.readme` is listed under `excluded`; its links point outside the bundle, so the generated README replaces it). A bundle holds `data/`: treat it as private, like the store.

Review `MANIFEST.json` before the bundle leaves the machine. Where it goes is the owner's decision. The repository's `.gitattributes` line names `kb-site/data/`; a repository made from a bundle keeps its records in `data/` and needs the line `data/**/*.jsonl merge=kbjsonl`.

## Command list

```sh
bun kb-site/cli.ts [--data <dir>] [--roots <file>] <command>
bun kb-site/cli.ts apps | checks | show <req> [--app <app>] | refs [<req>] | conflicts
bun kb-site/cli.ts checklist <app> [--release <r>] [--state <s>]... [--phase <p>]... [--cadence <c>] [--owner-gate] [--acceptance <a>]
bun kb-site/cli.ts compare <app> <app>... [--diff] [--phase <p>]... [--cadence <c>]
bun kb-site/cli.ts set <app> <req> --status ... --evidence kind=ref --note ... [--by <name>]
bun kb-site/cli.ts set-release <app> <version> [--build <n>]
bun kb-site/cli.ts revise <req> [--what|--how <text>] [--evidence-required true|false] [--platform <p>]... [--tag <t>]... [--all-apps] --note <why> | [--title <text>] [--acceptance <a>]
bun kb-site/cli.ts fmt && bun kb-site/cli.ts validate
bun kb-site/cli.ts install-merge-driver
bun kb-site/cli.ts approve-remote <remote-name-or-url> --i-verified-private
bun kb-site/cli.ts sync [--dry-run] [--commit -m <msg>] [--no-push] [--remote <r>] [--branch <b>] [--json]
bun kb-site/cli.ts publish --out <dir> [--force] [--json]
```

Every read command takes `--json`.
