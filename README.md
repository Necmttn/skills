# skills

A personal collection of agent skills, authored following the
[mattpocock/skills](https://github.com/mattpocock/skills) `writing-great-skills`
conventions. Skills live under `skills/<bucket>/<name>/SKILL.md`.

Clone and symlink into your agent skills directory (e.g. `~/.agents/skills`) to use them.

## Skills

- **[herdr-agent-orchestration](skills/engineering/herdr-agent-orchestration/SKILL.md)** — drive and orchestrate the AI agents running inside herdr: read pane state, send input, start new agents, and migrate in-flight work across machines via a handoff.
- **[migrate-to-workbox](skills/engineering/migrate-to-workbox/SKILL.md)** — offload a running local herdr session to the workbox: relocate an idle agent's in-flight work to the remote box via a handoff so it continues on fast hardware.
