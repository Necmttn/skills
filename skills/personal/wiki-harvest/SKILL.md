---
name: wiki-harvest
description: Propose-only sweep of recent coding sessions (via the ax CLI) for recurring concepts that are missing from, or should update, the personal LLM wiki at ~/wiki. Writes candidate briefs to ~/wiki/inbox/ only - never wiki pages. Use on schedule or when the user asks "harvest the wiki" or "what concepts am I repeating".
---

# Wiki harvest

Finds concepts the user keeps re-deriving across codebases and proposes
them to the wiki. PROPOSE-ONLY: the quera lesson is that extraction
without global context produces weak knowledge, so this skill never
writes pages - a curator (/wiki-ingest) makes the editorial call.

## Window

1. Orient first: read `~/wiki/SCHEMA.md`, then `~/wiki/index.md`, then
   the last ~20 lines of `~/wiki/log.md` - the same protocol every
   wiki writer follows.
2. Read `~/wiki/inbox/.harvest-checkpoint.json`. If `last_harvested_at`
   exists, harvest from there to now. If missing: last 7 days. Cap any
   gap at 14 days and say so in the report.
3. Update the checkpoint ONLY after a successful run, writing BOTH
   `last_harvested_at` (ISO-8601 local) and `last_harvested_epoch`
   (`date +%s` integer - the scheduler guard depends on it).

## Procedure

1. Load the dedup baseline from the index you already read: every slug
   plus all frontmatter `aliases:` values (`rg -N "^aliases:" ~/wiki -g '!raw/**'`).
2. Sweep the window's coding activity with ax, multiple angles:
   - `ax sessions around <date>` for each active day - what was worked on
   - `ax recall "<candidate term>" --scope=all` to test recurrence of
     concepts you notice in session summaries
   - `ax skills usage` for heavily-used skill areas in the window
   Judge from the evidence: which concepts, patterns, or hard-won
   lessons appeared in MORE THAN ONE session or repo?
3. Drop candidates already covered by a slug or alias - unless the new
   evidence clearly extends or contradicts the page; then the brief
   proposes an UPDATE and names the page.
4. For each surviving candidate write `~/wiki/inbox/<yyyy-mm-dd>-<slug>.md`:

    ---
    title: <Concept Name>
    created: <yyyy-mm-dd>
    type: brief
    proposal: new-page | update:<existing-slug>
    ---
    ## Why it recurs
    <2-4 sentences: where it showed up, why it is durable>
    ## Evidence
    - <repo> - session <ax-session-id> - <one line>
    - <repo> - session <ax-session-id> - <one line>
    ## Suggested wikilinks
    - [[<related-existing-page>]]

5. Report: window covered, briefs written (paths), candidates dropped
   as already-covered. If nothing qualifies: write no briefs, still
   update the checkpoint, and say "no new candidates".

## Rules

- Write ONLY under `~/wiki/inbox/`. Never pages, never `index.md`,
  never `log.md`, never `raw/`.
- Never `git commit` in `~/wiki`.
- 3-7 briefs per run maximum - propose the strongest, not everything.
- The ax write-guard hook blocks the Write/Edit tools under `~/wiki`;
  write vault files via shell (`tee`/heredoc), or run with
  `ALLOW_MAIN_WRITE=1` in the session environment.
