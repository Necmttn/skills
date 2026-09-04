/** The per-chunk workflow template (spec section 7.3): ordered steps under each stage. */
import { Result, Schema } from "effect";

export const Workflow = Schema.Struct({
  version: Schema.Literal(1),
  steps: Schema.Record(Schema.String, Schema.Array(Schema.String)),
});
export type Workflow = typeof Workflow.Type;

export const DEFAULT_WORKFLOW: Workflow = {
  version: 1,
  steps: {
    planned: ["plan-drafted", "plan-approved"],
    building: ["tdd-red", "tdd-green", "self-review", "report", "survey"],
    in_review: ["review-all", "codex-review", "adversarial-review"],
    gated: ["consensus", "hold-approved"],
    merged: ["main-synced", "archived-report"],
    dogfooded: ["tracer-run", "findings-filed"],
  },
};

const decode = Schema.decodeUnknownResult(Workflow);

export const parseWorkflow = (text: string): Result.Result<Workflow, string> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return Result.fail(`not JSON: ${String(error)}`);
  }
  const decoded = decode(json);
  if (Result.isFailure(decoded)) return Result.fail(`not a workflow template: ${String(decoded.failure)}`);
  return Result.succeed(decoded.success);
};

export const stepsFor = (workflow: Workflow, stage: string): ReadonlyArray<string> => workflow.steps[stage] ?? [];
export const hasStep = (workflow: Workflow, stage: string, step: string): boolean => stepsFor(workflow, stage).includes(step);
