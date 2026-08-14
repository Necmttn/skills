# Current SOTA

The current state of the art as we practice it - one verdict per line. Statuses: `[sota]` = our current best answer, apply it by default; `[directional]` = believed but not proven, verify before betting on it; `[retired]` = tried and rejected, do not resurrect.

Maintenance: append new verdicts with a date; when a verdict changes, flip its status to `[retired]` in place and add the replacement - never silently delete. Each verdict links its evidence (skill file, playbook, PR, or external source).

## Onboarding

- [sota] Quiz-funnel / commitment-first is our model for subscription apps: personalization quiz builds investment, hard paywall banks on it. Value-first only when the core action demonstrates itself in one minute. Evidence: mobile-onboarding-catalog "two dominant models". (2026-07-16)
- [sota] Pain-first sequence: identity → context → desire → investment → trust → permission → pain from 4 angles → "we heard you" loader → proof-of-pain stats → paywall → account last. Self-reported 94% onboarding-start → paywall-view. Evidence: P17 + [maxzr entry](https://x.com/maxzrco/status/2086919205601820831) in CATALOG.md. (2026-08-14)
- [sota] Real value or investment comes before any gate; signup after the first core action (Duolingo +20% DAU). Account creation after purchase in quiz-funnel flows. Evidence: P1, CATALOG Duolingo entry. (2026-07-16)
- [sota] ~25 screens is a normal flow length (iOS avg 26.5). Judge a flow on paywall-decision quality, never on screen count. Evidence: Mobbin 1,460-flow study in CATALOG benchmarks. (2026-07-22)
- [sota] Notification permission: custom pre-prompt framed on the value it unlocks, benefit-worded CTA, visible skip, progress never blocks on deny. Evidence: P10; Blinkist push opt-in 6% → 74%. (2026-07-16)
- [sota] Lock In Chinese: onboarding paywall sits at flow end (`pledge → paywall`) with a visible "Not now" decline link. Evidence: PR #972. (2026-07-28)
- [directional] Longer quiz → higher paid conversion. No primary-source A/B proves it; the proven part is paywall-after-investment. Treat as directional. Evidence: CATALOG "Quiz-funnel length". (2026-07-16)

## Paywalls

- [sota] Hard paywall at onboarding end, on Day 0: 90% of trial starts happen Day 0; hard converts install-to-paid ~5x freemium (10.7% vs 2.1%). Evidence: CATALOG benchmarks (RevenueCat/Adapty 2026). (2026-07-16)
- [sota] Lock In Chinese is a hard-paywall app (owner decision 2026-07-29, reversing #873). Every unpaid flow exit lands on the lock surface. Rescue Pass = one-time 3-day app-granted Pro on abandon. Evidence: PRs #1027, #1034. (2026-07-29)
- [sota] Lockout winback: dismissal routes to a discounted yearly offer ($14.99 `lockinchinese.pro.yearly.winback`); the word "winback" never appears in customer-facing copy. A/B by appending candidate ids. Evidence: PR #1035. (2026-07-30)
- [sota] Benchmarks we hold ourselves to: trial start 15%+, trial-to-paid 30%+, no-trial install-to-paid 4% floor. Placements before experiments. Evidence: paywall-experiments playbook (Superwall, 10k+ experiments). (2026-07-31)
- [sota] Transaction-abandonment discounts are ANNUAL ONLY - weekly/monthly discounts tested dead. Evidence: paywall-experiments playbook. (2026-07-31)
- [sota] Paywall copy mechanics: say "free" 5-7x, promise a trial-end reminder, hide trial length from the product card, trial-toggle dual pricing (~10% buy no-trial), prices behind the CTA, authentic numbers ($3.33) can beat .99. Evidence: paywall-experiments playbook. (2026-07-31)
- [sota] Weekly plan + 3-day trial delivers ~1.5x average LTV of other configs. Evidence: Adapty 2026 in CATALOG benchmarks. (2026-07-16)
- [sota] SDUI carries copy only; RevenueCat packages carry the plan mix. Never encode price/plan changes in SDUI. Evidence: lockin RC offering catalog decision. (2026-08-01)
- [sota] Never trust StoreKit `isEligibleForIntroOffer` alone - false negatives in TestFlight/sandbox even for fresh accounts. Resolve as store bit OR zero-transactions-in-group proof. Evidence: PR #1123. (2026-08-03)
- [sota] Honest paywall: clear trial timeline + "we'll remind you before you're charged" (+23% trial signups at Blinkist). Evidence: P9, CATALOG Blinkist entry. (2026-07-16)

## UX Psychology

- [sota] The twelve bias rules are the baseline for every screen: run the trigger list before writing markup, report critiques as rule → violation → concrete rewrite. Evidence: ux-psychology skill. (2026-07-16)
- [sota] Ethical line is part of SOTA, not an add-on: real computation behind analysis screens, true consequences in loss framing, no fabricated scarcity, share-gates state their price. Evidence: ux-psychology "Ethical boundary". (2026-07-16)

## Design

- [sota] Per-app DESIGN.md is law. Lock In Chinese: Cinnabar & Rice Paper, ONE seal accent. Evidence: `apps/lockin-chinese/ios/DESIGN.md`, PR #505. (2026-07-19)
- [sota] Bold/binary: all hanzi bold at the token source; selection = flooded fill + flipped text, never strokes/outlines; zero hairline rules - separation by whitespace only. Evidence: PR #950. (2026-07-28)
- [sota] Three-tier button system: L (~55pt full-width CTA) / M (31pt pill, 44pt hit) / S (quiet, 44pt floor). The style owns the hit floor so call sites cannot forget it. Evidence: fleet run #948; DESIGN.md law amendment tracked in #954. (2026-07-28)
- [sota] Navigation: tab shell + floating pill bar; tab surfaces switch tabs, every other destination pushes on the Home stack. Evidence: PRs #505/#506. (2026-07-19)
- [sota] Generated design defaults: restrained editorial register, one accent color, no LLM default palettes (no purple gradients, no neon). Evidence: standing feedback. (2026-07-16)

## ASO

- [sota] Screenshot direction for Lock In Chinese: "editorial primer" (SET U) - warm rice-paper, numbered narrative, serif headline + benefit sub-line, straight-on device, 100% real captures. Fabricated/redrawn UI is an App Store 2.3.3 risk - never ship it. Evidence: ASO verdicts 2026-07-24; aso-lockin-chinese playbook. (2026-07-24)
- [sota] A listing may be one notch louder than the product but must not promise a different relationship (copy-chief ruling). (2026-07-24)
- [retired] Seal Poster (sets C/G), Dossier (D), Layered callouts (K) - rejected by owner; exception: K5 unlock-window panel stays locked/approved. (2026-07-24)
- [directional] Cool-modern-3D-young studies W1-W4 (exploded UI / dark premium / kinetic type) - on-brand, pending owner pick before extending to a full set. (2026-07-24)

## Growth & Analytics

- [sota] Growth-ops loop is the operating system: every experiment gets a ledger file in `docs/experiments/` (no file = no experiment; no DECIDED line = still open); readouts quote METRICS.md metric names only. Evidence: PR #1070, growth-ops playbook. (2026-08-01)
- [sota] Autonomy boundary: agents may autonomously launch copy-string metadata experiments only; price, product, KV-publish, trial-length, and hard-lock changes need explicit user go. Evidence: PR #1070. (2026-08-01)
- [sota] Amplitude over PostHog for product analytics; app extensions never emit analytics events. Evidence: analytics-per-app playbook. (2026-07-16)
- [sota] Deletion-intercept offer quick action (trick #1, code LOCKIN50): intercept app-deletion intent with a discount quick action. Evidence: growth-tricks playbook. (2026-07-19)
