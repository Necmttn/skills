/** Git behind a service. Live layer: the real `git` binary through `ChildProcessSpawner`. */
import { Context, Effect, Layer, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

export interface GitResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Set by `sync` for every git call; the merge driver reads it to explain ours/theirs. */
export const SYNC_REBASE_ENV = "KB_SYNC_REBASE";

export class Git extends Context.Service<
  Git,
  {
    /** Runs `git <args>` in `cwd`. A nonzero exit is a value, not a failure: callers decide. */
    readonly run: (cwd: string, args: ReadonlyArray<string>) => Effect.Effect<GitResult>;
  }
>()("kb/Git") {
  static readonly layer: Layer.Layer<Git, never, ChildProcessSpawner.ChildProcessSpawner> = Layer.effect(
    Git,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const run = (cwd: string, args: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make("git", args, {
              cwd,
              extendEnv: true,
              // never prompt, never open an editor, stable English messages
              env: { GIT_TERMINAL_PROMPT: "0", GIT_EDITOR: "true", LC_ALL: "C", [SYNC_REBASE_ENV]: "1" },
            }),
          );
          const [stdout, stderr, exitCode] = yield* Effect.all(
            [
              handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
              handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
              handle.exitCode,
            ],
            { concurrency: "unbounded" },
          );
          return { exitCode: Number(exitCode), stdout, stderr };
        }).pipe(
          Effect.scoped,
          // git missing, cwd missing: report like a failed command so callers have one path
          Effect.catch((e) => Effect.succeed({ exitCode: 127, stdout: "", stderr: `cannot run git: ${String((e as { message?: unknown }).message ?? e)}` })),
        );
      return Git.of({ run });
    }),
  );

  /** Scripted git for unit tests: `respond` sees every call. */
  static readonly layerScripted = (respond: (args: ReadonlyArray<string>, cwd: string) => Partial<GitResult>): Layer.Layer<Git> =>
    Layer.succeed(Git, Git.of({ run: (cwd, args) => Effect.sync(() => ({ exitCode: 0, stdout: "", stderr: "", ...respond(args, cwd) })) }));
}
