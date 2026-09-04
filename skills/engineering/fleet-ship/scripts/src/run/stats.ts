/** Flow measurements over graph + ledger (spec 7.5 `fleet stats`). Pure. */
import type { Graph } from "../graph/Graph.ts";
import { chunkById } from "../graph/check.ts";
import type { FleetEvent } from "../ledger/Event.ts";
import { bareId, fold } from "../ledger/fold.ts";

export interface StageStat { lane: string; stage: string; count: number; meanMin: number; maxMin: number }
export interface Stats {
  byLaneStage: ReadonlyArray<StageStat>;
  attempts: ReadonlyArray<{ id: string; attempts: number; causes: ReadonlyArray<string> }>;
  causes: ReadonlyMap<string, number>;
  slowest: ReadonlyArray<{ id: string; stage: string; minutes: number }>;
  evidence: ReadonlyMap<string, number>;
}

const minutes = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);

export const computeStats = (graph: Graph, events: ReadonlyArray<FleetEvent>): Stats => {
  const byId = chunkById(graph);
  const laneOf = (subject: string) => byId.get(bareId(subject))?.lane ?? "adhoc";

  const perSubject = new Map<string, Array<FleetEvent>>();
  for (const event of events) {
    if (!event.type.startsWith("fleet.chunk.")) continue;
    perSubject.set(event.subject, [...(perSubject.get(event.subject) ?? []), event]);
  }
  const dwells: Array<{ id: string; lane: string; stage: string; minutes: number }> = [];
  for (const [subject, list] of perSubject) {
    for (let index = 0; index + 1 < list.length; index++) {
      const current = list[index]!;
      const next = list[index + 1]!;
      const stage = current.type.slice("fleet.chunk.".length);
      dwells.push({ id: bareId(subject), lane: laneOf(subject), stage, minutes: minutes(current.time, next.time) });
    }
  }
  const groups = new Map<string, Array<number>>();
  for (const dwell of dwells) {
    const key = `${dwell.lane}\u0000${dwell.stage}`;
    groups.set(key, [...(groups.get(key) ?? []), dwell.minutes]);
  }
  const byLaneStage: Array<StageStat> = [...groups.entries()].map(([key, values]) => {
    const [lane, stage] = key.split("\u0000") as [string, string];
    return { lane, stage, count: values.length, meanMin: values.reduce((sum, value) => sum + value, 0) / values.length, maxMin: Math.max(...values) };
  }).sort((a, b) => a.lane.localeCompare(b.lane) || a.stage.localeCompare(b.stage));

  const state = fold(events);
  const attempts: Array<{ id: string; attempts: number; causes: Array<string> }> = [];
  const causes = new Map<string, number>();
  const evidence = new Map<string, number>();
  for (const [subject, chunk] of state.chunks) {
    if (chunk.attempts.length > 1) attempts.push({ id: bareId(subject), attempts: chunk.attempts.length, causes: chunk.attempts.map((attempt) => attempt.cause) });
    for (const attempt of chunk.attempts) if (attempt.cause !== "initial") causes.set(attempt.cause, (causes.get(attempt.cause) ?? 0) + 1);
    if (chunk.stage === "merged" || chunk.stage === "dogfooded" || chunk.stage === "archived" || chunk.stage === "closed") {
      const value = chunk.evidence ?? "asserted";
      evidence.set(value, (evidence.get(value) ?? 0) + 1);
    }
  }
  const slowest = [...dwells].sort((a, b) => b.minutes - a.minutes).slice(0, 5).map(({ id, stage, minutes: value }) => ({ id, stage, minutes: value }));
  return { byLaneStage, attempts, causes, slowest, evidence };
};
