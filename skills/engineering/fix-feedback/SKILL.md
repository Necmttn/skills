---
name: fix-feedback
description: Burn down the shaketoship feedback backlog - GitHub issues auto-filed from shake-to-record device feedback (title `[feedback][<app>][<screen>]`). Fixes ONE issue per invocation (select -> claim -> debug -> fix in a worktree -> test -> PR "Fixes #N" -> label for review), so it composes cleanly with `/loop /fix-feedback`. Triggers when the user wants to fix feedback issues, run a feedback-fix loop, clear the feedback queue, or passes this skill to /loop. NOT for arbitrary GitHub issues - only the `feedback`-labelled, Gemini-authored ones.
---

You process the feedback backlog **one issue per invocation** so `/loop /fix-feedback`
advances the queue one wake at a time. Do exactly one issue, then stop and report
(the loop re-invokes you for the next). Never batch multiple issues in one turn.

## What these issues are

GitHub issues in `noktadev/apps` labelled `feedback`, auto-filed by the shaketoship
platform: a user shook-to-record on a device, Gemini analysed the video, and wrote a
structured issue. Body carries `Severity:`, `Quote:` (the user's words), `Screen:`, and a
footer anchor `<!-- shaketoship project=... -->`. Most are `[feedback][lockin-chinese][...]`
iOS bugs in `apps/lockin-chinese/ios` (LockInKit) or `packages/swift/AppFeedback`.

## Defaults (override if the user said otherwise this session)

- **Repo:** `noktadev/apps`. **App focus:** `lockin-chinese` (skip other apps' feedback
  unless told).
- **Merge policy:** open a PR for HUMAN review - do NOT auto-merge. These are user-facing
  iOS bugs; a device check is required and the loop can't do it. (If the user explicitly
  asked for auto-merge-on-green this session, merge when the Swift tests pass and note it.)
- **Labels (create if missing):** `wip:fixing` (claimed), `pr-open` (fix PR up),
  `needs-human` (not loop-fixable).

## The one-issue loop

1. **SELECT.** `gh issue list --repo noktadev/apps --label feedback --state open --json
   number,title,labels,body`. Filter to actionable `[feedback][lockin-chinese][...]` bugs
   that do NOT already carry `wip:fixing`, `pr-open`, or `needs-human`. Prioritise by the
   body's `Severity` (crash/bug before minor). Re-derive fresh from `gh` every time - never
   trust memory of the queue across invocations. **If none remain: STOP - tell the user the
   feedback backlog is clear, and if in a loop, end the loop.**
2. **TRIAGE non-fixes.** If the selected issue is not a code fix - a copy/marketing issue, a
   research task, a cross-app request, or something needing a product/design decision -
   comment one line saying why, add `needs-human`, and STOP (don't consume a fix cycle on it).
3. **CLAIM.** `gh issue edit <n> --repo noktadev/apps --add-label wip:fixing`. Read the full
   body: Severity, Quote, Screen.
4. **INVESTIGATE** with `superpowers:systematic-debugging`. Locate the responsible Swift code
   from the Screen + Quote. For a **crash**, get the real stack from Sentry (lockin iOS
   project `4511703095312464`, Nokta org, EU) if the Sentry MCP is authed; if not, say so and
   reason from the code + the quote (and note in the PR that a Sentry stack would confirm it).
5. **FIX** in an isolated worktree (`superpowers:using-git-worktrees`): branch
   `fix/feedback-<n>` off `origin/main`. Where the bug has a unit-testable seam, write the
   failing test FIRST (`superpowers:test-driven-development`) then fix. Pure-visual bugs
   often have no test seam - fix and say so explicitly in the PR rather than faking a test.
6. **VERIFY (real output, not assumptions).** Run `swift test` on the touched package (the
   `swift-test` pre-commit hook also runs on commit); `bun run typecheck` if any TS changed.
   Capture the actual pass/fail. iOS visual/behaviour changes the loop cannot fully verify -
   that's expected; the PR carries the device-check ask.
7. **COMMIT + PR.** One conventional commit; push; open a PR whose body has: `Fixes #<n>`, a
   short what-changed, how-verified (with the real test output), and a
   `Device verification needed:` line naming exactly what a human should check on-device
   (tie it to the issue's Quote/Screen). Do NOT auto-merge unless the user opted into it.
8. **TRACK + hand off.** Comment the PR link on the issue; swap the label `wip:fixing` ->
   `pr-open`. Tear down the worktree (remove it + delete the local branch; the PR holds the
   work). STOP - report the issue #, the PR #, and what you did in 2-3 lines.
9. **If you cannot confidently fix it** (needs an on-device repro, a design/product call, or
   a Sentry stack you couldn't get): comment your findings + the exact blocker, add
   `needs-human`, remove `wip:fixing`, STOP. Never touch the same issue on a later
   invocation - the labels are what stop you re-picking it.

## Guardrails

- **One issue per invocation. Always re-read the queue from `gh` first** - concurrent loops
  or a prior wake may have claimed things.
- **Never auto-close a feedback issue** - closing is the human's call after they verify on
  device and merge. You only open the PR + label.
- **Never delete or force-push branches you didn't create**, and never commit to the primary
  `apps` checkout - all fix work happens in the `fix/feedback-<n>` worktree.
- **Don't invent a fix for a vague issue.** If the Quote/Screen don't localise to real code
  with reasonable confidence, that's a `needs-human`, not a guess.
