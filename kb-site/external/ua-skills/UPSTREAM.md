# ua-skills (LINK ONLY - not mirrored)

Third-party paid-growth skill pack. **Nothing from it is copied into this repo.**
The upstream has **no license file**, so the default is all rights reserved and
we mirror none of it - the same call we made for the twelve-principles motion
essay. This page is our own writing: what the pack is, what survives without
paying the vendor, and how it maps to us.

| | |
|---|---|
| Upstream | https://github.com/appeeky/ua-skills |
| Author | Appeeky (appeeky.com) |
| License | **none declared** - do not vendor, do not copy text |
| Reviewed | 2026-08-24, at 24 skills / ~7,500 lines |
| Installed here | **no** - see "Why not installed" below |

## What it is

24 Claude Code skills for **paid** user acquisition: Apple Search Ads, Meta,
TikTok, Google UAC, ad-creative generation, MMP/attribution setup, and
cross-channel ROAS. It is the paid-growth counterpart to `vibe-aso`, which is
organic. The two do not overlap.

The content is real playbook material, not marketing filler - concrete spend
floors, kill criteria, and campaign structure defaults. The verdicts we adopted
from it are in `SOTA.md` under **Paid UA**.

## The vendor split - read this before trusting a skill

The pack is the front end for Appeeky's commercial API/MCP. Of the 24 skills,
**18 call `asa_*`, `meta_ads_*`, `tiktok_ads_*`, `rc_*`, or
`generate_app_ad_creative`** and do nothing useful without an Appeeky account.

Six are framework-only and work standalone:

| Skill | What it gives you with no vendor account |
|---|---|
| `cross-channel-budget` | budget allocation model, spend floors, launch sequence |
| `mmp-setup` | MMP choice + event-mapping checklist before any paid spend |
| `google-uac-campaign` | UAC campaign structure |
| `tiktok-creative-strategy` | creative angle framework |
| `ads-router` | router to the other 23 |
| `app-ads-context` | context doc the others read |

Treat the other 18 as documentation of Appeeky's product surface, not as
portable knowledge.

## Why not installed

The 24 skill descriptions cost roughly **2,550 tokens in every session**, always
on. Against that: we run no paid UA, and no app of ours is live yet
(all three sit pre-release in ASC as of 2026-08-24). The pack buys nothing until
there is a live app and an ad budget.

The marketplace is registered, so installing is one command when that changes:

```
claude plugin install ua-skills@ua-skills
```

Revisit when the first app is live and a paid budget is approved.

## Lead worth following

Upstream points at **https://github.com/eronred/aso-skills** for organic ASO and
attribution/SKAN. That is closer to our current position than paid UA is, and it
is not yet reviewed. Check its license before doing anything but linking it.

## Related

- `SOTA.md` -> **Paid UA** section: the verdicts we adopted, all `[directional]`.
- `external/vibe-aso/` - the organic ASO counterpart (MIT, mirrored, installed).
- `docs/playbooks/growth-ops.md` (apps repo) - our own experiment ledger rules;
  any paid test we eventually run gets a ledger file there like anything else.
