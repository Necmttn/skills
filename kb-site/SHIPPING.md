# Ship SOP

The standard operating procedure for "ship an app". This file is the orchestration layer: it orders the phases and says which document owns each one. Rules live in the owning playbooks; per-app state lives in the app's own files. Proven on Lock In Chinese; other apps copy the pattern with their own prefix/workflow.

**Hard rules (owner gates):**

- TestFlight first. The UAT loop (fix → tag → TF → user tests → repeat) is autonomous. The App Store submission step happens only after the user confirms the TF build and explicitly says go.
- Never tag or submit autonomously. Release tags fire on explicit "tag it"; the Submit click is owner-only.
- A rejected build number is never resubmitted. A rejection needs a NEW build.
- Every rejection gets a REJECTIONS.md entry AND a new playbook rule with a verify command.

## Phase 0 - Read first

- The app's `docs/LAUNCH_CHECKLIST.md` (launch-gated items; check off with date + evidence) and `docs/APP_STORE_SUBMISSION.md` (per-app gate state).
- `kb-site/REJECTIONS.md` - known banned patterns (skip-trial toggle, offer bursts after decline, exact-height viewports).
- The app's open `uat`-labeled issue - what the next build must prove on device.

## Phase 1 - Land the code

- Work in worktrees; land via PR; batch merges (fast-iteration policy).
- Gates: `bun run test:vitest` (repo) and the app's native gate (`just lang test` for Lock In Chinese). ITERATION tier (`test:changed` / `just lang test-affected`) is for the loop, never evidence a branch is green.

## Phase 2 - TestFlight build (autonomous during UAT)

Owner doc: `docs/playbooks/app-store-submission.md` §11 + Xcode Cloud gotchas.

- Release build = annotated tag `<app>/v<X.Y[.Z]>` via `just lang release X.Y [<sha>]` (args positional, never `SHA=`). The tag stamps `CFBundleShortVersionString` into all five target plists; repo plists stay frozen at 1.0.
- Tag trigger is NOT reliable. If no run appears: ASC UI → Xcode Cloud → Start Build → pick the tag ref (a manual start on a tag ref sets `CI_TAG` correctly). Prove a tag fired via `sourceBranchOrTag`, never via timestamps.
- Which build is submittable - read it, do not assume: release-tag runs carry the real marketingVersion + `APP_STORE_ELIGIBLE`; merge-to-main runs carry 1.0 + `INTERNAL_ONLY` and cannot attach. Check `GET /v1/builds/{id}?include=preReleaseVersion`.
- Release-workflow builds reach no tester by themselves: attach via `POST /v1/betaGroups/{g}/relationships/builds`, then confirm `buildBetaDetail.internalBuildState == IN_BETA_TESTING` (the betaGroups relationship read lies).
- `CANCELED` runs can still upload a build; verify the shipped build contains your work by commit ancestry, not run number.

## Phase 3 - Device UAT

- Extend the app's `uat` issue with concrete `- [ ]` steps + the PR links. TestFlight feedback is qualitative only - it is not a conversion readout.
- Loop autonomously: fix → tag → TF → user tests → repeat.

## Phase 4 - Pre-submission gate

Owner doc: `docs/playbooks/app-store-submission.md` (§1-§8; §9 is the copyable checklist).

- Copy §9 into the app's `docs/APP_STORE_SUBMISSION.md` and fill the evidence column. "Looks fine" is not evidence - every gate has a verify command.
- High-frequency catches: subscriptions `READY_TO_SUBMIT` in ALL territories (MISSING_METADATA = territory pricing + review screenshot); `dig +short MX <domain>` for the support address; review notes from the §7a template; screenshots carry no fabricated UI, no TestFlight status bar, no fake awards; surfaces gated off review builds have a second gate beyond receipt inference (sandboxReceipt trap).
- Cross-check the change against REJECTIONS.md before submitting.

## Phase 5 - Submission (OWNER-GATED)

- Wait for the explicit user go.
- Attach the eligible build to the ASC version record (version string must equal the record exactly - `1.0`, not `1.0.0`); include every subscription in the version's IAP submission set (winback included).
- Owner clicks: screenshots upload, App Privacy labels, age rating, Submit.

## Phase 6 - In review / on rejection

- The ASC API exposes no rejection text - read Resolution Center in the ASC web UI or the owner's Apple mailbox.
- On rejection: new entry in `kb-site/REJECTIONS.md` (Apple's words, root cause, fix, guard, lesson) + a new rule in the submission playbook. Entitlement claims are verified against the uploaded binary via `GET /v1/builds/{id}?include=buildBundles`.
- Fix in a new build; never resubmit the rejected build number.

## Phase 7 - Approval and launch

- Work through the app's `LAUNCH_CHECKLIST.md` gated items (for Lock In Chinese: mint `LOCKIN50` - 409s until the app is live AND the yearly sub is APPROVED; exact curl in `docs/OFFER_CODES.md`).
- Per-language site/collector promotion: `docs/playbooks/lockin-language-launch-readiness.md`.
- Verify the analytics collector end-to-end (`accepted:1` proves nothing - see analytics playbook).

## Phase 8 - First week after launch

- Monitor Sentry and the `uat` issue; first post-launch fixes ride the same TF loop.
- Growth-ops takes over: experiment ledger files, weekly readouts against METRICS.md names (see Growth & Analytics section).
