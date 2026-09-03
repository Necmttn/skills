/** The append-only JSONL ledger as an Effect service over the platform FileSystem. */
import { Context, Effect, FileSystem, Layer, Result } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { dirname } from "node:path";
import { encodeLine, parseLine, type FleetEvent, type MalformedLine } from "./Event.ts";

export interface LedgerRead {
  readonly events: ReadonlyArray<FleetEvent>;
  readonly malformed: ReadonlyArray<MalformedLine>;
}

export class Ledger extends Context.Service<
  Ledger,
  {
    readonly path: string;
    readonly append: (event: FleetEvent) => Effect.Effect<void, PlatformError>;
    readonly readAll: Effect.Effect<LedgerRead, PlatformError>;
  }
>()("fleet/Ledger") {}

export const layer = (path: string): Layer.Layer<Ledger, never, FileSystem.FileSystem> =>
  Layer.effect(
    Ledger,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return {
        path,
        append: (event) =>
          Effect.gen(function* () {
            yield* fs.makeDirectory(dirname(path), { recursive: true });
            yield* fs.writeFileString(path, encodeLine(event) + "\n", { flag: "a" });
          }),
        readAll: Effect.gen(function* () {
          if (!(yield* fs.exists(path))) return { events: [], malformed: [] };
          const text = yield* fs.readFileString(path);
          const events: Array<FleetEvent> = [];
          const malformed: Array<MalformedLine> = [];
          text.split("\n").forEach((raw, index) => {
            if (raw.trim() === "") return;
            const parsed = parseLine(raw, index + 1);
            if (Result.isSuccess(parsed)) events.push(parsed.success);
            else malformed.push(parsed.failure);
          });
          return { events, malformed };
        }),
      };
    }),
  );
