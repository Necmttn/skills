# Argon-first review

Owner instruction, 2026-10-28: prefer Argon for every required review when it is available and independent of the builder. If unavailable or ineligible, use a frontier Codex/Astra or Claude Opus/Fable reviewer under [tandem review](tandem-review.md). Lightweight models, including Gemini Flash, do not qualify.

## Identity and launch

- `aa` is the interactive shell alias for `agy --dangerously-skip-permissions` (Antigravity).
- Argon is a model within Antigravity, not a separate executable. Use `agy` directly in automation; shell aliases need not exist there.
- Check `agy models` on the target machine. The verified model is `gemini-4-argon-high`. Select it explicitly; do not inherit the CLI default.
- Inside Herdr, run Argon in a live pane. Follow the pane steps in [tandem review](tandem-review.md): brief file, sibling pane, then `herdr agent start review-<task> --kind agy --pane <pane-id> -- --model gemini-4-argon-high --dangerously-skip-permissions`, a short pointer prompt, and later rounds in the same pane. Do not add `--mode plan`: in `agy` it prepends `/plan` and asks for plan approval instead of a review. The brief keeps Argon advisory ("review only, do not edit files").
- Outside Herdr, or when a pane cannot start, run `agy --model gemini-4-argon-high --disable-slash-commands --print '<review brief>'` and record why. Set a bounded `--print-timeout` when needed. Headless mode cannot prompt for file-read permissions, so include the complete artifact or diff in the prompt; a permission denial is not a completed review.
- Do not inspect or control another Herdr session.

## Review contract

1. Finish the artifact and its applicable checks. Give Argon the task, constraints, exact files or diff, and check results. For git changes, name the base and head commits or provide the current diff.
2. Request review only. Require findings with severity, location, reason, and a concrete correction. For copy, check clarity, grammar, tone, audience, factual claims, consistency, and action labels. For code, also check correctness, regressions, and missing verification.
3. Preserve Argon's response and the reviewed revision in the task record or fleet ledger. Resolve each finding with a fix or a documented reason. Request another review when fixes materially change the reviewed artifact.
4. Keep independent technical reviews and repository gates required by the task. Argon review does not replace them. Argon cannot review Gemini-built work; another Argon session does not qualify.
5. Follow the selection and consensus rules in [tandem review](tandem-review.md). Mark review complete only at consensus there. The coordinator owns acceptance and merge.

If Argon is unavailable, record the actual failure and use an eligible frontier fallback from [tandem review](tandem-review.md). Preserve all open findings when handing off. Report blocked when no eligible frontier reviewer is available; do not downgrade to a lightweight model.

Review requests do not recursively require review of the review itself.
