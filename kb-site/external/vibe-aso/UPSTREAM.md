# vibe-aso (vendored reference copy)

Third-party knowledge, kept here so `kb-site/build.ts` can render it next to our
own ledgers. **We did not write this.** Do not edit the files in this directory
to record our own verdicts - put those in `kb-site/SOTA.md` or the apps-repo
playbooks, and let this copy stay a faithful mirror of upstream.

| | |
|---|---|
| Upstream | https://github.com/Kronop/vibe-aso |
| Author | Kronop |
| License | MIT (see `LICENSE`) |
| Vendored commit | `fdc1b0bbd4712509aa623d98c51953aa016a34a7` (2026-08-12) |
| Vendored on | 2026-08-15 |
| Installed here | yes - user scope, `vibe-aso@vibe-aso-marketplace` |

## What is here

Only the prose. The executable parts of the skill (`scripts/asc.rb`,
`scripts/check_setup.sh`, the playwright `renderer/`) stay upstream - install the
plugin if you want to run the pipeline:

```
/plugin marketplace add Kronop/vibe-aso
/plugin install vibe-aso@vibe-aso-marketplace
```

| File | Phase |
|---|---|
| `SKILL.md` | map of the six phases + cross-phase laws |
| `reference/keyword-research.md` | 1 - keyword research (popularity/difficulty/intent) |
| `reference/metadata.md` | 2 - name/subtitle/keywords/description across 50 locales |
| `reference/screenshots.md` | 3 - localized screenshot headings + upload hazards |
| `reference/pricing.md` | 4 - worldwide territory pricing (GNI bands) |
| `reference/app-localization.md` | 5 - in-app string localization + detector suite |
| `reference/submission-checklist.md` | 6 - ASC field checklist, API vs manual |

## How it relates to our own docs

- `docs/playbooks/app-store-submission.md` (apps repo) is **the gate** and stays
  authoritative for anything we have been rejected on. Where the two disagree,
  ours wins - ours is backed by our own rejection ledger.
- `reference/submission-checklist.md` is complementary: it enumerates the ASC
  *fields* a fresh app must fill, which our playbook assumes are already set.
- Phases 1-5 cover ground we have no document for at all (keyword method,
  locale cascade, territory pricing). Verdicts we adopt from them are recorded
  in `SOTA.md` as `[directional]` until we have shipped against them ourselves.

## Re-syncing

```
git clone --depth=1 https://github.com/Kronop/vibe-aso /tmp/vibe-aso
cp /tmp/vibe-aso/skills/vibe-aso/SKILL.md kb-site/external/vibe-aso/
cp /tmp/vibe-aso/skills/vibe-aso/reference/*.md kb-site/external/vibe-aso/reference/
```

Then update the vendored commit in the table above and re-run `bun kb-site/build.ts`.
