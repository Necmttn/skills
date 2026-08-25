# LLM Wiki — Reconciled Design Spec

Date: 2026-08-25
Status: approved
Supersedes: the 2026-08-25 draft that proposed a new repo at ~/Projects/wiki
(retracted in place: the draft assumed no wiki existed; discovery showed a
live, hermes-maintained wiki already runs — building a second one would have
split the substrate the design exists to unify).

## Purpose

One persistent, agent-maintained wiki that grounds concepts Necmttn keeps
re-deriving across codebases (ax, hackable-platform, craftgen, skills repo,
B2C apps research). Knowledge compounds instead of being re-derived per
session. Pattern: Karpathy's LLM wiki (via ry's gist fork).

## What already exists (discovered 2026-08-25)

- **Substrate**: `~/wiki` -> symlink -> `~/Documents/Obsidian Vault/wiki/`.
  ~57 pages (concepts/entities/comparisons/queries), `SCHEMA.md` constitution,
  `index.md` catalog, append-only `log.md`, immutable `raw/`.
- **Writer 1 (life/content feed)**: hermes cron `wiki-daily-content-ingest`
  (23:45 nightly, gpt-5.5 via openai-codex, 127 ok runs). Feed: screenpipe
  journals, content crons, Obsidian publishing surfaces. Orientation protocol
  every run: read SCHEMA.md -> index.md -> log.md; edit; update index; append
  log; advance checkpoint (`~/.hermes/state/wiki-daily-content-ingest.json`).
- **Operating manual**: hermes skill `llm-wiki` v2.1.0 (WIKI_PATH, default
  `~/wiki`), replicated across hermes profiles.
- **Backup/remote**: launchd `com.necmttn.notes-vault-sync` (every 15 min)
  pushes the vault to private GitHub `Necmttn/notes`.

## Decisions

1. **One wiki, in place.** `~/wiki` is the canonical path for every tool.
   No new repo, no migration. GitHub privacy is already solved by `notes`.
2. **SCHEMA.md is the shared constitution.** All writers follow the same
   orientation protocol hermes uses (SCHEMA -> index -> log before writing;
   index + log + checkpoint after). Wikilinks, YAML frontmatter, tag
   taxonomy, lowercase-hyphen slugs — the incumbent conventions win over
   any convention proposed in the retracted draft (markdown links, etc.).
3. **Hermes keeps the life/content feed untouched.**
4. **Claude Code adds the coding feed** — the gap: concepts repeated across
   codebases never reach the wiki, and coding sessions cannot recall from it.
5. **No extraction model.** Quera lesson: per-chunk entity extraction
   without global context produced weak results. Curation with the full
   index in context replaces extraction. Automated passes only PROPOSE
   (briefs in `inbox/`); they never write pages directly.
6. **Slug = canonical concept name** is the dedup mechanism (Workbench
   entity-memory lesson). Slug/alias check against index.md is mandatory
   before page creation.

## New components (all in necmttn-skills repo)

### Skill: /wiki (recall)
Read-only. Input: concept or question. Read `~/wiki/index.md`, `rg` the
wiki, return relevant page content + wikilink neighbors. Usable from any
repo mid-session.

### Skill: /wiki-ingest (curate)
Input: a source (file, URL, research output, session pointer) or an
`inbox/` brief. Orientation protocol, then:
1. Capture a compact raw-source note under `~/wiki/raw/` (immutable).
2. Editorial pass: update pages first; create only past the recurring/
   central threshold, slug check first; claims carry provenance
   (raw path + ax session id where applicable).
3. Update `index.md`; append `log.md`; commit is handled by vault-sync.
Promoted inbox briefs are deleted in the same pass; rejected briefs are
deleted with the reason appended to `log.md`.

### Skill: /wiki-harvest (propose)
Input: time window (default: since checkpoint marker
`~/wiki/inbox/.harvest-checkpoint.json`; first run 7 days; cap 14).
1. Sweep coding sessions via `ax recall` / `ax sessions` for recurring
   concept discussion.
2. Diff candidates against index.md slugs + aliases.
3. Write briefs to `~/wiki/inbox/<date>-<slug>.md`: concept, why it
   recurs, session/turn pointers. NO page writes, NO index/log writes
   except its own checkpoint.
Cadence: scheduled every 2 days at 21:00 (clear of the 23:45 hermes run).

### SCHEMA.md addition (one section)
Document the second feed and the `inbox/` convention: briefs are
proposals, propose-only writers, promotion path via /wiki-ingest, and the
shared orientation protocol as a requirement for any writer.

## Concurrency between the two writers

- Time-separated schedules (21:00 vs 23:45) plus append-only `log.md`.
- Both writers advance independent checkpoints.
- vault-sync owns commits; skills never git-commit in the vault.

## Later phases (out of scope now)

- SessionStart hook injecting index.md summaries into coding sessions
  (approved direction, fast-follow after v1 proves recall value).
- ax `concept-candidates` derive stage + `ax harvest` command (promote
  the skill-only harvester once briefs prove signal). Serial-stage
  constraint applies.
- Per-prompt matched-content injection: explicitly not planned.
- Wiki lint/compact skill pass (orphans, dead wikilinks, stale claims).

## Success criteria

- A concept discussed in >=2 codebases has one page; `/wiki <concept>`
  returns it in one call from any repo.
- First scheduled harvest yields >=1 brief worth promoting.
- Zero pages written by any automated pass without a curation step.
- hermes nightly ingest continues unmodified and keeps passing.

## Resolved questions

1. GitHub: already private via `Necmttn/notes`. No new repo.
2. Auto-inject: invoke-only v1; SessionStart index injection fast-follow.
3. Cadence: every 2 days, 21:00.
