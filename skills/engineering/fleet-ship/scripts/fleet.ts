#!/usr/bin/env bun
/**
 * fleet - the fleet-ship ledger tooling.
 *
 *   bun fleet.ts log <ledger> <type> <subject|-> [key=value ...]
 *   bun fleet.ts state <ledger> [--live] [--session <name>] [--tail N]
 *   bun fleet.ts teardown <ledger> --epic <epic> [--session <name>] [--archive-dir <dir>] [--execute]
 *
 * Exit codes: 0 ok · 1 herdr/teardown failure (survivors, close failed) · 2 usage or invalid ledger.
 */
import { BunFileSystem, BunPath, BunServices } from "@effect/platform-bun";
import { Cause, Data, Effect, Exit, FileSystem, Layer, Option, Result } from "effect";
import { Argument, CliError, Command, Flag } from "effect/unstable/cli";
import { basename, extname } from "node:path";
import { hostname } from "node:os";
import { parseData } from "./src/cli/data.ts";
import { Herdr } from "./src/herdr/Herdr.ts";
import * as HerdrCli from "./src/herdr/HerdrCli.ts";
import { isFleetType, makeEvent } from "./src/ledger/Event.ts";
import { fold } from "./src/ledger/fold.ts";
import { Ledger, layer as ledgerLayer } from "./src/ledger/Ledger.ts";
import { render } from "./src/render/state.ts";
import { teardown } from "./src/teardown.ts";

class UsageError extends Data.TaggedError("UsageError")<{ readonly message: string }> {}

const defaultSource = (ledger: string) => `fleet/${basename(ledger, extname(ledger))}/${hostname().split(".")[0]}`;
const stderr = (line: string) => Effect.sync(() => void process.stderr.write(line + "\n"));
const stdout = (text: string) => Effect.sync(() => void process.stdout.write(text));

// ---- log --------------------------------------------------------------------------------
const logCommand = Command.make(
  "log",
  {
    ledger: Argument.string("ledger"),
    type: Argument.string("type"),
    subject: Argument.string("subject"),
    pairs: Argument.variadic(Argument.string("pair")),
  },
  ({ ledger, type, subject, pairs }) =>
    Effect.gen(function* () {
      if (!isFleetType(type)) return yield* new UsageError({ message: `type must be in the fleet.* namespace, lowercase dotted (got ${JSON.stringify(type)})` });
      const data = parseData(pairs);
      if (Result.isFailure(data)) return yield* new UsageError({ message: data.failure });
      const source = process.env.FLEET_SOURCE || defaultSource(ledger);
      const event = makeEvent({ type, subject: subject === "-" ? "" : subject, data: data.success, source });
      yield* Effect.gen(function* () {
        yield* (yield* Ledger).append(event);
      }).pipe(Effect.provide(ledgerLayer(ledger)));
    }),
).pipe(Command.withDescription("Append one fleet.* CloudEvents record to the JSONL ledger"));

// ---- state ------------------------------------------------------------------------------
const stateCommand = Command.make(
  "state",
  {
    ledger: Argument.string("ledger"),
    live: Flag.boolean("live").pipe(Flag.withDefault(false), Flag.withDescription("merge herdr agent list from the fleet session")),
    session: Flag.optional(Flag.string("session")),
    tail: Flag.integer("tail").pipe(Flag.withDefault(20)),
  },
  ({ ledger, live, session, tail }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      if (!(yield* fs.exists(ledger))) return yield* new UsageError({ message: `ledger does not exist: ${ledger}` });
      const { events, malformed } = yield* Effect.gen(function* () {
        return yield* (yield* Ledger).readAll;
      }).pipe(Effect.provide(ledgerLayer(ledger)));
      for (const m of malformed) yield* stderr(`fleet-state: line ${m.line} malformed (${m.reason}): ${m.raw.slice(0, 80)}`);
      const state = fold(events);
      if (!state.epic) state.epic = basename(ledger, extname(ledger));
      const sessionName = Option.getOrNull(session) ?? state.session;
      const agents = live
        ? yield* Effect.gen(function* () {
            return yield* (yield* Herdr).agents.list;
          }).pipe(
            Effect.provide(HerdrCli.layer(sessionName)),
            Effect.catchTag("HerdrCommandFailed", (e) => stderr(`fleet-state: herdr agent list failed: ${e.output}`).pipe(Effect.as([]))),
          )
        : undefined;
      yield* stdout(render({ state, events, malformed: malformed.length, tail, now: new Date(), live: agents }));
    }),
).pipe(Command.withDescription("Render the orchestrator's view: header, chunks, checklist, open items, live, action log"));

// ---- teardown ---------------------------------------------------------------------------
const teardownCommand = Command.make(
  "teardown",
  {
    ledger: Argument.string("ledger"),
    epic: Flag.string("epic"),
    session: Flag.optional(Flag.string("session")),
    archiveDir: Flag.string("archive-dir").pipe(Flag.withDefault("docs/superpowers/fleet-runs")),
    execute: Flag.boolean("execute").pipe(Flag.withDefault(false)),
  },
  ({ ledger, epic, session, archiveDir, execute }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      if (!(yield* fs.exists(ledger))) return yield* new UsageError({ message: `ledger does not exist: ${ledger}` });
      const sessionName = Option.getOrNull(session);
      const result = yield* teardown({ epic, session: sessionName, archiveDir, execute }).pipe(
        Effect.provide(ledgerLayer(ledger)),
        Effect.provide(HerdrCli.layer(sessionName)),
      );
      yield* stdout(result.output);
    }),
).pipe(Command.withDescription("Archive-then-close every resource the ledger minted, then stop the fleet session"));

// ---- root -------------------------------------------------------------------------------
const root = Command.make("fleet").pipe(
  Command.withDescription("fleet-ship ledger tooling: JSONL CloudEvents ledger, state view, teardown"),
  Command.withSubcommands([logCommand, stateCommand, teardownCommand]),
);

const isCliError = (error: unknown): boolean => CliError.isCliError(error);

const exitCodeFor = (error: unknown): number => {
  const tag = (error as { _tag?: string } | null)?._tag;
  return tag === "UsageError" || tag === "LedgerInvalid" || isCliError(error) ? 2 : 1;
};

const describe = (error: unknown): string => {
  const e = error as Record<string, unknown> & { _tag?: string };
  switch (e?._tag) {
    case "UsageError":
    case "LedgerInvalid":
      return `fleet: ${String(e.message)}`;
    case "SurvivorsRemain":
      return `fleet-teardown: survivors remain:\n${(e.survivors as ReadonlyArray<string>).join("\n")}`;
    case "CloseFailed":
      return `fleet-teardown: failed to close ${String(e.type)} ${String(e.id)}: ${String((e.cause as { output?: string })?.output)}`;
    case "HerdrCommandFailed":
      return `fleet: herdr ${(e.args as ReadonlyArray<string>).join(" ")} failed: ${String(e.output)}`;
    default:
      return `fleet: ${e?.message ? String(e.message) : String(error)}`;
  }
};

const program = Command.runWith(root, { version: "0.1.0" })(process.argv.slice(2)).pipe(
  Effect.provide(Layer.mergeAll(BunServices.layer, BunFileSystem.layer, BunPath.layer)),
) as Effect.Effect<void, unknown, never>;

const exit = await Effect.runPromiseExit(program);
if (Exit.isFailure(exit)) {
  const error = Cause.squash(exit.cause);
  // The cli runtime already rendered usage/help for its own errors; only describe ours.
  if (!isCliError(error)) process.stderr.write(describe(error) + "\n");
  process.exit(exitCodeFor(error));
}
