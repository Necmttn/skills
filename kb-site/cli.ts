#!/usr/bin/env bun
/**
 * kb - app knowledge base CLI. Thin entry: the only file that touches the runtime.
 *
 *   bun kb-site/cli.ts [--data <dir>] <command> [--json]
 *
 * Exit codes: 0 ok, 1 validation or user error.
 */
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { CliError, Command } from "effect/unstable/cli";
import { join } from "node:path";
import { RuntimeLive } from "./runtime.ts";
import { makeRoot, VERSION } from "./src/commands.ts";
import { publishCommand } from "./src/publish/commands.ts";
import { syncCommands } from "./src/sync/commands.ts";

export const root = makeRoot(join(import.meta.dir, "data"), [...syncCommands, publishCommand]);

if (import.meta.main) {
  Command.run(root, { version: VERSION }).pipe(
    // Handlers print their own problems (`Reported`); the cli module renders its own usage errors.
    Effect.tapError((e) =>
      CliError.isCliError(e) || (e as { _tag?: string })._tag === "Reported"
        ? Effect.void
        : Console.error(`error: ${String((e as { message?: unknown }).message ?? e)}`)
    ),
    Effect.provide(Layer.merge(BunServices.layer, RuntimeLive)),
    BunRuntime.runMain({ disableErrorReporting: true }),
  );
}
