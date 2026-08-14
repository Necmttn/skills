# kb-site

A local website that curates the knowledge base: current SOTA verdicts, the experiment ledger, and the source documents (onboarding catalog, UX psychology rules, paywall/growth/ASO playbooks, design law).

## Build and view

```
bun kb-site/build.ts --open
```

Output: `kb-site/dist/index.html` (self-contained, no server needed). `/` focuses the filter box.

## Structure

- `SOTA.md` - one verdict per line with a `[sota]` / `[directional]` / `[retired]` status, evidence link, and date. This file is the answer to "what do we currently call SOTA". Append; never silently delete - flip to `[retired]` instead.
- `EXPERIMENTS.md` - cross-repo index of our own experiments. The authoritative per-experiment ledger files live in the apps repo under `docs/experiments/` (growth-ops rule).
- `build.ts` - reads the manifest of sources (these two files, the knowledge skills in `skills/engineering/`, and playbooks in `~/Projects/apps/docs/playbooks/`) and renders the site. A missing source renders as a note, not an error.

## Updating

The markdown files are the truth. Edit them (or the skills/playbooks they point at), rerun the build, refresh the page.
