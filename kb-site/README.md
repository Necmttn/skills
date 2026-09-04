# kb-site

A local website that curates the knowledge base: current SOTA verdicts, the experiment ledger, and the source documents (onboarding catalog, UX psychology rules, paywall/growth/ASO playbooks, design law).

## Build and view

```
bun kb-site/build.ts --open
```

Output: `kb-site/dist/index.html` (self-contained, no server needed). `/` focuses the filter box.

## Structure

- `SOTA.md` - one verdict per line with a `[sota]` / `[directional]` / `[retired]` status, evidence link, and date. This file is the answer to "what do we currently call SOTA". Append; never silently delete - flip to `[retired]` instead.
- `IDEA-ROAST.md` - the negative checklist for new app ideas: hard kills (one-sentence, sound-off, tarpit, mechanism, promo-picture, willingness-to-pay, App Review exposure) + soft flags, with a recorded ROAST verdict per idea. No recorded roast, no build.
- Motion vocabulary lives in `skills/engineering/motion-principles/SKILL.md` (the twelve classic principles mapped to UI rules + our house rules), rendered in the Motion section; the source essay is linked there, not vendored (copyrighted).
- `EXPERIMENTS.md` - cross-repo index of our own experiments. The authoritative per-experiment ledger files live in the apps repo under `docs/experiments/` (growth-ops rule).
- `REJECTIONS.md` - App Review rejection ledger: what Apple said, the real root cause, the fix, the guard, the lesson. Companion rule: every rejection also adds a rule with a verify command to the submission playbook.
- `SHIPPING.md` - the "ship an app" SOP: eight ordered phases from code-landing to launch week, with the owner gates (TF-first, tag/submit only on explicit go) and the document that owns each phase.
- Tooling section (added 2026-09-03) renders the apps-repo `docs/playbooks/mobile-iteration-loop.md` (the inner loop: affected tests, shared caches, seeded launch, AXe-driven simulator checks, batch merges) plus the `sim-test` and `axe` skills from `~/.claude/skills/`. Simulator verdicts live in `SOTA.md` under Tooling.
- `external/` - vendored third-party knowledge, mirrored verbatim with an `UPSTREAM.md` naming the source, license and pinned commit. Never edit these to record our own verdicts; those go in `SOTA.md`. Currently: `vibe-aso` (Kronop, MIT) - the six-phase ASO pipeline (keywords, 50-locale metadata, localized screenshots, worldwide pricing, in-app strings, ASC field checklist). And `rork-guide` (Rork/Daniel, pasted 2026-08-17) - the $0 -> $10k/mo consumer-app playbook: idea selection, the gotcha moment, MRR ladder, and creator/meme-page/paid-ads distribution mechanics; adopted verdicts live in `SOTA.md` (Idea Selection, Distribution) and `IDEA-ROAST.md`.
  Sources with no license, or a copyrighted one, are **linked, never mirrored** - the directory then holds only our own notes (`ua-skills`).
- `build.ts` - reads the manifest of sources (these two files, the knowledge skills in `skills/engineering/`, and playbooks in `~/Projects/apps/docs/playbooks/`) and renders the site. A missing source renders as a note, not an error.

## Updating

The markdown files are the truth. Edit them (or the skills/playbooks they point at), rerun the build, refresh the page.
