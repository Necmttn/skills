/** Content roots (PLAN section 7): records hold `root` + relative `path`; this maps roots to local dirs. */
import { Config, Context, Effect, FileSystem, Layer, Option, Path } from "effect";
import { containedRealPath } from "./access.ts";
import type { RootName } from "./schema.ts";

export type RootStatus =
  | { readonly _tag: "available"; readonly root: string; readonly dir: string }
  | { readonly _tag: "unavailable"; readonly root: string; readonly reason: string }
  | { readonly _tag: "url"; readonly root: "url" };

export type Resolved =
  | { readonly _tag: "available"; readonly root: string; readonly path: string; readonly absolute: string }
  | { readonly _tag: "unavailable"; readonly root: string; readonly path: string; readonly reason: string }
  | { readonly _tag: "url"; readonly root: "url"; readonly url: string };

export const ROOTS_FILE = "kb.roots.json";
export const ROOTS_FILE_ENV = "KB_ROOTS_FILE";
export const rootEnvName = (root: string): string => `KB_ROOT_${root.toUpperCase().replaceAll("-", "_")}`;

/** `available`, `url`, or `unavailable here (...)` - the words `refs` and `show` print. */
export const describeResolved = (r: Resolved | RootStatus): string =>
  r._tag === "unavailable" ? `unavailable here (${r.reason})` : r._tag;

export class Roots extends Context.Service<
  Roots,
  {
    /** Where the root map is looked up (may not exist). */
    readonly rootsFile: string;
    readonly root: (root: RootName | string) => Effect.Effect<RootStatus>;
    /** Root + relative path -> absolute path when the file is present on this machine. */
    readonly resolve: (root: RootName | string, relPath: string) => Effect.Effect<Resolved>;
  }
>()("kb/Roots") {
  /**
   * `kb.roots.json` (next to the data dir, or the file `--roots` / `KB_ROOTS_FILE` names) or `KB_ROOT_<NAME>` maps ANY root, `kb` and `skills` included; a
   * relative value resolves against the roots file's directory. Unmapped: `kb` = the data dir's parent,
   * `skills` = `<kb>/../skills`, every other root is unavailable. A published bundle maps `kb` and `skills`
   * to its `content/` tree this way.
   */
  static readonly layer = (dataDir: string, rootsFileOverride?: string): Layer.Layer<Roots, never, FileSystem.FileSystem | Path.Path> =>
    Layer.effect(
      Roots,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const kbDir = path.dirname(path.resolve(dataDir));
        const env = (name: string) => Effect.map(Config.option(Config.string(name)).pipe(Effect.orElseSucceed(() => Option.none<string>())), Option.getOrUndefined);
        // `--roots <file>`, then KB_ROOTS_FILE, then next to the data dir: a `--data` copy elsewhere keeps its private-root map
        const named = rootsFileOverride ?? (yield* env(ROOTS_FILE_ENV));
        const rootsFile = named === undefined || named.trim() === "" ? path.join(kbDir, ROOTS_FILE) : path.resolve(named);
        const mapDir = path.dirname(rootsFile);
        const home = Option.getOrUndefined(yield* Config.option(Config.string("HOME")).pipe(Effect.orElseSucceed(() => Option.none<string>())));

        const fileMap: Record<string, unknown> = yield* fs.readFileString(rootsFile).pipe(
          Effect.map((text) => JSON.parse(text) as unknown),
          Effect.map((v) => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})),
          Effect.orElseSucceed(() => ({})),
        );

        const expand = (dir: string) =>
          path.resolve(mapDir, home !== undefined && (dir === "~" || dir.startsWith("~/")) ? path.join(home, dir.slice(1)) : dir);
        const exists = (p: string) => fs.exists(p).pipe(Effect.orElseSucceed(() => false));

        const root = Effect.fn("Roots.root")(function* (name: string) {
          if (name === "url") return { _tag: "url", root: "url" } as RootStatus;
          const unavailable = (reason: string): RootStatus => ({ _tag: "unavailable", root: name, reason });
          const fromEnv = Option.getOrUndefined(
            yield* Config.option(Config.string(rootEnvName(name))).pipe(Effect.orElseSucceed(() => Option.none<string>())),
          );
          const mapped = fromEnv ?? (typeof fileMap[name] === "string" ? (fileMap[name] as string) : undefined);
          const derived = name === "kb" ? kbDir : name === "skills" ? path.resolve(kbDir, "..", "skills") : undefined;
          const dir = mapped !== undefined ? expand(mapped) : derived;
          if (dir === undefined) {
            return unavailable(`private root "${name}"; map it in ${ROOTS_FILE} or ${rootEnvName(name)}; with --data elsewhere, name the roots file with --roots <file> or ${ROOTS_FILE_ENV}`);
          }
          if (!(yield* exists(dir))) return unavailable(`root "${name}" maps to ${dir}, which does not exist`);
          return { _tag: "available", root: name, dir } as RootStatus;
        });

        const resolve = Effect.fn("Roots.resolve")(function* (name: string, relPath: string) {
          const status = yield* root(name);
          if (status._tag === "url") return { _tag: "url", root: "url", url: relPath } as Resolved;
          if (status._tag === "unavailable") return { ...status, path: relPath } as Resolved;
          const absolute = path.resolve(status.dir, relPath);
          const inside = absolute === status.dir || absolute.startsWith(status.dir + path.sep);
          if (!inside) return { _tag: "unavailable", root: name, path: relPath, reason: `path leaves root "${name}"` } as Resolved;
          if (!(yield* exists(absolute))) {
            return { _tag: "unavailable", root: name, path: relPath, reason: `not found under root "${name}"` } as Resolved;
          }
          // the lexical check above does not see symlinks: compare real paths too
          const contained = yield* containedRealPath(status.dir, absolute).pipe(
            Effect.provideService(FileSystem.FileSystem, fs),
            Effect.provideService(Path.Path, path),
            Effect.as(true),
            Effect.orElseSucceed(() => false),
          );
          if (!contained) return { _tag: "unavailable", root: name, path: relPath, reason: `path leaves root "${name}" (symlink)` } as Resolved;
          return { _tag: "available", root: name, path: relPath, absolute } as Resolved;
        });

        return Roots.of({ rootsFile, root, resolve });
      }),
    );
}
