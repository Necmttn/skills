/**
 * One fleet ledger record: a CloudEvents 1.0 envelope whose `type` lives in the `fleet.*`
 * namespace. The ledger is JSON Lines of these; jq, DuckDB and ax read it without a parser.
 */
import { Result, Schema } from "effect";

export const FleetType = Schema.TemplateLiteral(["fleet.", Schema.String]);

export const FleetEvent = Schema.Struct({
  specversion: Schema.Literal("1.0"),
  id: Schema.String,
  source: Schema.String,
  type: FleetType,
  time: Schema.String,
  subject: Schema.String,
  data: Schema.Record(Schema.String, Schema.Unknown),
});

export type FleetEvent = typeof FleetEvent.Type;
export type FleetData = FleetEvent["data"];

const decode = Schema.decodeUnknownResult(FleetEvent);

export interface MalformedLine {
  readonly line: number;
  readonly raw: string;
  readonly reason: string;
  /** Set when the ledger is read from an epic directory: the file the line came from. */
  readonly file?: string;
}

/** Parse one ledger line. Never throws: a bad line is a Failure with a human reason. */
export const parseLine = (raw: string, line = 0): Result.Result<FleetEvent, MalformedLine> => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return Result.fail({ line, raw, reason: `not JSON: ${String(error)}` });
  }
  const decoded = decode(json);
  if (Result.isFailure(decoded)) {
    return Result.fail({ line, raw, reason: `not a fleet event: ${String(decoded.failure)}` });
  }
  return Result.succeed(decoded.success);
};

export const isFleetType = (type: string): type is FleetEvent["type"] => /^fleet\.[a-z][a-z0-9._-]*$/.test(type);

const isoSeconds = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Mint a record: id and time are filled in here so no caller ever hand-writes them. */
export const makeEvent = (input: {
  readonly type: FleetEvent["type"];
  readonly subject: string;
  readonly data: FleetData;
  readonly source: string;
  readonly now?: Date;
}): FleetEvent => ({
  specversion: "1.0",
  id: crypto.randomUUID().replace(/-/g, ""),
  source: input.source,
  type: input.type,
  time: isoSeconds(input.now ?? new Date()),
  subject: input.subject,
  data: input.data,
});

export const encodeLine = (event: FleetEvent): string => JSON.stringify(event);
