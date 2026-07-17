# herdr CLI - orchestration commands

Every command talks to the running herdr server over its socket. Prefix with `ssh user@host '…'` to drive a remote server identically.

## Read state
- `herdr agent list` - JSON list of agents: `pane_id`, `agent` (claude/codex/…), `agent_status` (idle|working|blocked|unknown), `cwd`, `workspace_id`.
- `herdr agent get <pane>` - one agent's status.
- `herdr agent read <pane> [--source visible|recent] [--lines N] [--format text]` - pane contents. Returns JSON; extract `.result.read.text`:
  `… | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["read"]["text"])'`
- `herdr agent wait <pane> --status idle [--timeout MS]` - block until a state.

## Send input
- `herdr agent send <pane> "<text>"` - type literal text into the prompt (no Enter).
- `herdr pane send-keys <pane> <Key> [Key …]` - named keys: `Enter`, `Escape`, `Up`, `Down`. Submit, navigate menus, dismiss overlays.
- `herdr pane run <pane> "<cmd>"` - types text **and** Enter (shell-style).

## Lifecycle
- `herdr agent start <name> --cwd <path> [--workspace ID] [--split right|down] -- <argv…>` - spawn an agent in a new pane.
- `herdr pane close <pane>` - kill a pane.
- `herdr agent attach <pane> [--takeover]` - attach your terminal to one agent.

## Sessions & remote
- `herdr session list` / `herdr status` - server + session state.
- `herdr --remote user@host --session <name>` - attach as thin client; server runs on host, UI streams to you. Detach `ctrl+b q`; agents persist.

## Input hygiene
Before `send`: `read --source visible` and confirm an empty prompt. Dismiss rating prompts (`0`), trust/hook prompts (select + `Enter`), and clear any user-typed text. `send` appends to whatever is already there (verified live 2026-07-17).
