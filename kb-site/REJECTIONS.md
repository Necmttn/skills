# App Review Ledger

Every App Review rejection we receive, newest first per app - what Apple said, the real root cause, the fix, and the guard that prevents a repeat. Companion rule from the submission playbook: every rejection also gets a new playbook rule with a verify command. Statuses: `fixed` (shipped and not re-raised), `open` (fix in flight), `retired` (pattern permanently banned for us).

## Lock In Chinese

### 2026-08-13 · v1.7.7 (build 259) · Guideline 4 + 5.6 - iPad layout + repeated offers

- **Apple said:** (4 - Design) UI crowded/cut off on iPad Air 11" - "cutoff screen, text, and/or buttons on iPad and the bottom buttons were not visible". (5.6 - Developer Code of Conduct) "app displayed new subscription offers repeatedly after we declined the first subscription offer".
- **Root cause:** (4) the app is iPhone-only, so review runs it on iPad in iPhone-compat mode; nine SDUI screens use an exact-height `containerRelativeFrame` pattern instead of the min-height `SDUIFillViewport`, so content and CTAs clip instead of scrolling. An internal review gate documented this defect on 2026-07-21 across 5 PRs; it was never fixed. (5.6) a declining user met FIVE offer surfaces: $29.99 paywall → `txn_abandon` discounted yearly → free 3-day Rescue Pass → $14.99 lock winback → LOCKIN50 quick action.
- **Fix:** plan under adversarial review (`.claude/BRIEF-lockin-rejection-3.md`): decline → ONE offer (Rescue Pass) → 3 fully usable days → lock winback as the time-separated second touch; delete `txn_abandon` and the LOCKIN50 quick action; migrate all 9 screens to `SDUIFillViewport`; scan tests guard both.
- **Lesson:** an internally documented defect with no owner and no guard test ships anyway; time-separate the offer ladder - a burst of cheaper offers after a decline reads as manipulation.
- **Status:** open

### 2026-08-12 · v1.7.6 (build 257) · Guideline 3.1.2(c) - skip-trial toggle

- **Apple said:** the paywall's "Skip free trial - pay $24.99 now, save $5.00" toggle "may prevent users from understanding that they are committing to an auto-renewing subscription". Instruction was REMOVE, not reword.
- **Root cause:** our own paywall-experiments playbook (tactic 4) specified the toggle and justified it by naming live apps that run it. An app running a pattern is not evidence Apple approves it - it means they have not been caught. Two surfaces compiled the toggle into the binary (SDUI onboarding paywall + native main paywall), so a remote KV publish alone could not have fixed it.
- **Fix:** PR #1143 - toggle removed from both surfaces; three guards: binary ignores `skipTrialToggle`, `validate.ts` rejects it at publish time, `trial-toggle-absence.test.ts` fails on any control binding to the swap. Playbook tactics 4 and 5 struck. Twin machinery (`skipTrialAlternateIndex` hiding the no-trial product) kept deliberately - removing it would draw a worse 3.1.2(c) card.
- **Lesson:** competitor sightings are not compliance evidence; a paywall pattern lives in the binary AND the remote config - guard both.
- **Status:** fixed
- **Links:** evidence doc `apps/lockin-chinese/docs/review/2026-08-12-skip-trial-toggle-rejection.md`

### 2026-08-04 · v1.7.5 (build 255) · Guideline 2.5.1 - Screen Time frameworks without entitlement

- **Apple said:** automated analysis found Screen Time APIs without the Family Controls entitlement.
- **Root cause:** REAL, after an initial false-positive call was retracted. Four bundles carried the entitlement; the fifth (`Widgets.appex`) did not, yet linked `DeviceActivity`/`FamilyControls`/`ManagedSettings` because `LockInWidgetsKit` did `@_exported import LockInScreenTimeCore` (a side effect of the PR #1043 bundle-size split).
- **Fix:** PR #1140 - live Screen Time code split into `LockInScreenTimeLive` so unentitled targets link pure logic only; `screentime-entitlement-linkage.test.ts` scan guards it. Also removed real TikTok/Instagram/X/Facebook icons from the binary (guideline 5.2 risk). Confirmed fixed: 2.5.1 not raised on build 257.
- **Lesson:** verify the binary Apple received, not your source - `GET /v1/builds/{id}?include=buildBundles` returns signed entitlements per mach-o path. Two instrument traps: the entitlements dict is keyed by mach-o path (top-level grep reads as ABSENT), and `otool -L` on a Debug `.appex` lies (real content sits in the sibling `.debug.dylib`) - measure a Release build.
- **Status:** fixed
- **Links:** evidence doc `apps/lockin-chinese/docs/review/2026-08-04-family-controls-rejection.md`

## Traps that pre-empt rejections

Submission-gate findings that never became rejections because the playbook caught them first (rule numbers reference `docs/playbooks/app-store-submission.md`):

- **Review builds carry a `sandboxReceipt`, exactly like TestFlight** (rule 2.13). Any receipt-based channel inference hands the reviewer the beta surface - a surface that must not reach review needs a second, independent gate.
- **The client's entitlement-match id list is not the display catalog** (rule 3.20). A product sold only through a remote paywall can be missing from the `isPro()` list, and that subscriber reads as not-entitled on the plain StoreKit/Restore path. Real in lockin for the weekly sub.
- **Dead support mailboxes:** three org domains had no MX records, so every `support@` address given to Apple silently bounced. `dig +short MX <domain>` before submission.
- **`MISSING_METADATA` on subscriptions = incomplete territory pricing** (price in 1 of 175 territories), not Tax Category. Recompute only triggers on a localization write; subs also require a review screenshot via `subscriptionAppStoreReviewScreenshots`.
- **External TestFlight (Beta App Review) needs a working demo account** with populated content plus a reachable privacy-policy URL - reviewers reject without both.
- **The ASC API exposes NO rejection text.** `/v1/reviewSubmissions/{id}` returns only state (`UNRESOLVED_ISSUES`); read the Resolution Center message in the ASC web UI or the owner's Apple mailbox.
- **Screenshot compliance:** fabricated/redrawn UI is a 2.3.3 risk; `◀ TestFlight` in the status bar and self-attributed award laurels are rejection bait (open cleanup item from the 2.5.1 round).
