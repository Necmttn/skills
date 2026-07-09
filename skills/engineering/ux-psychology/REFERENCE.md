# UX Psychology - Reference

The psychology, evidence, and worked examples behind each rule in [SKILL.md](SKILL.md). Read this when you need to justify a finding to a stakeholder or pick between competing rules.

## 1. Smart Defaults (Decision Fatigue / Choice Overload)

**Concept:** Stacking choices on a user causes paralysis. The more decisions required at once, the more likely the user is to abandon the task.

**Evidence:** The jam study (Iyengar & Lepper, 2000). A grocery display with 24 jam flavors converted 3% of shoppers; reduced to 6 flavors, conversion jumped to 30%.

**App example:** A flight booking screen with 5 empty fields forces the user to build a query from scratch. A smart screen pre-fills the nearest airport, current date, and 1 passenger - shifting the user's task from "filling out a form" to "verifying data."

**Failure mode to flag in critique:** any form that opens with every field blank when sensible defaults are derivable (geolocation, current date, most common quantity, previous session's values).

## 2. Goal Gradient Effect (Momentum)

**Concept:** People accelerate toward a goal as they perceive themselves closer to finishing it (Hull, 1932; Kivetz, Urminsky & Zheng, 2006).

**Evidence:** The car-wash punch card study. Group A got a card with 8 empty slots. Group B got 10 slots with 2 pre-punched. Both required 8 washes, but Group B completed at nearly double the rate.

**App example:** Onboarding that says "0% Complete" feels like a mountain. Onboarding that says "20% Complete" because "Account Created" is already checked feels like momentum.

**Failure mode to flag:** progress indicators starting at 0%, step counters like "Step 1 of 9" with no credit for steps effectively done, checklists with nothing pre-checked.

## 3. Reciprocity (Value First)

**Concept:** Receiving something of value creates an unconscious pull to return the favor - like handing over an email address (Cialdini).

**Evidence:** Free food samples at Costco increase purchases of the sampled item by up to 2,000%.

**App example:** An SEO scanner that demands an account *before* scanning feels like a hostage situation. A scanner that runs the test, shows 3 critical errors, then asks for an email to "Save the full report" converts massively higher.

**Failure mode to flag:** any gate (signup, email capture, paywall) placed before the product has demonstrated any value on this visit.

## 4. IKEA Effect / Endowment Effect (User Investment)

**Concept:** People assign significantly higher value to things they built themselves or feel they own (Norton, Mochon & Ariely, 2012; Kahneman, Knetsch & Thaler, 1990).

**Evidence:** People overvalue cheap particle-board IKEA furniture simply because they spent two hours assembling it.

**App example:** Duolingo doesn't ask for signup on screen one. You pick a language, set a goal, and complete a 5-minute lesson first. By the time the signup screen appears, leaving feels like throwing away your work.

**Failure mode to flag:** registration as step one of a first-time experience; final CTA reading "Create Account" instead of "Save My Progress" after the user has configured anything.

## 5. Loss Aversion / Status Quo Bias

**Concept:** The psychological pain of losing something is roughly twice as powerful as the pleasure of gaining the same thing (Kahneman & Tversky, prospect theory - Nobel-recognized). Threats to what a user already has motivate action better than pitches for more.

**App example:** "Upgrade to get more space" (gain frame) is weak. "You are out of space. Your recent files will be deleted in 3 days" (loss frame) forces an immediate decision.

**Failure mode to flag:** retention or renewal screens framed purely as gains; dismiss buttons like "No Thanks" / "Maybe Later" that let users wave off a real, specific loss without acknowledging it.

**Ethical constraint:** the loss must be real. Fabricated deadlines or fake deletion threats are dark patterns, not loss aversion - see the Ethical boundary section in SKILL.md.

## 6. The Contrast Effect (Relative Anchoring)

**Concept:** The brain cannot evaluate numbers in isolation; it evaluates each new number relative to the one seen immediately before it (Tversky & Kahneman, anchoring).

**Evidence:** A restaurant puts a $90 steak on the menu so the $40 salmon reads as a reasonable deal.

**App example:** A $50/year protection plan on its own page triggers "$50 is a lot." The same plan directly beneath a $1,900 laptop in the cart reads as a rounding error (2.6%).

**Failure mode to flag:** any price, add-on, or upsell rendered on a screen with no larger reference value preceding it; pricing tables without a premium anchor tier.

## Rule interactions

- **Reciprocity + IKEA** compound in FTUE: deliver value first (reciprocity), have the user build something with it (IKEA), *then* gate. Duolingo runs both.
- **Goal Gradient + IKEA** compound in wizards: pre-punched progress starts momentum; each completed step deepens investment.
- **Loss Aversion supersedes Reciprocity** for existing users: retention screens should protect what the user has, not offer new gifts.
- **Contrast + Smart Defaults** in pricing: the anchor tier is the contrast; the pre-selected middle tier is the smart default. Use together - an anchored table with nothing pre-selected still forces a decision.
