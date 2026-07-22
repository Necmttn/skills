# Mobbin - "I Studied 1,460 Onboarding Flows. Here's What I Found."

Source: [YouTube, Mobbin channel](https://www.youtube.com/watch?v=Qsq-Sj_rojU), 10 min. Mined 2026-07-22 from auto-captions **plus frame extraction** - every app below with a screen transcription in [SCREENS.md](../SCREENS.md) was confirmed by reading the frame, which corrected several caption mishearings (see "Name corrections" at the bottom). Names still flagged `(?)` were audible only, never shown on screen.

Dataset (from the study's own data screens): **1,460 onboarding flows, 986 apps & websites, snapshot April 2026.** Mobbin's internal library counts - primary for library composition, not A/B evidence.

## Dataset findings

- **Average onboarding length by platform: iOS 26.5 screens, Android 24.9, Web 21.0** - web is 21% shorter than iOS. Mobile carries the extra permission + paywall screens. ("Average app has 25 screens" in the narration is the cross-platform figure.)
- **Top 10 longest flows:** Hyundai Card, Lemonade Insurance, Monzo, Noom, Neo Financial, Kit, Philips Hue, Chase UK, Upwork, Mercury - **7 of 10 are finance apps.** Longest categories overall: finance, health & fitness, education. Several of the longest belong to the most successful apps.
- Shortest flows: 3 of the shortest are **AI products** - AI tools skip upfront questions and let the product learn from usage.
- **23% of apps personalize during onboarding; AI apps only 7%.**
- **22% of 900+ apps/websites show a paywall during onboarding.** (Consistent with the RevenueCat/Adapty placement data in CATALOG.)
- Duolingo: **~60 screens before signup** - and it doesn't feel long.
- Culture caveat: Eastern-market users tolerate information-dense interfaces; what reads as clutter to one audience reads as efficient to another. Don't port density judgments across markets.

## Core thesis

Best onboarding = signup -> setup -> **aha moment** (Airbnb first booking, Netflix finding a show, Mobbin saving a screen). The flows that stuck "didn't feel like onboarding." And some products need **no onboarding**: when the first action is the value (Mobbin browse, AI chat's first prompt), get out of the way. On-screen title card: *"It's the outcome, not the features."*

## Pattern evidence

Screen-by-screen transcriptions of the starred items live in [SCREENS.md](../SCREENS.md).

### Sell the outcome, not features (-> P14)
- **Superhuman** * - signup screen as pitch: "Save 4 hours per person every single week" + a logo rail (OpenAI, Airtable, Cursor, Brex) as social proof.
- **Alma** * (AI food tracker) - runs the core action pre-signup: "Let's try tracking some food. What's the last thing you ate?" with a visible Skip.
- **Runbuds** * - opening screen is pure animation (a running-track glyph on red), no copy at all.
- **Timehop** - welcome screen just shows the product in action on mobile + desktop. (Audible only; the frame at that timestamp showed a different app.)

### Founder's / human touch (-> P15)
- **Basecamp** * - "Welcome from Jason Fried, CEO" modal right after signup, with a direct email address and a note that a real example project is waiting.
- **Airbnb** * - Brian Chesky video ("Congratulations, Sam!") on completing your first listing - the human moment lands at the aha, not the start.
- **One Year(?)** * - founder's note, monospace body, hand-drawn flower, signed "Sam & Alec"; the 7-day trial ask is embedded in the note.
- **Tinder** - acknowledges when your birthday is near.

### Personalization with a visible payoff (-> P3/P5)
- **Headspace** * - "What's on your mind?" switched from single-pick to **multi-select -> +10% free-trial conversion**.
- **Thrive Market** * - "What are your goals with Thrive Market?" multi-option picker feeding an "Easy Order Builder", chunked with progress dots.
- **Flighty** * - "Choose Your Map Style" with real preview thumbnails during onboarding (-> P6).
- **Dollar Shave Club** * - quiz copy rewritten conversationally -> **+5.24% subscriptions** (A/B slide, source: conversion.com).
- **Endel** * - after 6 questions: "Your Focus collection is ready" + a cited "7x increase in focus (Arctop study)" + the user's answers restated as promised outcomes.
- **BytePal(?)** * - projected-progress curve (65kg -> 62kg), **"Reach your goal by 28 January 2026"**, macro plan, CTA "Commit to my goal".
- **Speak** * - "In two months, you'll be able to communicate while traveling in France" delivered as a chat message, with a graph contrasting speaking vs reading. Prior steps already had the user speaking.
- **Brilliant** - post-quiz home pre-populated with personalized courses.

### Paywall pairings (-> P8)
- **Timo** * - identity question ("Are you neurodivergent?") -> social-proof page (500,000 users, Apple Design Award Finalist) -> paywall whose headline mirrors the identity back ("Carefully crafted for neurodivergent people"), $12/mo vs $60/yr with 7-day trial, awards + 8000 reviews at the decision point.
- **Flighty** * - one-time offer shaped as a boarding pass: "-58%", barcode, haptics as it prints, 59-minute countdown, "Claim It Now".
- **Grammarly** * - quiz answers select the *recommended* plan -> **10-20% increase in plan upgrades** (source: growth.design).

### Long flows that feel short
- **Bump(?)** - creative loading states and animation on normally-dead steps like verification; frame showed a map-based social onboarding ("Get me in").
- **Bipul(?)** - 61 screens, a nameable virtual pet raccoon, "Gamification makes habits stick for up to 5x longer" badge, value restated throughout -> paywall.

### Just-in-time education (-> P16)
- **Cake Equity** * - dry domain (equity, vesting) with per-field tooltips, "don't worry, you can edit this later", and a human escape hatch ("Is this too much hassle? We can do it for you!").
- **Acorns** * - password requirements listed before typing and ticking off per keystroke; submit stays disabled until met.
- **Notion** * - "Getting Started on Mobile" is a real editable page with a partly pre-checked checklist - you learn the editor by editing the lesson. (This is the "to-do app, not a blank empty state" example in the narration.)
- **Mural** * - replaced popups/banners with a six-step "Mural basics" checklist showing "1 of 6 Complete" -> **+10% relative one-week retention** (source: insidergrowthhq.com). Checklists survive dismissal; popups don't.

### Notification pre-prompt (-> P10)
- A custom screen before the OS popup "improves accept rates significantly."
- **Brilliant** - "I'll remind you to learn so it becomes a long-term habit."
- **Centr(?)** * - renders the *actual notification card* you would receive ("Your Plan is READY - check out your workouts, meal plan and mindset activities"); CTA is the benefit ("GET MOTIVATED") with a visible SKIP.

### Friction is not monotonic (-> P12)
- **Houzz(?)** - split the sign-up form across multiple screens -> **+15% conversions**. Friction added in one place can remove it overall.

## Name corrections (captions -> frames)

Auto-captions garbled several names. Corrected by reading the frames; cite the right-hand column.

| Caption said | Actually | Evidence |
|---|---|---|
| "Runkeeper" | **Runbuds** | Mobbin panel label in frame |
| "Elma" | **Alma** | Mobbin panel label in frame |
| "Tide" | **Thrive Market** | app logo + "Easy Order Builder" in frame |
| "Focus Flight" | **Flighty** | map-style + boarding-pass paywall screens |
| "Endless" | **Endel** | "Start your Endel experience" in frame |
| "Timely" | **Timo** | "500,000 happy Timo users" in frame |
| "to-do apps" (generic) | **Notion** | "Getting Started on Mobile" page in frame |
| password-field example (unnamed) | **Acorns** | Acorns branding in frame |

Still unverified: "One Year", "BytePal", "Bump", "Bipul", "Centr", "Houzz". Confirm on Mobbin before citing these by name.

## Numbers to re-verify before load-bearing use

All the lift figures here are relayed by Mobbin from third parties (growth.design, conversion.com, insidergrowthhq.com). Two are visibly tighter on the slides than in the narration: Grammarly is **10-20%**, not "almost 20%"; Dollar Shave Club is **5.24%**, not "5%". Go to the owning source before quoting any of them in a spec.

## Deltas applied to this skill (2026-07-22)

- SKILL.md: added P14 (outcome-first welcome), P15 (founder's touch), P16 (just-in-time education); stat/example adds to P5, P6, P8, P10, P12; "no onboarding" added as a third model.
- SCREENS.md: new - wireframe transcriptions of 18 screens from this video, mapped to patterns.
- CATALOG.md: Mobbin-study benchmark block; Duolingo + Headspace entry updates.
