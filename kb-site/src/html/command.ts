/**
 * The `build` command of the HTML view. Runtime-agnostic: `kb-site/build.ts` provides the platform services.
 *
 *   bun kb-site/build.ts [--open] [--public] [--out <file>] [--stamp <text>] [--data <dir>]
 *
 * Exit codes: 0 built; 1 built, but the record store has validation errors (the page shows a banner), or I/O failed.
 */
import { Config, Console, Data, Effect, FileSystem, Layer, Option, Path, Runtime } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { formatIssue } from "../issue.ts";
import { Roots } from "../roots.ts";
import { Store } from "../store.ts";
import { buildSite, type BuildResult } from "./site.ts";

/** The page was written, but the store has validation errors. */
export class InvalidStore extends Data.TaggedError("InvalidStore")<{ readonly errors: number }> {
  override readonly [Runtime.errorExitCode] = 1;
  override get message() {
    return `the record store has ${this.errors} validation error(s); the page was built with a banner. Run \`bun kb-site/cli.ts validate\``;
  }
}

export class BuildIo extends Data.TaggedError("BuildIo")<{ readonly file: string; readonly reason: string }> {
  override readonly [Runtime.errorExitCode] = 1;
  override get message() {
    return `${this.file}: ${this.reason}`;
  }
}

export interface BuildCommandDefaults {
  readonly dataDir: string;
  readonly out: string;
}

export interface WriteOptions {
  readonly dataDir: string;
  readonly out: string;
  readonly publicOnly: boolean;
  readonly stamp?: string | undefined;
  /** `--data` was not given: a missing directory gets the longer explanation. */
  readonly dataIsDefault?: boolean | undefined;
  /** Overrides the roots file location (`--roots`). */
  readonly rootsFile?: string | undefined;
}

/** Build from `dataDir` and write `out` (temp file + rename). Returns the build result; never fails on bad records. */
export const buildToFile = Effect.fn("html.buildToFile")(function* (options: WriteOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const result: BuildResult = yield* buildSite({ publicOnly: options.publicOnly, stamp: options.stamp }).pipe(
    Effect.provide(Layer.mergeAll(Store.layer(options.dataDir, { isDefault: options.dataIsDefault === true }), Roots.layer(options.dataDir, options.rootsFile))),
  );
  const out = path.resolve(options.out);
  const tmp = path.join(path.dirname(out), `.${path.basename(out)}.tmp`);
  yield* Effect.gen(function* () {
    yield* fs.makeDirectory(path.dirname(out), { recursive: true });
    yield* fs.writeFileString(tmp, result.html);
    yield* fs.rename(tmp, out);
  }).pipe(
    Effect.onError(() => fs.remove(tmp, { force: true }).pipe(Effect.ignore)),
    Effect.mapError((e) => new BuildIo({ file: out, reason: e.message })),
  );
  return { out, result };
});

export const summaryLines = (out: string, result: BuildResult, publicOnly: boolean): ReadonlyArray<string> => {
  const of = (kind: string) => result.docs.filter((d) => d.kind === kind);
  const cited = of("cited");
  return [
    `built ${out} (${publicOnly ? "public" : "local"}, ${new TextEncoder().encode(result.html).length} bytes)`,
    `records: ${result.counts.sources} sources, ${result.counts.requirements} requirements, ${result.counts.apps} apps, ${result.counts.tracking} tracking records, ${result.counts.conflicts} conflicts`,
    `docs: ${of("rendered").length} rendered, ${of("linked").length} linked only, ${cited.length} cited without text`,
    ...cited.map((d) => `  cited ${d.doc} (${d.source}): ${d.reason ?? ""}`),
    ...result.unmapped.map((u) => `  no source record: ${u}`),
    `validation: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
  ];
};

export const makeBuildCommand = (defaults: BuildCommandDefaults) =>
  Command.make(
    "kb-build",
    {
      open: Flag.boolean("open").pipe(Flag.withDefault(false), Flag.withDescription("Open the page in the browser after the build")),
      publicOnly: Flag.boolean("public").pipe(
        Flag.withDefault(false),
        Flag.withDescription("Show text only for sources with publishable: true; every other source becomes a citation card"),
      ),
      out: Flag.string("out").pipe(Flag.optional, Flag.withDescription("Output file (default: kb-site/dist/index.html)")),
      stamp: Flag.string("stamp").pipe(
        Flag.optional,
        Flag.withDescription("Fixed text for the 'Generated' footer (or env KB_BUILD_STAMP); makes the output byte-identical"),
      ),
      data: Flag.string("data").pipe(Flag.optional, Flag.withDescription("Data directory (default: kb-site/data)")),
      roots: Flag.string("roots").pipe(Flag.optional, Flag.withDescription("Roots file (default: $KB_ROOTS_FILE, else kb.roots.json next to the data dir)")),
    },
    Effect.fn("html.build")(function* ({ open, publicOnly, out, stamp, data, roots }) {
      const envStamp = yield* Config.option(Config.string("KB_BUILD_STAMP")).pipe(Effect.orElseSucceed(() => Option.none<string>()));
      const built = yield* buildToFile({
        dataDir: Option.getOrElse(data, () => defaults.dataDir),
        out: Option.getOrElse(out, () => defaults.out),
        publicOnly,
        stamp: Option.getOrUndefined(Option.orElse(stamp, () => envStamp)),
        rootsFile: Option.getOrUndefined(roots),
        dataIsDefault: Option.isNone(data),
      });
      for (const line of summaryLines(built.out, built.result, publicOnly)) yield* Console.log(line);
      for (const e of built.result.errors) yield* Console.error(formatIssue(e));
      if (open) {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        yield* spawner.exitCode(ChildProcess.make("open", [built.out])).pipe(
          Effect.catch(() => Console.error(`could not open ${built.out}; open it by hand`)),
        );
      }
      if (built.result.errors.length > 0) return yield* new InvalidStore({ errors: built.result.errors.length });
    }),
  ).pipe(Command.withDescription("Build the self-contained knowledge browser (records + prose) into one HTML file"));
