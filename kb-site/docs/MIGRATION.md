# Migration notes: markdown checklists to JSONL records

Date: 2026-09-18. Scope: the seed of `kb-site/data/`. Read `docs/PLAN.md` section 2 for the record contract and `inventory/RECONCILIATION.md` for the merge decisions.

## 1. What moved where

| Before | After |
|---|---|
| Check rules spread over 33 apps-repo files, the wiki playbook, `SHIPPING.md` and `REJECTIONS.md` | `data/requirements.jsonl`: 226 records (212 checks, 14 guidelines). Each record cites every source in `refs`. |
| Per-app state as checkboxes in `apps/<app>/docs/APP_STORE_SUBMISSION.md` and `LAUNCH_CHECKLIST.md` | `data/tracking/<app>.jsonl`: one record per (requirement, release). Absent record = `todo`. |
| Contradictions found by readers, fixed or not | `data/conflicts.jsonl`: 34 records (30 open, 4 resolved). Requirements link them. |
| App list in `apps/` and `scripts/asc/apps.json` | `data/apps.jsonl`: 6 iOS apps with tags that drive `applies_to`. |
| Absolute paths in `build.ts` | `data/sources.jsonl`: 82 records with `root` + relative `path`, access class, license, `publishable`. |

Nothing in the apps repo or the wiki was edited. Nothing was deleted anywhere.

## 2. What stays markdown

- All prose: every playbook, the wiki pages, `SHIPPING.md`, `REJECTIONS.md`, `SOTA.md`, `EXPERIMENTS.md`, `IDEA-ROAST.md`, the skills, and the vendored packs. Records point at them; `how` is a short paraphrase with the verify command.
- Ledgers with their own status vocabulary: `SOTA.md` verdicts, `REJECTIONS.md` entries, experiment ledger files, growth tricks status rows.
- App-specific prose in the app docs: review notes text, audit narrative, corrections, operational notes, the offer code runbook.
- Secrets, account identifiers, prices, reviewer-facing text, and keyword lists stay in the private sources. No record holds them. The seed checker scans for them.

## 3. Counts

| File | Records | Breakdown |
|---|---|---|
| `sources.jsonl` | 82 | private-repo 35, repo 18, vendored 16, private-wiki 9, local-only 3, linked-only 1; publishable 29 |
| `requirements.jsonl` | 226 | decided 180, candidate 43, verified 2, retired 1; once 111, every_release 115 |
| phases | - | idea 10, setup 24, build 14, monetization 39, analytics 22, aso 25, submission 48, release 18, post-launch 26 |
| `conflicts.jsonl` | 34 | open 30, resolved 4 |
| `apps.jsonl` | 6 | lockin-chinese, lockin-japanese, ailifestory, dotself, racket-vision, spectrum |
| `tracking/lockin-chinese.jsonl` | 36 | done 19, in_progress 16, blocked 1 |

## 4. Mapping: old checklists to requirement ids

### 4.1 Submission playbook section 9 (the copyable checklist) and its template copy

Rows are the requirements whose reference to the submission playbook names section 9. `templates/new-app/docs/APP_STORE_SUBMISSION.md` is a copy of the same list.

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| 7.6, 9 | `aso.age-rating-complete` | once | decided |
| 7.16, 9 | `aso.assets-localized-per-storefront` | once | decided |
| 7.13, 9 | `aso.assets-meet-4plus` | every_release | decided |
| 7.11, 9 | `aso.assets-no-price-discount-url-copyright` | every_release | decided |
| 7.12, 9 | `aso.assets-no-unverifiable-claim` | every_release | decided |
| 7.15, 9 | `aso.first-three-screenshots-ordered-for-search` | every_release | decided |
| 7.17, 9 | `aso.focal-art-safe-area-previewed` | every_release | decided |
| 7.21, 9 | `aso.header-and-search-creative-assets` | once | decided |
| 7.19, 9 | `aso.preview-poster-frame-stands-alone` | every_release | decided |
| 7.18, 9 | `aso.preview-works-muted-and-loops` | every_release | decided |
| 7.2, 7.14, 9 | `aso.screenshots-real-current-build-ui` | every_release | decided |
| 7.1, 9 | `aso.screenshots-uploaded-required-size` | every_release | candidate |
| 3.10, 9 | `monetization.paywall-offline-fallback` | every_release | decided |
| 3.1, 9 | `monetization.paywall-plan-title-and-duration` | every_release | decided |
| 3.9, 9 | `monetization.product-ids-set-equal` | every_release | candidate |
| 3.13, 9 | `monetization.sub-prices-all-territories` | once | decided |
| 3.11, 9 | `monetization.sub-review-notes-match-offers` | every_release | candidate |
| 3.14, 9 | `monetization.subs-attached-to-version-submission` | once | candidate |
| 8.3, 9 | `post-launch.launch-gated-list-run` | every_release | decided |
| 8.4, 9 | `release.uat-issue-updated` | every_release | decided |
| 1.2, 9 | `setup.paid-apps-agreement-active` | once | decided |
| 1.3, 9, Family Controls note, Correction 2026-09-03 | `setup.special-entitlement-enabled-per-id` | once | candidate |
| 2.9, 9 | `submission.cold-launch-hostile-conditions` | every_release | decided |
| 4.1, 9 | `submission.intended-build-attached` | every_release | decided |
| 6.1, 9 | `submission.legal-urls-return-200` | every_release | decided |
| 5.2, 9 | `submission.policy-names-every-outbound-host` | every_release | decided |
| 5.1, 9 | `submission.privacy-labels-complete-and-true` | every_release | decided |
| 2.3, 9 | `submission.privacy-manifest` | every_release | decided |
| 7.7, 9 | `submission.review-info-filled` | every_release | decided |
| 6.2, 9 | `submission.support-mailbox-receives-mail` | once | decided |
| 6.3, 9 | `submission.terms-page-real-subscription-terms` | once | decided |
| 2.2, 9 | `submission.usage-strings-specific-and-used` | every_release | decided |

All other numbered gate rows (1.1 to 8.5) are also records. Find them with `checks --phase submission` (also `setup`, `monetization`, `aso`, `release`) or by the `refs[].locator` rule number.

### 4.2 Lock In Chinese LAUNCH_CHECKLIST.md

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| Correction 2026-07-28 | `monetization.no-unminted-code-visible` | every_release | decided |
| Territory pricing sanity | `monetization.sub-prices-all-territories` | once | decided |
| Attach subscriptions | `monetization.subs-attached-to-version-submission` | once | candidate |
| Post-launch | `post-launch.growth-tricks-recorded` | once | candidate |
| Mint custom code | `post-launch.offer-code-minted-with-channel` | once | candidate |
| Redemption smoke test | `post-launch.offer-redemption-smoke-test` | once | candidate |
| Device-verify | `submission.real-device-smoke-on-exact-build` | every_release | decided |

Not mapped: "Device-verify shield receipt fix (PR #500)" is one app's bug check; it maps to the generic `submission.real-device-smoke-on-exact-build`. The struck "watch quick action events" item is dead in the source.

### 4.3 Lock In Chinese APP_STORE_SUBMISSION.md (B and S items, verified-good rows)

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| S5 | `aso.age-rating-complete` | once | decided |
| B1 | `aso.device-only-screens-captured-on-device` | every_release | candidate |
| Suggested order step 5 | `aso.eula-link-in-description` | once | decided |
| Verified good 7.3 | `aso.metadata-no-forbidden-terms` | every_release | decided |
| B1 | `aso.screenshots-real-current-build-ui` | every_release | decided |
| B1 | `aso.screenshots-uploaded-required-size` | every_release | candidate |
| S15 | `build.no-precondition-traps` | every_release | candidate |
| Fixed on branch | `monetization.asc-products-in-entitlement-list` | every_release | decided |
| Suggested order step 8 | `monetization.billed-amount-most-prominent` | every_release | decided |
| Suggested order step 6 | `monetization.launch-discounts-as-offer-codes` | once | decided |
| S12 | `monetization.manage-subscription-reachable` | every_release | decided |
| Verified good 3.8 | `monetization.no-external-purchase-steering` | every_release | decided |
| S9 | `monetization.no-orphan-iap-attached` | every_release | candidate |
| Verified good 3.15 | `monetization.no-unminted-code-visible` | every_release | decided |
| Verified good 3.5/3.6 | `monetization.paywall-legal-links-resolve` | every_release | decided |
| S13 | `monetization.paywall-offline-fallback` | every_release | decided |
| S2 | `monetization.product-ids-set-equal` | every_release | candidate |
| S11 | `monetization.purchase-controls-do-their-label` | every_release | decided |
| S10 | `monetization.remote-paywall-schema-has-legal-fields` | every_release | decided |
| S14 | `monetization.remote-url-sink-allowlist` | once | decided |
| S11 | `monetization.restore-purchases` | every_release | decided |
| S1 | `monetization.sub-review-notes-match-offers` | every_release | candidate |
| Suggested order step 10 | `monetization.subs-attached-to-version-submission` | once | candidate |
| B4 | `post-launch.site-build-language-env-match` | every_release | decided |
| Suggested order step 10 | `release.no-expedited-review-for-launch` | every_release | decided |
| B7 | `setup.xcode-cloud-workflows` | once | candidate |
| S16 | `submission.account-deletion-position-stated` | once | decided |
| S17 | `submission.analytics-consent-withdrawal` | once | candidate |
| Verified good 2.5 | `submission.app-group-identical-all-targets` | every_release | decided |
| Verified good 2.16-2.18 | `submission.archive-device-check-clean` | every_release | decided |
| Pending Meta SDK change | `submission.att-states-device-verified` | every_release | candidate |
| Suggested order step 9 | `submission.cold-launch-hostile-conditions` | every_release | decided |
| Verified good 2.1 | `submission.export-compliance-key-set` | once | decided |
| B7, Verify on the submitted build | `submission.feedback-recorder-absent-from-release` | every_release | decided |
| Verified good 2.16-2.18 | `submission.identity-golden-matches` | every_release | decided |
| B6 | `submission.intended-build-attached` | every_release | decided |
| S7 | `submission.launch-day-site-flip-prepared` | once | decided |
| Verified good 6.1 | `submission.legal-urls-return-200` | every_release | decided |
| Verified good 2.4 | `submission.listed-sdks-have-signed-manifests` | every_release | decided |
| Verified good 2.16-2.18 | `submission.live-shield-fixture-decodes` | every_release | decided |
| B7 | `submission.no-receipt-name-only-gate` | every_release | decided |
| Verified good 2.6 | `submission.no-unused-entitlement` | every_release | decided |
| S18 | `submission.paid-path-not-gated-on-permission` | every_release | decided |
| S4 | `submission.policy-names-every-outbound-host` | every_release | decided |
| S8 | `submission.privacy-labels-complete-and-true` | every_release | decided |
| B5 | `submission.privacy-manifest` | every_release | decided |
| Verified good 5.6 | `submission.privacy-url-every-localization` | every_release | decided |
| S3 | `submission.recording-capability-disclosed` | every_release | decided |
| Suggested order step 6, facts table | `submission.release-type-manual-for-launch` | once | candidate |
| B2 | `submission.review-info-filled` | every_release | decided |
| Current review notes | `submission.review-notes-match-build` | every_release | decided |
| Verified good 2.14 | `submission.shield-not-hide` | every_release | decided |
| S6 | `submission.site-copy-matches-listing` | every_release | decided |
| B3 | `submission.support-mailbox-receives-mail` | once | decided |
| B4 | `submission.terms-page-real-subscription-terms` | once | decided |
| Verified good 5.4, Pending Meta SDK change | `submission.tracking-answers-match-att-and-manifest` | every_release | candidate |

### 4.4 New-app templates (`templates/new-app/`)

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| bootstrap-checklist | `analytics.subdomain-route-live` | once | decided |
| bootstrap-checklist | `setup.amplitude-project-secret-set` | once | candidate |
| bootstrap-checklist | `setup.asc-app-record-created` | once | decided |
| bootstrap-checklist | `setup.asc-registry-entry` | once | decided |
| bootstrap-checklist | `setup.bundle-ids-capabilities-registered` | once | candidate |
| bootstrap-checklist | `setup.domain-dns-mx-live` | once | decided |
| bootstrap-checklist | `setup.revenuecat-project-configured` | once | candidate |
| bootstrap-checklist | `setup.sdui-kv-and-worker-envs` | once | decided |
| bootstrap-checklist | `setup.sentry-project-registered` | once | decided |
| last item | `setup.submission-state-file-seeded` | once | decided |
| bootstrap-checklist | `setup.subscriptions-created-ready` | once | candidate |
| bootstrap-checklist | `setup.testflight-post-action-and-group` | once | decided |
| bootstrap-checklist | `setup.xcode-cloud-workflows` | once | candidate |
| bootstrap-checklist | `submission.feedback-recorder-absent-from-release` | every_release | decided |
| bootstrap-checklist | `submission.support-mailbox-receives-mail` | once | decided |
| app-store-submission | `aso.age-rating-complete` | once | decided |
| app-store-submission | `aso.assets-meet-4plus` | every_release | decided |
| app-store-submission | `aso.assets-no-price-discount-url-copyright` | every_release | decided |
| app-store-submission | `aso.assets-no-unverifiable-claim` | every_release | decided |
| app-store-submission | `aso.screenshots-uploaded-required-size` | every_release | candidate |
| app-store-submission | `monetization.product-ids-set-equal` | every_release | candidate |
| app-store-submission | `monetization.sub-prices-all-territories` | once | decided |
| app-store-submission | `monetization.subs-attached-to-version-submission` | once | candidate |
| app-store-submission | `post-launch.launch-gated-list-run` | every_release | decided |
| app-store-submission | `release.uat-issue-updated` | every_release | decided |
| app-store-submission | `setup.paid-apps-agreement-active` | once | decided |
| app-store-submission | `setup.special-entitlement-enabled-per-id` | once | candidate |
| app-store-submission | `submission.cold-launch-hostile-conditions` | every_release | decided |
| app-store-submission | `submission.intended-build-attached` | every_release | decided |
| app-store-submission | `submission.legal-urls-return-200` | every_release | decided |
| app-store-submission | `submission.privacy-labels-complete-and-true` | every_release | decided |
| app-store-submission | `submission.privacy-manifest` | every_release | decided |
| app-store-submission | `submission.review-info-filled` | every_release | decided |
| app-store-submission | `submission.support-mailbox-receives-mail` | once | decided |
| app-store-submission | `submission.terms-page-real-subscription-terms` | once | decided |
| app-store-submission | `submission.usage-strings-specific-and-used` | every_release | decided |
| launch-checklist | `post-launch.growth-tricks-recorded` | once | candidate |
| launch-checklist | `post-launch.launch-gated-list-run` | every_release | decided |
| launch-checklist | `post-launch.offer-code-minted-with-channel` | once | candidate |
| metrics | `analytics.rc-to-amplitude-integration` | once | decided |
| metrics | `analytics.revenue-not-double-counted` | once | decided |
| metrics | `setup.metric-contract-defined` | once | decided |

### 4.5 New-app playbook

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| (e) | `analytics.adservices-token-collection` | once | decided |
| (e) | `analytics.device-context-on-every-event` | once | candidate |
| (e) | `analytics.funnel-dashboard-exists` | once | decided |
| (e) | `analytics.meta-capi-secrets-and-skadnetwork` | once | candidate |
| (e) | `analytics.rc-to-amplitude-integration` | once | decided |
| (e) | `analytics.rc-to-apple-search-ads-integration` | once | decided |
| (e) | `analytics.single-screenid-vocabulary` | once | decided |
| (e) | `analytics.vendor-ui-proof-per-destination` | once | decided |
| (g) | `build.capture-seal-watermark` | once | decided |
| (g) | `build.growth-ledger-skimmed` | once | decided |
| (h) | `build.qa-launch-args` | once | decided |
| (h) | `build.qa-new-customer-switch` | once | decided |
| (h) | `build.sandbox-tester-per-scenario` | once | decided |
| (a) | `setup.app-identity-decided` | once | candidate |
| (f), When this app's own gate | `setup.sdui-flow-copies-identical` | every_release | decided |
| Related docs | `setup.submission-state-file-seeded` | once | decided |
| (d) | `setup.template-scaffold-verified` | once | decided |
| (b) | `setup.template-source-lines-stripped` | once | decided |
| (i) | `submission.privacy-tracking-flags-consistent` | every_release | decided |
| (i) | `submission.review-notes-match-build` | every_release | decided |
| (i) | `submission.tracking-answers-match-att-and-manifest` | every_release | candidate |

### 4.6 Language launch readiness (8 promotion boxes)

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| promotion box 8 | `analytics.funnel-dashboard-exists` | once | decided |
| promotion box 8 | `analytics.meta-capi-secrets-and-skadnetwork` | once | candidate |
| promotion box 8 | `analytics.rc-to-amplitude-integration` | once | decided |
| promotion box 8 | `analytics.rc-to-apple-search-ads-integration` | once | decided |
| promotion box 4 | `post-launch.collector-synthetic-events-isolated` | once | decided |
| promotion box 7 | `post-launch.deploy-and-rollback-logged` | every_release | decided |
| promotion box 1 | `post-launch.public-listing-opens-signed-out` | once | decided |
| promotion box 6 | `post-launch.site-build-language-env-match` | every_release | decided |
| promotion box 5 | `post-launch.site-privacy-matches-deployed-analytics` | every_release | decided |
| promotion box 3 | `post-launch.waitlist-kv-bound` | once | decided |
| promotion box 2 | `submission.support-mailbox-receives-mail` | once | decided |

### 4.7 SHIPPING.md

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| Phase 8 | `analytics.experiment-ledger-file` | every_release | decided |
| Phase 7 | `analytics.vendor-ui-proof-per-destination` | once | decided |
| Phase 8 | `analytics.weekly-readout-scheduled` | once | decided |
| Phase 5 | `aso.age-rating-complete` | once | decided |
| Phase 4 | `aso.assets-no-unverifiable-claim` | every_release | decided |
| Phase 4 | `aso.screenshots-real-current-build-ui` | every_release | decided |
| Phase 5 | `aso.screenshots-uploaded-required-size` | every_release | candidate |
| Phase 1 | `build.full-test-suite-before-push` | every_release | decided |
| Phase 0 | `build.ipad-compat-layout-scrolls` | every_release | candidate |
| Phase 0 | `monetization.no-trial-toggle` | every_release | verified |
| Phase 0 | `monetization.single-offer-after-decline` | every_release | candidate |
| Phase 4 | `monetization.sub-prices-all-territories` | once | decided |
| Phase 5 | `monetization.subs-attached-to-version-submission` | once | candidate |
| Phase 8 | `post-launch.first-week-monitoring` | every_release | decided |
| Phase 7 | `post-launch.launch-gated-list-run` | every_release | decided |
| Phase 7 | `post-launch.offer-code-minted-with-channel` | once | candidate |
| Hard rules 4, Phase 6 | `post-launch.rejection-recorded-with-rule` | every_release | decided |
| Phase 2 | `release.build-contains-work-by-ancestry` | every_release | decided |
| Phase 2 | `release.build-in-beta-testing-before-delivery-report` | every_release | decided |
| Phase 2 | `release.build-version-stamped-from-tag` | every_release | decided |
| Hard rules 1, 2, Phase 5 | `release.owner-go-before-submit` | every_release | decided |
| Hard rules 2, Phase 2 | `release.owner-says-tag-it` | every_release | candidate |
| Hard rules 3, Phase 6 | `release.rejected-build-never-resubmitted` | every_release | decided |
| Phase 2 | `release.tag-run-appeared` | every_release | candidate |
| Hard rules 1, Phase 2, Phase 3 | `release.testflight-first` | every_release | candidate |
| Phase 0, Phase 3 | `release.uat-issue-updated` | every_release | decided |
| Phase 6 | `release.version-state-watched-same-day` | every_release | decided |
| Phase 4 | `setup.submission-state-file-seeded` | once | decided |
| Phase 6 | `submission.entitlements-verified-on-uploaded-binary` | every_release | decided |
| Phase 2, Phase 5 | `submission.intended-build-attached` | every_release | decided |
| Phase 4 | `submission.no-receipt-name-only-gate` | every_release | decided |
| Phase 5 | `submission.privacy-labels-complete-and-true` | every_release | decided |
| Phase 0, Phase 4 | `submission.rejections-ledger-cross-checked` | every_release | decided |
| Phase 4 | `submission.review-notes-match-build` | every_release | decided |
| Phase 4 | `submission.support-mailbox-receives-mail` | once | decided |

### 4.8 REJECTIONS.md

| Old location | Requirement id | Cadence | Acceptance |
|---|---|---|---|
| Traps (screenshot compliance) | `aso.assets-no-unverifiable-claim` | every_release | decided |
| Traps (screenshot compliance) | `aso.screenshots-real-current-build-ui` | every_release | decided |
| 2026-08-13 Guideline 4 | `build.ipad-compat-layout-scrolls` | every_release | candidate |
| Traps (rule 3.20) | `monetization.asc-products-in-entitlement-list` | every_release | decided |
| 2026-08-12 Guideline 3.1.2(c) (status fixed) | `monetization.no-trial-toggle` | every_release | verified |
| 2026-08-13 Guideline 5.6 (status open) | `monetization.single-offer-after-decline` | every_release | candidate |
| 2026-08-12 | `monetization.skip-trial-toggle-tactic` | once | retired |
| Traps (MISSING_METADATA) | `monetization.sub-prices-all-territories` | once | decided |
| Traps (MISSING_METADATA) | `monetization.sub-review-screenshot-present` | once | decided |
| intro | `post-launch.rejection-recorded-with-rule` | every_release | decided |
| Traps (external TestFlight) | `release.external-testflight-demo-account` | once | decided |
| Traps (no rejection text in API) | `release.version-state-watched-same-day` | every_release | decided |
| 2026-08-12 Lesson | `submission.competitor-sightings-not-evidence` | once | decided |
| 2026-08-04 Lesson | `submission.entitlements-verified-on-uploaded-binary` | every_release | decided |
| Traps (rule 2.13) | `submission.no-receipt-name-only-gate` | every_release | decided |
| 2026-08-04 Fix | `submission.no-third-party-brand-icons` | every_release | candidate |
| (whole file) | `submission.rejections-ledger-cross-checked` | every_release | decided |
| 2026-08-04 Guideline 2.5.1 (status fixed) | `submission.screen-time-linkage-matches-entitlement` | every_release | verified |
| Traps (dead support mailboxes) | `submission.support-mailbox-receives-mail` | once | decided |

### 4.9 Wiki rules (all 43)

Status is carried verbatim. The wiki stays the place where the owner changes a rule status; then someone updates `acceptance` here and bumps `revision` if the text changed.

| Wiki ID | Wiki status | Requirement id | Kind |
|---|---|---|---|
| A-01 | decided | `release.agent-autonomous-scope` | guideline |
| A-02 | decided | `release.human-go-for-price-product-flow-changes` | check |
| A-03 | decided | `release.human-go-for-price-product-flow-changes` | check |
| A-04 | decided | `release.human-go-for-price-product-flow-changes` | check |
| A-05 | decided | `analytics.live-experiments-in-weekly-report` | check |
| A-05 | decided | `release.human-go-for-price-product-flow-changes` | check |
| G-01 | decided | `release.distribution-started-before-approval` | check |
| G-02 | decided | `analytics.funnel-progression-not-views` | check |
| G-03 | decided | `analytics.attribution-pipe-verified-before-paid-spend` | check |
| G-04 | decided | `post-launch.creator-cac-full-cost` | guideline |
| G-05 | decided | `post-launch.views-and-conversions-decoupled` | guideline |
| G-06 | decided | `post-launch.every-video-shows-product` | guideline |
| G-07 | decided | `post-launch.creators-by-comment-engagement` | guideline |
| G-08 | decided | `post-launch.creator-pay-base-plus-milestones` | guideline |
| G-09 | decided | `post-launch.budget-flat-weeks-per-channel` | guideline |
| G-10 | decided | `post-launch.copy-proven-content-format` | guideline |
| G-11 | decided | `post-launch.sell-the-outcome` | guideline |
| G-12 | decided | `build.widget-reentry-surface` | check |
| G-13 | decided | `analytics.funnel-constraint-diagnosed` | check |
| G-14 | decided | `analytics.experiment-ledger-file` | check |
| G-15 | candidate | `aso.screenshots-are-an-ad-sequence` | check |
| I-01 | decided | `idea.one-sentence` | check |
| I-02 | decided | `idea.demand-receipts` | check |
| I-03 | decided | `idea.paying-intent-sizing` | check |
| I-04 | decided | `idea.free-paid-line-named` | check |
| I-05 | decided | `idea.distribution-loop-named` | check |
| I-06 | decided | `idea.kill-criterion-dated` | check |
| I-07 | decided | `idea.scored-evidence-monetization-loop` | check |
| P-01 | decided | `build.first-version-scope` | check |
| P-02 | decided | `build.value-moment-before-paywall` | check |
| P-03 | decided | `monetization.entitlements-are-server-roles` | check |
| P-04 | decided | `monetization.paywall-placements-covered` | check |
| P-05 | decided | `idea.paywall-adapted-not-copied` | guideline |
| P-06 | decided | `monetization.hard-paywall-after-onboarding` | check |
| P-07 | decided | `monetization.trial-anxiety-is-the-constraint` | guideline |
| P-08 | decided | `build.longer-onboarding-wins` | guideline |
| P-09 | decided | `monetization.abandonment-discount-annual-only` | check |
| P-10 | decided | `monetization.annual-preselected-few-plans` | check |
| P-11 | decided | `monetization.paywall-at-peak-effort` | check |
| P-12 | decided | `build.concrete-external-loss` | guideline |
| P-13 | decided | `monetization.freemium-and-winback-shape` | check |
| P-14 | decided | `analytics.benchmark-bands-compared` | check |
| P-15 | candidate | `monetization.paywall-close-rescue-offer` | check |
| P-16 | candidate | `monetization.benchmarks-before-change` | check |

## 5. Lock In Chinese tracking seed

Only explicit claims of `APP_STORE_SUBMISSION.md` and `LAUNCH_CHECKLIST.md` are seeded. Rules used:

- Checked item or verified-good row with recorded evidence: `done`, with `evidence.kind = doc`, the doc's date, and the release the doc names.
- Checked item whose evidence is incomplete (B3, B4, B5, B7, S2, S3, S4, S6, S11, S12, S13): `in_progress` with a note. Partial verified-good rows (7.3, 7.3a) and S16 are `in_progress` too.
- `every_release` records carry release `1.0` (the 2026-07-28 audit; `1.0(171)` where the doc names build 171). The app's `current_release` is `1.7.16`. So every one of them shows as `todo` with `last_done: 1.0` for the current release. No old evidence counts for a new build.
- `once` records have release `null`; the release that the doc names is kept inside the evidence entry.
- Unchecked items have no record, except the offer code item, which the doc states as blocked on an owner decision (`blocked`, owner `owner`).
- No owner was invented. No record is `done` without a dated doc statement.

| Requirement | Release | Status | Source item(s) |
|---|---|---|---|
| `aso.metadata-no-forbidden-terms` | 1.0 | in_progress | - |
| `aso.name-30-chars-no-competitor-keywords` | 1.0 | in_progress | - |
| `aso.support-marketing-url-every-localization` | 1.0 | done | verified-good-7.3-7.5 |
| `monetization.auto-renew-statement-visible` | 1.0 | done | verified-good-3.1-3.8 |
| `monetization.manage-subscription-reachable` | 1.0 | in_progress | - |
| `monetization.no-external-purchase-steering` | 1.0 | done | verified-good-3.8 |
| `monetization.no-unminted-code-visible` | 1.0 | done | verified-good-3.15 |
| `monetization.paywall-legal-links-resolve` | 1.0 | done | verified-good-3.5-3.6 |
| `monetization.paywall-offline-fallback` | 1.0 | in_progress | - |
| `monetization.product-ids-set-equal` | 1.0 | in_progress | - |
| `monetization.purchase-controls-do-their-label` | 1.0 | in_progress | - |
| `monetization.restore-purchases` | 1.0 | in_progress | - |
| `monetization.sub-prices-all-territories` | - | done | verified-good-3.13, territory-pricing-sanity |
| `monetization.sub-review-screenshot-present` | - | done | verified-good-3.12 |
| `monetization.subs-attached-to-version-submission` | - | done | attach-subscriptions |
| `monetization.trial-terms-visible` | 1.0 | done | verified-good-3.1-3.8 |
| `post-launch.offer-code-minted-with-channel` | - | blocked | - |
| `setup.special-entitlement-enabled-per-id` | - | done | verified-good-1.3 |
| `setup.xcode-cloud-workflows` | - | in_progress | - |
| `submission.account-deletion-position-stated` | - | in_progress | - |
| `submission.app-group-identical-all-targets` | 1.0 | done | verified-good-2.5 |
| `submission.build-state-valid` | 1.0(171) | done | verified-good-4.2 |
| `submission.export-compliance-key-set` | - | done | verified-good-2.1 |
| `submission.feedback-recorder-absent-from-release` | 1.0 | in_progress | - |
| `submission.legal-urls-return-200` | 1.0 | done | verified-good-6.1 |
| `submission.listed-sdks-have-signed-manifests` | 1.0 | done | verified-good-2.4 |
| `submission.no-unused-entitlement` | 1.0 | done | verified-good-2.6 |
| `submission.policy-names-every-outbound-host` | 1.0 | in_progress | - |
| `submission.privacy-manifest` | 1.0 | in_progress | - |
| `submission.privacy-url-every-localization` | 1.0 | done | verified-good-5.6 |
| `submission.recording-capability-disclosed` | 1.0 | in_progress | - |
| `submission.shield-not-hide` | 1.0 | done | verified-good-2.14 |
| `submission.site-copy-matches-listing` | 1.0 | in_progress | - |
| `submission.support-mailbox-receives-mail` | - | in_progress | - |
| `submission.terms-page-real-subscription-terms` | - | in_progress | - |
| `submission.tracking-answers-match-att-and-manifest` | 1.0 | done | verified-good-5.4 |

Claims in the docs that were NOT seeded:

| Claim | Reason |
|---|---|
| Verified-good 2.16-2.18 "mechanised 2026-09-03" | It says the tests exist. It records no passing run for a named build. |
| Verified-good 3.7, 3.9, 3.10 | They argue from code. They map to items that are `in_progress` (S11, S2, S13); the notes mention them. |
| Verified-good 7.8 (core value reachable without purchase) | The 1.7.12 review notes in the same doc say the opposite for later builds. It is a side of conflict `free-rescue-pass`. |
| S17 consent withdrawal, "DEFERRED" | Deferred is not blocked and not "not applicable". The record stays absent (= todo). The rule has conflict `analytics-consent-toggle`. |
| B1, B2, B6, S1, S5, S7, S8, S9, S10, S14, S15, S18 | Open in the doc as of 2026-07-28. The app shipped later (1.7.11 approved 2026-09-03), so several were closed in fact, but no doc records it. They stay absent until someone records evidence. |
| Public listing check of 2026-09-06 (readiness playbook), build 303, versions 1.7.14 and 1.7.16 (release-flow playbook) | The task limited the seed to the two app docs. They are context for `current_release` only. |

## 6. How to use the app-level docs now

1. `apps/<app>/docs/APP_STORE_SUBMISSION.md` and `LAUNCH_CHECKLIST.md` become narrative files: audit findings, corrections, review notes, links. Do not add new checkboxes there. Record state with `kb set <app> <req> --status ... --evidence ...`.
2. For a new release: set `current_release` in `apps.jsonl`, then run `kb checklist <app>`. Every `every_release` check returns to `todo` and shows `last_done`.
3. For a new app: add one line to `apps.jsonl` with tags. The template `APP_STORE_SUBMISSION.md` copy step (submission playbook "How to use it", bootstrap checklist last item) is replaced by `kb checklist <app>`. The templates can stay until the owner removes them; `setup.submission-state-file-seeded` documents both procedures.
4. For a new rejection: write the `REJECTIONS.md` entry and the playbook rule (unchanged), then add or revise the requirement and bump `revision`. Done items for that requirement then show as `stale`.
5. For a rule status change in the wiki: copy the status word to `acceptance` and to `refs[].upstream_status`.
6. The Lock In Chinese submission doc has a banner that says it is stale since 2026-07-31. A fresh audit should write tracking records, not new checkboxes.

## 7. Deliberately NOT migrated

- `SOTA.md` verdicts, `EXPERIMENTS.md` rows, growth tricks status tables, the paywall application map: ledgers with their own status words.
- Idea Roast items K1-K13 and S1-S5 as single records (one check `idea.roast-recorded` covers the run).
- Third-party checklists in `external/` (they are sources, not rules of ours). `external/ua-skills` stays linked-only: the upstream is a `url` source; only our notes are a `kb` source. `external/rork-guide/GUIDE.md` is `vendored`, license null, `publishable: false`.
- Wiki verdict cards, the idea bank query, raw transcripts, the decision log text.
- Evidence receipts under `docs/playbooks/receipts/` (private; one file matched a credential pattern scan). They can become `evidence` entries later, by reference only.
- Apple Search Ads campaign state, keyword lists, budgets; metric targets; prices; product ids; offer code names; account identifiers; reviewer notes text.
- Lock In Japanese status tables in the ASC bootstrap status playbook: no tracking file was seeded for it (the task scoped the tracking seed to Lock In Chinese). The other four apps have no checklist docs, so they have no tracking file; absent = all `todo`.
- Non-iOS entries of `apps/` (web worker, services, research-only folders).

## 8. Open points for the owner

- `publishable: false` was set on `SHIPPING.md`, `REJECTIONS.md`, `SOTA.md` and `EXPERIMENTS.md` although they are repo files. They hold an offer code name, App Review quotes, prices, and revenue or experiment figures, which the inventories class as sensitive. Flip them after a redaction pass.
- `license: "MIT"` on repo-owned sources follows the root `package.json`.
- Tags `subscriptions` on ailifestory and dotself come from a code search, not from a doc. Confirm.
- 30 open conflicts need an owner decision. `kb conflicts` lists them.
- **Acceptance was assigned by the seed, not by the owner (added 2026-09-19 after review).** 137 non-wiki rules carry `decided` and 2 carry `verified`. The mapping is in `inventory/RECONCILIATION.md` section 2: a playbook rule stated as a mandatory gate became `decided`; a rule proven by a fixed rejection with a guard test became `verified`. The wiki defines `verified` as "measured in a shipped app" and reserves status changes for the owner. Wiki rules kept their wiki status verbatim. Confirm the mapping, or downgrade with `kb revise <req> --acceptance candidate`.
- **The two review-screenshot and territory-price records for Lock In Chinese were downgraded to `in_progress` (2026-09-19).** The dated evidence covers 3 subscriptions; 5 existed by 2026-09-03. The first seed marked them `done`, which overstated the source. The evidence is kept.
- **`origin` of this repository is a PUBLIC GitHub repo.** The records paraphrase private wiki rules and private playbooks, and the inventories name private repository paths. The store needs a private remote before any push. See `docs/REPORT.md`.

## 9. Conflict resolutions (2026-09-21, owner: "resolve them")

The owner said "resolve them" for all 30 `open` records in `data/conflicts.jsonl`. Both sides of every conflict were read in the source files. Precedence, in order: (1) an App Review rejection or a fix with a guard test; (2) a source that retracts or supersedes its own earlier text; (3) the newer dated statement between the owner's own docs; (4) the app state doc for facts, the playbook for the rule; (5) a wiki `decided` rule over an apps-repo candidate, and the more specific wiki rule over the general one; (6) the conservative option when nothing above applies. Each `resolution` names the chosen side, the rule and the deciding date or source.

Edits to `data/requirements.jsonl`: the "Open conflict ..." sentence is gone from every `what`/`how` and the resolved rule replaces the conflicted wording; the `conflicts` links stay as history. Acceptance moved `candidate` -> `decided` only where the seed had set `candidate` because of the conflict alone (`inventory/RECONCILIATION.md` section 2: "Any apps-repo rule with an open conflict"). Wiki `upstream_status` values are verbatim. `revision` is 2 only where the resolved text changes the meaning of the check (`revised_at: 2026-09-21`, `revision_note` names the conflict).

| Conflict id | Chosen side (short) | Rule | Requirements changed | Revision bumped |
|---|---|---|---|---|
| `abandonment-placement-vs-offer-burst` | rejection ledger: placement not required; only as the single post-decline offer | 1 | `monetization.abandonment-discount-annual-only`; `monetization.paywall-placements-covered`; `monetization.single-offer-after-decline` | y: `monetization.abandonment-discount-annual-only`, `monetization.paywall-placements-covered` |
| `analytics-client-platform` | native Swift emission | 2 | `analytics.device-context-on-every-event` (candidate -> decided) | n |
| `analytics-consent-toggle` | playbook rule: the control is a gate; app fact stays open | 4 | `submission.analytics-consent-withdrawal` (candidate -> decided) | n |
| `aso-cross-localization` | unverified assumptions (banner 2026-09-15) | 2 | `aso.secondary-locales-distinct-keywords` | y: `aso.secondary-locales-distinct-keywords` |
| `build-upload-tool` | Xcode Cloud or local recipe; not EAS | 3 | `setup.xcode-cloud-workflows` (candidate -> decided) | n |
| `extension-bundle-id-suffix` | .widgets (project.yml) | 4 | `setup.bundle-ids-capabilities-registered` (candidate -> decided) | n |
| `family-controls-grant-scope` | toggle is enough; request only if missing (2026-09-08) | 3 | `setup.special-entitlement-enabled-per-id` (candidate -> decided) | n |
| `free-rescue-pass` | no free access; one paid non-renewing pass (1.7.12 notes 2026-09-09) | 4, 3 | `monetization.paywall-close-rescue-offer`; `monetization.single-offer-after-decline`; `post-launch.guardrail-metrics-monitored` (candidate -> decided) | n |
| `japanese-bundle-id` | registered id with .ja suffix | 4 | `setup.app-identity-decided` (candidate -> decided) | n |
| `limited-spots-line` | no scarcity line (conservative) | 6 | `monetization.no-fake-scarcity-or-countdown` | n |
| `offer-code-surface` | no in-app surface since 2026-08-14 | 1, 3 | `post-launch.growth-tricks-recorded` (candidate -> decided); `post-launch.offer-code-minted-with-channel` (candidate -> decided); `post-launch.offer-redemption-smoke-test` | n |
| `paywall-vendor` | RevenueCat (decided 2026-07-31) | 2 | `monetization.product-ids-set-equal` (candidate -> decided); `setup.revenuecat-project-configured` (candidate -> decided) | n |
| `release-start-mode-and-testflight-path` | merge = TestFlight; owner tag = release | 2, 3 | `release.tag-run-appeared` (candidate -> decided); `release.testflight-first` (candidate -> decided); `setup.xcode-cloud-workflows` (candidate -> decided) | n |
| `release-type` | manual for a first version | 4 | `submission.release-type-manual-for-launch` (candidate -> decided) | n |
| `screenshot-sizes` | 6.9 inch set only; sizes at export time | 3 | `aso.screenshots-uploaded-required-size` (candidate -> decided) | n |
| `secret-naming` | layered: app prefix on GitHub/SOPS, unprefixed Worker binding, family exception | 2 | `analytics.app-prefixed-secrets-mirrored` (candidate -> decided); `setup.amplitude-project-secret-set` (candidate -> decided) | n |
| `spin-wheel-discount` | certain reveal; no random version | 2 | `monetization.earned-discount-not-random` | y: `monetization.earned-discount-not-random` |
| `subscription-count` | count from ASC API; every sold product attached | 4 | `monetization.no-orphan-iap-attached`; `monetization.subs-attached-to-version-submission` (candidate -> decided) | n |
| `subscription-rerun-safety` | re-run does not repair (Correction 2026-09-08) | 2 | `setup.subscriptions-created-ready` (candidate -> decided) | n |
| `tracking-and-att` | answers follow the shipping build; Meta SDK branch pending | 4, 3 | `analytics.meta-capi-secrets-and-skadnetwork` (candidate -> decided); `submission.att-states-device-verified`; `submission.tracking-answers-match-att-and-manifest` (candidate -> decided) | n |
| `trial-lengths` | facts from ASC/StoreKit at submission time | 4, 3 | `monetization.sub-review-notes-match-offers` (candidate -> decided) | n |
| `trial-toggle-tactic` | do not ship; map row stale | 1 | `monetization.no-trial-toggle`; `monetization.skip-trial-toggle-tactic` | n |
| `who-may-cut-release` | agents never tag; owner runs or names the runner | 3 | `release.owner-says-tag-it` (candidate -> decided) | n |
| `wiki-autonomy-rules-date-anomaly` | 2026-08-01 is the growth-ops ratification date | 2 | `analytics.live-experiments-in-weekly-report`; `release.agent-autonomous-scope`; `release.human-go-for-price-product-flow-changes` | n |
| `wiki-moonly-vs-decided-rules` | decided rules stand; page is evidence only | 2, 5 | `build.longer-onboarding-wins`; `monetization.annual-preselected-few-plans`; `monetization.hard-paywall-after-onboarding`; `monetization.paywall-placements-covered`; `monetization.trial-anxiety-is-the-constraint` | y: `monetization.paywall-placements-covered` |
| `wiki-p01-vs-p08` | both stand; P-01 limits parts, not onboarding length | 5 | `build.first-version-scope`; `build.longer-onboarding-wins` | n |
| `wiki-p05-vs-g10-p16` | three rules, three surfaces; P-16 stays candidate | 5 | `idea.paywall-adapted-not-copied`; `monetization.benchmarks-before-change`; `post-launch.copy-proven-content-format` | n |
| `wiki-p15-vs-p09` | both stand; a pass is not a subscription discount | 5 | `monetization.abandonment-discount-annual-only`; `monetization.paywall-close-rescue-offer` | y: `monetization.abandonment-discount-annual-only` |
| `wiki-p15-vs-p13` | both stand; a rescue is not a winback | 5 | `monetization.freemium-and-winback-shape`; `monetization.paywall-close-rescue-offer` | n |
| `wiki-verdict-card-status-drift` | read status from playbook/apps.md only | 2 | - | n |

Counts: 30 conflicts resolved (34 of 34 now `resolved`); 47 requirements edited; 23 acceptance flips (`candidate` -> `decided`); 4 revision bumps; 0 `stale` tracking items (no `done` record exists for a bumped requirement; `kb checklist lockin-chinese --state stale` shows none).

Kept `candidate` after resolution, with the reason: `aso.secondary-locales-distinct-keywords`, `monetization.benchmarks-before-change`, `monetization.earned-discount-not-random`, `monetization.no-fake-scarcity-or-countdown`, `monetization.no-orphan-iap-attached`, `monetization.paywall-close-rescue-offer`, `monetization.single-offer-after-decline`, `post-launch.offer-redemption-smoke-test`, `submission.att-states-device-verified`. `monetization.single-offer-after-decline` rests on a ledger entry with status `open` and no guard test. `aso.secondary-locales-distinct-keywords`, `monetization.no-fake-scarcity-or-countdown` and `monetization.earned-discount-not-random` come from the ASO kit (unverified banner), the video synthesis and a paywall tactic. `monetization.no-orphan-iap-attached`, `post-launch.offer-redemption-smoke-test` and `submission.att-states-device-verified` are cited from one app's files only. `monetization.benchmarks-before-change` and `monetization.paywall-close-rescue-offer` carry the wiki status `candidate`, which only the owner moves.

Source text was not edited (the apps repo and the wiki are read-only inputs). Stale source lines that the resolutions name, for the owner to fix at the source: the paywall-experiments application map row for tactic 4; the growth-tricks trick 1 status row; the launch checklist "Redemption smoke test" step; the METRICS.md rescue grant guardrail; the analytics playbooks' Expo sections; the setup kit `.widget` suffix and EAS ship gate.
