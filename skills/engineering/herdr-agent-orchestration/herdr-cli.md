# herdr CLI - orchestration commands (0.8.0, protocol 19)

Every command talks to the running herdr server over its socket. Prefix with `ssh user@host '…'` to drive a remote server identically. `<target>` = agent NAME or pane id; `herdr pane *` takes pane ids only.

## Read state
- `herdr agent list` - JSON list of agents: `pane_id`, `agent` (claude/codex/…), `agent_status` (idle|working|blocked|done|unknown), `cwd`, `workspace_id`.
- `herdr agent get <target>` - one agent, incl. `agent_session` (real session id, via integrations) and `tokens` (`context` = context fill, `limit` = rate-limit window).
- `herdr agent read <target> [--source visible|recent|recent-unwrapped] [--lines N]` - pane contents as plain TEXT (no JSON extraction).
- `herdr agent wait <target> [--until STATUS …] [--timeout MS]` - block until a state; NO flag matches `idle|done|blocked`; `done` is first-class.
- `herdr pane wait-output <pane_id> (--match TEXT|--regex PAT) [--timeout MS]` - block until matching output; returns the matched line. Useless on claude panes (tool output is collapsed off-screen).

## Send input
- `herdr agent prompt <target> "<text>" [--wait [--until STATUS] [--timeout MS]]` - type AND submit; `--wait` blocks until the turn settles (`agent_prompt_stalled` if a non-working target shows no state change within 5s).
- `herdr pane send-text <pane_id> "<text>"` - literal text, NO submit.
- `herdr agent send-keys <target> <Key> [Key …]` - named keys: `Enter`, `esc`, `Up`, `Down`, `Ctrl+U`. Navigate menus, dismiss overlays, clear drafts.
- `herdr pane run <pane_id> "<cmd>"` - shell-style: text + Enter.

## Lifecycle
- Create the pane first: `herdr tab create --workspace <ID> --cwd <path> --label <text>` (agent goes into `result.root_pane`) or `herdr pane split <pane_id> --direction right|down --cwd <path> --no-focus`.
- `herdr agent start <name> --kind <claude|codex|grok|pi|gemini|…> --pane <pane_id> [--timeout MS] -- <agent flags>` - start the engine in that pane; success = detected + ready for input.
- `herdr pane close <pane_id>` - kill a pane (a tab dies with its last pane).
- `herdr agent attach <target> [--takeover]` - attach your terminal to one agent.

## Backchannel (inside any pane)
Env: `HERDR_ENV=1`, `HERDR_PANE_ID`, `HERDR_SOCKET_PATH` - a pane can always signal about itself:
- `herdr notification show "<title>" [--body TEXT] [--sound done|request]` - toast the human.
- `herdr pane report-agent "$HERDR_PANE_ID" --source <id> --agent <label> --state idle|working|blocked|unknown [--message TEXT]` - label a SHELL pane for `agent wait`/the sidebar. Cannot override a live agent pane's detected status.
- `herdr integration install claude|codex|grok|pi|…` (once per machine+user) - engine hooks report real session identity; `herdr integration status` shows drift.

## Sessions & remote
- `herdr session list` / `herdr status` - server + session state.
- `herdr --remote user@host --session <name>` - attach as thin client; UI only, never for driving subcommands. Detach `ctrl+b q`; agents persist.

## Input hygiene
Before `agent prompt`: `read --source visible` and confirm an empty prompt. Dismiss rating prompts (`0`), trust/hook prompts (select + `Enter`), and clear any user-typed text (`send-keys Ctrl+U`). Typed text appends to whatever is already there (verified live 2026-07-17).
