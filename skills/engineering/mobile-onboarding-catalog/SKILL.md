---
name: mobile-onboarding-catalog
description: A catalog of best-in-class consumer mobile onboarding flows plus the reusable patterns behind them, for designing or auditing onboarding, activation, and paywall placement. Use when you design an onboarding flow, run an onboarding teardown, want to improve activation or first-run conversion, decide where the paywall goes in onboarding, need concrete onboarding examples for a category (health, language learning, fitness, subscription consumer), or want to reduce onboarding drop-off. Complements ux-psychology - that skill owns the cognitive-bias rules, this one owns the concrete app-example catalog + benchmark numbers + resource directory. See CATALOG.md for the per-app entries, cited benchmarks, and the source directory to keep mining.
---

# Mobile Onboarding Catalog

Named, reusable onboarding patterns distilled from ~20 benchmark consumer apps, each mapped to the cognitive-bias rule it exploits and the apps that prove it. This is the pattern layer; the [CATALOG.md](CATALOG.md) is the evidence layer (per-app flows, exact numbers, sources, resource directory).

This skill pairs with `ux-psychology`. When a pattern below references "rule N", that is a rule in [ux-psychology/SKILL.md](../ux-psychology/SKILL.md) - apply that rule's Action/Copy lines too. This skill answers "what do the best apps actually build"; ux-psychology answers "why it works".

## The two dominant onboarding models

Every strong consumer flow is one of two shapes. Pick one before designing screens.

- **Value-first / freemium** - deliver a real core experience (or a signed commitment) inside onboarding, then a soft or trial paywall later. Best when the product's value is self-evident in one action (a lesson, a meditation, a personalized feed). Apps: Duolingo, Headspace, Spotify, Fabulous, BeReal.
- **Quiz-funnel / commitment-first** - a long personalization quiz builds a plan/projection, then a hard paywall banks on the sunk time and emotional investment. Best when value needs proving via personalization (a plan, a projection, a reading). Apps: Noom, Cal AI, Runna, Flo, Babbel, RISE.

Universal across both: the account/paywall gate comes AFTER value or investment, never first (Duolingo's +20% DAU from moving signup behind the first lesson is the canonical proof - see CATALOG).

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
- **Action:** after intake, animate a personalized projection chart tied to the user's stated goal (Noom's weight-loss trend line vs yo-yo dieting). It makes the future outcome concrete and loss-averse before the ask.
- **Rule:** ux-psychology 5 (loss aversion) + 2 (goal gradient). **Apps:** Noom, Runna.

### P6. Preference-picker instant ownership

- **Trigger:** first-run of apps with a configurable core experience (voice, theme, artists, feed).
- **Action:** surface 1-3 high-impact preferences immediately and re-render live as each is chosen. Speechify makes you pick voice + speed and reflects them back on a checkmarked summary; Spotify's 3-artist picker fills the home screen before you reach it.
- **Rule:** ux-psychology 12 (familiarity) + 1 (smart defaults). **Apps:** Speechify, Spotify, Notion.

### P7. Commitment gesture / contract

- **Trigger:** the step just before the paywall in a quiz-funnel flow.
- **Action:** insert an active micro-commitment - Fabulous has users "sign" a contract, Flo uses a tap-and-hold gesture, Duolingo's Investment Wager stakes gems on a streak (raised D7 retention +14%). A performed commitment raises exit cost right before the ask.
- **Rule:** ux-psychology 4 (IKEA) + 11 (active learning). **Apps:** Fabulous, Flo, Duolingo.

### P8. Hard paywall at onboarding end

- **Trigger:** you have a quiz-funnel or generated-plan flow and Day-0 intent is high.
- **Action:** place the hard paywall at the end of onboarding while intent peaks - ~90% of trial starts happen Day 0 and non-converters rarely return. Anchor the annual price against the weekly price ("SAVE 50%", weekly breakdown) and stack social proof at the decision point. Hard paywalls convert install-to-paid ~5x freemium (10.7% vs 2.1% median, RevenueCat 2026).
- **Rule:** ux-psychology 6 (contrast). **Apps:** Cal AI, Runna, Blinkist, Noom. **Numbers in CATALOG benchmarks.**

### P9. Honest paywall (trial transparency + reminder opt-in)

- **Trigger:** any free-trial paywall.
- **Action:** show a clear trial timeline and "we'll remind you before you're charged", then request notification permission to deliver that reminder. Blinkist's honest-paywall variant lifted trial signups +23% and push opt-in from 6% to 74%.
- **Rule:** ux-psychology 3 + ethical boundary. **Apps:** Blinkist.

### P10. Contextual notification priming

- **Trigger:** the notification-permission prompt.
- **Action:** never fire the OS prompt cold. Frame it around the value it unlocks at the moment it matters ("On the days you exercise, want a workout preview?"; BeReal: "the only way to know when to post"), and prime with a custom screen before the OS dialog.
- **Rule:** ux-psychology 11 (active learning) + 5. **Apps:** BeReal, Fitbod, Duolingo, Blinkist.

### P11. Invite-to-unlock virality

- **Trigger:** apps with a social or recap surface.
- **Action:** make the share asset and the invite the same loop. Airbuds withholds all but your top 3 artists until you invite friends; Strava auto-generates a shareable map from every activity (est. ~40-50% of organic signups). The product is deliberately thin until you pull others in.
- **Rule:** ux-psychology 9 (ego-driven sharing). **Apps:** Airbuds, Strava. **Ethics:** state the price of the gate; never harvest contacts silently.

### P12. One-question-per-screen micro-steps

- **Trigger:** unavoidable heavy intake (KYC, long profile, medical history).
- **Action:** one field per screen, staged into micro-steps, heaviest verification deferred. Cash App gets users running in <2 min on one screen per question; Revolut split KYC into micro-steps and cut sign-up-to-verified from ~70 min to ~2 min (70% abandon KYC flows over 3 min).
- **Rule:** ux-psychology 10 (Zeigarnik chunking) + 1 (smart defaults). **Apps:** Cash App, Revolut.

### P13. Live-morphing segmentation preview

- **Trigger:** apps with an empty-state / blank-canvas problem (productivity, tools).
- **Action:** turn the segmentation survey into a live preview that visibly builds the product as the user answers, then drop them into a real populated template - not an empty workspace. Notion morphs the UI in real time from a jobs-based questionnaire.
- **Rule:** ux-psychology 12 (familiarity) + 7. **Apps:** Notion, Speechify.

## Generation workflow

1. Pick a model (value-first vs quiz-funnel) from the app's value type.
2. Sequence the eureka funnel (ux-psychology REFERENCE "Eureka sequences"): core value or quiz first, then 1-3 ownership preferences (P6), then interactive commitment (P7), then the gate framed as saving progress. Signup is the last screen, never the first.
3. Place the paywall per P8 (Day-0, anchored) or defer per the value-first model.
4. Prime notifications per P10; add a virality loop per P11 if there's a shareable asset.
5. Cross-check every screen against the matched ux-psychology rules before writing markup.

## Audit workflow

For an existing flow: map each screen to a pattern above, then check the linked ux-psychology rule's failure modes. Report **pattern absent/violated -> the exemplar app that does it -> concrete change**. Compare the flow's paywall placement and quiz length against the CATALOG benchmarks.

## Ethics

Same honesty line as ux-psychology. Quiz-funnels (P3/P4) must use every answer in the output - a long quiz over a canned result is Barnum fraud. Paywalls (P8/P9) must state trial terms and real charge dates. Invite gates (P11) must name their price. These patterns reduce friction toward what the user already wants; they must not fabricate urgency or trap.
