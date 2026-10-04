#!/usr/bin/env bun
/**
 * Knowledge-base site builder. Thin entry: the only file of the HTML view that touches the runtime.
 * The page is a VIEW over the same records the CLI reads (`data/*.jsonl`) plus the prose they cite.
 *
 *   bun kb-site/build.ts                     # build dist/index.html
 *   bun kb-site/build.ts --open              # build and open in the browser
 *   bun kb-site/build.ts --public --out f    # only publishable text; the rest as citation cards
 *
 * Exit codes: 0 ok, 1 validation errors in the store (page still written, with a banner) or I/O failure.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { CliError, Command } from "effect/unstable/cli";
import { join } from "node:path";
import { RuntimeLive } from "./runtime.ts";
import { VERSION } from "./src/commands.ts";
import { makeBuildCommand } from "./src/html/command.ts";

export const build = makeBuildCommand({
  dataDir: join(import.meta.dir, "data"),
  out: join(import.meta.dir, "dist", "index.html"),
});

if (import.meta.main) {
  Command.run(build, { version: VERSION }).pipe(
    Effect.tapError((e) => CliError.isCliError(e) ? Effect.void : Console.error(`error: ${String((e as { message?: unknown }).message ?? e)}`)),
    Effect.provide(Layer.merge(BunServices.layer, RuntimeLive)),
    BunRuntime.runMain({ disableErrorReporting: true }),
  );
}
