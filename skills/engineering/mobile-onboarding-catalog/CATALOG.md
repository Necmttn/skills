# Mobile Onboarding Catalog - Evidence

Per-app onboarding entries, cited benchmark numbers, and the resource directory behind [SKILL.md](SKILL.md). Read this to justify a pattern, copy a specific move, or check a number against a source.

## How to update this catalog

Each app entry uses this template. Re-verify and re-date any entry you touch.

```
### App name (category)
- **Flow:** ordered screens - what happens step by step.
- **Quiz length:** number of questions/screens if any.
- **Paywall:** when it appears (during onboarding / after value / at end / none).
- **Signup:** when the account gate appears.
- **Key moves:** the distinctive personalization/activation/virality mechanics.
- **Patterns:** P-numbers from SKILL.md.
- **Why it works:** the one load-bearing reason.
- **Sources:** primary links.
- **Verified:** date. **Confidence:** primary / strong-secondary / thin.
```

Maintenance rules:
- Cite the source that OWNS the claim (the teardown publisher, the benchmark report, the company blog), not a listicle.
- Prefer growth.design, ScreensDesign, Mobbin, UserOnboard, RevenueCat/Adapty, and company blogs over generic articles.
- When a benchmark has a new annual edition (RevenueCat/Adapty), replace the number and bump the edition tag.
- Flag confidence honestly. "thin" = flow-gallery screens only, no narrative teardown.
- New apps: add under the category that fits; keep entries terse.

---

## App catalog

### Duolingo (language learning)
- **Flow:** open to a "start lesson" home (no login gate) -> language + motivation + self-assessed level -> complete a real first lesson (~15 items) BEFORE any account -> streak/progress screen -> signup wall AFTER the lesson -> notification priming + "Investment Wager" (stake gems to protect a streak).
- **Quiz length:** short motivation/level intake, then a ~15-item lesson.
- **Paywall:** freemium; no hard onboarding paywall, Super upsell comes later.
- **Signup:** deliberately AFTER the first lesson (moving it there raised DAUs ~20%).
- **Key moves:** motivation capture; the Investment Wager raised D7 retention +14%; late-night streak-saver notification.
- **Patterns:** P1, P7, P10.
- **Why it works:** delivers a completed lesson (real "magic") before asking for anything; the wager converts sunk streak into retention.
- **Sources:** [Growth.Design - Duolingo User Retention](https://growth.design/case-studies/duolingo-user-retention).
- **Verified:** 2026-07-16. **Confidence:** primary.

### Headspace (meditation)
- **Flow:** experience level -> session length -> "what brought you to Headspace" (goal) -> recommended first session -> onboarding IS a ~2-min guided meditation (reachable in ~9-10 taps) -> post-session mood check -> account/paywall after value.
- **Quiz length:** very short, 2-3 questions.
- **Paywall:** after the first-session experience, usually with a free trial.
- **Signup:** after try-it-first.
- **Key moves:** self-segmentation on experience + goal makes the first session feel immediately relevant; articulating a goal raises motivation.
- **Patterns:** P2, P1.
- **Why it works:** the core value (a real meditation) is experienced inside onboarding before any commitment.
- **Sources:** [UserOnboard - How Headspace Onboards New Users](https://www.useronboard.com/how-headspace-onboards-new-users/), [Appcues GoodUX - Headspace's mindful onboarding](https://goodux.appcues.com/blog/headspaces-mindful-onboarding-sequence).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Calm (meditation)
- **Flow:** opens by prompting a single deep breath (instant relief) -> "what are you looking for?" multi-select goals -> personalized feed shaped by answers -> ongoing mood check-ins -> account + paywall.
- **Quiz length:** short multi-select goal picker.
- **Paywall:** during onboarding at peak relaxation; account creation bundled with subscription (~$69.99/yr) softened by a 7-day trial.
- **Signup:** bundled with the paywall near the end.
- **Key moves:** goal multi-select -> tailored feed; recurring mood check-ins; instant checkmark feedback reduces form friction.
- **Patterns:** P2, P8.
- **Why it works:** sells the emotional state first (a deep breath = instant proof), then presents the paywall when the user is most receptive.
- **Sources:** [Appcues GoodUX - Calm's new user experience](https://goodux.appcues.com/blog/calm-app-new-user-experience), [ScreensDesign - Calm](https://screensdesign.com/showcase/calm).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Noom (weight/health) - the quiz-funnel benchmark
- **Flow:** long intake quiz (~10 core behavioral-profile slider questions, branching adds follow-ups) -> email capture ~1/3 through -> animated projected weight-loss chart -> "building your plan" loading screens (some long, teaching moments that slip in more questions) -> results reveal referencing typed goal weight -> pace selection -> paywall after ~100 screens ("pay what you want" 14-day trial at $1/$5/$14, then standard pricing; bonus with a 15-min countdown).
- **Quiz length:** up to 113 screens total, 10-15 minutes; ~10 behavioral questions form the core.
- **Paywall:** after ~100 screens - maximum time/effort/emotion invested.
- **Signup:** email requested before the results reveal.
- **Key moves:** goal weight is the backbone of every projection; conditional branching; visible progress; animated projection chart. Related stat: 55% of trial cancellations happen Day 0.
- **Patterns:** P3, P4, P5, P8.
- **Why it works:** progressive commitment - by the paywall, time/effort/emotion are already sunk, so it converts on sunk-cost plus a personalized projected outcome.
- **Sources:** [RevenueCat - Inside Noom's Web-to-App Onboarding Funnel](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel/), [Web2App World - Noom breakdown](https://web2appworld.com/breakdowns/noom/).
- **Verified:** 2026-07-16. **Confidence:** primary.

### Cal AI (AI calorie counter)
- **Flow:** short demo video up front -> extensive personalization quiz (heavy animation/interaction) -> mid-onboarding review prompt (App Store rating while engaged) -> personalized plan -> hard paywall (card required): free-trial hook -> anchor $10/mo ($120/yr) -> yearly framed as 80-90% discount -> decline triggers a ~$20/yr second offer.
- **Quiz length:** extensive, exact count undisclosed ("a masterclass in quiz funnels").
- **Paywall:** end of onboarding, card-required hard gate. (One X teardown called it "soft"; revenue/case-study sources say hard - weighted to primary.)
- **Signup:** card capture at the paywall.
- **Key moves:** photo-to-calories value teased early; plan tailored to quiz; mid-flow rating prompt; ran 61 paywall experiments, grew revenue 3x+ in 10 months.
- **Patterns:** P3, P4, P8.
- **Why it works:** the paywall is the most-optimized surface, pairing an invested quiz funnel with an aggressively tuned hard paywall.
- **Sources:** [Superwall - How Cal AI scaled paywall experimentation](https://superwall.com/case-studies/cal-ai).
- **Verified:** 2026-07-16. **Confidence:** primary.

### Runna (running plans)
- **Flow:** auto-advancing intro carousel (Instagram-Stories style) -> detailed quiz (goal, level, weekly availability, start date, local terrain) -> fitness estimation from answers -> personalized plan generated -> 1-week free trial starts -> hard paywall after trial (annual "SAVE 50%", weekly-price breakdown, star rating + testimonials at the decision point).
- **Quiz length:** long/detailed.
- **Paywall:** end of onboarding, gated behind a 1-week trial then hard paywall.
- **Signup:** around plan generation / trial start.
- **Key moves:** fitness-level estimation means two users with the same race date start at different plan points.
- **Patterns:** P3, P5, P8.
- **Why it works:** by trial's end the user has an active personalized plan, so quitting feels like abandoning progress.
- **Sources:** [UX Collective - Runna onboarding case study](https://uxdesign.cc/how-to-nail-onboarding-a-case-study-of-runna-7780ba89c202), [ScreensDesign - Runna](https://screensdesign.com/showcase/runna-running-training-plans).
- **Verified:** 2026-07-16. **Confidence:** primary.

### Flo (women's health / period tracking)
- **Flow:** thorough conversational cycle/health quiz (dozens of questions, each with a micro-reinforcement) -> personalized profile -> a "tap and hold" commitment gesture -> paywall (Premium $39.99/yr or $11.49/mo).
- **Quiz length:** long - dozens of questions framed as a guided conversation.
- **Paywall:** after the full quiz, right after the tap-and-hold gesture.
- **Signup:** profile built during the quiz.
- **Key moves:** per-answer micro-validation keeps a long quiz from fatiguing; the tap-and-hold manufactures active commitment right before the ask.
- **Patterns:** P3, P7, P8.
- **Why it works:** the conversational quiz makes a very long intake feel effortless, and the gesture creates commitment at the ask.
- **Sources:** [ScreensDesign - Flo](https://screensdesign.com/showcase/flo-period-pregnancy-tracker), [PaywallPro/dev.to - onboarding breakdown to paywall](https://dev.to/paywallpro/complete-onboarding-breakdown-9-steps-from-first-screen-to-paywall-2j7).
- **Note:** long-term users report "bait and switch" as free features moved behind Premium - a retention risk, not a model to blindly copy.
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Fabulous (habit / behavior design)
- **Flow:** long personalization quiz -> a signed commitment contract (user "signs" their intention) -> guided into small "journeys" building toward a ritual -> soft paywall / free-trial offer only AFTER quiz + contract.
- **Quiz length:** long, deliberate sunk-cost building.
- **Paywall:** after quiz and signed contract, soft/trial.
- **Signup:** buy-in captured via the contract before the paywall.
- **Key moves:** the signed commitment contract personalizes intent and creates public buy-in.
- **Patterns:** P2, P7.
- **Why it works:** the paywall lands on someone already psychologically bought in via their own signed goal.
- **Sources:** [ScreensDesign - Fabulous](https://screensdesign.com/showcase/fabulous-daily-habit-tracker), [The Behavioral Scientist - Fabulous onboarding critique](https://www.thebehavioralscientist.com/articles/fabulous-app-product-critique-onboarding).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Babbel (language learning)
- **Flow:** select target language -> probe motivation -> define specific goals (conversation/reading/culture) -> self-assess level or take a placement test -> account setup -> soft paywall (free trial).
- **Quiz length:** ~17 onboarding steps.
- **Paywall:** soft, after personalization + account setup; 7-day trial; 3/6/12-month plans framed with longer-commitment savings.
- **Signup:** account created before the paywall, after goal/level personalization.
- **Key moves:** motivation + goal + placement-test level tailoring.
- **Patterns:** P3, P8.
- **Why it works:** meticulous 17-step personalization (incl. a real placement test) makes the course feel calibrated before the soft trial-led paywall.
- **Sources:** [ScreensDesign - Babbel](https://screensdesign.com/showcase/babbel-language-learning), [Uiland - Babbel onboarding flow](https://uiland.design/flows/Onboarding/Babbel).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Blinkist (book summaries)
- **Flow:** paid social ads drive to a web article/quiz first (web-to-app) -> web onboarding quiz (topic/goal interests) precedes account -> tapping any summary triggers the paywall.
- **Quiz length:** short topic/interest quiz.
- **Paywall:** hard - clicking a summary gates a subscription/trial. The "honest paywall" variant showed a clear trial timeline + "we'll remind you before you're charged" + notification opt-in.
- **Signup:** at the paywall, after the quiz.
- **Key moves:** honest-paywall transparency: +23% trial signups; push opt-in 6% -> 74% (~1,200% lift); complaints down 55%.
- **Patterns:** P8, P9, P10.
- **Why it works:** disarms the biggest purchase fear (surprise charge) with transparency, converting anxiety into a notification opt-in and a subscription at once.
- **Sources:** [growth.design - Trial Paywall Challenge](https://growth.design/case-studies/trial-paywall-challenge), [RevenueCat - web-to-app funnel examples](https://www.revenuecat.com/blog/growth/web-to-app-funnel-examples).
- **Verified:** 2026-07-16. **Confidence:** primary.

### Spotify (media)
- **Flow:** signup (email/Apple/Google/Facebook) -> pick at least 3 artists from a photo grid -> home screen instantly filled with matching playlists/songs. Install-to-music under ~2 min.
- **Quiz length:** minimum-3-artists picker with dynamic recommendations.
- **Paywall:** none in onboarding; free tier starts immediately, Premium upsell deferred/contextual (ads, offline, skips).
- **Signup:** up front - personalization is the entire value, no meaningful browse-before-signup.
- **Key moves:** artist photos (not text) drive stickiness; the 3-artist input is the minimum that turns a generic app into "your" app.
- **Patterns:** P6, P1.
- **Why it works:** delivers a personalized library in under two minutes before you reach the home screen.
- **Sources:** [Mobbin - Spotify iOS flow](https://mobbin.com/explore/flows/2ca9968b-a50d-4910-89e7-e894023d7d21), [Medium - Spotify onboarding deep-dive](https://medium.com/@smarthvasdev/deep-dive-into-spotifys-user-onboarding-experience-f2eefb8619d6).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary (Mobbin flow primary for screens).

### Speechify (text-to-speech)
- **Flow:** welcome -> "what do you read most for?" (use case) -> "what type of voice?" grid -> swipeable voice carousel (200+ voices) -> playback-speed setting -> summary screen listing chosen profile/usage/voice/speed with checkmarks -> paywall -> account. ~11-34 screens by variant.
- **Quiz length:** ~11-34 screens depending on the test variant.
- **Paywall:** after the personalization sequence. Speechify A/B-tested minimize-onboarding vs long-onboarding-before-paywall over 80+ tests / 8 months; the long-onboarding direction won.
- **Signup:** at/after the paywall, near the end.
- **Key moves:** picking voice + speed before paying creates ownership; the summary reflects choices back with checkmarks.
- **Patterns:** P6, P13, P8.
- **Why it works:** by the paywall the user has "built" their ideal reading voice, so subscribing feels like unlocking something they configured.
- **Sources:** [Nicholas Hunter - Speechify onboarding case study](https://www.nicholashunter.design/speechify-onboarding).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary (step order assembled from multiple sources).

### Strava (fitness social)
- **Flow:** signup -> progressive intro to activity feed + social features -> first activity summary shows value fast -> paid features (routes, advanced analytics) disclosed progressively.
- **Quiz length:** none.
- **Paywall:** deferred/progressive; free tracking + social first, subscription revealed later contextually.
- **Signup:** up front (social graph is core) but payoff lands fast.
- **Key moves:** every GPS activity auto-generates a shareable map + stats card; UGC shares estimated to drive ~40-50% of organic signups (2025); social proof via kudos, leaderboards, segments, clubs.
- **Patterns:** P11.
- **Why it works:** routine workouts become a viral acquisition loop while social proof creates the retention hook.
- **Sources:** [Strava support - sharing activities](https://support.strava.com/hc/en-us/articles/221089587-Sharing-Your-Strava-Activities), [LinkedIn - Strava product teardown](https://www.linkedin.com/posts/sowbhagyat_strava-product-teardown-new-user-onboarding-activity-7044915495405326336-3UsY).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary (share-% claims are estimates).

### BeReal (social)
- **Flow:** account creation -> add contacts -> notification-permission screen framed as "the only way to know when to post a BeReal!" -> teaches by doing: fires a notification, asks the user to tap it, advances only after they do.
- **Quiz length:** none; minimal fields.
- **Paywall:** none (free).
- **Signup:** up front, minimal.
- **Key moves:** the whole product is one daily action (dual-camera photo within 2 min of the daily notification); onboarding's real job is securing the notification opt-in because the notification IS the loop.
- **Patterns:** P10.
- **Why it works:** teaches the core behavior live and makes the daily notification feel indispensable, so the habit installs during onboarding.
- **Sources:** [nextleap - BeReal onboarding teardown (PDF)](https://assets.nextleap.app/submissions/BeRealNewUserOnboardingTeardown1-f987a2c2-cba1-4a2a-9ab6-2c37f029766a.pdf), [Mobbin - BeReal flow](https://mobbin.com/explore/flows/1e02df10-24d6-4514-8659-bfeb933630db).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Revolut / Cash App (fintech)
- **Flow (Revolut):** limited access before full KYC -> KYC split into micro-steps (identity -> bank-link -> setup) -> starts light (typed name/DOB/address, not scans), heavier details later -> biometric selfie + document with immediate pass/fail -> asks financial goals to tailor the dashboard. **Flow (Cash App):** running in <2 min on phone/email; one question per screen ("What's your legal name?").
- **Quiz length:** none beyond staged KYC / profile fields.
- **Paywall:** none - monetization is per-transaction / premium features.
- **Signup:** up front but stripped to minimum per screen; full KYC deferred/staged.
- **Key moves:** one-question-per-screen + micro-step KYC; Revolut cut UK sign-up-to-verified from ~70 min to ~2 min (70% abandon KYC flows over 3 min).
- **Patterns:** P12.
- **Why it works:** perceived effort stays near zero and heavy verification is deferred until after investment, beating the 3-minute abandonment cliff.
- **Sources:** [GBG - Revolut KYC case study](https://www.gbg.com/en/our-customers/revolut-v1/), [Craft Innovations - Revolut onboarding analysis](https://craftinnovations.global/revolut-onboarding-flow-analysis/), [Userpilot - fintech onboarding](https://userpilot.com/blog/fintech-onboarding/).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Notion (productivity)
- **Flow:** profile setup (name + optional photo) -> workspace detection via email domain (join colleagues vs create) -> jobs-based questionnaire ("what do you need / how do you work?") -> UI preview that morphs in real time as you answer -> workspace naming -> guided tour surfacing templates matched to your use case, opt-out anytime.
- **Quiz length:** short jobs-based questionnaire.
- **Paywall:** none in onboarding (freemium; team/enterprise upsell later).
- **Signup:** up front.
- **Key moves:** the workspace preview visibly changes as you answer, and the tour drops you into a real template - beating blank-canvas paralysis.
- **Patterns:** P13, P6.
- **Why it works:** converts a segmentation survey into a live preview of your workspace, solving Notion's hardest problem (empty state).
- **Sources:** [Candu - How Notion crafts personalized onboarding](https://www.candu.ai/blog/how-notion-crafts-a-personalized-onboarding-experience-6-lessons-to-guide-new-users). Slack reference: [UserGuiding - Slack onboarding teardown](https://userguiding.com/blog/slack-user-onboarding-teardown).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### Airbuds (music / social recap)
- **Flow:** link a streaming service (Spotify/Apple Music) -> find/invite friends -> set up the home-screen widget (shows what friends play, live) -> weekly "pocket Spotify Wrapped".
- **Quiz length:** none; one action - link + find friends.
- **Paywall:** none (growth-first).
- **Signup:** up front, immediately followed by the invite requirement.
- **Key moves:** invite-to-unlock - you must invite friends to see more than your top 3 artists. 15M+ downloads, 5M MAU, 1.5M DAU.
- **Patterns:** P11.
- **Why it works:** the product is empty without friends and the recap withholds all but the top 3 artists until you invite - onboarding IS the viral loop.
- **Sources:** [Consumer App Lab - Inside Airbuds](https://consumerapplab.substack.com/p/inside-airbuds-the-app-that-grew), [techweez - Airbuds](https://techweez.com/2026/06/12/airbuds-the-app-that-turns-your-music-into-a-social-feed/).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary.

### RISE (sleep tracker) - the "analyzing" pattern beyond Noom
- **Flow:** opens with a "sleep is a drug" reframe -> quiz on sleep habits/schedule/goals -> introduces the "energy timeline" (circadian energy peaks/valleys) -> a screen that visibly shows it building your personalized plan (transparent processing, not a spinner) -> paywall -> signup.
- **Quiz length:** medium sleep-habits quiz.
- **Paywall:** after quiz + plan-generation reveal (quiz-funnel -> paywall).
- **Signup:** around the paywall, at the end.
- **Key moves:** two onboarding goals per the co-founder - (1) convince people sleep matters, (2) convince them RISE fixes a problem they may not know they have. Value-discovery onboarding, not feature-teaching.
- **Patterns:** P3, P4.
- **Why it works:** the "building your plan" screen shows the work rather than faking it - manufacturing earned value right before the paywall.
- **Sources:** [ScreensDesign - RISE Sleep Tracker](https://screensdesign.com/showcase/rise-sleep-tracker), [Reteno - RISE flow screens](https://gallery.reteno.com/flows/app-screens-rise).
- **Verified:** 2026-07-16. **Confidence:** strong-secondary (ScreensDesign page 403'd to fetch; detail via search + Reteno).

### Fitbod (strength training)
- **Flow:** "what's the main reason for joining?" (motivation) -> primary goal (muscle/strength/endurance) -> experience level -> "what equipment do you have?" -> generates one specific doable workout (not a template library) -> optional Apple Health sync -> notification opt-in with concrete framing -> progressive tutorial; paywall.
- **Quiz length:** short, ~3-4 personalization questions + equipment.
- **Paywall:** after personalization; exact placement thinly documented (flagged).
- **Signup:** not precisely documented.
- **Key moves:** equipment + experience + goal produce one concrete, immediately-usable workout, proving the "personal trainer" promise upfront.
- **Patterns:** P3, P10.
- **Why it works:** personalization yields one usable plan, not options, so value is immediate.
- **Sources:** [App Fuel - Fitbod onboarding](https://www.theappfuel.com/examples/fitbod_onboarding), [Uiland - Fitbod paywall flow](https://uiland.design/flows/Paywall%20and%20Subscription/Fitbod).
- **Verified:** 2026-07-16. **Confidence:** thin (paywall placement unverified; strongest on the equipment/experience personalization).

---

## Benchmarks

Numbers below are from the primary source that owns them. Edition/year tagged. Health & Fitness pulled out where available since it maps to dotself and the Lock In language apps' subscription model.

### Paywall placement and conversion
- Install-to-paid: **hard paywall 10.7% median vs freemium 2.1% median** (~5x) - [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps).
- Onboarding paywall WITH trial converts install-to-paid at **1.35% avg (highest placement)** vs in-app 0.89%; onboarding without trial 0.82% vs in-app 0.76% - [Adapty - high-performing paywall 2026](https://adapty.io/blog/high-performing-paywall-2026/).
- Onboarding paywalls without a trial have the **highest conversion rate at 37.45%** but the lowest long-term value - [Adapty State of In-App Subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions/).
- **Hard paywalls generate 21% higher LTV per subscriber** than soft; hard median LTV $41.9 vs soft $20.0. Soft paywalls convert ~50% better but earn less per user - [Adapty - high-performing paywall 2026](https://adapty.io/blog/high-performing-paywall-2026/).
- Case studies moving the paywall earlier: **Greg raised sign-up-to-trial from 3% to 15% (5x)**; **Rootd got a 5x revenue increase** - [RevenueCat - optimizing paywall placement](https://www.revenuecat.com/blog/growth/paywall-placement).

### Trial timing (why the paywall belongs on Day 0)
- **82% of trial starts happen the same day as install** - [RevenueCat SoSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025).
- **90% of trial starts happen on Day 0**; 44.5% of all purchases happen on Day 0 - [Adapty SoIAS 2026](https://adapty.io/state-of-in-app-subscriptions/).
- In Health & Fitness, **86.1% of trials convert on Day 0** - [Adapty - Health & Fitness benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/).
- Interpretation both vendors converge on: the subscribe decision happens once, on Day 0; non-converters rarely return - place the hard paywall inside/at end of onboarding.

### Trial-to-paid and install-to-trial
- Trial-to-paid by category: **Travel 43.5% median, Health & Fitness 37.7%**, Gaming 25.0%, Photo & Video 22.2% - [RevenueCat SoSA 2026](https://www.revenuecat.com/state-of-subscription-apps).
- Longer trials convert higher: **17-32 day trials 42.5% median vs <=4-day trials 25.5%** - [RevenueCat SoSA 2026](https://www.revenuecat.com/state-of-subscription-apps).
- Global install-to-trial: **5.7% median** (RevenueCat 2026); North America 7.1% median, top quartile >15%. Adapty reports global install-to-trial **10.9%**, trial-to-paid 25.6% ([Adapty SoIAS 2026](https://adapty.io/state-of-in-app-subscriptions/)) - the two differ by dataset/method; cite whichever matches your measurement.

### Pricing / plan configuration
- **Weekly plan with a 3-day free trial delivers ~1.5x the average LTV** of other configs; weekly+trial raised LTV from $7.40 to $54.50 (636%) - [Adapty - high-performing paywall 2026](https://adapty.io/blog/high-performing-paywall-2026/).
- Weekly plans convert **1.7-7.4x better than annual** across price tiers; 9 in 10 subscriptions sell at full price - [Adapty SoIAS 2026](https://adapty.io/state-of-in-app-subscriptions/).

### Health & Fitness category (maps to dotself + Lock In apps)
- **Install-to-trial 9.5% global / 14.5% North America; trial-to-paid 42.2%; first renewal 67.7%; onboarding paywalls with trials hit 1.78% install-to-paid** - [Adapty - Health & Fitness benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/).
- **Install-to-paid 2.9% median (highest of all categories)**; D14 revenue-per-install $0.48 median (leads all); year-1 realized LTV per payer $35.64 median; **68% of subscriptions are annual** - [RevenueCat SoSA 2026](https://www.revenuecat.com/state-of-subscription-apps).

### Onboarding drop-off / retention
- **"The average app loses 77% of its DAUs within the first 3 days after install"** (90% within 30 days, 95%+ within 90) - Quettra data (>125M devices), originally reported by [Andrew Chen - losing 80% of mobile users is normal](https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal-and-that-the-best-apps-do-much-better/). Cite precisely: it measures DAU-curve decay, not "installers who never return".
- **Only 4.6% of apps reach $10K MRR within two years** (all categories) - [RevenueCat SoSA 2026](https://www.revenuecat.com/state-of-subscription-apps).

### Quiz-funnel length
- No rigorous published A/B proving "longer quiz -> higher paid conversion" from a primary owner. The defensible mechanism: paywalls placed after a value/commitment event convert better (RevenueCat/Adapty above), and Noom's **113-screen / ~10-question** funnel is the industry template - [RevenueCat - Noom funnel](https://www.revenuecat.com/blog/growth/web-to-app-onboarding-funnel/). Speechify's own testing found long-onboarding-before-paywall beat minimal onboarding - [Nicholas Hunter](https://www.nicholashunter.design/speechify-onboarding). Treat "longer quiz converts better" as directional, not proven.

### KYC / fintech onboarding friction
- **70% of users abandon KYC flows longer than 3 minutes**; Revolut cut UK sign-up-to-verified from ~70 min to ~2 min - [GBG - Revolut case study](https://www.gbg.com/en/our-customers/revolut-v1/).

### Numbers to verify before quoting (secondary-only)
- D1/D7/D30 retention by category (e.g. consumer-social D1 40-50% / D7 20-30% / D30 10-15%; gaming D1 ~29-33%) - reached only via aggregators (MWM, Plotline), not the owning Amplitude/Adjust reports. The primary reports (Amplitude Product Benchmarks, Adjust benchmark tool) are gated/JS-driven.
- RevenueCat per-category monthly-churn specifics (first-renewal 30-50% weekly / 15-40% monthly; ~10% of monthly payers reach year 2) - surfaced via search snippet attributed to the 2025 report, not confirmed on the fetched page (full churn tables are in the email-gated PDF).

---

## Resource directory

Ongoing sources to mine. Format: what it is, cost, how to use it for onboarding study. All verified live 2026-07-16.

### Screenshot & flow libraries
- **[Mobbin](https://mobbin.com)** - freemium (Starter ~$20/seat/mo; **Pro ~$40/mo adds user-flow recordings**). Deepest searchable library of real mobile/web screens organized into flows. Pro tier is the one for studying full onboarding sequences screen-by-screen.
- **[ScreensDesign](https://screensdesign.com)** - paid (~EUR 60/quarter). Video previews of iOS onboarding + paywall flows from ~1,500 top-grossing apps, tagged with revenue/conversion signals. Best source for the MOTION of a flow (question -> loading -> paywall). Filter by revenue to study only proven flows.
- **[Page Flows](https://pageflows.com)** - paid (from $8.25/user/mo annual; $2.95 3-day trial). 79,000+ screens, 20,000+ apps, hundreds of recorded flow videos incl. a dedicated iOS onboarding section. Cheaper than Mobbin Pro for flow recordings.

### Teardowns & case studies (psychology-led)
- **[Growth.Design](https://growth.design/case-studies)** - free (freemium email). Comic-format teardowns tying UI choices to named cognitive biases. Best free "why it works" resource; one new teardown weekly.
- **[UserOnboard](https://www.useronboard.com/user-onboarding-teardowns/)** - free (Samuel Hulick). The original first-run teardowns. Largely a historical archive now (Hulick consults) - use for timeless first-run principles, not fresh examples.
- **[Appcues blog / GoodUX](https://www.appcues.com/blog)** - free. Practitioner onboarding-UX guides + a weekly gallery of real examples. SaaS/web-leaning but the pattern taxonomy transfers.

### Subscription / paywall growth (mobile-specific)
- **[RevenueCat blog](https://www.revenuecat.com/blog) + [Sub Club podcast](https://subclub.com)** - free. The definitive mobile-subscription growth channel: paywall placement, gating, trial timing, operator interviews. Read "optimizing paywall placement" + the annual State of Subscription Apps report.
- **[Adapty blog](https://adapty.io/blog) + [State of In-App Subscriptions](https://adapty.io/state-of-in-app-subscriptions/)** - free. Hard benchmark data by placement/category/trial ($3B rev / 16,000+ apps). Report is interactive - benchmark your own category. Also the [Paywall Library](https://adapty.io/paywall-library/).
- **[Superwall blog](https://superwall.com/blog)** and **[Apphud blog](https://apphud.com/blog)** - free. Paywall-experimentation teardowns and best-performing-paywall roundups.
- **[Superwall YouTube channel](https://www.youtube.com/@SuperwallHQ/videos)** (ongoing source) - free. Weekly operator interviews with consumer-app founders (median ~$1M ARR) covering onboarding-as-pitch, hard/soft paywall placement, trial-anxiety reminders, price/packaging, and UGC acquisition. 30 most-recent videos mined into structured takeaways in [sources/superwall-videos.md](sources/superwall-videos.md); strongest paywall-design evidence is "I made 4,000 app paywalls" (Superwall lead designer) and the dual/anticipation paywall breakdowns. Keep mining older videos as the queue in that file allows.

### Practitioner voices & creators
- **[Peter Loving / UserActive](https://www.youtube.com/@UserActive)** - free. Onboarding + paywall UX breakdowns from a conversion-focused studio.
- **[Rosie Hoggmascall - Growth Dives](https://www.rosiehogg.com)** (LinkedIn / [Medium](https://medium.com/@rosiehoggmascall)) - freemium. Weekly annotated teardowns of monetisation/onboarding flows with real opt-in numbers. Her flow-order A/B (paywall-before-onboarding lifting opt-in 2%->8%->15%) is a canonical lesson.
- **[Appfigures App Teardowns](https://appfigures.com/resources/app-teardowns)** - free content. ASO/store-listing + growth teardowns; complements the UX sources with the acquisition side.

### Consumer virality strategy
- **[Nikita Bier on Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-to-consistently-go-viral-nikita-bier)** ([video](https://www.youtube.com/watch?v=bhnfZhJWCWY)) - free. The reference playbook for consumer onboarding friction removal + viral loops (TBH/Gas founder): show core value in the first seconds, strip every ounce of friction, target dense networks. His X @nikitabier is the running-thread source.

### Activation strategy (canonical long-form)
- **[Lenny Rachitsky - What is a good activation rate](https://www.lennysnewsletter.com/p/what-is-a-good-activation-rate)** - freemium. Defines the activation milestone = earliest onboarding point predictive of long-term retention. The best practitioner framing of the aha-moment. Pair with the free [Lenny's Wiki](https://www.lennyrachitsky.wiki) Activation/Onboarding entries.
- **[Reforge - Retention & Engagement](https://www.reforge.com/courses/retention-and-engagement)** - paid course; some free [Activation Strategy artifacts](https://www.reforge.com/artifacts/c/growth/activation-strategy). Deepest structured curriculum on defining activation moments and mapping the journey.
- **[Chamath Palihapitiya - Facebook "7 friends in 10 days"](https://ryangum.com/chamath-palihapitiya-how-we-put-facebook-on-the-path-to-1-billion-users/)** - free. The origin of the aha-moment/magic-number concept. Balance with [Mixpanel - Magic numbers are an illusion](https://mixpanel.com/blog/magic-numbers-are-an-illusion/) for the modern "these correlations aren't causal" critique.

### Competitor data (paid, enterprise)
- **[Sensor Tower](https://sensortower.com)** - paid, sales-led (no free tier, ~$500/mo entry). Downloads/revenue/rankings + ad/usage intelligence. Overkill for pure UX study; use only for hard competitor install/revenue numbers. **data.ai (App Annie) was acquired by and is folding into Sensor Tower** - treat as one vendor.

### Could not verify
- **"App Fights"** - no app/podcast/newsletter by this name found (2 searches). Likely misremembered or defunct. Substitutes above: Appfigures teardowns, Superwall, Apphud.
- **[Demand Curve - The Frontier](https://www.demandcurve.com/newsletter)** - free, verified, worth adding as a broad growth/acquisition newsletter (not onboarding-specific).
