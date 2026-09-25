# Consumer Club: organic UGC system (LINK ONLY - not mirrored)

A 7-minute sales video for a done-for-you organic UGC program for consumer
apps. **Nothing from it is copied into this repo.** It is a copyrighted pitch
with no license, so this page is our own writing: what the video argues, how it
maps to what we already run, and which ideas we adopted as verdicts.

| | |
|---|---|
| Upstream | https://www.joinconsumerclub.com/strategy-call |
| Media | Wistia `gyzzmq7828` - https://fast.wistia.net/embed/iframe/gyzzmq7828 |
| Author | Consumer Club (founder-led agency; also runs a podcast) |
| License | **none declared** - do not vendor, do not copy text |
| Reviewed | 2026-09-25, full watch via transcript (6 min 46 s) |
| Local copy | `~/Downloads/consumerclub-strategy-call-gyzzmq7828.mp4`, transcript `~/.cache/consumerclub/gyzzmq7828.transcript.json` (both outside git) |

Owner note (2026-09-25): "overall what we end up doing with our marketing ops."
Read it as an outside confirmation of the shape we reached on our own, not as a
new plan.

## The argument, in our words

1. **Organic is a testing discipline, not a lottery.** It is closer to Meta ads
   than to "post a lot and hope". The common failures (big agency on retainer,
   one cheap generalist poster, the founder grinding alone) all come from the
   volume-game belief.
2. **Three roles, hired in this order.** Strategist (creative research,
   hypotheses, briefs; owns "viral AND converting") and recruiter (sources
   creators by casting fit for the ICP, not by view count) first; they are the
   high-leverage roles. A manager (ideally an ex-creator: feedback, keeps
   creators posting, pre-post tweaks) comes later for the day-to-day.
3. **Four stages over ~90 days.**
   - *Hypothesize:* 3-5 formats, 3-5 accounts, one creator per account, tight
     constraints per format. Source formats from million-view videos in
     *other* niches, not only competitors. About half copied-and-iterated,
     the rest always spent on new formats.
   - *Format (month 1):* the only goal is to find formats the algorithm pushes
     for this app. Views and conversions are not the target yet.
   - *Convert (months 2-3):* keep the viral formats that also convert. Isolate
     one variable at a time - hook, caption, CTA, talent - coach creators on
     what worked, then scale the winner to more creators.
   - *Handoff:* document research, brief writing, coaching, and the test queue,
     then place a fractional in-house head of organic (claimed < $4k/month vs
     $15-30k agency retainers).
4. **Casting archetypes.** Test two on-camera types: the *mountain* (already
   has the result the app promises; authority) and the *mirror* (just starting;
   relatability). Both aim at trust-based conversion.
5. **Organic feeds paid.** Winning organic formats hand paid ads validated
   messaging and cheaper creative; it is worth running even for a paid-first team.
6. **Three questions to ask any vendor or hire.** What happens after week one
   (want: a specific iteration method, not "post more")? How do you vet
   creators (lifetime views as the main answer is a red flag)? When do we see a
   viral video vs. a converting one (want: month 1 vs. months 2-3)?

Claims we did **not** verify and do not rely on: "$6M+ added across 12+ apps",
"740 founders observed", "~10 good UGC agencies", the <$4k fractional cost.

## How it maps to what we run

| Video idea | Our equivalent | State |
|---|---|---|
| Strategist: research, hypotheses, briefs | Ad-studio stages 01 Research / 02 Analyze / 03 Script, format cards with evidence states (`apps/lockin-chinese/ad-studio/docs/repeatable-video-workflows-2026-09-23.md`) | planned, Treg selected |
| 3-5 formats, cross-niche sourcing, half iterate / half innovate | "Three groups" research (direct, adjacent, transferable structures); first batch 3 formats x 3 openings | planned |
| Isolate one variable at a time | `changed_variable` + version IDs on every output; body/offer/CTA fixed per comparison | planned |
| Month 1 = format hunt, months 2-3 = conversion | Evidence states `reference_candidate` -> `repeatable_reach` -> `internal_conversion_evidence`; "views are not conversion evidence" | adopted |
| Recruiter with ICP casting | nokta creator program (creators.nokta.dev, Discord guild, approval-based pay) | live since 2026-07 |
| Manager: feedback, keep posting | Discord bot `/submit` + approval loop, `dash.nokta.dev` cockpit, creator-ops handover (`docs/playbooks/creator-ops-handover.md` in apps) | live |
| Mountain vs mirror talent | Generated presenters + real creators; no explicit archetype split yet | **gap** |
| Handoff to an in-house operator | Creator-ops agent handover prompt; documented stages as the system | partial |
| Organic winners feed paid | SOTA Distribution "Paid ads last" | adopted |

Where we differ on purpose: we run generated presenters alongside human
creators, and every stage is an agent-run, re-runnable command with receipts.
The video assumes a human team for every role.

## Verdicts taken

See `SOTA.md` section **Distribution**, entries citing "consumerclub" (2026-09-25).
