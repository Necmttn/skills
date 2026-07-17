# Fleet run: improve-plans (2026-07-17)
Ledger: /tmp/fleet-improve-plans.ledger · signals fallback (board /events endpoint absent)

## 003-teardown (w1P:p1D, codex gpt-5.6 medium)
Merged 51325e4 (squash of c9a1436) · gate: PASS (orchestrator adversarial read + independent re-run of bash -n, dry-run parser test; executor ran shellcheck, live integration w/ scratch tab + --execute + idempotence, zero leftovers).
Report: implemented scripts/fleet-teardown.sh (285 ln) + SKILL/REFERENCE wiring per plans/003.
Concern (filed as follow-up issue): resolve_resource can abort via set -e when a pane RES id references an already-closed workspace from a PREVIOUS partial run (herdr pane list fails -> pipefail -> command-substitution assignment exits the script). Also noted: root-shell panes absent from agent list; script probes pane list by exact id (handled).

## 001-doc-fixes v1 (w1P:p1C, codex) - BLOCKED, correctly
Live send-semantics test (plan STOP condition): herdr agent send APPENDS (AAA then BBB -> AAABBB) on installed herdr - fleet-ship hard rule "REPLACES" (2026-07-10) is WRONG; herdr-agent-orchestration "appends" was right. All provisional edits reverted, no commit, scratch pane torn down. Full tail: archived at teardown. Respawned as v2 (w1P:p1N) with inverted scope: monitor fix + append-semantics rewrite + live-verified clear/submit recipe.
