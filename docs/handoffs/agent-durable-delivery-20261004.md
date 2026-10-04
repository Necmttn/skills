# Durable delivery instruction change

Goal: preserve saved repository work in remote branches and draft PRs, including research and exploration.
Owner: repository owner. Approval and merge remain pending.
Branch: docs/agent-durable-delivery-20261004.
PR: https://github.com/Necmttn/skills/pull/103.
Checkpoint being handed over: 83d1a66.
The final publication SHA is the current remote branch and PR head.

Artifacts: the shared contract at skills/engineering/herdr-agent-orchestration/references/durable-delivery.md and its callers in fleet-ship, herdr-agent-orchestration, wrap-up, and research.
Checks: repository bootstrap, skill frontmatter validation, all five new contract links, and git diff --check.
The original fleet description fails the frontmatter validator because it contains angle brackets. This update narrows that description to its task trigger.
No executable code changes. No runtime enforcement or external service is installed.
Existing local skill overrides and loaded pane contexts do not change with this PR.

Next action: review PR 103, then reconcile approved instructions with active local skill copies.
Remaining implementation: enforce remote receipts in completion and closure, validate supervisor parent identity, and provide recovery outside the Herdr server.
