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
import { bundledWorkflowPath, epicPaths, isLedgerFile, slugOf } from "./src/cli/epic.ts";
import { emptyGraph, encodeGraph, holdOf, parseGraph } from "./src/graph/Graph.ts";
import { checkGraph, chunkById, formatFindings, hasErrors } from "./src/graph/check.ts";
import { Herdr } from "./src/herdr/Herdr.ts";
import * as HerdrCli from "./src/herdr/HerdrCli.ts";
import { isFleetType, makeEvent } from "./src/ledger/Event.ts";
import { bareId, fold } from "./src/ledger/fold.ts";
import { Ledger, layer as ledgerLayer, layerDir } from "./src/ledger/Ledger.ts";
import { allowedTargets, EVIDENCE, isAllowed } from "./src/ledger/transitions.ts";
import { render } from "./src/render/state.ts";
import { renderNext } from "./src/render/next.ts";
import { renderStatus } from "./src/render/status.ts";
import { joinRun } from "./src/run/Run.ts";
import { teardown } from "./src/teardown.ts";
import { DEFAULT_WORKFLOW, hasStep, parseWorkflow, stepsFor } from "./src/workflow/Workflow.ts";

class UsageError extends Data.TaggedError("UsageError")<{ readonly message: string }> {}
class GraphInvalid extends Data.TaggedError("GraphInvalid")<{ readonly message: string }> {}

const defaultSource = (ledger: string) => `fleet/${basename(ledger, extname(ledger))}/${hostname().split(".")[0]}`;
const stderr = (line: string) => Effect.sync(() => void process.stderr.write(line + "\n"));
const stdout = (text: string) => Effect.sync(() => void process.stdout.write(text));

/** graph.json of an epic dir, or null when absent. Invalid JSON is an error, not null. */
const loadGraph = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(path))) return null;
    const parsed = parseGraph(yield* fs.readFileString(path));
    if (Result.isFailure(parsed)) return yield* new GraphInvalid({ message: `${path}: ${parsed.failure}` });
    return parsed.success;
  });

const loadWorkflow = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = process.env.FLEET_WORKFLOW || bundledWorkflowPath();
  if (!(yield* fs.exists(path))) return DEFAULT_WORKFLOW;
  const parsed = parseWorkflow(yield* fs.readFileString(path));
  if (Result.isFailure(parsed)) return yield* new UsageError({ message: `${path}: ${parsed.failure}` });
  return parsed.success;
});

/** Ledger layer for either form: a single file or an epic directory. */
const ledgerLayerFor = (target: string) => (isLedgerFile(target) ? ledgerLayer(target) : layerDir(epicPaths(target, slugOf()).dir, slugOf()));

const readLedger = (target: string) =>
  Effect.gen(function* () {
    return yield* (yield* Ledger).readAll;
  }).pipe(Effect.provide(ledgerLayerFor(target)));

/** graph + folded ledger of an epic dir; UsageError when graph.json is missing. */
const loadRun = (dir: string) =>
  Effect.gen(function* () {
    const paths = epicPaths(dir, slugOf());
    const graph = yield* loadGraph(paths.graph);
    if (!graph) return yield* new UsageError({ message: `no graph.json in ${paths.dir} - run fleet init, then write the graph` });
    const { events, malformed } = yield* readLedger(dir);
    for (const item of malformed) yield* stderr(`fleet: ${item.file ?? paths.ledger} line ${item.line} malformed (${item.reason})`);
    const state = fold(events);
    if (!state.epic) state.epic = paths.epic;
    return { paths, graph, events, malformed, state, view: joinRun(graph, state) };
  });

// ---- log --------------------------------------------------------------------------------
const logCommand = Command.make(
  "log",
  {
    force: Flag.boolean("force").pipe(Flag.withDefault(false), Flag.withDescription("allow an illegal transition; requires reason=<text>")),
    adhoc: Flag.boolean("adhoc").pipe(Flag.withDefault(false), Flag.withDescription("allow a chunk id that is not in graph.json")),
    target: Argument.string("epic-dir-or-ledger"),
    type: Argument.string("type"),
    subject: Argument.string("subject"),
    pairs: Argument.variadic(Argument.string("pair")),
  },
  ({ force, adhoc, target, type, subject, pairs }) =>
    Effect.gen(function* () {
      if (!isFleetType(type)) return yield* new UsageError({ message: `type must be in the fleet.* namespace, lowercase dotted (got ${JSON.stringify(type)})` });
      const parsed = parseData(pairs);
      if (Result.isFailure(parsed)) return yield* new UsageError({ message: parsed.failure });
      const data: Record<string, unknown> = { ...parsed.success };
      const epicMode = !isLedgerFile(target);
      const paths = epicMode ? epicPaths(target, slugOf()) : null;

      if (epicMode && paths && type.startsWith("fleet.chunk.")) {
        const stage = type.slice("fleet.chunk.".length);
        const graph = yield* loadGraph(paths.graph);
        const workflow = yield* loadWorkflow;
        const { events } = yield* readLedger(target);
        const state = fold(events);
        const id = bareId(subject);
        const spec = graph ? chunkById(graph).get(id) : undefined;
        if (graph && !spec && !adhoc) return yield* new UsageError({ message: `chunk ${id} is not in ${paths.graph} (use --adhoc for a hotfix chunk)` });
        if (adhoc) data.adhoc = true;
        const current = state.chunks.get(subject) ?? null;
        const position = { stage: current?.stage ?? null, interrupted: current?.interrupted ?? null };
        if (graph && !isAllowed(position, stage)) {
          if (!force) return yield* new UsageError({ message: `illegal transition ${position.stage ?? "(none)"} -> ${stage} for ${subject}; allowed: ${allowedTargets(position).join(", ") || "none"} (or --force reason=...)` });
          if (typeof data.reason !== "string" || data.reason === "") return yield* new UsageError({ message: "--force needs reason=<text>" });
          data.forced = true;
        }
        if (typeof data.step === "string" && !hasStep(workflow, stage, data.step)) {
          return yield* new UsageError({ message: `unknown step ${data.step} for stage ${stage}; steps: ${stepsFor(workflow, stage).join(", ") || "none"}` });
        }
        if (data.evidence !== undefined && !(EVIDENCE as ReadonlyArray<unknown>).includes(data.evidence)) {
          return yield* new UsageError({ message: `evidence must be one of ${EVIDENCE.join(", ")} (got ${String(data.evidence)})` });
        }
        if (stage === "merged" && spec && holdOf(spec) === "human" && data.hold !== "approved" && current?.data.hold !== "approved") {
          return yield* new UsageError({ message: `${id} is held for the owner; log merged with hold=approved once approved` });
        }
      }

      const source = process.env.FLEET_SOURCE || (paths ? `fleet/${paths.epic}/${slugOf()}` : defaultSource(target));
      const event = makeEvent({ type, subject: subject === "-" ? "" : subject, data, source });
      yield* Effect.gen(function* () {
        yield* (yield* Ledger).append(event);
      }).pipe(Effect.provide(ledgerLayerFor(target)));
    }),
).pipe(Command.withDescription("Append one fleet.* CloudEvents record; in epic mode the chunk transition is checked"));

const graphCheckCommand = Command.make(
  "check",
  { dir: Argument.string("epic-dir") },
  ({ dir }) =>
    Effect.gen(function* () {
      const paths = epicPaths(dir, slugOf());
      const graph = yield* loadGraph(paths.graph);
      if (!graph) return yield* new UsageError({ message: `no graph.json in ${paths.dir}` });
      const findings = checkGraph(graph);
      if (findings.length) yield* stderr(formatFindings(findings));
      if (hasErrors(findings)) return yield* new GraphInvalid({ message: `${paths.graph}: ${findings.filter((f) => f.level === "error").length} error(s)` });
      yield* stdout(`graph ok: ${graph.chunks.length} chunks, ${findings.length} warning(s)\n`);
    }),
).pipe(Command.withDescription("Validate graph.json: cycles, dangling deps and conflicts, duplicate ids"));

const graphCommand = Command.make("graph").pipe(Command.withDescription("graph.json tooling"), Command.withSubcommands([graphCheckCommand]));

const KNOWHOW_SKELETON = `# Know-how\n\nCurated, per area. The librarian writes here; agents read it through \`fleet status\`.\n`;
const DECISIONS_SKELETON = (epic: string) => `# Decisions: ${epic}\n\nOne line per decision, newest last. Panes read this at start and before their gate.\n\n- (none yet)\n`;
const GIT_RECIPE = (home: string) =>
  `fleet home is not a git worktree yet. From the code repo checkout run:\n  git worktree add --orphan -b fleet ${home}\n  (git >= 2.42; then commit the files fleet init created)\n`;

const initCommand = Command.make(
  "init",
  {
    home: Argument.string("home"),
    epic: Argument.string("epic"),
    repo: Flag.string("repo"),
    plan: Flag.string("plan"),
    planSha: Flag.string("plan-sha").pipe(Flag.withDefault("")),
  },
  ({ home, epic, repo, plan, planSha }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const created: Array<string> = [];
      const ensureDir = (path: string) => fs.makeDirectory(path, { recursive: true });
      const ensureFile = (path: string, body: string) =>
        Effect.gen(function* () {
          if (yield* fs.exists(path)) return;
          yield* fs.writeFileString(path, body);
          created.push(path);
        });
      const paths = epicPaths(`${home}/${epic}`, slugOf());
      yield* ensureDir(`${home}/knowhow/inbox`);
      yield* ensureDir(`${home}/knowhow/archive`);
      yield* ensureDir(paths.dir);
      yield* ensureFile(`${home}/.gitignore`, ".dagr/\nmessages.jsonl\n");
      yield* ensureFile(`${home}/knowhow/KNOWHOW.md`, KNOWHOW_SKELETON);
      yield* ensureFile(paths.graph, encodeGraph(emptyGraph({ epic, repo, planPath: plan, planSha })));
      yield* ensureFile(paths.decisions, DECISIONS_SKELETON(epic));
      yield* stdout(created.length ? `created:\n${created.map((item) => `  ${item}`).join("\n")}\n` : "nothing to create\n");
      if (!(yield* fs.exists(`${home}/.git`))) yield* stdout(GIT_RECIPE(home));
    }),
).pipe(Command.withDescription("Create the fleet home layout for an epic: graph.json, DECISIONS.md, knowhow/"));

const nextCommand = Command.make("next", { dir: Argument.string("epic-dir") }, ({ dir }) =>
  Effect.gen(function* () {
    const run = yield* loadRun(dir);
    yield* stdout(renderNext(run.view, new Date()));
  }),
).pipe(Command.withDescription("Print the frontier: chunks the orchestrator may spawn now, and why the rest wait"));

const statusCommand = Command.make("status", { dir: Argument.string("epic-dir"), chunk: Argument.string("chunk") }, ({ dir, chunk }) =>
  Effect.gen(function* () {
    const run = yield* loadRun(dir);
    const workflow = yield* loadWorkflow;
    const result = renderStatus(run.view, chunk, new Date(), workflow);
    if (!result) return yield* new UsageError({ message: `chunk ${chunk} is not in ${run.paths.graph}` });
    yield* stdout(result);
  }),
).pipe(Command.withDescription("Print one chunk for the pane that owns it: stage, step, attempt, blockers, dependents, acceptance"));

// ---- state ------------------------------------------------------------------------------
const stateCommand = Command.make(
  "state",
  {
    ledger: Argument.string("epic-dir-or-ledger"),
    live: Flag.boolean("live").pipe(Flag.withDefault(false), Flag.withDescription("merge herdr agent list from the fleet session")),
    session: Flag.optional(Flag.string("session")),
    tail: Flag.integer("tail").pipe(Flag.withDefault(20)),
  },
  ({ ledger: target, live, session, tail }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      if (!(yield* fs.exists(target))) return yield* new UsageError({ message: `ledger or epic dir does not exist: ${target}` });
      const epicMode = !isLedgerFile(target);
      const paths = epicMode ? epicPaths(target, slugOf()) : null;
      const graph = paths ? yield* loadGraph(paths.graph) : null;
      const { events, malformed } = yield* readLedger(target);
      for (const item of malformed) yield* stderr(`fleet-state: ${item.file ? item.file + " " : ""}line ${item.line} malformed (${item.reason}): ${item.raw.slice(0, 80)}`);
      const state = fold(events);
      if (!state.epic) state.epic = paths ? paths.epic : basename(target, extname(target));
      const sessionName = Option.getOrNull(session) ?? state.session;
      const agents = live
        ? yield* Effect.gen(function* () {
            return yield* (yield* Herdr).agents.list;
          }).pipe(
            Effect.provide(HerdrCli.layer(sessionName)),
            Effect.catchTag("HerdrCommandFailed", (e) => stderr(`fleet-state: herdr agent list failed: ${e.output}`).pipe(Effect.as([]))),
          )
        : undefined;
      const run = graph ? joinRun(graph, state) : undefined;
      yield* stdout(render({ state, events, malformed: malformed.length, tail, now: new Date(), live: agents, run }));
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
  Command.withSubcommands([logCommand, stateCommand, teardownCommand, graphCommand, initCommand, nextCommand, statusCommand]),
);

const isCliError = (error: unknown): boolean => CliError.isCliError(error);

const exitCodeFor = (error: unknown): number => {
  const tag = (error as { _tag?: string } | null)?._tag;
  return tag === "UsageError" || tag === "LedgerInvalid" || tag === "GraphInvalid" || isCliError(error) ? 2 : 1;
};

const describe = (error: unknown): string => {
  const e = error as Record<string, unknown> & { _tag?: string };
  switch (e?._tag) {
    case "UsageError":
    case "LedgerInvalid":
    case "GraphInvalid":
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
