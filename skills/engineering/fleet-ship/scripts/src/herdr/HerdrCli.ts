/** `Herdr` over the `herdr` binary: every call is `herdr [--session <s>] <args>` via Bun.spawn. */
import { Effect, Layer } from "effect";
import { Herdr, HerdrCommandFailed, HerdrNotFound, type AgentInfo, type HerdrShape, type PaneInfo } from "./Herdr.ts";

interface Run {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const spawn = (args: ReadonlyArray<string>): Effect.Effect<Run> =>
  Effect.promise(async () => {
    const proc = Bun.spawn(["herdr", ...args], { stdout: "pipe", stderr: "pipe", stdin: "ignore", env: { ...process.env } });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  });

const errorCode = (stdout: string): string | null => {
  try {
    const doc = JSON.parse(stdout);
    return typeof doc?.error?.code === "string" ? doc.error.code : null;
  } catch {
    return null;
  }
};

export const layer = (session: string | null): Layer.Layer<Herdr> => {
  const prefix = session ? ["--session", session] : [];

  /** Run a herdr subcommand; a not-found envelope is HerdrNotFound, any other failure HerdrCommandFailed. */
  const run = (what: string, id: string, ...args: Array<string>) =>
    Effect.gen(function* () {
      const full = [...prefix, ...args];
      const result = yield* spawn(full);
      // herdr prints its error envelope on stderr (probed 2026-09-03); older builds used stdout.
      const code = errorCode(result.stdout) ?? errorCode(result.stderr);
      if (code && /not_found|not found/.test(code)) return yield* new HerdrNotFound({ what, id });
      if (result.exitCode !== 0 || code) {
        return yield* new HerdrCommandFailed({ args: full, exitCode: result.exitCode, output: (result.stdout + result.stderr).trim() });
      }
      return result.stdout;
    });

  const json = <A>(what: string, id: string, pick: (doc: any) => A, ...args: Array<string>) =>
    run(what, id, ...args).pipe(
      Effect.flatMap((stdout) =>
        Effect.try({
          try: () => pick(JSON.parse(stdout)),
          catch: () => new HerdrCommandFailed({ args: [...prefix, ...args], exitCode: 0, output: `unparsable: ${stdout.slice(0, 200)}` }),
        }),
      ),
    );

  const shape: HerdrShape = {
    session,
    agents: {
      list: json("agents", "*", (doc): ReadonlyArray<AgentInfo> => doc.result.agents, "agent", "list").pipe(
        Effect.catchTag("HerdrNotFound", (e) => new HerdrCommandFailed({ args: ["agent", "list"], exitCode: 1, output: String(e) })),
      ),
      read: (name, lines) =>
        run("agent", name, "agent", "read", name, "--source", "recent", "--lines", String(lines)).pipe(
          Effect.catchTag("HerdrNotFound", (e) => new HerdrCommandFailed({ args: ["agent", "read", name], exitCode: 1, output: String(e) })),
        ),
    },
    panes: {
      list: (workspace) => json("workspace", workspace, (doc): ReadonlyArray<PaneInfo> => doc.result.panes, "pane", "list", "--workspace", workspace),
      close: (paneId) => run("pane", paneId, "pane", "close", paneId).pipe(Effect.asVoid),
    },
    tabs: { close: (tabId) => run("tab", tabId, "tab", "close", tabId).pipe(Effect.asVoid) },
    workspaces: { close: (id) => run("workspace", id, "workspace", "close", id).pipe(Effect.asVoid) },
    sessions: {
      stop: (name) => run("session", name, "session", "stop", name).pipe(Effect.asVoid),
      delete: (name) => run("session", name, "session", "delete", name).pipe(Effect.asVoid),
    },
  };
  return Layer.succeed(Herdr, shape);
};
