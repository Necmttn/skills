/**
 * The ONE policy for what may leave this machine and what a record path may read.
 * Used by the public HTML build, `publish`, `validate`, and `Roots` (so also `refs` and the local build).
 */
import { Data, Effect, FileSystem, Path } from "effect";
import type { Source } from "./schema.ts";

/** Private roots. Nothing under them is ever published, whatever a record claims. */
export const PRIVATE_ROOTS: ReadonlyArray<string> = ["wiki", "apps", "home-skills"];

/** The only `access` values whose text (or link) may be published. */
export const PUBLISHABLE_ACCESS: ReadonlyArray<string> = ["repo", "vendored", "public-url"];

/** `undefined` = may be published. Otherwise the first reason it may not, in words. */
export const whyNotPublishable = (s: Source): string | undefined => {
  if (PRIVATE_ROOTS.includes(s.root)) return `root "${s.root}" is private and is never copied`;
  if (s.access === "linked-only") return "access linked-only: the link is cited, the text is never copied";
  if (s.access === "vendored" && s.license === null) return "vendored without a license: the text may not be redistributed";
  if (!PUBLISHABLE_ACCESS.includes(s.access)) return `access ${s.access} is private`;
  if (!s.publishable) return "publishable is false";
  return undefined;
};

/** The publishable flag AND a non-private root AND an allowed access AND (vendored => a license). */
export const mayPublish = (s: Source): boolean => whyNotPublishable(s) === undefined;

/** `file` resolves (symlink or `..`) to a real path outside the real `rootDir`. */
export class EscapesRoot extends Data.TaggedError("EscapesRoot")<{ readonly rootDir: string; readonly file: string }> {
  override get message() {
    return `${this.file} resolves outside ${this.rootDir} (symlink or ".."); it is never read or copied`;
  }
}

/** The real path of `file`, or `EscapesRoot` when it is not inside the real `rootDir`. Both must exist. */
export const containedRealPath = Effect.fn("access.containedRealPath")(function* (rootDir: string, file: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const [root, real] = [yield* fs.realPath(rootDir), yield* fs.realPath(file)];
  const inside = real === root || real.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
  if (!inside) return yield* new EscapesRoot({ rootDir, file });
  return real;
});
