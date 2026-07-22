# Screen Mocks - real onboarding screens, transcribed

Wireframe transcriptions of onboarding screens from apps in the catalog, each mapped to the pattern it demonstrates. Use these as concrete reference when generating a flow: copy the *structure and copy strategy*, not the wording.

Every mock below was transcribed from a frame of the [Mobbin 1,460-flow study video](sources/mobbin-1460-onboarding-study.md) (verified 2026-07-22). Where the app name was only audible in captions and not visible on screen, it is flagged `(?)`.

---

## P14 - Outcome-first welcome

### Superhuman - signup screen as pitch

```
┌────────────────────────────┬──────────────────┐
│                            │                  │
│  Save 4 hours per person   │  Trusted by      │
│  every single week         │  teams at...     │
│                            │                  │
│  [ G  Sign up with Google ]│    OpenAI        │
│  [ ■  Sign up with        ]│    Airtable      │
│  [    Microsoft           ]│    Cursor        │
│                            │    Brex          │
│  ───────── or ─────────    │                  │
│  [ Enter email           ] │                  │
│  [ Sign up with email    ] │                  │
└────────────────────────────┴──────────────────┘
```

The headline is the outcome (hours saved), not the product category. The right rail turns dead space into social proof at the exact moment of the ask. **Zero feature words on a signup screen.**

### Alma - try the core action before signup

```
┌─────────────────────────────┐
│  ←                    Skip  │
│                             │
│                             │
│     Let's try tracking      │
│     some food. What's       │
│     the last thing you ate? │
│                             │
│            ╱                │
│           ○                 │
│      ░░░▒▒▓▓░░░             │
│           (+)               │
└─────────────────────────────┘
```

An AI food tracker that runs its core action *inside* onboarding, pre-account. Rare: only 7% of AI apps personalize during onboarding at all. Note the visible `Skip` - the try-it is offered, not forced.

### Runbuds - animation instead of a value prop

Opening screen is a full-bleed red field with a single animated running-track glyph. No headline, no body copy, no buttons in frame. The motion alone conveys "running app" before a word is read.

---

## P15 - Founder's touch

### One Year(?) - handwritten founder's note

```
┌─────────────────────────────┐
│             ✿               │
│                             │
│        hey friend           │
│                             │
│  we created one year as a   │
│  daily reminder that life   │
│  is too short to spend on   │
│  things we're not excited   │
│  about                      │
│                             │
│  we hope every time you     │
│  look at this app you're    │
│  reminded                   │
│                             │
│    every day matters        │  ← accent color
│                             │
│  try it for the next 07     │
│  days, and if you find any  │
│  value in it, you can make  │
│  it a part of your journey  │
│                             │
│          love,              │
│      𝒮𝒶𝓂 & 𝒜𝓁𝑒𝒸  ♡         │  ← handwritten
└─────────────────────────────┘
```

Monospace body, hand-drawn flower, real signatures. The trial ask ("try it for the next 07 days") is embedded in the note rather than presented as a paywall step.

### Basecamp - CEO welcome after account creation

```
┌───────────────────────────────────────┐
│              (photo)                  │
│      Welcome from Jason Fried, CEO    │
│  ─────────────────────────────────    │
│  Thanks for signing up - your account │
│  is ready to go!                      │
│                                       │
│  Now you have one central, organized  │
│  place to put the files, track the    │
│  work, discuss ideas, set deadlines...│
│  We included a real-life example of   │
│  how we use Basecamp at our own       │
│  company. Do explore!                 │
│                                       │
│  If you ever need a hand, please      │
│  contact me directly at               │
│  jason@37signals.com. I'm here for you│
│                                       │
│  ✍ Jason Fried, CEO of 37signals      │
│                                       │
│  [   OK, let's see my account     ]   │
└───────────────────────────────────────┘
```

Fires immediately after signup. Doubles as P16: it tells you a populated example project is waiting, pre-empting the empty state.

### Airbnb - CEO video at the aha moment

The listing flow ends: `Last step` → `Yay! It's time to publish` → **full-bleed CEO video, "Congratulations, Sam!"** → `Welcome, Sam!` dashboard with next steps. The human moment is placed on the *completion* of the hard task, not at the start.

---

## P3 / P5 - Personalization with a visible payoff

### Headspace - multi-select goals (+10% trial conversion)

```
┌─────────────────────────────┐
│          ( ◡ )              │
│                             │
│   What's on your mind?      │
│        I want to...         │
│                             │
│  ( Be present and mindful ) │
│  ( Reduce stress          ) │
│  ( Manage anxiety         ) │
│  ( Sleep soundly          ) │
│  ( Feel calm and relaxed  ) │
│  ( Something else         ) │
└─────────────────────────────┘
```

The change that moved the number was allowing **more than one** selection. Users arrive with multiple pain points; forcing a single pick misrepresents them and mis-tunes the recommendation.

### Thrive Market - goal picker driving recommendations

Same shape ("What are your goals with Thrive Market?" - save money on groceries / save time on food prep / shop a specific diet / all organic and non-GMO / environmentally-conscious), multi-option, feeding an "Easy Order Builder". Note the progress dots at top: intake is chunked (P12).

### Endel - post-quiz reveal, evidence-led

```
┌─────────────────────────────┐
│                       ↗     │
│         7x                  │
│  increase in focus,         │
│  according to a study by    │
│  Arctop                     │
│                             │
│  Your Focus collection      │
│  is ready                   │
│                             │
│  Start your Endel experience│
│  and use science-backed     │
│  sound technology to:       │
│   ✓ Focus consistently      │
│   ✓ Improve attention span  │
│   ✓ Switch on for           │
│     productivity easily     │
│   ✓ Get rid of distractions │
│   ✓ Stay calm and motivated │
│                             │
│  [       Continue        ]  │
└─────────────────────────────┘
```

Six questions in, zero product used - yet "your collection is ready" plus a cited third-party stat makes it feel like it will work. The checklist restates the user's own quiz answers back as promised outcomes.

### Plan-with-a-date reveal (BytePal(?) / weight-loss class)

```
┌─────────────────────────────┐
│  Projected progress         │
│                             │
│  65 kg ○                    │
│         ╲___                │
│             ╲──○ 62 kg      │
│                  [1kg goal] │
│  today        28 January    │
│                             │
│  ✓ See the first visible    │
│    results in just 3 weeks  │
│  ✓ Reach your goal by       │
│    28 January 2026          │
│  ✓ Habits will help you     │
│    sustain your success     │
│                             │
│  Nutrition recommendations  │
│  🔥 2,121 kcal              │
│  ▓▓▓▓▓░░░▒▒▒▒               │
│  Carbs 265g Fats 66g        │
│  Proteins 117g              │
│                             │
│  [  Commit to my goal  › ]  │
└─────────────────────────────┘
```

Three moves stacked: projection curve (P5), a **named date**, and a CTA phrased as a commitment rather than "Continue" (P7).

### Speak - projection as a chat message

```
┌─────────────────────────────┐
│  ✕  ▓▓▓▓▓▓▓▓▓░░░░░          │
│                             │
│  (•) Thank you!             │
│      In two months, you'll  │
│      be able to communicate │
│      while traveling in     │
│      France.                │
│                             │
│  ┌───────────────────────┐  │
│  │              ╱ Speak  │  │
│  │            ╱          │  │
│  │        ╱╱             │  │
│  │    ╱╱────→ Reading    │  │
│  │ Reach your goals      │  │
│  │ faster with Speak!    │  │
│  └───────────────────────┘  │
│                             │
│  [       Continue        ]  │
└─────────────────────────────┘
```

The projection is delivered *in the assistant's voice*, and the graph contrasts the app's method against the alternative the user would otherwise choose. Preceding steps already had the user speaking aloud, so the claim lands on lived evidence.

---

## P6 - Preference-picker instant ownership

### Flighty - map style

```
┌─────────────────────────────┐
│      ▬▬  ▬▬  ▬▬  ▬▬         │
│   Choose Your Map Style 🗺   │
│  Your chosen map will appear│
│  by default on the home and │
│  flight screens.            │
│                             │
│  ┌─────────┐ ┌─────────┐    │
│  │ ▓▓▓▓▓▓  │ │ ▓▓▓▓▓▓  │◄── │ selected
│  │Monochrome│ │  Terra  │    │
│  └─────────┘ └─────────┘    │
│  ┌─────────┐ ┌─────────┐    │
│  │ ▓▓▓▓▓▓  │ │ ▓▓▓▓▓▓  │    │
│  │ Standard│ │Satellite│    │
│  └─────────┘ └─────────┘    │
│                             │
│  Labels             ● ON    │
│  [       Continue        ]  │
└─────────────────────────────┘
```

A purely cosmetic choice with real preview thumbnails. Cheap to build, and the app is "yours" before first use.

---

## P8 - Paywall placement and framing

### Timo - social proof page immediately before the paywall

```
   screen n-1                    screen n
┌──────────────────┐      ┌────────────────────┐
│   (illustration) │      │ Carefully crafted  │
│                  │      │ for neurodivergent │
│ You're part of   │      │ people             │
│ more than        │      │                    │
│ 500,000 happy    │      │ MONTHLY   [ANNUAL] │ ← most popular
│ Timo users       │      │  $12.00    $60.00  │
│ around the globe │      │  no trial  7 days  │
│                  │      │                    │
│  Apple Design    │      │ 🏆 Awards  🏆 🏆    │
│  Award Finalist  │      │ Over 8000+ 5★ revs │
│                  │      │                    │
│                  │      │ [Start 7 days free]│
│                  │      │ 7 days then $60/yr │
│                  │      │ No commitment.     │
└──────────────────┘      └────────────────────┘
```

The identity question ("Are you neurodivergent? / I think I am / I am not / I don't know") is asked first, then the paywall headline mirrors that identity back verbatim. Awards and review count sit *at* the decision point, not on a marketing page.

### Flighty - the paywall as a delight object

```
┌─────────────────────────────┐
│  ✈ Lifetime            ✕    │
│  Congratulations! You've    │
│  unlocked a limited-time    │
│  lifetime discount.         │
│                             │
│        -58%                 │
│                             │
│      ░░ $9.70 ░░            │  ← "prints" in
│  ▌▐▌▐▌▐▌▐▌▐▌▐▌▐▌▐▌▐        │     with haptics
│                             │
│         Expires in          │
│      ┌────┐ ┌────┐          │
│      │ 59 │:│ 5x │          │
│      └────┘ └────┘          │
│                             │
│  [     Claim It Now      ]  │
└─────────────────────────────┘
```

Shaped as a boarding pass, animated as if printing, with haptics on the print. Same urgency mechanics as any countdown offer - but rendered as a gift rather than a threat. **Ethics check:** a countdown must be real; a timer that resets on relaunch is a dark pattern.

### Grammarly - quiz answers select the plan (10-20% more plan upgrades)

```
  quiz                          →  tailored plan page
┌──────────────────────┐          ┌──────────────────────┐
│ I want Grammarly to  │          │ Win With Effective   │
│ help me              │          │ Communication        │
│ (write clearly)      │   →      │                      │
│ (improve confidence) │          │  Free    │ Business   │
│ (sound professional) │          │  ✓spelling│ ✓advanced │
│ (write faster)  ...  │          │  ✓grammar │ ✓brand    │
│                      │          │  ✓punct.  │ ✓style    │
│ [Next]               │          │           │ ✓snippets │
└──────────────────────┘          └──────────────────────┘
```

Not a generic pricing table: the selected goals decide which plan is *recommended* and how the value is framed.

---

## P16 - Just-in-time education

### Acorns - password requirements validating live

```
  step 1              step 2              step 3
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│Create your   │  │Create your   │  │Create your   │
│password for  │  │password for  │  │password for  │
│alex@mail.com │  │alex@mail.com │  │alex@mail.com │
│              │  │              │  │              │
│[Password  👁]│  │[••••••    👁]│  │[••••••••  👁]│
│              │  │              │  │              │
│○ Min 8 chars │  │✓ Min 8 chars │  │✓ Min 8 chars │
│○ Upper+lower │  │✓ Upper+lower │  │✓ Upper+lower │
│○ One number  │  │○ One number  │  │✓ One number  │
│○ One special │  │○ One special │  │✓ One special │
│              │  │              │  │              │
│[Create acct] │  │[Create acct] │  │[Create acct] │
│  (disabled)  │  │  (disabled)  │  │  (enabled)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

Requirements are visible before typing and tick off per keystroke. Removes the single most common signup stall: submit → rejected → guess again.

### Cake Equity - tooltips plus an escape hatch

```
┌─────────────────────────────────────────────┐
│ Cake.                                     ✕ │
│           Add your shareholders             │
│   Add the details below. Don't worry, you   │
│   can edit this later.                      │
│                                             │
│ Shareholder │ E-mail │ Ownership │ # Shares │
│ Jane Smith  │┌─────────────────────────┐│ 8 │
│ ─────────── ││ We will not email these ││   │
│ Shareholder ││ contacts. This is for   ││   │
│ ─────────── ││ linking a shareholder's ││   │
│ Shareholder ││ own unique account...   ││   │
│             │└─────────────────────────┘│   │
│ + Add shareholder      Total shares: 8      │
│                                             │
│         Is this too much hassle?            │
│           We can do it for you!             │
│                                  [ Next › ] │
└─────────────────────────────────────────────┘
```

Three de-risking devices on one screen: "you can edit this later" (reversibility), a tooltip answering the unasked privacy question at the field that raises it, and a human escape hatch for users who stall.

### Notion - populated getting-started page instead of an empty state

```
┌─────────────────────────────┐
│  Getting Started on Mobile  │
│                             │
│  👋 Welcome to Notion!      │
│                             │
│  Here are the basics:       │
│  ☐ Tap anywhere and start   │
│    typing                   │
│  ☐ Tap the + above your     │
│    keyboard to add content  │
│      📄 Example sub page    │
│  ☑ Highlight text and use   │
│    the bar above to format  │
│  ☑ Tap and hold this line,  │
│    then drag                │
│  ☑ Tap the home tab button  │
│    to see your pages        │
│                             │
│  👉 Have a question? Tap    │
│  `Help & feedback`          │
└─────────────────────────────┘
```

The tutorial *is* a document in the workspace: users learn the editor by editing the lesson. Some boxes ship pre-checked (goal-gradient head start, ux-psychology rule 2). No modal, no tour, dismissible by deleting the page.

### Mural - checklist replacing popups (+10% relative 1-week retention)

```
  A (before)                B (after)
┌────────────────┐   ┌──────────────────────────┐
│  ▓ popup ▓     │   │ Mural basics          ✕  │
│  ▓ banner ▓    │   │ ✓ Build a space to       │
│  (tips layered │   │   collaborate            │
│   over canvas) │   │ ✓ Make it your own       │
│                │   │ ✓ Write down some        │
│                │   │   thoughts               │
│                │   │ ✓ Make it visual         │
│                │   │ ✓ Move around            │
│                │   │ ✓ Invite friends to the  │
│                │   │   party!                 │
│                │   │        (avatar)          │
│                │   │     1 of 6 Complete      │
└────────────────┘   └──────────────────────────┘
```

The load-bearing difference: a checklist **persists after dismissal** and can be reopened; a popup fires once and is gone. Progress text ("1 of 6 Complete") keeps the Zeigarnik loop open (ux-psychology rule 10).

---

## P10 - Notification pre-prompt

### Notification preview teaser (Centr(?) / fitness class)

```
┌─────────────────────────────┐
│  GET MOTIVATED, STAY        │
│  UPDATED & BE FIRST TO      │
│  KNOW                       │
│  ┌───────────────────────┐  │
│  │ ┌───────────────────┐ │  │
│  │ │ Your Plan is      │ │  │ ← a real
│  │ │ READY 💪🍎🧘       │ │  │   notification,
│  │ │ Check out your    │ │  │   rendered
│  │ │ workouts, meal    │ │  │
│  │ │ plan and mindset  │ │  │
│  │ │ activities!       │ │  │
│  │ └───────────────────┘ │  │
│  └───────────────────────┘  │
│                             │
│  [    GET MOTIVATED     ]   │
│           SKIP              │
└─────────────────────────────┘
```

Goes one step past normal priming: instead of *describing* the notifications, it renders the exact card you'd receive. The CTA is the benefit ("Get motivated"), not the mechanism ("Allow notifications"), and `SKIP` keeps it honest.

---

## Reference - the study's own data screens

### Onboarding length by platform

```
Average total onboarding screens (incl. nested flows)

iOS      ████████████████████████████  26.5
Android  ██████████████████████████    24.9
Web      █████████████████████         21.0

Web onboarding is 21% shorter than iOS on average.
```

### Top 10 longest onboarding flows

Hyundai Card, Lemonade Insurance, Monzo, Noom, Neo Financial, Kit, Philips Hue, Chase UK, Upwork, Mercury - **7 of 10 are finance apps.** (Dataset: 1,460 onboarding flows, 986 apps & websites, snapshot April 2026.)
