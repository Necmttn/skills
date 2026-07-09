---
name: ux-psychology
description: Apply six cognitive-bias patterns (smart defaults, goal gradient, reciprocity, IKEA effect, loss aversion, contrast anchoring) when designing or critiquing UI. Use when generating or reviewing forms, onboarding flows, multi-step wizards, signup/auth walls, paywalls, pricing tables, upsells, progress indicators, or retention screens - or when the user asks for a UX critique, conversion optimization, or to "make this screen convert better".
---

# UX Psychology

Six cognitive-bias rules for generating or critiquing UI. Each rule fires on a trigger surface - when the UI you're building or reviewing matches a trigger, apply that rule. For the psychology, evidence, and worked app examples behind each rule, see [REFERENCE.md](REFERENCE.md).

## Rules

### 1. Smart Defaults - combat decision fatigue

- **Trigger:** forms, settings pages, filter UIs.
- **Action:** never output blank fields. Pre-select the 80th-percentile most common choices (nearest location, today's date, quantity 1).
- **Copy:** replace generic CTAs ("Search") with value-driven ones ("View 12 Results").

### 2. Goal Gradient - manufacture momentum

- **Trigger:** multi-step wizards, onboarding flows, setup guides.
- **Action:** never start a progress bar at 0%. Include an implicit first step the user already completed by arriving ("Account created ✓" → 20%).

### 3. Reciprocity - value before the gate

- **Trigger:** authentication walls, paywalls, lead-generation forms.
- **Action:** delay the gate. Serve a partial payload of real value first (run the scan, show 3 results), then gate the rest.
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

## Critique workflow

When reviewing an existing screen:

1. Identify which trigger surfaces the screen contains (form? gate? price? progress? warning?).
2. For each matched rule, check the Action and Copy lines above. Each violation is a finding.
3. Report findings as: **rule → violation → concrete rewrite** (the exact replacement default, copy, or layout change).

## Generation workflow

When building a new screen, run the trigger list before writing markup. Apply every matched rule in the first draft - defaults pre-filled, progress pre-seeded, gates delayed, prices anchored. Don't bolt them on after.

## Ethical boundary

These patterns reduce friction toward what the user already wants; they must not manufacture false urgency or trap users. Loss-aversion framing must state *true* consequences (files really will be deleted). Never fabricate scarcity, hide cancel paths, or use confirm-shaming for harmless dismissals - "I accept the risk" is for real risk only.
