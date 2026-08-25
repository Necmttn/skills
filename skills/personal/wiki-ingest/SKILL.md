---
name: wiki-ingest
description: Curate a source into the personal LLM wiki at ~/wiki following its SCHEMA.md - a file, URL, research output, ax session, or a pending ~/wiki/inbox/ brief. Use when the user says "add this to the wiki", "ingest this", "promote the inbox", or after research worth keeping long-term.
---

# Wiki ingest

The ONLY writer of wiki pages on the Claude Code side. Curation with
the full index in context - never mechanical extraction.

## Orientation (mandatory, every run)

1. Read `~/wiki/SCHEMA.md` - the constitution. Its conventions win
   over anything in this skill if they conflict.
2. Read `~/wiki/index.md` - full page catalog.
3. Read the last ~40 lines of `~/wiki/log.md`.

## Procedure

1. **Capture raw.** Write a compact source note under the right
   `~/wiki/raw/` subdir (`articles|papers|transcripts`), named
   `<yyyy-mm-dd>-<slug>.md`: where the material came from, the files/
   sessions used, and the durable claims found. Summarize; do not dump.
   Raw files are immutable after this.
2. **Editorial pass.** Prefer updating existing pages. Create a page
   only when the concept recurs across sources or is central, AND no
   existing slug or `aliases:` entry covers it (check both - this is
   the dedup gate). Every substantive claim carries provenance: the
   raw path and, for coding material, the ax session id.
3. **Conventions.** YAML frontmatter per SCHEMA.md, lowercase-hyphen
   names, >=2 `[[wikilinks]]` per page, bump `updated` on edits.
4. **Index + log.** Add new pages to `index.md` under the right
   section; append one `log.md` entry: date, action, window/source,
   created, updated, notes.
5. **Inbox promotion.** For `/wiki-ingest inbox`: process every
   `~/wiki/inbox/*.md` brief - promote (do steps 1-4 using the brief's
   session pointers as the source trail) or reject. Delete the brief
   either way; rejected briefs get their reason in the `log.md` entry.

## Rules

- NEVER `git commit` in `~/wiki` - vault-sync owns commits.
- Never edit files under `raw/` after capture.
- Never touch hermes state (`~/.hermes/**`).
- When new material contradicts a page, follow SCHEMA.md's update
  policy: keep both positions with dates, mark the contradiction.
- The ax write-guard hook blocks the Write/Edit tools under `~/wiki`;
  write vault files via shell (`tee`/heredoc), or run with
  `ALLOW_MAIN_WRITE=1` in the session environment.
