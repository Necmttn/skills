---
name: migrate-to-workbox
description: Offload a running local herdr session to the workbox - relocate an idle agent's in-flight work to the remote box through a handoff so it continues on fast hardware. Use when the user wants to migrate, move, or offload local herdr agents/sessions to the workbox or remote box, dogfood the migration, or get work off the slow-network laptop.
---

# Migrate a local herdr session to the workbox

**Offload**: take an agent running locally and relocate its work to the **workbox** - the persistent remote herdr server on fast hardware - so the laptop's slow link stops gating it. The carrier is a **handoff**: a committed document plus a GitHub issue, machine-independent so any successor can resume from it.

This skill is the workbox-specific playbook. For the socket primitives (`agent list/read/send`, `pane send-keys`, `agent start`) and the meaning of *drive* and *handoff*, see [herdr-agent-orchestration](../herdr-agent-orchestration/SKILL.md) - don't restate them here.

## Preconditions

- The workbox is reachable over ssh and runs a herdr server (`ssh <workbox> 'herdr status'` shows `running`).
- The agent CLI you'll start there is installed and authed on the workbox; `gh` works there.
- You can drive both servers over the socket - local directly, workbox via `ssh <workbox> 'herdr …'`.

## Steps

1. **Pick targets.** `herdr agent list` locally. Migrate only **idle** agents - a `working` agent has no stable state to hand off. List the chosen panes before touching any.
2. **Source writes the handoff** (per agent, one at a time). Drive the local agent to: push its branch, write a handoff document at the repo root, open a GitHub issue whose body is that document, and reply with the issue URL. Capture `{repo, branch, checkpoint commit, issue URL}`. **Done when: the issue URL is posted and the branch is pushed.**
3. **Prepare the workbox checkout.** On the workbox, ensure the repo is present (clone it if missing) and fetch the handoff branch. If another agent already occupies that repo's working tree, give this one its own `git worktree` - never two agents in one tree.
4. **Start the successor on the workbox.** `ssh <workbox> 'herdr agent start <name> --cwd <repo-or-worktree> -- <agent-cli> <bypass-flag>'`. Clear the startup trust/hook prompts once it boots. **Done when: `agent list` on the workbox shows the new pane idle.**
5. **Hand it the goal.** Send the successor the handoff issue as a *tracked goal* - `/goal <objective referencing the issue and branch>` - not a one-shot prompt. **Done when: a `read` shows it pursuing the goal.**
6. **Retire the local source.** Tell the local agent its work has moved to the workbox (or close its pane) so the same work never runs in two places.
7. **Repeat per target.** The workbox server persists every successor; the human watches them with `herdr --remote <workbox> --session <name>` and detaches without stopping them.

## Gotchas

- One handoff at a time: let each source finish posting its issue before starting its successor, so you never mix up `{repo, branch, issue}`.
- Two targets sharing one repo (e.g. two agents in the same project) **must** land in separate worktrees on the workbox.
- The successor reauths per machine and reads the issue, not the laptop's memory - so it resumes cleanly even with a fresh context.
