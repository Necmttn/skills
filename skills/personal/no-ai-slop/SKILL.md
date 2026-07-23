---
name: no-ai-slop
description: Strip AI-slop patterns from a draft while preserving the writer's voice, or detect slop without rewriting. Use as the mandatory final pass on any copy before shipping, when the user wants a draft clearer/less AI-sounding, or when asked "is this AI slop?", "audit this writing", "does this read as AI".
---

# No AI slop

Sharp human editor. Preserve the point and the personal voice. Remove AI patterns without
sanding distinctive writing into generic polished prose.

Adapted from petergyang/no-ai-slop (MIT, https://github.com/petergyang/no-ai-slop), merged
with the local tell bank at `~/.claude/agents/copy-wiki-examples.md`.

## Two jobs

**Edit (default).** Make the minimum effective edit with the rules below. Return the full
edited draft plus a short **What changed** section.

**Detect.** The user asks whether a piece is AI slop, or asks to audit/scan/flag without
rewriting. Name each pattern that appears, quote the offending line, give the fix in a few
words. Do not rewrite. Do not score the draft. Do not guess whether AI wrote it - detectors
guess, named patterns are evidence the user can check. Offer to edit after.

## Before editing

- No draft provided: ask for it.
- Audience or format unclear: ask one question - who is this for, where does it publish?
- Goal unclear: ask what the reader should think, feel, or do after reading.

## Editing principles

- **Preserve the writer's real voice.** First note the draft's vocabulary, cadence,
  bluntness, humor, uncertainty, digressions, level of polish. Keep the traits that feel
  personal. Do not make every paragraph equally tidy.
- **Minimum effective edit.** Fix slop, errors, repetition, unclear passages. Leave strong
  human sentences alone. Cutting must be proportional to the actual slop.
- **Lead with the point when the setup adds nothing.** Keep a personal aside, story, or
  admission when it creates context, tension, or character.
- **Front-load only when it improves clarity.** Do not force every section into the same
  point-detail-background shape.
- **Keep the user's meaning.** Never invent claims, examples, stats, quotes, or opinions.
  Unclear beats invented - ask.
- **Open it up, don't dumb it down.** Strip jargon, long sentences, abstract nouns, tangled
  structure. Keep substance, nuance, precision.
- **Active voice, human subjects.** "The team shipped it Tuesday", not "the decision emerged".
- **Be concrete.** "The integration cut deploy time from 40 minutes to 4" beats "improved
  efficiency". Protect the specific fact; never smooth a useful detail into generic importance.
- **Verbs do the work.** "decided" over "made a decision". "can" over "has the ability to".
- **Preserve edge.** Strong opinions, blunt language, humor, profanity, self-interruptions,
  honest admissions stay when they belong to the writer.
- **Keep structure unless it hurts the piece.** If you reorganize, say why in What changed.

## Words to cut

Banned: delve, foster, leverage, utilize, facilitate, empower, streamline, robust,
cutting-edge, paradigm shift, game changer, this is huge, this changes everything, tapestry,
realm, beacon, multifaceted, meticulous, intricate, paramount, transformative, elevate,
embark, supercharge, harness, ever-evolving, unlock, seamless, effortlessly.

Often-empty adverbs: just, literally, honestly, simply, actually, truly, fundamentally,
importantly, crucially, inherently, inevitably.

Often-empty phrases: it's worth noting, it's important to note, at the end of the day, when
it comes to, at its core, in today's world, in the age of, in the world of, the reality is,
the truth is, in terms of, with regard to, in order to, going forward, in this article,
let's dive in.

Adverbs and phrases are defaults, not absolutes. Keep one when it carries real emphasis,
uncertainty, contrast, or the writer's spoken rhythm.

## Patterns to cut

**Binary contrasts.** "This is not X. It's Y." / "The question isn't X, it's Y." / "not just
X but Y". State Y directly. "The question isn't the model. It's the eval." becomes "The eval
matters more than the model."

**Throat-clearing openers.** "Here's the thing", "Here's what I mean", "Let me be clear",
"I'll be honest", "The uncomfortable truth is". Cut, state the point.

**Faux-insight setups.** "What most people get wrong", "Here's what nobody tells you", "The
part everyone misses". These flatter the writer as lone expert. "The part everyone misses:
distribution is the real moat" becomes "Distribution is the moat."

**Colon reveals.** Noun phrase, colon, lowercase dramatic reveal: "The best part: it learns."
Rewrite as a plain sentence. Colons are for lists, labels, quotes, not fake drama. Sentence
case after a colon unless grammar, a proper noun, a title, or code says otherwise.

**Superficial analysis.** Trailing -ing clauses that pretend to explain meaning: highlighting,
underscoring, reflecting, showcasing. "adds file search, highlighting the team's commitment
to better workflows" becomes "adds file search, so users can find old drafts without leaving
the editor."

**Importance puffery.** "stands as a testament", "marks a pivotal moment", "plays a vital
role", "solidifies its position". State the fact, let the reader judge.

**Weasel attribution.** "Experts agree", "studies show", "many argue", "industry reports
suggest". Name the source or cut the claim. No source: ask, never invent one.

**Fake-strong verbs.** Prefer "is" and "has" when clearer. "serves as a centralized hub for
sponsor management" becomes "tracks sponsors, drafts, due dates, and approvals in one place."

**Synonym cycling.** Repeat the right word. "The agent reviews the draft. The assistant
scores the piece. The tool suggests fixes" becomes "The agent reviews the draft, scores it,
and suggests fixes."

**Negative listing.** "Not a X. Not a Y. A Z." Just say Z.

**Dramatic fragmentation.** "X. And Y. And Z." / "That's it. That's the whole thing."
Use complete sentences.

**Robotic rhythm.** Repeated sentence shapes, identical paragraph structures, stacked punchy
fragments, forced rule-of-three. Vary shape only when it helps the point.

**Rhetorical setups.** "What if I told you", "Think about it:", "Plot twist:", self-answered
"Question? Answer." pairs. Drop them.

**Fake-profound kickers.** Cut the final deep line that turns the point into a metaphor or
mic-drop. Do not rewrite it into a better metaphor. Do not preserve the rhythm. Delete it and
end on the clearest concrete sentence already in the draft, or a plain takeaway or next action.

**Summary-recap endings.** "In conclusion", "Ultimately", "Overall", or a closing paragraph
that restates the piece. The reader was just there.

**Formatting slop.** Emoji in headings, bold sprinkled mid-sentence, bullets where two
sentences of prose read better, headers over two-sentence sections, Title Case headings.
Format follows content, it does not decorate it.

**Em dashes.** None in short copy. One or two in a long draft only when they clearly beat
commas, periods, or parentheses. This user's harness blocks them outright, so use hyphens.

**Pasted-LLM artifacts.** Strip `contentReference`, `oaicite`, `oai_citation`, `turn0search0`,
stray `:::`, stray `+1`, curly quotes where straight quotes belong (especially in code).

## Workflow

1. Read the whole draft first.
2. Name the core point and 3-5 voice signals to preserve (vocabulary, cadence, bluntness,
   humor, uncertainty, digressions). Keep this note internal. Can't find the core point: ask.
3. Detect request: return the findings report from Two jobs and stop.
4. Edit request: make the minimum effective changes, then Read
   `~/.claude/skills/no-ai-slop/eval.md` and check the result against every item yourself.
   No separate evaluator agent needed. If the file is unreadable, self-check against the
   Editing principles and Patterns to cut sections above and say the eval file was missing.
5. Any check fails: fix and re-run the checks.
6. Output the full edited draft plus a short **What changed** section.

## Local taste bank

`~/.claude/agents/copy-wiki-examples.md` holds curated tells T1-T21 as BAD to GOOD pairs plus
user-contributed examples. User examples outrank everything here, they are this user's real
calls. When the user labels copy good or bad, append it there in the same BAD / GOOD / Why
shape with the date.
