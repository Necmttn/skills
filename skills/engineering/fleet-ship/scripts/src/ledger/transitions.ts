/** The chunk state machine (spec section 7.1). Pure data and predicates. */

export const STAGES = [
  "assigned", "spawned", "planned", "building", "built", "in_review", "gated", "merged", "dogfooded", "archived", "closed",
] as const;
export const SIDE_STATES = ["blocked", "error"] as const;
export const ALL_STAGES: ReadonlySet<string> = new Set([...STAGES, ...SIDE_STATES]);

export const MERGED_OR_LATER: ReadonlySet<string> = new Set(["merged", "dogfooded", "archived", "closed"]);
/** Stages where a chunk occupies a pane and may collide on shared files. */
export const ACTIVE: ReadonlySet<string> = new Set(["spawned", "planned", "building", "built", "in_review", "gated", "blocked", "error"]);
export const RETURNS_TO_BUILDING: ReadonlySet<string> = new Set(["built", "in_review", "gated", "dogfooded"]);
export const EVIDENCE = ["verified", "reported", "asserted"] as const;
export const EVIDENCE_STAGES: ReadonlySet<string> = new Set(["built", "gated", "merged"]);

const TABLE: Readonly<Record<string, ReadonlyArray<string>>> = {
  "": ["assigned", "spawned"],
  assigned: ["spawned", "blocked", "error", "closed"],
  spawned: ["planned", "building", "blocked", "error"],
  planned: ["building", "blocked", "error"],
  building: ["built", "blocked", "error"],
  built: ["in_review", "building", "blocked", "error"],
  in_review: ["gated", "building", "blocked", "error"],
  gated: ["merged", "building", "blocked", "error"],
  merged: ["dogfooded", "archived"],
  dogfooded: ["archived", "building"],
  archived: ["closed"],
  closed: [],
};

export interface Position {
  readonly stage: string | null;
  /** The stage a blocked/error chunk left; null otherwise. */
  readonly interrupted: string | null;
}

const uniq = (xs: ReadonlyArray<string>) => [...new Set(xs)];

export const allowedTargets = (p: Position): ReadonlyArray<string> => {
  if (p.stage === "blocked") return uniq([...(p.interrupted ? [p.interrupted] : []), "building"]);
  if (p.stage === "error") return uniq([...(p.interrupted ? [p.interrupted] : []), "building", "closed"]);
  return TABLE[p.stage ?? ""] ?? [];
};

export const isAllowed = (p: Position, to: string): boolean => (p.stage !== null && to === p.stage) || allowedTargets(p).includes(to);

export type Cause = "initial" | "gate_failed" | "sent_back" | "followup";
const CAUSES: ReadonlySet<string> = new Set(["initial", "gate_failed", "sent_back", "followup"]);

/**
 * Why a new attempt starts. `from` is the effective stage being left (an interrupted stage when
 * leaving blocked/error), `prevData` the chunk's data before this event, `newData` this event's data.
 */
export const causeFor = (from: string | null, prevData: Record<string, unknown>, newData: Record<string, unknown>): Cause => {
  const explicit = newData.cause;
  if (typeof explicit === "string" && CAUSES.has(explicit)) return explicit as Cause;
  if (from === "dogfooded") return "followup";
  if ((from === "built" || from === "gated") && /FAIL/i.test(String(prevData.verdict ?? ""))) return "gate_failed";
  if (from === "built" || from === "in_review" || from === "gated") return "sent_back";
  return "initial";
};
