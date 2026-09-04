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

export const ledgerFileName = (slug: string): string => `ledger.${slug}.jsonl`;
const LEDGER_FILE = /^ledger\.[A-Za-z0-9_-]+\.jsonl$/;

const parseText = (text: string, file?: string): LedgerRead => {
  const events: Array<FleetEvent> = [];
  const malformed: Array<MalformedLine> = [];
  text.split("\n").forEach((raw, index) => {
    if (raw.trim() === "") return;
    const parsed = parseLine(raw, index + 1);
    if (Result.isSuccess(parsed)) events.push(parsed.success);
    else malformed.push(file ? { ...parsed.failure, file } : parsed.failure);
  });
  return { events, malformed };
};

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
          return parseText(yield* fs.readFileString(path));
        }),
      };
    }),
  );

/**
 * The epic-directory ledger: this machine appends to `ledger.<slug>.jsonl`; reads merge every
 * `ledger.*.jsonl` in the directory, ordered by `time` then file name (stable for equal times).
 */
export const layerDir = (dir: string, slug: string): Layer.Layer<Ledger, never, FileSystem.FileSystem> =>
  Layer.effect(
    Ledger,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const own = `${dir}/${ledgerFileName(slug)}`;
      return {
        path: own,
        append: (event) =>
          Effect.gen(function* () {
            yield* fs.makeDirectory(dir, { recursive: true });
            yield* fs.writeFileString(own, encodeLine(event) + "\n", { flag: "a" });
          }),
        readAll: Effect.gen(function* () {
          if (!(yield* fs.exists(dir))) return { events: [], malformed: [] };
          const names = (yield* fs.readDirectory(dir)).filter((n) => LEDGER_FILE.test(n)).sort();
          const tagged: Array<{ event: FleetEvent; file: string; index: number }> = [];
          const malformed: Array<MalformedLine> = [];
          for (const name of names) {
            const read = parseText(yield* fs.readFileString(`${dir}/${name}`), name);
            read.events.forEach((event, index) => tagged.push({ event, file: name, index }));
            malformed.push(...read.malformed);
          }
          tagged.sort((a, b) => a.event.time.localeCompare(b.event.time) || a.file.localeCompare(b.file) || a.index - b.index);
          return { events: tagged.map((t) => t.event), malformed };
        }),
      };
    }),
  );
