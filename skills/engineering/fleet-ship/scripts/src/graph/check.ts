/** Structural checks over a parsed graph (spec section 5). Pure. */
import { conflictsListOf, type Chunk, type Graph } from "./Graph.ts";

export interface Finding {
  readonly level: "error" | "warning";
  readonly code: string;
  readonly chunk: string | null;
  readonly message: string;
}

const ID = /^[a-z0-9-]+$/;

export const chunkById = (graph: Graph): ReadonlyMap<string, Chunk> => new Map(graph.chunks.map((c) => [c.id, c]));

export const conflictsOf = (graph: Graph): ReadonlyMap<string, ReadonlySet<string>> => {
  const out = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!out.has(a)) out.set(a, new Set());
    out.get(a)!.add(b);
  };
  for (const chunk of graph.chunks) {
    for (const other of conflictsListOf(chunk)) {
      if (other === chunk.id) continue;
      add(chunk.id, other);
      add(other, chunk.id);
    }
  }
  return out;
};

const findCycleMember = (graph: Graph): string | null => {
  const byId = chunkById(graph);
  const color = new Map<string, 0 | 1 | 2>();
  const visit = (id: string): string | null => {
    const state = color.get(id) ?? 0;
    if (state === 1) return id;
    if (state === 2) return null;
    color.set(id, 1);
    for (const dep of byId.get(id)?.deps ?? []) {
      if (!byId.has(dep)) continue;
      const hit = visit(dep);
      if (hit) return hit;
    }
    color.set(id, 2);
    return null;
  };
  for (const chunk of graph.chunks) {
    const hit = visit(chunk.id);
    if (hit) return hit;
  }
  return null;
};

export const checkGraph = (graph: Graph): ReadonlyArray<Finding> => {
  const findings: Array<Finding> = [];
  const err = (code: string, chunk: string | null, message: string) => findings.push({ level: "error", code, chunk, message });
  const warn = (code: string, chunk: string | null, message: string) => findings.push({ level: "warning", code, chunk, message });
  const seen = new Set<string>();
  const ids = new Set(graph.chunks.map((c) => c.id));

  for (const chunk of graph.chunks) {
    if (seen.has(chunk.id)) err("G100", chunk.id, `duplicate chunk id ${chunk.id}`);
    seen.add(chunk.id);
    if (!ID.test(chunk.id)) err("G101", chunk.id, `chunk id must match [a-z0-9-]+ (got ${JSON.stringify(chunk.id)})`);
    for (const dep of chunk.deps) if (!ids.has(dep)) err("G110", chunk.id, `${chunk.id} depends on unknown chunk ${dep}`);
    for (const other of conflictsListOf(chunk)) {
      if (other === chunk.id) err("G112", chunk.id, `${chunk.id} conflicts with itself`);
      else if (!ids.has(other)) err("G111", chunk.id, `${chunk.id} conflicts with unknown chunk ${other}`);
    }
  }

  const cycle = findCycleMember(graph);
  if (cycle) err("G120", cycle, `dependency cycle through ${cycle}`);

  for (const chunk of graph.chunks) {
    if (chunk.kind !== "question") continue;
    const dependents = graph.chunks.filter((c) => c.kind === "impl" && c.deps.includes(chunk.id)).map((c) => c.id);
    if (dependents.length > 0) warn("W200", chunk.id, `question ${chunk.id} has impl dependents ${dependents.join(", ")}; answer it before they start`);
  }
  return findings;
};

export const hasErrors = (findings: ReadonlyArray<Finding>): boolean => findings.some((f) => f.level === "error");

export const formatFindings = (findings: ReadonlyArray<Finding>): string =>
  findings.map((f) => `${f.level === "error" ? "E" : "W"} ${f.code} ${f.chunk ?? "-"}: ${f.message}`).join("\n");
