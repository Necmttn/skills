/** Render the orchestrator's five-block view from a folded run state. Pure. */
import type { FleetEvent } from "../ledger/Event.ts";
import type { RunState } from "../ledger/fold.ts";
import type { AgentInfo } from "../herdr/Herdr.ts";

export const STAGE_ORDER = [
  "assigned", "spawned", "planned", "building", "built", "in_review", "gated", "merged", "dogfooded",
  "blocked", "error", "archived", "closed",
];
const TERMINAL = new Set(["merged", "archived", "closed"]);

const HINTS: ReadonlyArray<readonly [string, string]> = [
  ["built", "gate them"],
  ["gated", "merge them"],
  ["blocked", "unblock or reassign"],
  ["error", "triage the pane"],
];

export const age = (then: string | null, now: Date): string => {
  if (!then) return "?";
  const ms = now.getTime() - new Date(then).getTime();
  if (Number.isNaN(ms)) return "?";
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const text = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));

export interface RenderInput {
  readonly state: RunState;
  readonly events: ReadonlyArray<FleetEvent>;
  readonly malformed: number;
  readonly tail: number;
  readonly now: Date;
  /** Live agents from the fleet session; undefined = ledger-only render. */
  readonly live?: ReadonlyArray<AgentInfo> | undefined;
}

export const render = ({ state, events, malformed, tail, now, live }: RenderInput): string => {
  const out: Array<string> = [];
  out.push(`epic: ${state.epic ?? "?"}   session: ${state.session ?? "-"}   last action: ${state.last ?? "-"} (${age(state.last, now)} ago)`);
  out.push(`events: ${events.length}   malformed: ${malformed}   runmap: ${state.runmap ?? "-"}   kanban: ${state.kanban ?? "-"}`);
  if (state.cursor) out.push("cursor: " + Object.entries(state.cursor).map(([k, v]) => `${k}=${text(v)}`).join(" "));
  for (const [name, policy] of state.policies) out.push(`policy ${name}: ${policy}`);
  if (state.teardown) out.push(`TEARDOWN DONE at ${state.teardown}`);

  const byPane = new Map<string, AgentInfo>();
  const byName = new Map<string, AgentInfo>();
  for (const agent of live ?? []) {
    if (agent.pane_id) byPane.set(agent.pane_id, agent);
    if (agent.name) byName.set(agent.name, agent);
  }

  out.push("", "chunks", "chunk | stage | pane | live | engine | pr | age | gist");
  const claimed = new Set<string>();
  const chunkNames = new Set<string>();
  const gone: Array<string> = [];
  for (const [subject, chunk] of state.chunks) {
    const pane = text(chunk.data.pane);
    const name = subject.split("/").at(-1) ?? subject;
    chunkNames.add(name);
    const agent = byPane.get(pane) ?? byName.get(name);
    let status = "-";
    if (live !== undefined) {
      if (agent) {
        status = agent.agent_status ?? "?";
        claimed.add(agent.pane_id);
      } else if (pane && !TERMINAL.has(chunk.stage)) {
        status = "gone";
        gone.push(`${subject} pane ${pane}`);
      }
    }
    if (pane) claimed.add(pane);
    const gist = text(chunk.data.gist) || text(chunk.data.commit);
    out.push([subject, chunk.stage, pane || "-", status, text(chunk.data.engine) || "-", text(chunk.data.pr) || "-", age(chunk.time, now), gist].join(" | "));
  }
  if (state.chunks.size === 0) out.push("(no chunk events yet)");

  out.push("", "checklist");
  const counts = new Map<string, number>();
  for (const chunk of state.chunks.values()) counts.set(chunk.stage, (counts.get(chunk.stage) ?? 0) + 1);
  const ordered = [...STAGE_ORDER.filter((s) => counts.has(s)), ...[...counts.keys()].filter((s) => !STAGE_ORDER.includes(s))];
  out.push(ordered.map((s) => `${s}: ${counts.get(s)}`).join("  ") || "no chunks");
  const hints = HINTS.filter(([stage]) => counts.has(stage)).map(([stage, hint]) => `${counts.get(stage)} ${stage} -> ${hint}`);
  if (counts.has("merged")) hints.push(`${counts.get("merged")} merged -> archive-then-close`);
  out.push("next: " + (hints.length ? hints.join("; ") : "wait on working panes"));

  out.push("", "open attn");
  for (const [subject, item] of state.attn) out.push(`${subject}: ${item.ask} (${age(item.time, now)} ago)`);
  if (state.attn.size === 0) out.push("none");

  out.push("", "open resources");
  for (const [subject, item] of state.resources) out.push(`${subject} ${item.label}`.trimEnd());
  if (state.resources.size === 0) out.push("none");

  if (live !== undefined) {
    out.push("", "live");
    const orphans = live.filter((a) => !claimed.has(a.pane_id) && !(a.name && chunkNames.has(a.name)));
    for (const a of orphans) out.push(`orphan pane ${a.pane_id} ${a.name ?? "(unnamed)"} ${a.agent_status ?? "?"}`);
    for (const line of gone) out.push(`gone ${line}`);
    if (orphans.length === 0 && gone.length === 0) out.push(`${live.length} agents, all accounted for`);
  }

  out.push("", `action log (last ${tail})`);
  for (const event of events.slice(-tail)) {
    const d = event.data;
    const summary = text(d.gist) || text(d.text) || text(d.ask) || text(d.label) || text(d.pr);
    out.push(`${event.time || "?"} ${event.type} ${event.subject} ${summary}`.trimEnd());
  }
  return out.join("\n") + "\n";
};
