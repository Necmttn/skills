import type { FleetData } from "./Event.ts";
import type { ChunkState } from "./fold.ts";
import { isAllowed } from "./transitions.ts";

export interface GateReceipt {
  readonly attempt: string;
  readonly commit: string;
  readonly checks: string;
}

const nonempty = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
export const isCommit = (v: unknown): v is string => typeof v === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(v);

/** A receipt attests only to the reviewed input, never the eventual squash commit. */
export const checkGate = (chunk: ChunkState | null, head: string): string | null => {
  if (!chunk?.gate || chunk.stage !== "gated") return "no current gate receipt; complete the review first";
  if (chunk.gate.attempt !== chunk.data.attempt_id) return "gate receipt belongs to another attempt";
  if (chunk.gate.commit !== head || chunk.data.commit !== head) return "gate commit differs from the current commit; repeat the affected review and checks";
  return null;
};

/** Used at write time and during replay. Untagged historical events retain their old semantics. */
export const eventError = (chunk: ChunkState | null, stage: string, data: FleetData): string | null => {
  const current = chunk?.data.attempt_id;
  const tagged = nonempty(current) || data.attempt_id !== undefined;
  if (!tagged) return null;
  if (chunk && chunk.stage !== "?" && !isAllowed(chunk, stage)) return `illegal attempt transition ${chunk.stage} -> ${stage}`;
  if (!nonempty(data.attempt_id)) return "attempt_id is required for this chunk";
  if (stage === "building") {
    const open = chunk?.attempts.at(-1);
    if (open && open.ended === null) {
      if (data.attempt_id !== current) return "an attempt is still active; record error before replacing it";
    } else if (chunk?.attempts.some((a) => a.id === data.attempt_id)) {
      return "attempt_id already ended; start a fresh attempt";
    }
    return null;
  }
  if (data.attempt_id !== current) return "stale attempt_id; reconcile the current attempt before accepting this result";
  if (stage === "built" && !isCommit(data.commit)) return "built requires the full commit SHA";
  if (stage === "gated") {
    if (data.verdict !== "PASS" || data.evidence !== "verified" || !nonempty(data.checks)) {
      return "gated requires verdict=PASS evidence=verified checks=<receipt-path>";
    }
    if (!isCommit(data.commit) || data.commit !== chunk?.data.commit) return "gate commit must match the built commit";
  }
  if (stage === "merged") {
    if (!isCommit(data.input_commit)) return "merged requires input_commit=<reviewed-head-sha>";
    return checkGate(chunk, data.input_commit);
  }
  return null;
};
