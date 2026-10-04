---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Before assigning repository research, read [Durable task delivery](../../../../engineering/herdr-agent-orchestration/references/durable-delivery.md).
Give the research worker an isolated task checkout and an existing draft PR.
Its result includes the pushed notes, verified remote SHA, PR URL, and committed recovery record.
Preserve options and unresolved decisions before waiting for the owner.

Its job:

1. Investigate the question against **primary sources** — official docs, source code, specs, first-party APIs — not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.
