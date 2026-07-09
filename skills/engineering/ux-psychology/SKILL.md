---
name: ux-psychology
description: Apply twelve cognitive-bias patterns (smart defaults, goal gradient, reciprocity, IKEA effect, loss aversion, contrast anchoring, effort justification, identity labeling, ego-driven sharing, Zeigarnik chunking, active learning, familiarity) when designing or critiquing UI. Use when generating or reviewing forms, onboarding flows, multi-step wizards, signup/auth walls, paywalls, pricing tables, upsells, progress indicators, retention screens, result reveals, profile/archetype screens, share cards, referral loops, tutorials, feature tours, or first-run setup - or when the user asks for a UX critique, conversion optimization, retention mechanics, viral loops, onboarding drop-off fixes, or to "make this screen convert better".
---

# UX Psychology

Twelve cognitive-bias rules for generating or critiquing UI. Rules 1-6 drive conversion on a single screen; rules 7-9 drive retention and acquisition across the product; rules 10-12 drive onboarding completion (most apps lose ~77% of users in the first 3 days - these are the counter). Each rule fires on a trigger surface - when the UI you're building or reviewing matches a trigger, apply that rule. For the psychology, evidence, and worked app examples behind each rule, see [REFERENCE.md](REFERENCE.md).

## Rules

### 1. Smart Defaults - combat decision fatigue

- **Trigger:** forms, settings pages, filter UIs.
- **Action:** never output blank fields. Pre-select the 80th-percentile most common choices (nearest location, today's date, quantity 1).
- **Copy:** replace generic CTAs ("Search") with value-driven ones ("View 12 Results").

### 2. Goal Gradient - manufacture momentum

- **Trigger:** multi-step wizards, onboarding flows, setup guides.
- **Action:** never start a progress bar at 0%. Include an implicit first step the user already completed by arriving ("Account created ✓" → 20%). Always show a visual progress cue: exact step counters ("Step 2 of 4") for short flows (under ~5 steps); for long flows where value hasn't landed yet, hide the daunting total behind a percentage bar or vague milestones ("Almost there") - the Typeform move.

### 3. Reciprocity - value before the gate

- **Trigger:** authentication walls, paywalls, lead-generation forms, first-run screens.
- **Action:** delay the gate. Serve a partial payload of real value first (run the scan, show 3 results), then gate the rest. In FTUE this is the eureka rule: the user must feel the core value within ~60 seconds - defer account creation, setup, and tutorials until after one successful core action (Breathwork's onboarding *is* a breathing session).
- **Copy:** frame auth as saving/unlocking value already visible ("Save the full report"), not "Sign Up".

### 4. IKEA / Endowment Effect - invest the user first

- **Trigger:** first-time user experiences (FTUE), registration flows.
- **Action:** invert the funnel. Push configuration, personalization, or a core task *before* the registration screen.
- **Copy:** final CTA is "Save My Progress" / "Keep My Setup", not "Create Account".

### 5. Loss Aversion - frame around what's at risk

- **Trigger:** retention interventions, subscription renewals, critical warnings.
- **Action:** frame the required action around the specific asset or capability the user is about to lose ("Your recent files will be deleted in 3 days"), not the gain of upgrading.
- **Copy:** dismiss buttons force explicit risk acknowledgment - "I accept the risk" / "Delete my files", never "Maybe Later".

### 6. Contrast Effect - anchor every price

- **Trigger:** pricing tables, upsells, add-on modules.
- **Action:** never present a cost in isolation. Inject a high-value anchor immediately before the target price (the $50 add-on sits under the $1,900 cart item).

### 7. Effort Justification / The Mirror - earned results feel personal

- **Trigger:** onboarding quizzes, data-capture flows, AI/analysis result reveals.
- **Action:** make the user work for the reveal. Break single forms into multi-step quiz flows; stage the result behind a visible analysis step ("Analyzing your inputs..."). The invested effort amplifies the perceived value of the output.
- **Constraint:** the output must genuinely derive from the collected inputs. Staged waits on real computation are fine; fake analysis over a canned result is deception (see Ethical boundary).

### 8. Identity Labeling / The Label - retention through self-concept

- **Trigger:** end-of-flow summaries, user profiles, gamification systems, stats dashboards.
- **Action:** never show only raw stats. Synthesize behavior into a definitive, flattering archetype or status the user can adopt ("Top 1% Listener", "Systems Architect"), with a badge or visual they can claim. Once the label is part of their identity, leaving costs a piece of themselves.
- **Copy:** name the archetype; don't describe the data ("You are The Advocate", not "You scored high on empathy").

### 9. Ego-Driven Sharing / The Flex - bragging as acquisition

- **Trigger:** sharing mechanics, referral programs, recap/dashboard summaries.
- **Action:** find the one piece of data the user is proudest of and package it as a minimal, aesthetic, watermarked card. Make Share the primary CTA, and make the share action and the invite action the same loop (recap unlocks by inviting a friend).
- **Copy:** the card speaks for the user's status, not the product ("12,000 km run this year", not "Made with AppName" as the headline).

### 10. Zeigarnik Chunking - tasks finish only if they look finishable

- **Trigger:** multi-step configurations, tutorials, setup wizards, dense instruction screens.
- **Action:** show at most ~3 steps per view. A begun task pulls toward completion, but only while the remaining steps look achievable - a visible 12-page manual kills the pull. If a process needs 10 steps, chunk it into 3-step groups where finishing one chunk reveals the next (progressive disclosure).

### 11. Active Learning - action turns into understanding

- **Trigger:** tooltips, help docs, feature tours, tutorials.
- **Action:** ban passive "Next, Next, Finish" modal tours. The tutorial advances only when the user performs the real interaction - click the actual button, drag the actual slider, type the actual command. Show contextual hints at the moment the user reaches that interaction point, not upfront (Sudoku apps drop you into a puzzle and hint as you play).

### 12. Familiarity / Instant Ownership - make it theirs in the first minute

- **Trigger:** app settings, workspace setup, profile creation, first-run defaults.
- **Action:** surface 1-3 high-impact preferences (voice, theme, layout density, core metric) immediately on entry, and re-render the UI live as each is chosen - the user must *feel* the impact (Speechify: pick voice, speed, highlight style before anything else). Like adjusting seat and mirrors in a new car: small controls make the product feel safe and theirs.
- **Distinct from rule 4:** IKEA is about sunk investment raising exit cost; familiarity is about comfort and trust raising engagement. Both fire in FTUE - the preference-picking *is* the first investment.

## Critique workflow

When reviewing an existing screen:

1. Identify which trigger surfaces the screen contains (form? gate? price? progress? warning? reveal? profile? share? tutorial? first-run?).
2. For each matched rule, check the Action and Copy lines above. Each violation is a finding.
3. Report findings as: **rule → violation → concrete rewrite** (the exact replacement default, copy, or layout change).

## Generation workflow

When building a new screen, run the trigger list before writing markup. Apply every matched rule in the first draft - defaults pre-filled, progress pre-seeded, gates delayed, prices anchored. Don't bolt them on after.

## Ethical boundary

These patterns reduce friction toward what the user already wants; they must not manufacture false urgency or trap users. Loss-aversion framing must state *true* consequences (files really will be deleted). Never fabricate scarcity, hide cancel paths, or use confirm-shaming for harmless dismissals - "I accept the risk" is for real risk only.

The retention/virality rules have the same honesty line. Effort justification must stage *real* computation - collecting inputs the output never uses is Barnum-effect fraud. Labels must be grounded in the user's actual data, not universally flattering horoscopes. Share-gates must say what unlocking costs ("Invite a friend to see your full recap"), never harvest contacts silently.
