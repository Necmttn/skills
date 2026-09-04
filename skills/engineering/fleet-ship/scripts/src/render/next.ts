/** The frontier: what the orchestrator may spawn now, and why the rest cannot. Pure. */
import { holdOf } from "../graph/Graph.ts";
import { MERGED_OR_LATER } from "../ledger/transitions.ts";
import type { RunView } from "../run/Run.ts";

const needsText = (needs: Record<string, unknown> | undefined) =>
  needs && Object.keys(needs).length ? Object.entries(needs).map(([key, value]) => `${key}=${String(value)}`).join(",") : "-";

export const renderNext = (view: RunView, now: Date): string => {
  const out: Array<string> = [];
  out.push(`frontier (${view.frontier.length}) at ${now.toISOString()}`);
  out.push("chunk | kind | lane | hold | needs | note");
  for (const id of view.frontier) {
    const chunk = view.chunks.get(id)!;
    out.push([id, chunk.spec.kind, chunk.spec.lane, holdOf(chunk.spec) ?? "-", needsText(chunk.spec.needs), chunk.needsAnswer ? "needs answer - do not spawn a build pane" : "spawn"].join(" | "));
  }
  if (view.frontier.length === 0) out.push("(nothing ready)");
  out.push("", "not ready");
  let any = false;
  for (const chunk of view.chunks.values()) {
    if (chunk.ready || MERGED_OR_LATER.has(chunk.stage ?? "")) continue;
    any = true;
    out.push(`${chunk.id} | ${chunk.stage ?? "-"} | ${chunk.reason}`);
  }
  if (!any) out.push("(none)");
  if (view.adhoc.length) out.push("", `adhoc (not in graph): ${view.adhoc.join(", ")}`);
  return out.join("\n") + "\n";
};
