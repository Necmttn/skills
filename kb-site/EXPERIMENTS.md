# Experiment Ledger

Our own experiments and growth-surface changes, newest first per app. This is the cross-repo index; the authoritative per-experiment ledger files live in the apps repo under `docs/experiments/` (growth-ops rule: no ledger file = no experiment; no DECIDED line = still open).

Entry format: an `###` heading `date · title`, then Hypothesis / Change / Result / Status / Links. Statuses: `shipped` (live, readout pending or done), `decided` (readout done, verdict locked), `open` (running or queued), `retired` (rolled back or rejected).

## Lock In Chinese

### 2026-08-03 · Intro-eligibility false negatives fix

- **Hypothesis:** Fresh Apple IDs on TestFlight see no trial because StoreKit `isEligibleForIntroOffer` returns false negatives, not because ASC config is wrong.
- **Change:** Eligibility seam `PaywallIntroEligibility.resolve` = store bit OR zero-transactions-in-group proof via `Transaction.all`.
- **Result:** ASC was confirmed clean (trial live 175/175); the seam restores trial copy and trial-ramp screens for fresh accounts.
- **Status:** shipped
- **Links:** PR #1123, `apps/lockin-chinese/ios/docs/paywall-surface-map.md`

### 2026-07-30 · Lockout winback offer

- **Hypothesis:** A discounted yearly offer at the lock surface recovers users who declined the full-price paywall.
- **Change:** Lockout placement sells the first resolved id from `lockInLockoutOfferCandidateIds` - currently `lockinchinese.pro.yearly.winback` at $14.99/yr with "EXTRA N% OFF" computed from real Decimals. "winback" is never customer-facing.
- **Result:** Live; conversion readout pending store traffic.
- **Status:** shipped
- **Links:** PR #1035

### 2026-07-29 · Hard paywall + Rescue Pass

- **Hypothesis:** Hard paywall converts ~5x freemium (RevenueCat 2026 benchmark); a one-time 3-day Rescue Pass softens the lock without giving the app away.
- **Change:** `hardPaywallLocked` gates Home after onboarding unless Pro or active rescue; every unpaid flow exit lands on the lock surface. Reverses the #873 soft-paywall decision.
- **Result:** Shipped with test-pinned invariants; conversion readout pending store traffic.
- **Status:** shipped
- **Links:** PRs #1027, #1034

### 2026-07-28 · Onboarding paywall restored

- **Hypothesis:** Removing the onboarding paywall (PR #917) traded revenue for a dismissal complaint that a visible decline link solves.
- **Change:** Paywall step restored at flow end (`pledge → paywall`) with a visible "Not now" link sharing the X's abandon action.
- **Result:** Flow ends on the offer again; superseded upstream by the hard-paywall decision a day later.
- **Status:** decided
- **Links:** PR #972

### 2026-07-28 · Fast bootstrap

- **Hypothesis:** Fatal launch watchdog kills (Sentry LOCKIN-CHINESE-8) come from Adapty constructing a WKWebView on main before first frame.
- **Change:** No Adapty/WebKit before first frame; native `PaywallView` is the only renderer; `app.launch` time-to-interactive span added.
- **Result:** Watchdog crash class eliminated in later builds; launch span live.
- **Status:** decided
- **Links:** PR #975, spec #946

### 2026-07-24 · ASO screenshot direction search

- **Hypothesis:** A stronger screenshot register than the first sets exists; explore wide (playful, girly, modern, 3D) before locking.
- **Change:** ~20 variant sets built with parallel design-curators; all frames rebuilt over 100% real captures.
- **Result:** Winner = "editorial primer" SET U; C/D/G/K rejected (K5 kept); W1-W4 modern-3D studies pending a pick.
- **Status:** decided (SET U), open (W-series pick)
- **Links:** aso-lockin-chinese playbook, `~/Desktop/lockin-final-screenshots/`

### 2026-07-19 · Deletion-intercept offer (LOCKIN50)

- **Hypothesis:** Intercepting app-deletion intent with a discount quick action recovers a slice of churning users.
- **Change:** Home-screen quick action offers code LOCKIN50 (growth trick #1). Mint gated on app live + subscription APPROVED.
- **Result:** Readout pending launch traffic.
- **Status:** open
- **Links:** growth-tricks playbook

## Backlog / research

- **RC web-to-app funnels** - unused scheme `rc-169a144706`; issue #1071. Status: open.
- **ASA keyword loop** - issue #1072. Status: open.
- **Weekly cron growth reports** - deferred until RC-to-Amplitude live + store traffic (growth-ops PR #1070). Status: open.
