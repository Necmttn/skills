# Required tandem review

Owner instruction, 2026-10-28: every task gets an independent cross-engine review before completion. Prefer Argon when available and independent of the builder. Otherwise use a frontier Codex/Astra or Claude Opus/Fable reviewer from a different engine. This replaces the optional-Argon selection rule from 2026-10-20; the consensus requirement remains.

Apply this to single-agent work and fleet work: code, plans, specs, reports, and user-facing copy.

## Pick the reviewer

The reviewer runs on a different engine from the builder.

| Builder | Reviewer order |
|---|---|
| Claude, including Opus/Fable | Argon first; frontier Codex/Astra if unavailable |
| Codex, including Astra | Argon first; Claude Opus/Fable if unavailable |
| Gemini, including Argon | Frontier Codex/Astra or Claude Opus/Fable; Argon is not independent |

The reviewer engine must have written none of the artifact. Another session of the builder engine never qualifies. If no engine qualifies, ask the owner for an exception.

Pin the reviewer model explicitly and verify its identity on the target runtime. Record the exact resolved model ID in the review receipt; use an alias only when its resolution is verified. A CLI name alone does not establish model quality. Use only Argon for the Gemini reviewer seat. Gemini Flash, Lite, Haiku, Spark, mini models, and other lightweight models do not satisfy any required review, including documentation and final reports. An implementation worker's cost ceiling does not reduce this review standard.

Check availability on the target runtime. Quota exhaustion, model-not-found, authentication failure, or an outage permits the next eligible frontier reviewer. Record the attempted model and the actual error; do not assume that a listed model has working quota. A same-engine builder makes Argon ineligible without an availability probe. If all eligible reviewers are unavailable, report the block instead of downgrading. A fallback after a failed review receives the artifact, all findings, and their dispositions; changing models never discards findings.

## Launch: a live Herdr pane first

Owner instruction, 2026-10-31: run reviewers and delegated workers in Herdr panes, not as headless CLI calls. A pane is visible to the owner, keeps its context across consensus rounds, accepts follow-up prompts, and comes back after a Herdr restart in bypass mode. Use a headless call only outside Herdr, or when a pane cannot start; record the error.

Inside Herdr (`HERDR_ENV=1`):

1. Write the brief to a file. Put the task, constraints, artifact paths or diff, base and head commits, check results, and the output contract in it. Do not paste a long brief into the pane; long single-line sends break Codex panes. Location: `<worktree>/reviews/` in a task worktree, or `<repo>/.claude/reviews/` on a `main` checkout (the worktree-write guard blocks Claude and Codex writes elsewhere on `main`). Never `/tmp`.
2. Make a sibling pane. Run `herdr pane layout --pane "$HERDR_PANE_ID"`, then `herdr pane split --current --direction right --cwd "$PWD" --no-focus` for a wide pane, or `--direction down` for a narrow or tall pane. Read `.result.pane.pane_id`.
3. Start the reviewer with its model pinned. The name must match `[a-z][a-z0-9_-]{0,31}` and be unique in `herdr agent list`, for example `review-<short-task>`.
   - Argon: `herdr agent start review-<task> --kind agy --pane <pane-id> -- --model gemini-4-argon-high --dangerously-skip-permissions`. Do not add `--mode plan`: it turns the request into a plan-approval workflow. See [Argon launch details](argon-review.md).
   - Claude: `herdr agent start review-<task> --kind claude --pane <pane-id> -- --model opus --dangerously-skip-permissions`. Fable is eligible when its exact model or alias is verified on this runtime.
   - Codex: `herdr agent start review-<task> --kind codex --pane <pane-id> -- --yolo --model gpt-6-astra -c model_reasoning_effort=medium`.
   The pane can read the repository, so the brief can name files instead of pasting them. The brief must say "review only, do not edit files".
   If `agent start` returns `agent_not_ready`, read the pane with `herdr agent read`. Folder-trust and hook-review dialogs appear on first use; accept them only for the owner's own folders and hooks, and ask the owner otherwise. If the start fails, close the pane you made (`herdr pane close <pane-id>`) before a fallback.
4. Send a short pointer and wait: `herdr agent prompt review-<task> "Read <brief-path> and follow it. Write your review to <review-path>, then reply DONE." --wait --timeout 1800000`. Reviews often take 10 to 20 minutes.
5. Read `<review-path>`. If it is missing, read the pane with `herdr agent read review-<task> --source recent-unwrapped --lines 200`. A timeout does not prove failure; check `herdr agent get` before you prompt again.
6. Answer each finding in a reply file and send the next round to the same pane with `herdr agent prompt`. The reviewer keeps its earlier context, so it can confirm or dispute your dispositions directly.
7. After consensus, keep the review files in the task record. Close only the pane you created, unless the owner wants to keep the conversation.

After a Herdr restart a pane resumes in bypass mode with its conversation, but without its other launch flags (`--model`, `-c`). Check the model before the next round.

Delegated implementation work uses the same live-pane pattern: one named pane per worker, a brief file, short prompts, and steering through the pane. Each writing worker gets its own worktree (`--cwd <repo>/.claude/worktrees/<task>`); never put two writers in one working tree. The owner and other agents can see and join the work.

Headless fallback (outside Herdr, or a pane cannot start):

- Argon: `agy --model gemini-4-argon-high --disable-slash-commands --print '<brief>'`. Check `agy models` on the target machine.
- Claude: `claude --model opus -p '<brief>'`.
- Codex: `codex exec --model gpt-6-astra -c model_reasoning_effort='medium' --skip-git-repo-check --sandbox read-only '<brief>' </dev/null` (the skip flag is needed outside a trusted git repo).

Headless reviewers may not be able to read files. Put the complete artifact or diff in the brief.

## Consensus loop

1. Finish the artifact and its checks. Give the reviewer the task, constraints, artifact or diff, and check results.
2. Request review only. Require findings with severity (blocker, major, minor, nit), location, reason, and a concrete correction, plus a one-line verdict: PASS or FAIL. For copy, check clarity, tone, audience, factual claims, and consistency. For code, also check correctness, regressions, and missing verification.
3. The builder answers each finding: fix it, or reject it with a reason.
4. A round is one reviewer response. After any FAIL, send the revision and every rejection back to the same reviewer for a new verdict. After a PASS, re-review only when later fixes change the artifact materially.
5. Consensus means the latest verdict is PASS and every finding has a disposition the reviewer did not dispute.
6. After two rounds without consensus, give the disputed findings, both positions, and the artifact to the third engine. Its ruling on each disputed finding is binding unless the owner overrides it. If the third engine is unavailable, escalate to the owner. Do not mark the task complete while a dispute is open.

Preserve each review response, the reviewed revision, and every finding's disposition in the task record or fleet ledger.

## Limits

- Tandem review does not replace repository gates, tests, or other technical reviews the task requires.
- If no eligible frontier reviewer is available, report the review as blocked with the errors. Do not substitute a lightweight model, self-review, or claim completion. Only an explicit new owner instruction can change this requirement.
- Review-only requests do not need a review of the review.
- Fleet-ship's TANDEM steward is a different thing: it monitors fleet progress. It does not satisfy this review unless it also runs a qualifying cross-engine review of the artifact.
