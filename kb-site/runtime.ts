/**
 * Runtime glue shared by the two thin entries (`cli.ts`, `build.ts`). Not part of the runtime-agnostic core.
 *
 * Bun 1.3: once `process.stdout` has been read (BunServices' Terminal layer reads it), `console.log` drops
 * everything beyond the 64 KiB pipe buffer when the reader is slow (`kb checklist --json | jq`).
 * Stream writes queue correctly, so the console goes through the streams.
 */
import { Console, DateTime, Layer } from "effect";
import { format } from "node:util";
import { dateInZone, Today } from "./src/today.ts";

const out = (...args: ReadonlyArray<unknown>) => void process.stdout.write(format(...args) + "\n");
const err = (...args: ReadonlyArray<unknown>) => void process.stderr.write(format(...args) + "\n");

const streamConsole: Console.Console = {
  ...globalThis.console,
  log: out,
  info: out,
  debug: out,
  error: err,
  warn: err,
  trace: err,
} as Console.Console;

export const ConsoleLive = Layer.succeed(Console.Console, streamConsole);

/** Date-only stamps (evidence `date`, `revised_at`) use this machine's calendar date, not the UTC date. */
export const TodayLocal = Layer.succeed(Today, dateInZone(DateTime.zoneMakeLocal()));

/** Everything the two entries add on top of `BunServices.layer`. */
export const RuntimeLive = Layer.merge(ConsoleLive, TodayLocal);
