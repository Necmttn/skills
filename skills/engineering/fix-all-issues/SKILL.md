---
name: fix-all-issues
description: Fix every identified issue in the current working state to production-ready quality, without committing. Only invoke when explicitly requested via /fix-all-issues.
---

# Fix all issues (no commit)

Fix every identified issue in the current working state to production-ready
quality, without committing.

**Core principle:** every fix must be correct, complete, idiomatic, and
production-ready. No shortcuts.

## Process

1. **Identify all issues.** Run linters, type checks, tests, and review changed
   files. Examine compiler warnings, lints, test failures, and any other
   diagnostics the project exposes.

2. **Fix every issue.** For each one:
   - Implement the correct, idiomatic solution - not a workaround.
   - Never leave behind a `TODO`, `FIXME`, `HACK`, `XXX`, or placeholder comment.
   - Never suppress a warning or lint without fixing the underlying cause.
   - Never add a quick patch that papers over the real problem.
   - If fixing one issue reveals another, fix that too.

3. **Verify fixes.** Re-run all diagnostics to confirm every issue is resolved
   and no new issues were introduced.

4. **Do NOT commit.** Leave all changes unstaged/uncommitted.

5. **Review.** Run the review checklist in `wrap-up` (step 1) against the result:
   complete, edge cases, correct, consistent, production ready, goals met.

## Standards

- **Correct:** fixes address root causes, not symptoms.
- **Complete:** every identified issue is resolved. Zero remaining.
- **Idiomatic:** code follows the project's conventions, language idioms, and
  established patterns.
- **Production-ready:** the result could ship as-is. No rough edges.

## Red flags - stop and redo

- You wrote a `TODO` or `FIXME` - go back and finish it.
- You suppressed a lint or warning - fix the cause instead.
- You added a workaround comment - find the real fix.
- You skipped an issue because it seemed minor - fix it anyway.
- You committed changes - undo the commit, keep the changes.
