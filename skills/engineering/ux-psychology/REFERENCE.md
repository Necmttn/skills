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

**Failure mode to flag:** progress indicators starting at 0%, step counters like "Step 1 of 9" with no credit for steps effectively done, checklists with nothing pre-checked; long flows that expose a daunting exact total before any value has landed.

**Visual-cue calibration:** Marathon (social TV tracker) uses a quiet top progress bar in onboarding - enough feedback to sustain momentum, no fanfare. Typeform hides the total question count in long forms; when the finish line would demotivate rather than pull, show percentage or vague milestones ("Almost there") instead of "Step 2 of 12".

## 3. Reciprocity (Value First)

**Concept:** Receiving something of value creates an unconscious pull to return the favor - like handing over an email address (Cialdini).

**Evidence:** Free food samples at Costco increase purchases of the sampled item by up to 2,000%.

**App example:** An SEO scanner that demands an account *before* scanning feels like a hostage situation. A scanner that runs the test, shows 3 critical errors, then asks for an email to "Save the full report" converts massively higher.

**Failure mode to flag:** any gate (signup, email capture, paywall) placed before the product has demonstrated any value on this visit.

**FTUE corollary (the eureka effect):** ~77% of app users churn within the first 3 days; the strongest counter is delivering the core value inside the first 60 seconds. Breathwork's onboarding *is* a guided breathing session - the user feels calmer before being asked for anything. Drop the user into a simplified version of the main tool and let one successful core action complete before any signup, goal-picking, or tutorial.

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

## 7. Effort Justification / The Mirror (Barnum Effect + Sunk Cost)

**Concept:** Users rate an output as more personal and more valuable when they worked to get it. Two biases stack: the Barnum effect (generic statements engineered to feel individually tailored - Forer, 1949) and effort justification (Aronson & Mills, 1959; the sunk-cost side of cognitive dissonance). Friction before the reveal doesn't kill conversion - it amplifies the perceived value of what's revealed.

**App example:** Starcross (soulmate-prediction astrology app). Tedious onboarding - exact birth time, city, date - then a long "analyzing" loader, then a paywall in front of the result. The output is assembled from pre-written traits, but the invested effort makes it feel deeply custom.

**Failure mode to flag (generation):** instant, effortless reveals of high-stakes personalized output - a one-click "your result" undersells real analysis. **Failure mode to flag (critique):** the inverse fraud - long quizzes whose answers demonstrably don't change the output. That's the dark-pattern variant; see the ethical line below.

**Ethical line:** stage *real* computation. Every collected input must influence the output. A loader over genuine work is theater in the good sense; a loader over a canned result is fraud.

## 8. Identity Labeling / The Label (Identity-Driven Retention)

**Concept:** A specific, flattering label the user adopts as identity is the strongest retention mechanic available. Once "I am an X" enters their self-concept, abandoning the product means giving up a piece of themselves (self-perception theory - Bem, 1972; identity-based motivation).

**App example:** 16 Personalities (MBTI). Users get a four-letter archetype ("INFJ - The Advocate"), then put it in dating bios and use it to explain themselves at work. The label outlives any session.

**Failure mode to flag:** end-of-flow screens that dump raw stats ("You wrote 10,000 lines of code") instead of synthesizing an archetype ("Top 1% Systems Architect"); profiles with no claimable badge or status.

**Ethical line:** the label must be earned from the user's actual data. A label everyone receives regardless of input is a horoscope, and collapses the moment users compare notes.

## 9. Ego-Driven Sharing / The Flex (Virality)

**Concept:** The strongest referral program is one the user doesn't experience as marketing. Package the user's data into an aesthetic asset that proves their taste or status; the selfish act of bragging becomes the acquisition engine (costly signaling / social currency - Berger, *Contagious*, 2013).

**App example:** Airbuds - beautifully designed weekly listening recaps; unlocking the *full* recap requires inviting a friend, so the share asset and the invite are one loop. Also: Strava run maps, Wordle's green/yellow squares (which encode status while spoiling nothing), Spotify Wrapped.

**Failure mode to flag:** share buttons bolted onto screens with nothing brag-worthy; recap cards headlined by the product's brand instead of the user's achievement; referral programs that pay in discounts (transactional) where an ego-asset (status) would work harder.

**Ethical line:** the share-gate must state its price plainly ("Invite a friend to see your full recap"). Never harvest contacts or post on the user's behalf silently.

## 10. Zeigarnik Chunking (Cognitive Load / Finishability)

**Concept:** Incomplete tasks occupy the mind and pull toward completion (Zeigarnik, 1927) - but the pull only holds while the remaining work looks achievable. Exposing full complexity upfront (the 12-page IKEA manual) flips the effect into abandonment. Chunking keeps every visible horizon finishable.

**App example:** Stomper explains its essentials in three minimalist steps - no wall of input fields on entry. Contrast with setup wizards that show "Step 1 of 14" plus a dense instruction page: users quit before beginning.

**Failure mode to flag:** more than ~3 steps visible in one view; instruction text walls before the first interaction; wizards that enumerate the full step list upfront instead of revealing chunks progressively.

## 11. Active Learning (Trial-and-Error Engagement)

**Concept:** People internalize by doing, not by reading - action converts to understanding where passive consumption evaporates (the generation effect / testing effect). Instruction manuals don't work; guided execution does.

**App example:** Sudoku apps skip the rules page entirely. They drop the user into a first puzzle and surface contextual hints as the user touches the board - each hint arrives exactly at its interaction point.

**Failure mode to flag:** "Next, Next, Finish" modal tours the user clicks through without touching the product; upfront tooltip storms; any tutorial step that advances without the user performing the real interaction it describes.

## 12. Familiarity / Instant Ownership (Personalization as Trust)

**Concept:** People trust and engage with what feels personalized to them (mere-exposure and self-relevance effects). Handing over small controls early - like adjusting seat and mirrors in a new car - makes the product feel safe, comfortable, and theirs before any commitment is asked.

**App example:** Speechify's first-run flow has new users pick voice tone, highlight style, and listening speed immediately, re-rendering the experience live with each choice. The reading environment is *theirs* within the first minute.

**Failure mode to flag:** first-run experiences that showcase features but offer no control; preference screens whose choices produce no visible change until later; burying high-impact preferences (theme, density, voice) deep in settings.

**Relation to rule 4 (IKEA):** IKEA raises exit cost via sunk investment; familiarity raises engagement via comfort and trust. The same preference-picking flow serves both - it is simultaneously the first investment and the ownership signal.

## Rule interactions

- **Reciprocity + IKEA** compound in FTUE: deliver value first (reciprocity), have the user build something with it (IKEA), *then* gate. Duolingo runs both.
- **Goal Gradient + IKEA** compound in wizards: pre-punched progress starts momentum; each completed step deepens investment.
- **Loss Aversion supersedes Reciprocity** for existing users: retention screens should protect what the user has, not offer new gifts.
- **Contrast + Smart Defaults** in pricing: the anchor tier is the contrast; the pre-selected middle tier is the smart default. Use together - an anchored table with nothing pre-selected still forces a decision.
- **Mirror → Label → Flex is a funnel:** effort makes the result feel personal (7), the result crystallizes into an identity (8), the identity becomes the shareable asset that acquires the next user (9). 16 Personalities and Spotify Wrapped run all three in sequence.
- **Mirror tension with Smart Defaults / Reciprocity:** rules 1 and 3 minimize friction before value; rule 7 adds friction before the reveal. Resolve by surface: transactional flows (booking, checkout, search) get frictionless defaults; identity-producing flows (quizzes, analyses, personalized reports) get earned reveals.
- **Label + Loss Aversion** in retention: a threatened *status* ("You're about to lose your 30-day streak - and your Top 1% badge") outperforms a threatened feature.
- **Zeigarnik + Goal Gradient** are the two halves of wizard momentum: chunking (10) keeps the next horizon finishable; progress cues (2) show how close it is. A chunked flow with no progress bar wastes the pull; a progress bar over an unchunked wall wastes the chunk.
- **Eureka sequences the onboarding rules:** core value first (3), then 1-3 ownership preferences (12), then the interactive walkthrough (11) chunked in threes (10), *then* the gate framed as saving progress (4). Signup is the last screen of onboarding, never the first.
- **Active Learning constrains the Mirror:** rule 7's quiz friction must still be *doing*, not reading - multi-step quizzes work because each step is an interaction; a long passive explainer before the reveal loses both effects.
