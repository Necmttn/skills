# Cross-machine signals: what fleetboard already supports

Research for [Necmttn/skills#8](https://github.com/Necmttn/skills/issues/8) (part of #4).

Sources read directly (no secondary sources for the fleetboard part):
- `~/Projects/fleetboard/server.ts` (Bun.serve routes, WS, persistence) - 175 lines, read in full.
- `~/Projects/fleetboard/fleetctl.ts` (CLI) - 72 lines, read in full.
- `~/Projects/fleetboard/board.html` (dashboard, WS client) - 114 lines, read in full.
- `~/Projects/necmttn-skills/skills/engineering/fleet-ship/SKILL.md` - "Multi-orchestrator
  coordination" and "Child→parent signals" sections.
- `~/Projects/necmttn-skills/skills/engineering/fleet-ship/REFERENCE.md` - waiter/monitor scripts
  (confirms the /tmp signals + waiters are local-filesystem/local-git operations).
- `~/Projects/necmttn-skills/skills/engineering/herdr-agent-orchestration/SKILL.md` - confirms
  herdr's cross-machine story: remote panes are driven by SSH-prefixing the same commands
  (`ssh user@host 'herdr agent send <pane> …'`); there is no unified cross-machine `agent list`.

## What fleetboard is, concretely

A single Bun process (`server.ts`) serving:
- HTTP JSON routes for CLI clients (`fleetctl.ts`).
- One `/ws` WebSocket that broadcasts the **entire state blob** to every connected socket on
  every mutation (`touch()` = persist + broadcast). Only `board.html` (the human dashboard)
  actually opens this socket; `fleetctl.ts` never does.
- State model: `{ fleets: Record<id, Fleet>, claims: Claim[], attention: Attention[] }`, persisted
  as one JSON file at `~/.fleet/state.json` on whichever machine runs the server (source: lines
  13-43 of server.ts).
- `Fleet = { id, host, epic, status, lastHeartbeat, meta? }` - `meta` is an untyped
  `Record<string, unknown>` grab-bag, shallow-merged on heartbeat (`f.meta = {...f.meta, ...b.meta}`).
- `Claim = { resource, fleet, since }` - no `host` field; you'd have to join through `fleets[fleet].host`.
- `Attention = { id, fleet, ask, at, resolved, answer? }` - the only entity with a resolve/answer
  round-trip.

Bind: `hostname: "0.0.0.0"` (server.ts:69) - reachable from any machine that can route to the
port, e.g. over Tailscale, which is exactly how `fleet-ship`'s SKILL.md already uses it
("VPS fleets set FLEET_BOARD_URL to the Mac's tailscale addr").

## Endpoint-by-endpoint

| Endpoint | Behavior (from source) | Notes |
|---|---|---|
| `POST /register` | Upserts `state.fleets[id]` (host, epic, status, meta), stamps `lastHeartbeat` now. | Overwrite semantics - no auth, no ownership check. Any caller can register any id. |
| `POST /heartbeat` | 404 if unregistered; else updates `lastHeartbeat`, optionally `status` and shallow-merges `meta`. | Last-write-wins per fleet id. No history/log kept - only latest status survives. |
| `POST /claim` | 409 + `{heldBy, since}` if `resource` held by a different fleet; else inserts (idempotent for same fleet). | Exclusive lock per resource string. No TTL, no expiry, no forced-release. |
| `POST /release` | Filters the claim out for `(resource, fleet)`. | No ownership check beyond matching the fleet id string the caller sends. |
| `POST /attention` | Appends an `Attention`, persists, broadcasts, and if `NTFY_TOPIC` is set, POSTs to `ntfy.sh` for phone push. | The only push-to-a-human primitive that exists. Nothing analogous pushes to another *machine/process*. |
| `POST /resolve` | Marks an attention item resolved, optional `answer`. | Human answers by clicking the dashboard button; caller must poll `/state` to see the answer (fleetctl has no `resolve`/`answer` reader beyond `status`). |
| `POST /deregister` | Deletes the fleet, filters out its claims. | Nothing auto-releases claims on crash - only explicit deregister. |
| `GET /state` | Full state dump. | `fleetctl status` is a straight poll of this. |
| `GET /` + `/ws` | Dashboard HTML + WebSocket that re-sends the full state JSON on every mutation. | WS is server→dashboard only; no client can subscribe selectively or send anything meaningful (the `message()` handler is a no-op, server.ts:169). |

`fleetctl.ts` command surface exactly mirrors these: `register / heartbeat / claim / release / attn / status / deregister`. It is a thin fetch wrapper - no `watch`, `wait`, or long-poll subcommand exists. Every command is one request, one response, process exits.

## Findings against the four questions

### (a) Chunk DONE|BLOCKED|ERROR signals from remote panes

- **Exists:** `heartbeat`'s `status` + `meta` fields could technically carry a signal
  (`fleetctl heartbeat <id> --status DONE --meta '{"gist":"..."}'`), and this is durable
  (persisted to `~/.fleet/state.json`, survives the poster's process dying) and remotely
  reachable over the tailnet.
- **Missing:** the local `/tmp/fleet-<epic>.signals` design is an **append-only log** - every
  pane's every STOP event becomes one more line, multiple chunks per run, orchestrator reads the
  whole history on every wake to reconcile. fleetboard's heartbeat is **last-write-wins per
  fleet id** - one status field, overwritten each call, no per-chunk history, no queryable
  "give me all DONE|BLOCKED|ERROR events since X" endpoint. There is also no concept of "chunk"
  distinct from "fleet" in the schema - reusing `fleet.id` as the chunk id (one fleetboard
  registration per *pane*, not per *orchestrator run*) is a workable convention but nothing in
  the schema or CLI encodes or enforces it.
- **Gap size: medium.** The primitives (register/heartbeat/deregister per chunk-pane, with
  `status` as the DONE|BLOCKED|ERROR enum and `meta.gist`/`meta.report` for detail) cover the
  *last-known-state* need. What's missing is the *append-only multi-event log* semantic and a
  batch "what changed since I last looked" read - the orchestrator would have to diff full
  `/state` snapshots itself (doable, but not provided).

### (b) Per-machine scoping / capability registry

- **Exists:** `Fleet.host` is populated at register time from `process.env.HOSTNAME` (or
  `os.hostname()`) - so every registered fleet/pane self-reports which machine it's on, and the
  dashboard shows it (`board.html:78`). `meta` could hold ad hoc capability info (e.g.
  `{"sims":["..."]}`, already an example in fleetctl.ts's own doc comment).
- **Missing:** no schema for capabilities at all - `meta` is `Record<string, unknown>`, untyped
  and unvalidated, so "what can machine X build/run" is a convention, not a contract. No
  endpoint to query "list fleets on host X" or "list machines with capability Y" (client would
  fetch the full `/state` and filter locally - fine at current scale, but there's no index).
  Claims don't carry `host` (only `fleet`), so resolving "which machine holds this claim" needs
  a join against `state.fleets[claim.fleet].host` that could dangle if the fleet already
  deregistered. No first-class "machine" entity separate from "fleet run" - a machine that hosts
  zero currently-registered fleets is invisible to the board entirely.
- **Gap size: large.** Everything here is inferred/conventional, nothing enforced. Building a
  real capability registry (e.g. "machine X has 3 free sim slots, GPU Y, is on macOS") would need
  a new endpoint/entity, not a repurposing of `meta`.

### (c) Waking a remote orchestrator (push vs poll)

- **Exists:** genuine server push exists in exactly one place - the `/ws` broadcast to the
  dashboard, and the `ntfy.sh` bell for a **human's phone** on `/attention`. Both are one-way,
  fixed-audience pushes (dashboard renders state; ntfy notifies a person) - neither is a
  general pub/sub or callback mechanism a *process* can subscribe to and react on.
- **Missing:** `fleetctl.ts` - the only interface an orchestrator process actually uses - has no
  `watch`/`wait`/long-poll command and never opens the WebSocket. So today, "wake a remote
  orchestrator" reduces to: that orchestrator's own loop must poll `GET /state` on some cadence
  (the fleet-ship pattern's local idle-waiter/monitor are `herdr agent wait` background loops
  with `sleep`, which only work because the orchestrator, the pane, and the git worktree are on
  the same filesystem - confirmed by REFERENCE.md's waiter script literally doing
  `git -C "$WT" status --porcelain`). For a genuinely remote pane, herdr itself requires
  SSH-prefixing every command (`ssh user@host 'herdr agent send <pane> …'`, per
  herdr-agent-orchestration SKILL.md) - there's no unified `agent list` across machines, so an
  orchestrator can't even enumerate remote panes without already knowing which host each one is
  on. fleetboard doesn't help here: no webhook/callback-URL registration per fleet, no
  server-initiated request to any client, and no SSE/long-poll fallback for non-browser clients.
- **Gap size: large.** Nothing exists between "browser holds a live socket" and "process polls
  a REST endpoint." A cross-machine wake-up would need either (1) fleetctl gains a `watch`
  subcommand that opens `/ws` (or a long-poll `/state?since=` endpoint) and blocks until a
  matching state change appears, or (2) each orchestrator keeps polling on its own cadence
  (functionally what the local idle-waiter already does, just pointed at `/state` instead of
  local git/herdr state) - the latter is buildable today with zero server changes, but it's
  polling, not the push the local `agent wait` gives you.

### (d) Auth / trust on the tailnet

- **Exists:** implicit network-perimeter trust - the server binds `0.0.0.0` with no code-level
  authentication, so reachability is gated entirely by whoever controls network routes to the
  port (in the documented deployment, Tailscale ACLs). `ringBell`'s ntfy topic is a
  shared-secret-by-obscurity (topic name in the URL), not an auth mechanism for the board itself.
- **Missing:** zero request-level auth in `server.ts` - no token/header check, no per-fleet
  identity verification, no mTLS. Any request that reaches the port can register/deregister any
  fleet id, heartbeat on behalf of any id, claim/release any resource, and post/resolve any
  attention item - there's no ownership binding between "who is allowed to say they're fleet X"
  and the request. On a tailnet this means every device tailnet-ACL'd to the port is fully
  trusted; a compromised or misbehaving machine on the tailnet can impersonate any fleet, steal
  or forcibly release any claim, or spam fake attention items with no server-side pushback.
  There's also no TLS termination in the code (plain `Bun.serve`) - Tailscale gives you
  network-layer encryption/identity between nodes, but the app layer does nothing with it (e.g.
  no use of Tailscale's identity headers to bind a request to a known node).
- **Gap size: medium for the documented single-operator tailnet use case (matches the existing
  trust model of "everything on my tailnet is mine"), large if cross-machine coordination is
  meant to span machines/operators the user doesn't fully control** - e.g. a rented/shared VPS
  fleet lane, or if the tailnet ever grows guest devices. No incremental auth exists to dial in
  between those two cases today.

## Summary table

| Need | Exists | Missing | Gap |
|---|---|---|---|
| (a) DONE/BLOCKED/ERROR signal from remote pane | heartbeat status+meta, durable, remote-reachable | append-only per-chunk log; diff-since-last-read; no chunk entity distinct from fleet | medium |
| (b) per-machine scoping / capability registry | `Fleet.host` self-reported; free-form `meta` | no schema, no query-by-host/capability, no host on claims, no entity for idle machines | large |
| (c) waking a remote orchestrator | WS push (dashboard only), ntfy push (human only) | no watch/long-poll in fleetctl, no callback registration, herdr itself needs per-host SSH addressing | large |
| (d) auth/trust on tailnet | network-perimeter trust via Tailscale ACLs | zero request-level auth/identity binding in server.ts | medium (single-operator) / large (shared machines) |

## Bottom line

fleetboard already gives cross-machine orchestrators a shared, durable, tailnet-reachable KV-ish
store with basic locking (`claim`/`release`) and one human-facing push channel (`attn` → ntfy).
That's enough to durably replace the *local-filesystem part* of the /tmp-signals design (a
heartbeat call is a fine substitute for an appended signal line, as long as each chunk-pane
registers as its own fleet id and the orchestrator treats `status` as the signal). What it does
**not** give you is (1) a multi-event append log / diff-since-read the way a signals file
naturally is, (2) any structured capability/machine registry beyond a free-text `meta` bag and a
self-reported `host` string, (3) any way for a process (not a browser or a phone) to be *pushed*
to rather than poll, and (4) any request-level authentication - trust is 100% delegated to
network reachability. Replacing local idle-waiters cross-machine is the biggest open gap: today
it would have to become polling `/state` on a cadence (functionally fine, just not the
event-driven wake the same-machine `herdr agent wait` provides), since fleetctl never opens the
one push channel (`/ws`) that does exist.
