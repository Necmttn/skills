# aso-skills (vendored reference copy, curated)

Third-party organic-ASO skill pack, mirrored so `kb-site/build.ts` can render it
next to our own ledgers. **We did not write this.** Do not edit these files to
record our verdicts - those go in `SOTA.md`, and this copy stays a faithful
mirror of upstream.

| | |
|---|---|
| Upstream | https://github.com/eronred/aso-skills |
| Author | Erencan |
| License | MIT (see `LICENSE`) |
| Vendored commit | `4df730f456c21e42b9a2ea2be89fb32caf787728` (2026-08-22) |
| Vendored on | 2026-08-25 |
| Installed here | **no** - mirrored for reading, not installed as a plugin |

## What is mirrored, and what is not

Upstream has 40 skills. We mirror the **32 that carry no vendor dependency**
(~5,600 lines). The 8 that call the Appeeky commercial API are skipped, on the
same reasoning as `external/ua-skills/`: they document a product surface we do
not pay for. Skipped: `aso-audit`, `apple-search-ads`, `asc-metrics`,
`android-aso`, `app-icon-optimization`, `category-positioning`,
`competitor-tracking`, `seasonal-aso`.

Also not mirrored: `reference/` and reference `.mdx` files, which are
docs-site duplicates of the same skills, and `guides/`.

## Why this one earns its place next to vibe-aso

`vibe-aso` owns the **pipeline** - keywords, 50-locale metadata, screenshots,
pricing, in-app strings, submission fields. `aso-skills` owns **surfaces and
situations vibe-aso never touches**:

| Surface | Why it matters to us |
|---|---|
| `custom-product-pages` | Up to 35 alternate product pages behind campaign URLs. Claimed 10-40% tap-to-install lift. We use none. |
| `in-app-events` | Event cards on the Today tab and in search. They notify lapsed users. Free discovery surface we use none of. |
| `ab-test-store-listing` | Apple PPO mechanics and limits (3 variants, 90% confidence, one test at a time, icon/screenshots/video only). |
| `app-rejection-recovery` | Per-guideline recovery playbook. We have had four rejections. |
| `localization`, `keyword-research`, `metadata-optimization` | Second opinion on ground vibe-aso already covers - read both before betting. |

## The finding that changes a roadmap decision

`app-rejection-recovery` calls **Guideline 4.3 (design spam / duplicate)** the
hardest rejection to recover from, and says plainly: if the duplicate is inside
your own portfolio, consolidate or kill the old app; on a first submission,
expect it to be permanent unless the app fundamentally changes.

That is a direct risk to a per-language app family - Lock In Chinese, Lock In
Japanese, and any further language cut from the same codebase. See `SOTA.md`
-> App Review for the verdict.

## Re-syncing

```
git clone --depth=1 https://github.com/eronred/aso-skills /tmp/aso-skills
# re-copy only the vendor-free skills:
for d in /tmp/aso-skills/skills/*/; do
  grep -qi appeeky "$d/SKILL.md" && continue
  mkdir -p "kb-site/external/aso-skills/skills/$(basename $d)"
  cp "$d/SKILL.md" "kb-site/external/aso-skills/skills/$(basename $d)/SKILL.md"
done
```

Then update the pinned commit above and re-run `bun kb-site/build.ts`.

## Related

- `external/vibe-aso/` - the pipeline counterpart (MIT, mirrored, installed).
- `external/ua-skills/` - the paid-UA counterpart (unlicensed, link only).
