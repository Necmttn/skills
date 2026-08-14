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

## Workspace placement (before any `agent start`)

Every pane lives in a workspace, and workspaces belong to projects. Starting a pane without `--workspace` drops it into whatever workspace is focused - usually the WRONG one.

1. Run `herdr agent list` and read each agent's `workspace_id` + `cwd`.
2. Pick the workspace whose agents' `cwd` matches the project you are starting the pane for (the repo root, or a worktree under it).
3. Create the pane there explicitly, then start the agent in it (0.8.0: `agent start` takes an EXISTING
   pane, not --cwd/--workspace): `herdr tab create --workspace <ID> --cwd <path> --label <text>` (use its
   `result.root_pane`) or `herdr pane split <pane-in-that-workspace> --cwd <path> --no-focus`, then
   `herdr agent start <name> --kind <claude|codex|grok|pi|…> --pane <pane_id> -- <agent flags>`.
4. No matching workspace (new project, or an agent that needs isolation per the handoff flow)? Start one with a fresh label instead of squatting in an unrelated project's workspace.

When a tab is involved, two more rules:
- **Reuse before create:** `herdr tab list --workspace <ws>` first - if a tab with your label already exists, spawn into it (`--tab <id>`). Blind `tab create` breeds duplicate tabs.
- **Kill the root shell:** `tab create` always ships an empty root SHELL pane (its `pane_id` is in the create response as `result.root_pane`). After you spawn your agent pane into the tab, `herdr pane close <root_pane_id>` - otherwise every tab you create carries a dead empty pane the human has to look at. Verify with `herdr pane list --workspace <ws>`: no `shell` panes left in tabs you manage.

**Done when: the started pane's `workspace_id` in the start response matches the project you intended.** If it doesn't, `herdr pane close <pane>` and restart with the right `--workspace` - panes are cheap, misfiled sessions are not.

## Drive an agent

`herdr agent list` enumerates every agent with its `pane_id` and `agent_status`. `herdr agent read <target>` prints its terminal as plain TEXT (0.8.0; no JSON extraction). `herdr agent prompt <target> "<text>"` types AND submits in one call; add `--wait [--until <status>] [--timeout <ms>]` to block until the turn settles. For literal text WITHOUT submit use `herdr pane send-text <pane_id> "<text>"`.

Never drive a `working` agent - you interrupt its turn. Wait first: `herdr agent wait <target>` (no flag matches `idle|done|blocked`; `--until <status>` narrows it, `done` is first-class).

Before every `prompt`, confirm the prompt line is EMPTY: dismiss rating and approval overlays, and clear any unsent text the user left typed (`agent send-keys <target> Ctrl+U`) - typed text appends, so stray text corrupts your command (verified live 2026-07-17). **Done when: a fresh `read` of the target shows idle with an empty prompt.**

Backchannel primitives (probed 2026-08-15): every pane's env carries `HERDR_ENV=1`, `HERDR_PANE_ID`, `HERDR_SOCKET_PATH`, so a pane can always signal about itself (`herdr notification show "<title>" --sound request`, `herdr pane report-agent "$HERDR_PANE_ID" …` for shell panes). `herdr pane wait-output <pane_id> (--match TEXT|--regex PAT)` fires on matching output - but Claude Code ≥2.1.x collapses tool output, so screen sentinels do NOT work for claude panes; wake on `agent wait` status transitions instead. `herdr agent get <target>` exposes `.result.agent.tokens` (context fill + rate-limit window) - read it instead of scraping status footers. Install `herdr integration install claude codex grok pi` once per machine+user so panes report their real session identity.

## Remote is the same socket

A herdr server on another machine is driven by prefixing the same commands with ssh: `ssh user@host 'herdr agent prompt <target> …'`. The server persists, so agents you start keep running after everyone detaches. The human attaches to watch with `herdr --remote user@host --session <name>`; that changes nothing about how you drive it.

## Migrate in-flight work (handoff)

Move an agent's work to a fresh agent - a faster machine, a clean context, or a different model - without losing state. The **handoff** is the carrier: a committed document plus a GitHub issue, machine-independent so the successor can pick it up anywhere.

1. **Confirm the source is idle.** A working agent has no stable state to hand off; wait or pick another.
2. **Make the source write the handoff.** Send it: push its branch, write a handoff document at the repo root, open a GitHub issue whose body is that document, and reply with the issue URL. The document names the branch, the checkpoint commit, and the remaining work. **Done when: the issue URL is posted and the branch is pushed.**
3. **Isolate the target checkout.** On the target, check out the handoff's branch. If another agent already occupies that repo, give this one its own `git worktree` - never two agents in one working tree.
4. **Start the successor.** Create a pane cwd'd at the checkout in its **own labeled workspace** (one agent per workspace keeps sessions reviewable), then `herdr agent start <name> --kind <kind> --pane <pane_id> -- <agent flags>`. For an unattended run add the agent's bypass flag (codex: `--dangerously-bypass-approvals-and-sandbox`); clear the startup trust and hook prompts once it boots.
5. **Hand it the goal.** Give the successor the handoff issue as a *tracked goal*, not a one-shot prompt - e.g. `/goal <objective referencing the issue and branch>`. **Done when: a `read` shows the successor pursuing the goal.**

## Gotchas

- `agent prompt` submits; `pane send-text` is literal text without submit. Numbered menus take `agent send-keys <target> Down/Up/Enter/Escape` (use `esc` for Escape).
- Agent CLIs reauth per machine: copy token files where allowed, otherwise log in on the target. The handoff issue stays readable regardless.
- `agent read`/`pane read` print plain text (0.8.0); older skills' `.result.read.text` extraction is obsolete.
- `agent start` inherits placement from the PANE you pass it - creating that pane in the wrong workspace misfiles the session. Always resolve the workspace first (see Workspace placement).
- `agent prompt --wait` on a non-working target returns `agent_prompt_stalled` if no state change appears within 5s - treat it as "the text may not have submitted", read the pane before retrying.
