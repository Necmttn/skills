/** `key=value` pairs from the command line into an event's data object. */
import { Result } from "effect";
import type { FleetData } from "../ledger/Event.ts";

const coerce = (value: string): unknown => {
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export const parseData = (pairs: ReadonlyArray<string>): Result.Result<FleetData, string> => {
  const data: Record<string, unknown> = {};
  for (const pair of pairs) {
    const at = pair.indexOf("=");
    if (at < 0) return Result.fail(`data must be key=value (got ${JSON.stringify(pair)})`);
    data[pair.slice(0, at)] = coerce(pair.slice(at + 1));
  }
  return Result.succeed(data);
};
