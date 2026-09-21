/** A bare "remote" plus clones in a scoped temp dir, driven with the real `git` binary. */
import { assert } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestConsole } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { makeRoot } from "../../src/commands.ts";
import { encodeJsonl, type FileKind, kindForPath, parseJsonl } from "../../src/jsonl.ts";
import { publishCommand } from "../../src/publish/commands.ts";
import { syncCommands } from "../../src/sync/commands.ts";
import { Git } from "../../src/sync/git.ts";
import { baseFiles, lines, TestEnv, tracking } from "../helpers.ts";

export const CLI = new URL("../../cli.ts", import.meta.url).pathname;
export const root = makeRoot("/nonexistent/default/data", [...syncCommands, publishCommand]);
/** Every git call and every merge-driver run is a subprocess; a loaded machine needs room. */
export const LONG = 600_000;

export const seedFiles = (): Record<string, string> => ({
  ...(baseFiles() as Record<string, string>),
  "tracking/alpha.jsonl": lines([
    tracking({ requirement: "release.smoke", release: "1.0" }),
    tracking(),
  ]),
});

export interface Clone {
  readonly dir: string;
  readonly data: string;
  /** Run `git` here; fails the test on a nonzero exit. */
  readonly git: (...args: ReadonlyArray<string>) => Effect.Effect<string>;
  readonly tryGit: (...args: ReadonlyArray<string>) => Effect.Effect<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }>;
  /** Run the kb CLI in-process on this clone's data dir. */
  readonly kb: (...argv: ReadonlyArray<string>) => Effect.Effect<{ readonly ok: boolean; readonly stdout: string; readonly stderr: string; readonly error: unknown }, never, any>;
  readonly read: (rel: string) => Effect.Effect<string>;
  readonly write: (rel: string, text: string) => Effect.Effect<void>;
  /** Patch one record of a data file (by its human id) and rewrite the file canonically. */
  readonly edit: (rel: string, id: string, patch: Record<string, unknown>) => Effect.Effect<void>;
  readonly records: (rel: string) => Effect.Effect<ReadonlyArray<any>>;
}

export interface World {
  readonly tmp: string;
  readonly remote: string;
  readonly remoteHead: Effect.Effect<string>;
  /** A clone with the merge driver set. `approve: false` leaves the remote unapproved (default: approved through `approve-remote`). */
  readonly clone: (name: string, options?: { readonly approve?: boolean }) => Effect.Effect<Clone, never, any>;
  /** A plain directory handle (no clone): for repositories the test builds itself. */
  readonly at: (dir: string, dataRel?: string) => Clone;
  /** Local identity; no signing, hooks, or prompts inherited from the machine. */
  readonly isolate: (c: Clone, name: string) => Effect.Effect<void>;
}

const services = Effect.gen(function* () {
  return { fs: yield* FileSystem.FileSystem, path: yield* Path.Path, git: yield* Git };
});

export const withWorld = <A, E>(f: (world: World) => Effect.Effect<A, E, any>): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const { fs, path, git } = yield* services;
    const tmp = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "kb-sync-" }));
    let seenOut = 0;
    let seenErr = 0;

    const at = (dir: string, dataRel = "kb-site/data"): Clone => {
      const data = path.join(dir, ...dataRel.split("/"));
      const tryGit = (...args: ReadonlyArray<string>) => git.run(dir, args);
      const run = (...args: ReadonlyArray<string>) =>
        Effect.map(tryGit(...args), (r) => {
          assert.strictEqual(r.exitCode, 0, `git ${args.join(" ")} failed in ${dir}:\n${r.stdout}\n${r.stderr}`);
          return r.stdout.trim();
        });
      const read = (rel: string) => fs.readFileString(path.join(data, rel)).pipe(Effect.orDie);
      const write = (rel: string, text: string) =>
        Effect.gen(function* () {
          yield* fs.makeDirectory(path.dirname(path.join(data, rel)), { recursive: true });
          yield* fs.writeFileString(path.join(data, rel), text);
        }).pipe(Effect.orDie);
      const records = (rel: string) => Effect.map(read(rel), (text) => parseJsonl(kindForPath(rel)!, rel, text).records.map((r) => r.value));
      const edit = (rel: string, id: string, patch: Record<string, unknown>) =>
        Effect.gen(function* () {
          const kind = kindForPath(rel) as FileKind<any>;
          const all = yield* records(rel);
          assert.isTrue(all.some((r) => kind.id(r) === id), `${rel} has no record ${id}`);
          yield* write(rel, encodeJsonl(kind, all.map((r) => (kind.id(r) === id ? { ...r, ...patch } : r))));
        });
      const kb = (...argv: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const exit = yield* Effect.exit(Command.runWith(root, { version: "0.0.0" })(["--data", data, ...argv]));
          const out = (yield* TestConsole.logLines).map(String);
          const err = (yield* TestConsole.errorLines).map(String);
          const result = {
            ok: exit._tag === "Success",
            stdout: out.slice(seenOut).join("\n"),
            stderr: err.slice(seenErr).join("\n"),
            error: exit._tag === "Failure" ? exit.cause : undefined,
          };
          seenOut = out.length;
          seenErr = err.length;
          return result;
        });
      return { dir, data, git: run, tryGit, kb, read, write, edit, records };
    };

    /** Settings a test must not inherit from the machine: signing, hooks, a global driver. */
    const isolate = (c: Clone, name: string) =>
      Effect.gen(function* () {
        yield* c.git("config", "--local", "user.name", name);
        yield* c.git("config", "--local", "user.email", `${name}@example.com`);
        yield* c.git("config", "--local", "commit.gpgsign", "false");
        yield* c.git("config", "--local", "core.hooksPath", "/dev/null");
      }).pipe(Effect.asVoid);

    const remote = path.join(tmp, "remote.git");
    yield* fs.makeDirectory(remote);
    yield* at(remote).git("init", "--bare", "-b", "main");

    const seed = at(path.join(tmp, "seed"));
    yield* fs.makeDirectory(seed.dir);
    yield* seed.git("init", "-b", "main");
    yield* isolate(seed, "seed");
    for (const [rel, text] of Object.entries(seedFiles())) yield* seed.write(rel, text);
    yield* fs.writeFileString(path.join(seed.dir, ".gitattributes"), "kb-site/data/**/*.jsonl merge=kbjsonl\n");
    yield* fs.writeFileString(path.join(seed.dir, "README.md"), "seed\n");
    yield* seed.git("add", "-A");
    yield* seed.git("commit", "-m", "seed");
    yield* seed.git("remote", "add", "origin", remote);
    yield* seed.git("push", "-u", "origin", "main");

    const clone = (name: string, options: { readonly approve?: boolean } = {}) =>
      Effect.gen(function* () {
        const c = at(path.join(tmp, name));
        yield* at(tmp).git("clone", remote, name);
        yield* isolate(c, name);
        // what `install-merge-driver --cli <abs>` writes; the install command has its own test
        yield* c.git("config", "--local", "merge.kbjsonl.name", "kb record-level JSONL merge");
        yield* c.git("config", "--local", "merge.kbjsonl.driver", `bun ${CLI} merge-driver %O %A %B %P`);
        if (options.approve !== false) {
          // the test world's owner "verified" its bare remote; sync refuses an unapproved one
          const approved = yield* c.kb("approve-remote", "origin", "--i-verified-private");
          assert.isTrue(approved.ok, approved.stderr);
        }
        return c;
      });

    return yield* f({ tmp, remote, remoteHead: at(remote).git("rev-parse", "refs/heads/main"), clone, at, isolate });
  }).pipe(Effect.provide(Git.layer), Effect.scoped, Effect.provide(TestEnv)) as Effect.Effect<A, E>;
