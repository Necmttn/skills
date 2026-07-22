---
name: mobile-onboarding-catalog
description: A catalog of best-in-class consumer mobile onboarding flows plus the reusable patterns behind them, for designing or auditing onboarding, activation, and paywall placement. Use when you design an onboarding flow, run an onboarding teardown, want to improve activation or first-run conversion, decide where the paywall goes in onboarding, need concrete onboarding examples for a category (health, language learning, fitness, subscription consumer), or want to reduce onboarding drop-off. Complements ux-psychology - that skill owns the cognitive-bias rules, this one owns the concrete app-example catalog + benchmark numbers + resource directory. See CATALOG.md for the per-app entries, cited benchmarks, and the source directory to keep mining, and SCREENS.md for wireframe transcriptions of real onboarding screens mapped to each pattern.
---

# Mobile Onboarding Catalog

Named, reusable onboarding patterns distilled from ~20 benchmark consumer apps, each mapped to the cognitive-bias rule it exploits and the apps that prove it. This is the pattern layer; [CATALOG.md](CATALOG.md) is the evidence layer (per-app flows, exact numbers, sources, resource directory) and [SCREENS.md](SCREENS.md) is the reference layer (wireframe transcriptions of real onboarding screens, mapped to these patterns - read it before generating screens).

This skill pairs with `ux-psychology`. When a pattern below references "rule N", that is a rule in [ux-psychology/SKILL.md](../ux-psychology/SKILL.md) - apply that rule's Action/Copy lines too. This skill answers "what do the best apps actually build"; ux-psychology answers "why it works".

## The two dominant onboarding models

Every strong consumer flow is one of two shapes. Pick one before designing screens.

- **Value-first / freemium** - deliver a real core experience (or a signed commitment) inside onboarding, then a soft or trial paywall later. Best when the product's value is self-evident in one action (a lesson, a meditation, a personalized feed). Apps: Duolingo, Headspace, Spotify, Fabulous, BeReal.
- **Quiz-funnel / commitment-first** - a long personalization quiz builds a plan/projection, then a hard paywall banks on the sunk time and emotional investment. Best when value needs proving via personalization (a plan, a projection, a reading). Apps: Noom, Cal AI, Runna, Flo, Babbel, RISE.

Universal across both: the account/paywall gate comes AFTER value or investment, never first (Duolingo's +20% DAU from moving signup behind the first lesson is the canonical proof - see CATALOG).

A third, narrow option: **no onboarding at all**. When the first action IS the value (a browse app like Mobbin, an AI chat's first prompt), the best flow gets out of the way - AI products dominate the shortest flows in Mobbin's 1,460-flow study, and only 7% of AI apps personalize up front (they let the product learn from usage). Length itself is not the enemy: the average app runs 25 onboarding screens, and finance/health/education winners run the longest flows - they just make them feel short (P14-P16, P3).

## Patterns

### P1. Value-before-signup

- **Trigger:** first-run of any app with a demonstrable core action.
- **Action:** run one real core action before the account/paywall screen - a completed lesson, a played track, a generated workout. Defer signup to after it.
- **Rule:** ux-psychology 3 (reciprocity) + 4 (IKEA). **Apps:** Duolingo, Spotify, Headspace.

### P2. Onboarding-is-the-first-session (eureka in 60s)

- **Trigger:** apps whose value is an experience, not a plan (meditation, breathing, journaling, audio).
- **Action:** make onboarding itself the first session. Headspace's onboarding is a ~2-min guided meditation; Calm opens by prompting a single deep breath. The user must feel core value before any ask.
- **Rule:** ux-psychology 3 (eureka corollary). **Apps:** Headspace, Calm, Fabulous.

### P3. Quiz-funnel personalization

- **Trigger:** apps that sell a personalized plan, projection, or reading.
- **Action:** break intake into a long multi-step quiz (one question per screen), with per-answer micro-validation so length feels effortless. Noom runs up to 113 screens; Babbel ~17 steps; Flo dozens of conversational questions. The effort is the point - it amplifies perceived value of the reveal.
- **Rule:** ux-psychology 7 (effort justification) + 10 (Zeigarnik chunking). **Apps:** Noom, Cal AI, Runna, Flo, Babbel, RISE. **Ethics:** every collected answer must actually shape the output (rule 7 ethical line).

### P4. Plan-generation loading screen

- **Trigger:** the moment between quiz completion and the result/paywall.
- **Action:** stage a visible "building your personalized plan" screen that shows real processing (RISE shows the work rather than a generic spinner) - not a fake wait. It manufactures earned value right before the paywall.
- **Rule:** ux-psychology 7. **Apps:** Noom, RISE, Cal AI. **Ethics:** stage real computation, never a loader over a canned result.

### P5. Projected-outcome reveal

- **Trigger:** health/fitness/finance apps where the user has a goal number.
- **Action:** after intake, animate a personalized projection chart tied to the user's stated goal (Noom's weight-loss trend line vs yo-yo dieting). It makes the future outcome concrete and loss-averse before the ask. Strongest form names a date or horizon: Speak renders "In 2 months, you'll be able to communicate while traveling in France" from two quiz answers; plan-builder apps state the exact date you'll hit your goal.
- **Rule:** ux-psychology 5 (loss aversion) + 2 (goal gradient). **Apps:** Noom, Runna, Speak, Endel, Brilliant (post-quiz home pre-populated with matched courses). **Screens:** [SCREENS.md P3/P5](SCREENS.md#p3--p5---personalization-with-a-visible-payoff).

### P6. Preference-picker instant ownership

- **Trigger:** first-run of apps with a configurable core experience (voice, theme, artists, feed).
- **Action:** surface 1-3 high-impact preferences immediately and re-render live as each is chosen. Speechify makes you pick voice + speed and reflects them back on a checkmarked summary; Spotify's 3-artist picker fills the home screen before you reach it.
- **Rule:** ux-psychology 12 (familiarity) + 1 (smart defaults). **Apps:** Speechify, Spotify, Notion, Flighty (map-style picker with live preview thumbnails - purely cosmetic, cheap to build, and the app is "yours" before first use; [screen](SCREENS.md#p6---preference-picker-instant-ownership)).

### P7. Commitment gesture / contract

- **Trigger:** the step just before the paywall in a quiz-funnel flow.
- **Action:** insert an active micro-commitment - Fabulous has users "sign" a contract, Flo uses a tap-and-hold gesture, Duolingo's Investment Wager stakes gems on a streak (raised D7 retention +14%). A performed commitment raises exit cost right before the ask.
- **Rule:** ux-psychology 4 (IKEA) + 11 (active learning). **Apps:** Fabulous, Flo, Duolingo.

### P8. Hard paywall at onboarding end

- **Trigger:** you have a quiz-funnel or generated-plan flow and Day-0 intent is high.
- **Action:** place the hard paywall at the end of onboarding while intent peaks - ~90% of trial starts happen Day 0 and non-converters rarely return. Anchor the annual price against the weekly price ("SAVE 50%", weekly breakdown) and stack social proof at the decision point. Hard paywalls convert install-to-paid ~5x freemium (10.7% vs 2.1% median, RevenueCat 2026). Two amplifiers: use quiz answers to recommend a tailored plan tier (Grammarly: ~+20% plan upgrades), and make the paywall itself delightful (Flighty's one-time offer prints as a haptic flight ticket).
- **Rule:** ux-psychology 6 (contrast). **Apps:** Cal AI, Runna, Blinkist, Noom, Timo (identity question -> social-proof page -> paywall headline mirroring the identity back), Grammarly, Flighty. **Screens:** [SCREENS.md P8](SCREENS.md#p8---paywall-placement-and-framing). **Numbers in CATALOG benchmarks.**

### P9. Honest paywall (trial transparency + reminder opt-in)

- **Trigger:** any free-trial paywall.
- **Action:** show a clear trial timeline and "we'll remind you before you're charged", then request notification permission to deliver that reminder. Blinkist's honest-paywall variant lifted trial signups +23% and push opt-in from 6% to 74%.
- **Rule:** ux-psychology 3 + ethical boundary. **Apps:** Blinkist.

### P10. Contextual notification priming

- **Trigger:** the notification-permission prompt.
- **Action:** never fire the OS prompt cold. Frame it around the value it unlocks at the moment it matters ("On the days you exercise, want a workout preview?"; BeReal: "the only way to know when to post"), and prime with a custom screen before the OS dialog. Strongest form renders the actual notification card you would receive, makes the CTA the benefit ("Get motivated") rather than the mechanism ("Allow notifications"), and keeps a visible Skip.
- **Rule:** ux-psychology 11 (active learning) + 5. **Apps:** BeReal, Fitbod, Duolingo, Blinkist, Centr. **Screens:** [SCREENS.md P10](SCREENS.md#p10---notification-pre-prompt).

### P11. Invite-to-unlock virality

- **Trigger:** apps with a social or recap surface.
- **Action:** make the share asset and the invite the same loop. Airbuds withholds all but your top 3 artists until you invite friends; Strava auto-generates a shareable map from every activity (est. ~40-50% of organic signups). The product is deliberately thin until you pull others in.
- **Rule:** ux-psychology 9 (ego-driven sharing). **Apps:** Airbuds, Strava. **Ethics:** state the price of the gate; never harvest contacts silently.

### P12. One-question-per-screen micro-steps

- **Trigger:** unavoidable heavy intake (KYC, long profile, medical history).
- **Action:** one field per screen, staged into micro-steps, heaviest verification deferred. Cash App gets users running in <2 min on one screen per question; Revolut split KYC into micro-steps and cut sign-up-to-verified from ~70 min to ~2 min (70% abandon KYC flows over 3 min). More screens can WIN: Houzz split its sign-up form into multiple screens and saw +15% conversions - added friction in one place can remove it overall.
- **Rule:** ux-psychology 10 (Zeigarnik chunking) + 1 (smart defaults). **Apps:** Cash App, Revolut, Houzz.

### P13. Live-morphing segmentation preview

- **Trigger:** apps with an empty-state / blank-canvas problem (productivity, tools).
- **Action:** turn the segmentation survey into a live preview that visibly builds the product as the user answers, then drop them into a real populated template - not an empty workspace. Notion morphs the UI in real time from a jobs-based questionnaire.
- **Rule:** ux-psychology 12 (familiarity) + 7. **Apps:** Notion, Speechify.

### P14. Outcome-first welcome (sell the outcome, not features)

- **Trigger:** the very first screen(s) - welcome, splash, signup.
- **Action:** show the outcome instead of listing features. Superhuman's signup screen leads with "Save 4 hours per person every single week" and a customer-logo rail; Runbuds opens on pure animation with no copy at all; Alma runs its core action pre-signup ("Let's try tracking some food. What's the last thing you ate?"); Timehop's welcome is just the product in action. Feature bullet lists on a welcome screen are the anti-pattern.
- **Rule:** ux-psychology 3 (reciprocity) + 8 (identity). **Apps:** Superhuman, Runbuds, Alma, Timehop. **Screens:** [SCREENS.md P14](SCREENS.md#p14---outcome-first-welcome). **Source:** [Mobbin 1,460-flow study](sources/mobbin-1460-onboarding-study.md).

### P15. Founder's touch (human moment at the seam)

- **Trigger:** the emotional seams of the flow - right after account creation, at the first aha moment, or a personal milestone.
- **Action:** insert one deliberately human, non-scalable-feeling artifact: a CEO note with a real reply-to address right after signup (Basecamp), a founder video when you finish the hard task (Airbnb, on first listing published), a handwritten-signed founder's note (One Year), a birthday acknowledgment (Tinder). Placement matters more than production value - land it AT the aha moment or the commitment point, not on a random screen.
- **Rule:** ux-psychology 3 (reciprocity) + 8 (identity labeling). **Apps:** Basecamp, Airbnb, Tinder. **Screens:** [SCREENS.md P15](SCREENS.md#p15---founders-touch). **Source:** [Mobbin study](sources/mobbin-1460-onboarding-study.md).

### P16. Just-in-time education (guidance in place of tours)

- **Trigger:** products with dry/complex domains or an empty-state risk, and any temptation to front-load explainer screens or popup tours.
- **Action:** move education to the moment of need: per-field tooltips answering the objection that field raises, plus reversibility copy and a human escape hatch (Cake Equity on equity/vesting); inline validation, e.g. Acorns listing password rules before typing and ticking them off per keystroke; a real populated starter document instead of a blank state (Notion's "Getting Started" page is editable and partly pre-checked - you learn the editor by editing the lesson); and a persistent checklist instead of popups - Mural's six-step "1 of 6 Complete" checklist replacing popups/banners drove +10% relative one-week retention. Checklists survive dismissal; tours don't.
- **Rule:** ux-psychology 1 (smart defaults) + 10 (Zeigarnik - the unchecked checklist nags) + 2 (goal gradient). **Apps:** Cake Equity, Acorns, Notion, Mural. **Screens:** [SCREENS.md P16](SCREENS.md#p16---just-in-time-education). **Source:** [Mobbin study](sources/mobbin-1460-onboarding-study.md).

## Generation workflow

1. Pick a model (value-first vs quiz-funnel vs no-onboarding) from the app's value type.
2. Open with an outcome-first welcome (P14), never a feature list. Pull the closest reference screen from [SCREENS.md](SCREENS.md) before writing any screen.
3. Sequence the eureka funnel (ux-psychology REFERENCE "Eureka sequences"): core value or quiz first, then 1-3 ownership preferences (P6), then interactive commitment (P7), then the gate framed as saving progress. Signup is the last screen, never the first.
4. Place the paywall per P8 (Day-0, anchored) or defer per the value-first model.
5. Prime notifications per P10; add a virality loop per P11 if there's a shareable asset; consider a founder's touch at the aha seam (P15).
6. Replace any explainer screens or tour popups with just-in-time guidance + a persistent checklist (P16).
7. Cross-check every screen against the matched ux-psychology rules before writing markup.

## Audit workflow

For an existing flow: map each screen to a pattern above, then check the linked ux-psychology rule's failure modes. Report **pattern absent/violated -> the exemplar app that does it -> concrete change**, citing the reference screen in [SCREENS.md](SCREENS.md) so the change is concrete rather than abstract. Compare the flow's paywall placement and quiz length against the CATALOG benchmarks - and against the platform average (iOS 26.5 screens, Android 24.9, web 21.0), since "too long" is usually the wrong diagnosis.

## Ethics

Same honesty line as ux-psychology. Quiz-funnels (P3/P4) must use every answer in the output - a long quiz over a canned result is Barnum fraud. Paywalls (P8/P9) must state trial terms and real charge dates. Invite gates (P11) must name their price. These patterns reduce friction toward what the user already wants; they must not fabricate urgency or trap.
