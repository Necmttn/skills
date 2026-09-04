/**
 * graph.json - the plan-only dependency graph of one epic (spec section 5).
 * Never holds run-time state; the ledger does.
 */
import { Result, Schema } from "effect";

export const ChunkKind = Schema.Literals(["impl", "verify", "gate", "question"]);
export const Lane = Schema.Literals(["mechanical", "judgment", "design"]);

export const Chunk = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  kind: ChunkKind,
  lane: Lane,
  deps: Schema.Array(Schema.String),
  conflicts: Schema.optionalKey(Schema.Array(Schema.String)),
  needs: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
  hold: Schema.optionalKey(Schema.NullOr(Schema.Literal("human"))),
  areas: Schema.optionalKey(Schema.Array(Schema.String)),
  acceptance: Schema.String,
  plan_ref: Schema.optionalKey(Schema.String),
});

export const Graph = Schema.Struct({
  version: Schema.Literal(1),
  epic: Schema.String,
  repo: Schema.String,
  plan: Schema.Struct({ path: Schema.String, sha: Schema.String }),
  integration_branch: Schema.String,
  runmap_issue: Schema.optionalKey(Schema.Number),
  project_number: Schema.optionalKey(Schema.Number),
  chunks: Schema.Array(Chunk),
});

export type Chunk = typeof Chunk.Type;
export type Graph = typeof Graph.Type;
export type ChunkKind = typeof ChunkKind.Type;
export type Lane = typeof Lane.Type;

const decode = Schema.decodeUnknownResult(Graph);

/** Parse graph.json text. Never throws: a bad document is a Failure with a human reason. */
export const parseGraph = (text: string): Result.Result<Graph, string> => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return Result.fail(`not JSON: ${String(error)}`);
  }
  const decoded = decode(json);
  if (Result.isFailure(decoded)) return Result.fail(`not a fleet graph: ${String(decoded.failure)}`);
  return Result.succeed(decoded.success);
};

export const holdOf = (chunk: Chunk): "human" | null => chunk.hold ?? null;
export const conflictsListOf = (chunk: Chunk): ReadonlyArray<string> => chunk.conflicts ?? [];
export const areasOf = (chunk: Chunk): ReadonlyArray<string> => chunk.areas ?? [];

/** An empty graph for `fleet init`. */
export const emptyGraph = (input: { epic: string; repo: string; planPath: string; planSha: string }): Graph => ({
  version: 1,
  epic: input.epic,
  repo: input.repo,
  plan: { path: input.planPath, sha: input.planSha },
  integration_branch: `epic/${input.epic}`,
  chunks: [],
});

export const encodeGraph = (graph: Graph): string => JSON.stringify(graph, null, 2) + "\n";
