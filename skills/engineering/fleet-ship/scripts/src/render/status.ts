/** One chunk, for the pane that owns it (spec section 12). Pure. */
import { holdOf } from "../graph/Graph.ts";
import type { RunView } from "../run/Run.ts";
import { stepsFor, type Workflow } from "../workflow/Workflow.ts";
import { age } from "./state.ts";

export const renderStatus = (view: RunView, idOrSubject: string, now: Date, workflow: Workflow): string | null => {
  const id = idOrSubject.split("/").at(-1) ?? idOrSubject;
  const chunk = view.chunks.get(id);
  if (!chunk) return null;
  const state = chunk.state;
  const attempt = state?.attempts.at(-1);
  const steps = stepsFor(workflow, chunk.stage ?? "");
  const nextSteps = state?.step ? steps.slice(steps.indexOf(state.step) + 1) : steps;
  const paneOf = (dep: string) => view.chunks.get(dep)?.state?.data.pane ?? "-";
  const stageOf = (dep: string) => view.chunks.get(dep)?.stage ?? "not started";
  const hold = holdOf(chunk.spec);
  const lines = [
    `chunk: ${chunk.id}  (${chunk.spec.title})`,
    `subject: ${chunk.subject ?? "-"}   pane: ${String(state?.data.pane ?? "-")}   engine: ${String(state?.data.engine ?? "-")}`,
    `stage: ${chunk.stage ?? "not started"}   step: ${state?.step ?? "-"}   since: ${age(state?.time ?? null, now)} ago`,
    `next steps: ${nextSteps.join(", ") || "-"}`,
    `attempt: ${attempt ? `${attempt.n} (${attempt.cause})` : "-"}   evidence: ${state?.evidence ?? "-"}`,
    `ready: ${chunk.ready ? "yes" : "no"} - ${chunk.reason}`,
    `blocked by: ${chunk.blockedBy.length ? chunk.blockedBy.map((dep) => `${dep} (${stageOf(dep)})`).join(", ") : "-"}`,
    `dependents: ${chunk.dependents.length ? chunk.dependents.map((dep) => `${dep} (${String(paneOf(dep))})`).join(", ") : "-"}`,
    `conflicts: ${(chunk.spec.conflicts ?? []).join(", ") || "-"}${chunk.conflictHolds.length ? `  ACTIVE: ${chunk.conflictHolds.join(", ")}` : ""}`,
    `hold: ${hold ? `${hold} (${chunk.holdApproved ? "approved" : "not approved"})` : "-"}`,
    `pr: ${String(state?.data.pr ?? "-")}   commit: ${String(state?.data.commit ?? "-")}`,
    `acceptance: ${chunk.spec.acceptance}`,
    `plan: ${chunk.spec.plan_ref ?? "-"}   lane: ${chunk.spec.lane}   kind: ${chunk.spec.kind}   areas: ${(chunk.spec.areas ?? []).join(",") || "-"}`,
  ];
  return lines.join("\n") + "\n";
};
