---
name: herdr-agent-orchestration
description: Drive and orchestrate the AI agents running inside herdr - read their state, send input, start new ones, and migrate in-flight work to another machine through a handoff. Use when the user wants to control a herdr agent or pane, broadcast to running agents, run agents on a remote box, move or hand off work between agents, or mentions herdr orchestration.
---

# Orchestrating herdr agents

herdr runs each agent in a pane backed by a persistent server, controlled through a **socket** API. You **drive** an agent by reading its pane and sending it input - and the socket is the same control plane whether the server is local or on a remote box, so one skill covers both.

Two branches:
- **Drive** agents already running - sweep status, send a command, broadcast.
- **Migrate** an agent's in-flight work to a fresh agent (often on another machine) through a **handoff**.

Full command syntax lives in [herdr-cli.md](herdr-cli.md); read it before your first `send`.

## Drive an agent

`herdr agent list` enumerates every agent with its `pane_id` and `agent_status`. `herdr agent read <pane>` shows what it is doing; `herdr agent send <pane> "<text>"` types into its prompt - **literal text, no submit**. Submit separately with `herdr pane send-keys <pane> Enter`.

Never drive a `working` agent - you interrupt its turn. Wait for idle (`herdr agent wait <pane> --status idle`).

Before every `send`, clear the prompt line: dismiss rating and approval overlays, and delete any unsent text the user left typed - `send` appends, so stray text corrupts your command. **Done when: a fresh `read` of the target shows idle with an empty prompt.**

## Remote is the same socket

A herdr server on another machine is driven by prefixing the same commands with ssh: `ssh user@host 'herdr agent send <pane> …'`. The server persists, so agents you start keep running after everyone detaches. The human attaches to watch with `herdr --remote user@host --session <name>`; that changes nothing about how you drive it.

## Migrate in-flight work (handoff)

Move an agent's work to a fresh agent - a faster machine, a clean context, or a different model - without losing state. The **handoff** is the carrier: a committed document plus a GitHub issue, machine-independent so the successor can pick it up anywhere.

1. **Confirm the source is idle.** A working agent has no stable state to hand off; wait or pick another.
2. **Make the source write the handoff.** Send it: push its branch, write a handoff document at the repo root, open a GitHub issue whose body is that document, and reply with the issue URL. The document names the branch, the checkpoint commit, and the remaining work. **Done when: the issue URL is posted and the branch is pushed.**
3. **Isolate the target checkout.** On the target, check out the handoff's branch. If another agent already occupies that repo, give this one its own `git worktree` - never two agents in one working tree.
4. **Start the successor.** `herdr agent start <name> --cwd <repo> -- <agent-cli>`. For an unattended run add the agent's bypass flag (codex: `--dangerously-bypass-approvals-and-sandbox`); clear the startup trust and hook prompts once it boots. Start it in its **own labeled workspace** (`--workspace`) - one agent per workspace keeps sessions reviewable.
5. **Hand it the goal.** Give the successor the handoff issue as a *tracked goal*, not a one-shot prompt - e.g. `/goal <objective referencing the issue and branch>`. **Done when: a `read` shows the successor pursuing the goal.**

## Gotchas

- `agent send` is literal text; submission is a separate `pane send-keys <pane> Enter`. Numbered menus take `send-keys Down/Up/Enter/Escape`.
- Agent CLIs reauth per machine: copy token files where allowed, otherwise log in on the target. The handoff issue stays readable regardless.
- `read` returns JSON - extract `.result.read.text` to see the pane.
