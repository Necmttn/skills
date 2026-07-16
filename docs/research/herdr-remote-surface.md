# herdr remote control surface: what works over ssh

Research for [Necmttn/skills#7](https://github.com/Necmttn/skills/issues/7), part of #4.

Verifies the claims in `skills/engineering/herdr-agent-orchestration/SKILL.md` ("Remote is
the same socket") and `herdr-cli.md` against local ground truth: `herdr --help` and every
subcommand's `--help` (herdr 0.7.4, protocol 16), plus live behavior probes. herdr's own
source is closed (Homebrew core formula installs a bottle; no source tree found under
`~/Projects`), so this is CLI-surface + live-probe verification, not source-code
verification.

## TL;DR

The skill's "same socket" claim is correct in effect but imprecise in mechanism. There is
no network-reachable socket: `herdr` only ever talks to a **Unix domain socket** at
`~/.config/herdr/herdr.sock` (or a named session's socket under
`~/.config/herdr/sessions/<name>/herdr.sock`). `ssh user@host 'herdr agent list'` works
identically to a local call **because the remote shell executes the remote machine's own
`herdr` binary against its own local socket** - the command runs there, not here. It is not
a local client dialing a socket over the network. `--remote` is a completely different,
non-composable code path (see below).

## Command surface, verified

Ran `herdr --help` plus `--help` on every listed subcommand group. Full list (0.7.4):

- **State reads (socket-API):** `agent list`, `agent get`, `agent read`, `pane get`,
  `pane list`, `pane current/layout/process-info/edges`, `tab list/get`, `workspace
  list/get`, `session list`, `status`, `api snapshot`, `api schema`.
- **Writes/lifecycle (socket-API):** `agent send`, `agent rename`, `agent focus`, `agent
  start`, `agent attach`, `agent wait`, `pane send-text`, `pane send-keys`, `pane run`,
  `pane split/move/swap/resize/zoom/close/rename`, `tab create/rename/close/focus`,
  `workspace create/rename/close/focus`, `wait output`, `wait agent-status`.
- **UI-attach only (not socket-API, no remote-exec equivalent):** bare `herdr` (launch/attach
  session), `herdr --remote <ssh-target> [--session <name>]`, `herdr session attach <name>`.

Every socket-API command accepts targets as terminal ids, unique agent names,
detected/reported agent labels, **or legacy pane ids** (per `herdr agent --help`'s footer) -
confirms name-addressing works, but names are resolved against the target server's own
agent table only (see Namespacing below).

## `--remote` is not composable with driving commands

This is the load-bearing correction to the skill doc. Tested locally:

```
$ herdr --remote bogus agent list
error: --remote can only be used with the default launch command
run 'herdr --help' for usage
```

`--remote` only launches the **interactive thin-client UI attach** (`herdr --remote
user@host --session <name>`, human watches a stream, detach with `ctrl+b q`). It cannot be
combined with `agent`/`pane`/`tab`/`workspace`/`wait` subcommands. There is no `herdr
--remote host agent list` one-shot form and no `--socket host:port` flag anywhere in the
CLI. **The only way to drive a remote server's socket-API is `ssh user@host 'herdr
<subcommand> ...'`** - i.e. remote-exec the whole command, don't try to point a local client
at a remote socket. The skill doc's phrasing ("prefixing the same commands with ssh") is
already correct on this point; this just confirms it's the *only* path, not one of several.

## Live probe: ssh daria

```
$ ssh -o ConnectTimeout=8 -o BatchMode=yes daria 'herdr agent list'
necmttn@daria: Permission denied (publickey,password,keyboard-interactive).
```

Host resolved and the SSH handshake was attempted (not a DNS/tailscale-magic-dns failure);
auth failed for this session (no forwarded key/agent). Did not chase credentials per the
research method - this is a session-scoped auth gap, not evidence the remote-exec model is
broken. Re-run from a session with daria SSH access to get a live `herdr agent list` over
the wire; the mechanism above (remote binary, remote socket) should behave identically to
local once auth succeeds, since it's the same code path executing on the far side.

## Waiter and status semantics - real gotcha found

`herdr agent list` reports `agent_status` values including `"done"` (seen live: two idle
Claude panes in this session both showed `agent_status: "done"`). But the two wait
commands disagree on whether `done` is a legal target status:

```
$ herdr agent --help
  herdr agent wait <target> --status <idle|working|blocked|unknown> [--timeout MS]

$ herdr wait --help
  herdr wait agent-status <pane_id> --status <idle|working|blocked|done|unknown> [--timeout MS]
```

`agent wait` does not list `done` as an accepted status; `wait agent-status` does. Verified
live against a pane whose real `agent_status` was `"done"`:

```
$ herdr agent wait wZ:pG4 --status done --timeout 1500
Error: Custom { kind: Other, error: "done is a UI attention state; use idle for CLI agent
completion waits" }
```

`--status done` is explicitly rejected by `agent wait` with that message. And:

```
$ herdr agent wait wZ:pG4 --status idle --timeout 1500
(resolves in ~10ms, not the 1500ms timeout - but exits 1)
{"id":"cli:agent:wait:resolve","result":{"agent":{...,"agent_status":"done",...},
"type":"agent_info"}}
```

Waiting for `idle` against an agent that's actually `done` resolves almost instantly
(herdr treats `done` as idle-equivalent for the purposes of unblocking a waiter) but the
process **exits non-zero**, and the resolved payload's own `agent_status` field still reads
`"done"`, not `"idle"`. A caller that only checks exit code will see a spurious failure on a
successful, idle agent; a caller that checks `result.agent.agent_status == "idle"` will
never match a `done` agent. **Fleet waiters should treat `done` as terminal/idle-equivalent
explicitly** (`agent_status in {idle, done}`) rather than requesting `--status idle` and
trusting the exit code, and should never pass `--status done` to `agent wait` (use `wait
agent-status` for that, which does accept it as a first-class value per its `--help`, though
this pass did not live-test `wait agent-status --status done` specifically).

This status-vocabulary mismatch between `agent wait` and `wait agent-status` is unrelated
to remote vs local - it reproduces purely locally - but it directly threatens fleet-ship's
idle-waiter logic wherever it's driving agents (local or remote) and treats `agent
wait --status idle` as the sole gate for "agent is done."

## Fleet-ship needs, mapped to what was verified

- **Background idle-waiters over ssh, long-lived vs re-arm-per-poll.** Not directly
  measurable without a working daria session, but structurally: since remote-exec is a full
  `ssh user@host 'herdr wait ...'` process per call, a *blocking* wait (`--timeout` set high)
  held open over ssh is one long-lived ssh connection per outstanding wait - normal ssh
  keepalive/`ServerAliveInterval` tuning applies same as any long ssh exec. Re-arming per
  poll (short-timeout wait, loop) trades connection longevity for repeated ssh handshake
  cost; given `agent wait`/`wait output` support `--timeout MS` server-side blocking, prefer
  one long-lived ssh call with a bounded timeout over tight polling loops, same as the local
  recommendation in the skill doc ("wait for idle").
- **`agent wait --timeout` semantics over ssh.** The timeout is enforced by the remote
  `herdr` process against its local socket exactly as it is locally (see above) - ssh is
  just the transport for stdin/stdout/exit-code of that remote process. No local-vs-remote
  semantic difference expected; what changes is that a `--timeout` value must now also
  survive ssh's own connection timeout/keepalive settings, which are the caller's
  responsibility to set generously (`ConnectTimeout`, `ServerAliveInterval`), not herdr's.
- **Name-addressing across machines.** Confirmed structurally: `herdr agent list`/`get` etc.
  resolve names against *that server's* own agent table only - there is no cross-host
  namespace. Two machines can each have an agent named `sdk-migrate` with no collision
  detection between them. **Fleet orchestration must namespace by host** (e.g. prefix pane
  labels/names with a machine tag, or always route through `ssh <host> 'herdr agent send
  <name> ...'` so the host is explicit in the call site) rather than assuming names are
  globally unique.
- **send-keys Enter round trips.** `agent send`/`pane send-text` are confirmed literal-text,
  no-submit (per every `--help` and the skill doc); `pane send-keys <pane> Enter` is the
  separate submit call, `pane run <pane> <cmd>` is the combined text+Enter shortcut. Nothing
  in the ssh path changes this - it's two remote-exec calls (or one `pane run`) instead of
  two local calls. No ssh-specific breakage found; the risk is purely latency/round-trip
  count (two ssh round trips for send+Enter vs one local pair), which argues for preferring
  `pane run` over local pattern's already-known `pane send-keys` where phrasing is a full
  shell command rather than agent chat text.

## What breaks / does not exist

- `herdr --remote host agent ...` - does not exist, hard-rejected by the CLI (see above).
  Only whole-command ssh remote-exec drives another machine's socket-API.
- Cross-host name uniqueness - does not exist; namespace by host at the call site.
- `agent wait --status done` - hard-rejected; `done` is only a legal wait target via `wait
  agent-status`, not `agent wait`.
- Live daria round-trip - not completed this pass (ssh auth denied for this session); the
  ssh handshake itself succeeded (host reachable, no DNS/tailscale issue), only credentials
  were missing. Re-probe from an authorized session to get real remote latency numbers.

## Primary sources consulted

- `~/Projects/necmttn-skills/skills/engineering/herdr-agent-orchestration/SKILL.md`
- `~/Projects/necmttn-skills/skills/engineering/herdr-agent-orchestration/herdr-cli.md`
- `herdr --help`, `herdr agent --help`, `herdr pane --help`, `herdr tab --help`, `herdr
  workspace --help`, `herdr wait --help`, `herdr session --help`, `herdr api --help`,
  `herdr status` - all run locally, herdr 0.7.4, protocol 16, socket
  `/Users/necmttn/.config/herdr/herdr.sock`.
- Live probes: `herdr session list --json`, `herdr agent list`, `herdr agent wait <pane>
  --status idle|done --timeout 1500` against a real `done`-status pane, `herdr --remote
  bogus agent list`, `ssh daria 'herdr agent list'`.
- `brew info herdr` - confirms herdr is closed-source-distributed (bottled formula from
  homebrew-core, AGPL-3.0-or-later license listed but no source tree found locally); no
  server/socket implementation source was available on this machine to read directly.
