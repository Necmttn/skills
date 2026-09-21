# Reconciliation: sources to requirement records

Date: 2026-09-18. Builder: B (seed). Inputs: `inventory/apps-repo.md` (181 check candidates, 25 conflicts), `inventory/wiki.md` (43 rules, 27 of them per-app checks, 9 tensions), `SHIPPING.md` (hard rules and phases), `REJECTIONS.md` (3 entries, 7 traps), `IDEA-ROAST.md`.
Output: `data/requirements.jsonl` (226 records), `data/conflicts.jsonl` (34 records).

## 1. Method

1. One record per distinct actionable statement. Two candidates merge only when they state the same thing about the same surface.
2. A merged record cites ALL its sources in `refs`. Wiki rules keep `upstream_id` and `upstream_status`.
3. Where sources disagree, no side is chosen. A `conflicts.jsonl` record holds each side. The affected requirement links it, names it in `what`, and is `candidate`.
4. Exception to 3: a rule keeps its status when a source marks it with an explicit status word. That is a wiki status (`decided`, `candidate`) or a rejection ledger status `fixed` with a guard test (`verified`).
5. A conflict that a source retracts itself is recorded as `resolved` with the retraction as the resolution. A resolved conflict does not force `candidate`.

## 2. Acceptance mapping used

| Source statement | acceptance |
|---|---|
| Wiki status word | carried verbatim (40 decided, 3 candidate) |
| Apps-repo playbook gate, recipe step, bootstrap item, release rule, label contract | `decided` |
| Rejection ledger entry with status `fixed` and a guard test | `verified` (2 records) |
| Rejection ledger entry with status `open`; a fix note with no guard | `candidate` |
| Rule found only in one app's audit file, the video synthesis, the ASO kit (unverified banner), or a paywall tactic | `candidate` |
| Any apps-repo rule with an open conflict | `candidate` |
| Struck tactic | `retired`, and the replacing rule lists it in `supersedes` |

## 3. Counts

| Input | Count | Result |
|---|---|---|
| Apps-repo candidates | 181 | 176 records (5 internal merges removed 5 slugs; 0 dropped) |
| of these, shared with a wiki rule | 6 records | P-04, P-05, P-09, G-14, A-02..A-05 |
| Wiki rules | 43 | 35 new records + 8 rules merged into 6 shared records (A-05 is cited by two records) |
| SHIPPING, REJECTIONS, IDEA-ROAST, conflict 24 | - | 15 new records; all other statements merged into existing records as extra refs |
| Total | - | 226 records: 212 checks, 14 guidelines |

Every one of the 181 inventory slugs appears in the table below. The generator asserted this by script. No candidate was dropped.

## 4. Table: requirement id, merged-from, note

`merged-from` lists apps-repo inventory slugs, wiki IDs, and SHIPPING / REJECTIONS locations.

| Requirement id | Merged from | Note |
|---|---|---|
| `analytics.adservices-token-collection` | adservices-token-collection-enabled | - |
| `analytics.app-prefixed-secrets-mirrored` | app-prefixed-secrets-mirrored-to-sops | conflicts: secret-naming |
| `analytics.attribution-pipe-verified-before-paid-spend` | wiki G-03 | - |
| `analytics.benchmark-bands-compared` | wiki P-14 | - |
| `analytics.device-context-on-every-event` | device-context-on-every-event | conflicts: analytics-client-platform |
| `analytics.experiment-ledger-file` | experiment-ledger-file-exists; wiki G-14 | Inventory phase was monetization with cadence once (per experiment); wiki guessed every_release. Seeded as analytics/every_release. |
| `analytics.extension-events-buffered` | extension-events-buffered-not-sent | - |
| `analytics.funnel-constraint-diagnosed` | wiki G-13 | - |
| `analytics.funnel-dashboard-exists` | amplitude-funnel-dashboard-exists | - |
| `analytics.funnel-progression-not-views` | wiki G-02 | - |
| `analytics.live-experiments-in-weekly-report` | live-experiments-in-weekly-report; wiki A-05 (second half) | conflicts: wiki-autonomy-rules-date-anomaly |
| `analytics.meta-capi-secrets-and-skadnetwork` | meta-capi-secrets-and-skadnetwork | conflicts: tracking-and-att |
| `analytics.rc-to-amplitude-integration` | rc-to-amplitude-integration-on | - |
| `analytics.rc-to-apple-search-ads-integration` | rc-to-apple-search-ads-integration-on | - |
| `analytics.revenue-not-double-counted` | revenue-not-double-counted | - |
| `analytics.server-destinations-wired` | server-destinations-wired | - |
| `analytics.single-screenid-vocabulary` | single-screenid-vocabulary | - |
| `analytics.subdomain-route-live` | analytics-subdomain-route-live | - |
| `analytics.tools-bought-by-company` | tesvik-purchase-via-company | - |
| `analytics.vendor-ui-proof-per-destination` | vendor-ui-proof-per-destination; SHIPPING Phase 7 | - |
| `analytics.web-pixels-via-zaraz` | web-pixels-via-zaraz | - |
| `analytics.weekly-readout-scheduled` | weekly-readout-scheduled | - |
| `aso.age-rating-complete` | age-rating-complete; SHIPPING Phase 5 owner click | - |
| `aso.assets-localized-per-storefront` | assets-localized-per-storefront | - |
| `aso.assets-meet-4plus` | assets-meet-4plus | - |
| `aso.assets-no-price-discount-url-copyright` | assets-no-price-discount-url-copyright | - |
| `aso.assets-no-unverifiable-claim` | assets-no-unverifiable-claim; REJECTIONS trap (award laurels) | - |
| `aso.change-recorded-with-baseline` | aso-change-recorded-with-baseline | - |
| `aso.content-rights-and-territories-set` | content-rights-and-territories-set | - |
| `aso.device-only-screens-captured-on-device` | device-only-screens-captured-on-device | - |
| `aso.eula-link-in-description` | eula-link-in-description | - |
| `aso.first-three-screenshots-ordered-for-search` | first-three-screenshots-ordered-for-search | - |
| `aso.focal-art-safe-area-previewed` | focal-art-safe-area-previewed | - |
| `aso.header-and-search-creative-assets` | header-and-search-creative-assets | - |
| `aso.in-app-event-art-both-ratios` | in-app-event-art-both-ratios | - |
| `aso.keywords-within-100-chars` | keywords-within-100-chars | - |
| `aso.metadata-no-forbidden-terms` | metadata-no-forbidden-terms | - |
| `aso.name-30-chars-no-competitor-keywords` | name-30-chars-no-competitor-keywords | - |
| `aso.name-subtitle-final-before-submit` | name-subtitle-final-before-submit | - |
| `aso.non-english-metadata-native-checked` | non-english-metadata-native-checked | - |
| `aso.preview-poster-frame-stands-alone` | preview-poster-frame-stands-alone | - |
| `aso.preview-works-muted-and-loops` | preview-works-muted-and-loops | - |
| `aso.screenshots-are-an-ad-sequence` | wiki G-15 | - |
| `aso.screenshots-real-current-build-ui` | screenshots-real-current-build-ui; REJECTIONS trap (screenshot compliance) | - |
| `aso.screenshots-uploaded-required-size` | screenshots-uploaded-required-size; SHIPPING Phase 5 owner click | conflicts: screenshot-sizes |
| `aso.secondary-locales-distinct-keywords` | secondary-locales-added-with-distinct-keywords | conflicts: aso-cross-localization |
| `aso.support-marketing-url-every-localization` | support-marketing-url-every-localization | - |
| `build.capture-seal-watermark` | capture-seal-watermark-on-share-surfaces | - |
| `build.concrete-external-loss` | wiki P-12 | - |
| `build.controls-have-accessibility-ids` | controls-have-accessibility-ids | - |
| `build.first-version-scope` | wiki P-01 | conflicts: wiki-p01-vs-p08 |
| `build.full-test-suite-before-push` | full-test-suite-before-push; SHIPPING Phase 1 | - |
| `build.growth-ledger-skimmed` | growth-ledger-skimmed-before-first-testflight | - |
| `build.ipad-compat-layout-scrolls` | REJECTIONS 2026-08-13 (Guideline 4) | - |
| `build.longer-onboarding-wins` | wiki P-08 | conflicts: wiki-p01-vs-p08, wiki-moonly-vs-decided-rules |
| `build.no-precondition-traps` | no-precondition-traps-in-release | Derived from one app's audit finding; not yet a playbook rule. |
| `build.qa-launch-args` | qa-launch-args-present | - |
| `build.qa-new-customer-switch` | qa-review-as-new-customer-switch | - |
| `build.sandbox-tester-per-scenario` | sandbox-tester-per-scenario | - |
| `build.value-moment-before-paywall` | wiki P-02 | conflicts: wiki-p02-vs-p06 |
| `build.widget-reentry-surface` | wiki G-12 | - |
| `idea.competitor-screen-study` | competitor-screen-study-recorded | - |
| `idea.demand-receipts` | wiki I-02 | - |
| `idea.distribution-loop-named` | wiki I-05 | - |
| `idea.free-paid-line-named` | wiki I-04 | - |
| `idea.kill-criterion-dated` | wiki I-06 | - |
| `idea.one-sentence` | wiki I-01; IDEA-ROAST K1 | - |
| `idea.paying-intent-sizing` | wiki I-03 | - |
| `idea.paywall-adapted-not-copied` | paywall-tactics-adapted-not-copied; wiki P-05 | conflicts: wiki-p05-vs-g10-p16 |
| `idea.roast-recorded` | IDEA-ROAST (new; not in inventories) | - |
| `idea.scored-evidence-monetization-loop` | wiki I-07 | - |
| `monetization.abandonment-discount-annual-only` | discount-annual-only; wiki P-09 | conflicts: wiki-p15-vs-p09, abandonment-placement-vs-offer-burst |
| `monetization.annual-preselected-few-plans` | wiki P-10 | conflicts: wiki-moonly-vs-decided-rules |
| `monetization.asc-products-in-entitlement-list` | asc-products-in-entitlement-list; REJECTIONS trap 3.20 | - |
| `monetization.auto-renew-statement-visible` | auto-renew-statement-visible | - |
| `monetization.benchmarks-before-change` | wiki P-16 | conflicts: wiki-p05-vs-g10-p16 |
| `monetization.billed-amount-most-prominent` | billed-amount-most-prominent | - |
| `monetization.earned-discount-not-random` | inventory conflict 24 (no inventory slug) | conflicts: spin-wheel-discount |
| `monetization.entitlements-are-server-roles` | wiki P-03 | - |
| `monetization.freemium-and-winback-shape` | wiki P-13 | conflicts: wiki-p15-vs-p13 |
| `monetization.hard-paywall-after-onboarding` | wiki P-06 | conflicts: wiki-p02-vs-p06, wiki-moonly-vs-decided-rules |
| `monetization.launch-discounts-as-offer-codes` | launch-discounts-as-offer-codes | - |
| `monetization.manage-subscription-reachable` | manage-subscription-reachable | - |
| `monetization.no-external-purchase-steering` | no-external-purchase-steering | - |
| `monetization.no-fabricated-social-proof` | no-fabricated-social-proof | - |
| `monetization.no-fake-scarcity-or-countdown` | no-fake-scarcity-or-countdown | conflicts: limited-spots-line |
| `monetization.no-orphan-iap-attached` | no-orphan-iap-attached | conflicts: subscription-count, lifetime-product |
| `monetization.no-review-gating` | no-review-gating | - |
| `monetization.no-trial-toggle` | no-trial-toggle-on-paywall; REJECTIONS 2026-08-12, status fixed with guard tests | conflicts: trial-toggle-tactic |
| `monetization.no-unminted-code-visible` | no-unminted-code-visible | - |
| `monetization.paywall-at-peak-effort` | wiki P-11 | - |
| `monetization.paywall-close-rescue-offer` | wiki P-15 | conflicts: wiki-p15-vs-p09, wiki-p15-vs-p13, free-rescue-pass |
| `monetization.paywall-legal-links-resolve` | terms-link-resolves; privacy-link-resolves | - |
| `monetization.paywall-offline-fallback` | paywall-offline-fallback | - |
| `monetization.paywall-placements-covered` | paywall-placements-covered; wiki P-04 | conflicts: wiki-moonly-vs-decided-rules, abandonment-placement-vs-offer-burst |
| `monetization.paywall-plan-title-and-duration` | paywall-plan-title-and-duration | - |
| `monetization.product-ids-set-equal` | product-ids-set-equal | conflicts: paywall-vendor |
| `monetization.purchase-controls-do-their-label` | purchase-controls-do-their-label | - |
| `monetization.remote-paywall-schema-has-legal-fields` | remote-paywall-schema-has-legal-fields | - |
| `monetization.remote-url-sink-allowlist` | remote-url-sink-allowlist | - |
| `monetization.restore-purchases` | restore-purchases-reachable | - |
| `monetization.single-offer-after-decline` | REJECTIONS 2026-08-13 (5.6) | conflicts: free-rescue-pass, abandonment-placement-vs-offer-burst |
| `monetization.skip-trial-toggle-tactic` | PWX tactic 4 (struck); not an inventory slug | conflicts: trial-toggle-tactic |
| `monetization.sub-prices-all-territories` | sub-prices-all-territories; REJECTIONS trap (MISSING_METADATA) | - |
| `monetization.sub-review-notes-match-offers` | sub-review-notes-match-offers | conflicts: trial-lengths |
| `monetization.sub-review-screenshot-present` | sub-review-screenshot-present; REJECTIONS trap (MISSING_METADATA) | - |
| `monetization.subs-attached-to-version-submission` | subs-attached-to-version-submission; SHIPPING Phase 5 | conflicts: subscription-count |
| `monetization.trial-anxiety-is-the-constraint` | wiki P-07 | conflicts: wiki-moonly-vs-decided-rules |
| `monetization.trial-reminder-actually-sent` | trial-reminder-actually-sent | - |
| `monetization.trial-terms-visible` | trial-terms-visible | - |
| `post-launch.asa-campaigns-created-paused` | asa-campaigns-created-paused | - |
| `post-launch.asa-exact-before-discovery` | asa-exact-before-discovery | - |
| `post-launch.asa-no-change-in-learning` | asa-no-budget-or-cpt-change-in-learning | - |
| `post-launch.aso-proposals-in-monthly-window` | aso-proposals-only-in-monthly-window | - |
| `post-launch.budget-flat-weeks-per-channel` | wiki G-09 | - |
| `post-launch.collector-synthetic-events-isolated` | collector-synthetic-events-isolated | - |
| `post-launch.copy-proven-content-format` | wiki G-10 | conflicts: wiki-p05-vs-g10-p16 |
| `post-launch.creator-cac-full-cost` | wiki G-04 | - |
| `post-launch.creator-pay-base-plus-milestones` | wiki G-08 | - |
| `post-launch.creators-by-comment-engagement` | wiki G-07 | - |
| `post-launch.deploy-and-rollback-logged` | deploy-and-rollback-logged | - |
| `post-launch.every-video-shows-product` | wiki G-06 | - |
| `post-launch.first-week-monitoring` | SHIPPING Phase 8 | - |
| `post-launch.growth-tricks-recorded` | growth-tricks-flipped-and-recorded; offer-docs-status-updated | conflicts: offer-code-surface |
| `post-launch.guardrail-metrics-monitored` | guardrail-metrics-monitored | conflicts: free-rescue-pass |
| `post-launch.launch-gated-list-run` | launch-gated-list-run; SHIPPING Phase 7 | - |
| `post-launch.main-train-bumped-after-approval` | main-train-bumped-after-approval | - |
| `post-launch.offer-code-minted-with-channel` | offer-code-minted-with-channel | conflicts: offer-code-surface |
| `post-launch.offer-redemption-smoke-test` | offer-redemption-smoke-test | conflicts: offer-code-surface |
| `post-launch.public-listing-opens-signed-out` | public-listing-opens-signed-out | - |
| `post-launch.rejection-recorded-with-rule` | rejection-rule-added-to-playbook; SHIPPING hard rule 4 | - |
| `post-launch.sell-the-outcome` | wiki G-11 | - |
| `post-launch.site-build-language-env-match` | site-build-language-env-match | - |
| `post-launch.site-privacy-matches-deployed-analytics` | site-privacy-matches-deployed-analytics | - |
| `post-launch.views-and-conversions-decoupled` | wiki G-05 | - |
| `post-launch.waitlist-kv-bound` | waitlist-kv-bound | - |
| `release.agent-autonomous-scope` | wiki A-01 | conflicts: wiki-autonomy-rules-date-anomaly |
| `release.appeal-only-after-info-reply` | appeal-only-after-info-reply | - |
| `release.blocker-testflight-issues-resolved` | blocker-testflight-issues-resolved | - |
| `release.build-contains-work-by-ancestry` | SHIPPING Phase 2 (CANCELED runs) | - |
| `release.build-in-beta-testing-before-delivery-report` | release-build-attached-to-beta-group; delivery-requires-valid-and-in-beta | - |
| `release.build-version-stamped-from-tag` | build-version-stamped-from-tag; SHIPPING Phase 2 | - |
| `release.distribution-started-before-approval` | wiki G-01 | - |
| `release.external-testflight-demo-account` | REJECTIONS trap (external TestFlight) | - |
| `release.human-go-for-price-product-flow-changes` | human-go-for-price-or-flow-change; wiki A-02, A-03, A-04, A-05 (first half) | Wiki marks A-rules as agent policy. They are merged into this check because the apps-repo candidate is a trackable owner gate. Inventory phase was monetization; seeded under release. conflicts: wiki-autonomy-rules-date-anomaly |
| `release.internal-build-number-reported` | internal-build-number-reported | - |
| `release.no-expedited-review-for-launch` | no-expedited-review-for-launch | - |
| `release.owner-go-before-submit` | submission-second-explicit-go; SHIPPING hard rule 2 (submit), Phase 5 | - |
| `release.owner-says-tag-it` | owner-tested-and-said-tag-it; SHIPPING hard rule 2 (tag) | conflicts: who-may-cut-release |
| `release.rejected-build-never-resubmitted` | SHIPPING hard rule 3 | - |
| `release.tag-run-appeared` | tag-run-appeared; SHIPPING Phase 2 | conflicts: release-start-mode-and-testflight-path |
| `release.testflight-first` | SHIPPING hard rule 1 | conflicts: release-start-mode-and-testflight-path |
| `release.uat-issue-updated` | uat-issue-updated; SHIPPING Phase 3 | - |
| `release.version-state-watched-same-day` | version-state-watched-same-day; REJECTIONS trap (no rejection text) | - |
| `setup.amplitude-project-secret-set` | amplitude-project-secret-set | conflicts: secret-naming |
| `setup.app-identity-decided` | app-identity-decided | conflicts: japanese-bundle-id |
| `setup.asc-api-creds-verified` | asc-api-creds-verified | - |
| `setup.asc-app-record-created` | asc-app-record-created | - |
| `setup.asc-registry-entry` | asc-registry-entry-added | - |
| `setup.aso-watch-configured` | aso-watch-configured | - |
| `setup.bundle-ids-capabilities-registered` | bundle-ids-capabilities-registered | conflicts: extension-bundle-id-suffix |
| `setup.developer-program-active` | developer-program-active | - |
| `setup.domain-dns-mx-live` | domain-dns-mx-live | - |
| `setup.metric-contract-defined` | metric-contract-defined | conflicts: metrics-file-existence |
| `setup.paid-apps-agreement-active` | paid-apps-agreement-active | - |
| `setup.profiles-regenerated-after-capability-change` | profiles-regenerated-after-capability-change | - |
| `setup.revenuecat-project-configured` | revenuecat-project-configured | conflicts: paywall-vendor |
| `setup.sdui-flow-copies-identical` | sdui-three-copies-identical | - |
| `setup.sdui-kv-and-worker-envs` | sdui-kv-and-worker-envs-added | - |
| `setup.sentry-project-map-updated` | sentry-project-map-updated | - |
| `setup.sentry-project-registered` | sentry-project-registered | - |
| `setup.special-entitlement-enabled-per-id` | special-entitlement-enabled-per-id | conflicts: family-controls-grant-scope |
| `setup.submission-state-file-seeded` | submission-state-file-seeded; SHIPPING Phase 4 (copy section 9) | - |
| `setup.subscriptions-created-ready` | subscriptions-created-ready | conflicts: subscription-rerun-safety |
| `setup.template-scaffold-verified` | template-scaffold-verified | - |
| `setup.template-source-lines-stripped` | template-source-lines-stripped | - |
| `setup.testflight-post-action-and-group` | testflight-post-action-and-group-set | - |
| `setup.xcode-cloud-workflows` | xcode-cloud-workflows-created | conflicts: release-start-mode-and-testflight-path, build-upload-tool |
| `submission.account-deletion-position-stated` | account-deletion-position-stated | - |
| `submission.analytics-consent-withdrawal` | analytics-consent-withdrawal-in-app | conflicts: analytics-consent-toggle |
| `submission.app-group-identical-all-targets` | app-group-identical-all-targets | - |
| `submission.archive-device-check-clean` | archive-device-check-clean | - |
| `submission.att-states-device-verified` | att-states-device-verified | conflicts: tracking-and-att |
| `submission.binary-locales-match-asc` | binary-locales-match-asc | - |
| `submission.build-state-valid` | build-state-valid | - |
| `submission.cold-launch-hostile-conditions` | cold-launch-hostile-conditions | - |
| `submission.competitor-sightings-not-evidence` | REJECTIONS 2026-08-12 lesson | - |
| `submission.compiled-secrets-low-blast` | compiled-secrets-low-blast-documented | - |
| `submission.entitlements-verified-on-uploaded-binary` | REJECTIONS 2026-08-04 lesson; SHIPPING Phase 6 | - |
| `submission.export-compliance-answered` | export-compliance-answered | - |
| `submission.export-compliance-key-set` | export-compliance-key-set | - |
| `submission.feedback-recorder-absent-from-release` | feedback-env-vars-testflight-only; feedback-recorder-absent-from-release | - |
| `submission.icon-1024-no-alpha` | icon-1024-no-alpha | - |
| `submission.identity-golden-matches` | identity-golden-matches | - |
| `submission.intended-build-attached` | intended-build-attached; SHIPPING Phase 5 | - |
| `submission.launch-day-site-flip-prepared` | launch-day-site-flip-prepared | - |
| `submission.legal-urls-return-200` | legal-urls-return-200 | - |
| `submission.listed-sdks-have-signed-manifests` | listed-sdks-have-signed-manifests | - |
| `submission.live-shield-fixture-decodes` | live-shield-fixture-decodes | - |
| `submission.marketing-icon-matches-composer` | marketing-icon-full-bleed-matches-composer | - |
| `submission.no-debug-surface-in-release` | no-debug-surface-in-release | - |
| `submission.no-receipt-name-only-gate` | no-receipt-name-only-gate; REJECTIONS trap 2.13 | - |
| `submission.no-staging-endpoint-in-release` | no-staging-endpoint-in-release | - |
| `submission.no-stale-product-names-on-site` | no-stale-product-names-on-site | - |
| `submission.no-third-party-brand-icons` | REJECTIONS 2026-08-04 fix note | Recorded as part of a fix, with no guard; candidate. |
| `submission.no-unused-entitlement` | no-unused-entitlement | - |
| `submission.no-unused-special-capability-on-identifiers` | no-unused-special-capability-on-identifiers | - |
| `submission.paid-path-not-gated-on-permission` | paid-path-not-gated-on-permission | - |
| `submission.policy-names-every-outbound-host` | policy-names-every-outbound-host | - |
| `submission.privacy-labels-complete-and-true` | privacy-labels-complete-and-true; SHIPPING Phase 5 owner click | conflicts: privacy-label-table |
| `submission.privacy-manifest` | privacy-manifest-per-target | - |
| `submission.privacy-tracking-flags-consistent` | privacy-tracking-flags-consistent | - |
| `submission.privacy-url-every-localization` | privacy-url-every-localization | - |
| `submission.real-device-smoke-on-exact-build` | real-device-smoke-on-exact-build | - |
| `submission.recording-capability-disclosed` | recording-capability-disclosed | - |
| `submission.rejections-ledger-cross-checked` | SHIPPING Phase 0 and Phase 4 | - |
| `submission.release-type-manual-for-launch` | release-type-manual-for-launch | conflicts: release-type |
| `submission.review-info-filled` | review-info-filled | - |
| `submission.review-notes-match-build` | review-notes-explain-entitlement-and-match-build | - |
| `submission.screen-time-linkage-matches-entitlement` | REJECTIONS 2026-08-04 (2.5.1), status fixed with guard test | - |
| `submission.shield-not-hide` | shield-not-hide | - |
| `submission.site-copy-matches-listing` | site-copy-matches-listing | - |
| `submission.support-mailbox-receives-mail` | support-mailbox-receives-mail; REJECTIONS trap (dead mailboxes) | - |
| `submission.terms-page-real-subscription-terms` | terms-page-has-real-subscription-terms | - |
| `submission.tracking-answers-match-att-and-manifest` | tracking-answer-matches-att; privacy-answers-and-notes-match-manifest | conflicts: tracking-and-att |
| `submission.usage-strings-specific-and-used` | usage-strings-specific-and-used | - |

## 5. Merges of more than one inventory slug

| Requirement | Slugs merged | Reason |
|---|---|---|
| `submission.feedback-recorder-absent-from-release` | `feedback-env-vars-testflight-only`, `feedback-recorder-absent-from-release` | Same outcome. One is the workflow config, the other is the check on the build. |
| `submission.tracking-answers-match-att-and-manifest` | `tracking-answer-matches-att`, `privacy-answers-and-notes-match-manifest` | Both say: ASC answers, notes, manifest and ATT behaviour agree. |
| `monetization.paywall-legal-links-resolve` | `terms-link-resolves`, `privacy-link-resolves` | Same surface, same verify command. |
| `release.build-in-beta-testing-before-delivery-report` | `release-build-attached-to-beta-group`, `delivery-requires-valid-and-in-beta` | Same API readback. |
| `post-launch.growth-tricks-recorded` | `growth-tricks-flipped-and-recorded`, `offer-docs-status-updated` | Both are status-row edits after a growth trick changes. |

Kept apart on purpose: `setup.domain-dns-mx-live` and `submission.support-mailbox-receives-mail` (DNS setup against a received test message); `submission.legal-urls-return-200` and `monetization.paywall-legal-links-resolve` (site against paywall); `aso.first-three-screenshots-ordered-for-search` and `aso.screenshots-are-an-ad-sequence` (Apple search layout against the wiki candidate G-15); P-05, G-10 and P-16 (wiki tension 4 forbids the merge).

## 6. Conflicts

34 records: 25 from the apps-repo inventory, 8 wiki tensions, 1 new.

- All 25 inventory conflicts are recorded. 22 are `open`. 3 are `resolved` because a source retracts itself or the inventory checked the fact: `lifetime-product` (setup kit banner), `privacy-label-table` (setup kit banner), `metrics-file-existence` (file exists, later commit date).
- Wiki tensions 1 to 8 are recorded. Tension 1 (`wiki-p02-vs-p06`) is `resolved`: P-02 reconciles it in its own text. Tension 9 (terminology: the wiki says `decided`, not "accepted") is not a conflict between rules. It is handled by using the word `decided` everywhere.
- New: `abandonment-placement-vs-offer-burst`. Wiki P-09 and P-04 (decided) ask for a transaction-abandonment placement. The rejection ledger fix plan for Guideline 5.6 (2026-08-13, status open) deletes that placement.
- Extra sides added to inventory conflicts: SHIPPING (hard rule 1 and Phase 2) is a side of `release-start-mode-and-testflight-path` and `who-may-cut-release`; SHIPPING Phase 5 is a side of `subscription-count`; REJECTIONS 2026-08-13 and wiki P-15 are sides of `free-rescue-pass`; REJECTIONS 2026-08-13 is a side of `offer-code-surface`.
- Each conflict links only the 1 to 5 requirements that it changes. A conflict about one app's facts (for example the subscription count) does not make every subscription rule a candidate.

## 7. Not seeded, with reason

| Item | Reason |
|---|---|
| Wiki G-06 as a check | The wiki counts it per video. It has no per-app state. Seeded as a guideline. |
| Wiki P-05, P-07, P-08, P-12, G-04, G-05, G-07 to G-11, A-01 as checks | The wiki marks them general knowledge or agent policy. Seeded as guidelines. |
| Idea Roast K1-K13 and S1-S5 as 18 records | The roast is one recorded verdict per idea. Seeded as one check, `idea.roast-recorded`; K1 and K13 are also cited by two other records. |
| `SOTA.md` verdict lines | They are verdicts with their own status vocabulary (`[sota]`, `[directional]`, `[retired]`), not per-app checks. The ledger stays markdown. |
| Vendored pack checklists (vibe-aso phase 6, aso-skills) | Third-party text. The packs are `sources` and are cited where they support a rule. No rule is seeded from them alone. `vibe-aso` notes say our playbook wins where they disagree. |
| ua-skills content | Linked-only. Only our own notes are a source. |
| Meta SDK pre-ship list (five actions, 2026-09-10) | App-specific work for one branch. Covered by `submission.tracking-answers-match-att-and-manifest`, `submission.att-states-device-verified`, `submission.review-notes-match-build`. |
| Lock In Chinese "Operational notes" (stale build number, hardcoded IPA name) | The doc says neither affects review. They are repo notes, not checks. |
| Rejection 2026-08-12 "twin machinery kept deliberately" | A design decision for one app, not a rule. |
| Verdict cards | Per-idea state, private. One directory-level source exists only so the status-drift conflict can cite it. |

## 8. Judgement calls for review

1. Wiki A-02, A-03, A-04 and the first half of A-05 are merged into the check `release.human-go-for-price-product-flow-changes`. The wiki calls them agent policy. The apps-repo inventory has a trackable owner gate with the same content. A-01 stays a guideline.
2. `analytics.experiment-ledger-file` is seeded as `every_release`. The sources say "per experiment". The contract has no per-experiment cadence.
3. `release.testflight-first` and `release.owner-says-tag-it` are `candidate` because open conflicts touch them, although SHIPPING calls them hard rules. `release.owner-go-before-submit` has no conflict and is `decided`.
4. Three inventory conflicts are recorded as `resolved` (section 6). Change them to `open` if the owner wants a formal decision.
5. `monetization.earned-discount-not-random` exists only to carry inventory conflict 24. Its `what` states the conflict and chooses no side.
6. Four tags are carried by no app yet: `app-preview`, `att`, `external-testflight`, `in-app-event`. Rules with these tags are excluded for every app until an app gets the tag.
