# skills

A personal collection of agent skills, authored following the
[mattpocock/skills](https://github.com/mattpocock/skills) `writing-great-skills`
conventions. Skills live under `skills/<bucket>/<name>/SKILL.md`.

Clone and symlink into your agent skills directory (e.g. `~/.agents/skills`) to use them.

## Skills

- **[herdr-agent-orchestration](skills/engineering/herdr-agent-orchestration/SKILL.md)** - drive and orchestrate the AI agents running inside herdr: read pane state, send input, start new agents, and migrate in-flight work across machines via a handoff.
- **[migrate-to-workbox](skills/engineering/migrate-to-workbox/SKILL.md)** - offload a running local herdr session to the workbox: relocate an idle agent's in-flight work to the remote box via a handoff so it continues on fast hardware.
- **[ux-psychology](skills/engineering/ux-psychology/SKILL.md)** - twelve cognitive-bias rules (smart defaults, goal gradient, reciprocity, IKEA effect, loss aversion, contrast anchoring, effort justification, identity labeling, ego-driven sharing, Zeigarnik chunking, active learning, familiarity) for designing or critiquing conversion, onboarding, retention, and viral-loop UI.
- **[wrap-up](skills/engineering/wrap-up/SKILL.md)** - close down a work session or agent pane: land or file everything of value (follow-up tickets), queue human checks on a `uat` checklist issue, safe-only housekeeping, then report closed/filed/kept.

This repo also carries the upstream [mattpocock/skills](https://github.com/mattpocock/skills) collection (merged history) - see the skills under `skills/engineering/`, `skills/productivity/`, and `skills/misc/`.

## Related

- **[backpine/remote-agent-workspace](https://github.com/backpine/remote-agent-workspace)** - the infrastructure blueprint for the always-on remote box these skills drive: Herdr remote + Syncthing + Cloudflare Tunnel + Caddy. Stand the box up with that; orchestrate the agents on it with the skills above.
