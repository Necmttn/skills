/**
 * `kb publish --out <dir>`: build a bundle a collaborator may receive. It publishes NOTHING: no
 * network, no git. The owner decides where the bundle goes.
 *
 * Copied: the records, the tool (src, cli, package files), CONTRIBUTING + PLAN, and the text of sources
 * that pass `decideSource`. Generated: the bundle's own README.md, kb.roots.json, .gitignore.
 * Everything else is listed in MANIFEST.json with the reason.
 */
import { Crypto, Data, Effect, FileSystem, Path } from "effect";
import { containedRealPath, mayPublish, PRIVATE_ROOTS, whyNotPublishable } from "../access.ts";
import { errorsOf, formatIssue } from "../issue.ts";
import { Roots, ROOTS_FILE } from "../roots.ts";
import type { Source } from "../schema.ts";
import { Store } from "../store.ts";
import { Git } from "../sync/git.ts";
import { type Finding, scanText } from "./scan.ts";

export const MANIFEST = "MANIFEST.json";

/** Private roots (the shared policy in `access.ts`). Nothing under them is ever copied, whatever a record claims. */
export const FORBIDDEN_ROOTS = PRIVATE_ROOTS;

/**
 * Source text sits under `content/<root>/<path>`, but records keep `root: "kb"` / `"skills"`. The bundle
 * carries its own root map so `refs` and `build.ts` find the text. Same relation as in the repository:
 * the file sits next to `data/`. The repository's own `kb.roots.json` is machine-specific and never copied.
 */
export const BUNDLE_ROOTS: Readonly<Record<string, string>> = { kb: "content/kb", skills: "content/skills" };
/** In the repository `kb.roots.json` is gitignored; in a bundle it is content, so the bundle's ignore file leaves it out. */
export const BUNDLE_GITIGNORE = "node_modules/\ndist/\ndata/.kb.lock*\n";

/** Tool files copied when present (kb-dir relative). Directories are copied recursively. */
export const TOOL_PATHS: ReadonlyArray<string> = [
  "src",
  "cli.ts",
  "build.ts",
  "runtime.ts",
  "package.json",
  "bun.lock",
  "tsconfig.json",
  "vitest.config.ts",
  "kb.roots.example.json",
  "docs/CONTRIBUTING.md",
  "docs/PLAN.md",
];

export const BUNDLE_README = "README.md";
/** Left out on purpose; the bundle README says why. */
export const LEFT_OUT: ReadonlyArray<readonly [what: string, why: string]> = [
  ["`docs/MIGRATION.md`, `inventory/`", "they describe how private sources were read"],
  ["`test/`", "the bundle is for reading and tracking, not for tool development"],
  ["the repository `README.md`", "its links point at files outside the bundle; this file replaces it"],
  ["the repository `kb.roots.json`", "it holds machine paths; the bundle has its own"],
];

/** The bundle's own README. Links only to files that are in the bundle (`has`). Deterministic. */
export const bundleReadme = (has: (rel: string) => boolean, counts: { readonly copied: number; readonly linked: number; readonly excluded: number }): string => {
  const link = (rel: string) => (has(rel) ? `[${rel}](./${rel})` : `\`${rel}\` (not in this bundle)`);
  return [
    "# App knowledge bundle",
    "",
    "Prepared on one machine by `kb publish`. Nothing was uploaded. This directory is self-contained: records, the tool that reads them, and the source text that may be shared.",
    "",
    "**Handle as private.** The records in `data/` paraphrase private rules closely and cite them by id. Share this bundle only with people the owner trusts. Do not put it in a public repository or on a public host.",
    "",
    "## Run it",
    "",
    "```sh",
    "bun install",
    "bun cli.ts --help",
    "bun cli.ts validate",
    "bun cli.ts apps",
    "bun build.ts            # writes dist/index.html, one self-contained page",
    "```",
    "",
    `The documents say \`bun kb-site/cli.ts\`; in this bundle the same tool is \`bun cli.ts\`.`,
    "",
    "## What is here",
    "",
    `- ${link(MANIFEST)}: every file with its sha256, every source (copied, linked, excluded with the reason), and every scan finding. Read it first.`,
    "- `data/`: the records (sources, requirements, apps, conflicts, per-app tracking).",
    "- `src/`, `cli.ts`, `build.ts`, `runtime.ts`, package files: the tool.",
    `- ${link("docs/CONTRIBUTING.md")}: how to read, track, validate, and sync.`,
    `- ${link("docs/PLAN.md")}: the record contract and the rules.`,
    `- \`content/<root>/<path>\`: the text of ${counts.copied} source(s) that may be shared. ${link(ROOTS_FILE)} maps the roots \`kb\` and \`skills\` to it, so \`bun cli.ts refs\` and \`bun build.ts\` find the text.`,
    "",
    "## Excluded, and why",
    "",
    `${counts.excluded} source(s) are cited by the records but their text is NOT here; ${counts.linked} more are web links. \`sources.excluded\` in ${MANIFEST} gives the reason for each one:`,
    "",
    "- a source in a private root (`apps`, `wiki`, `home-skills`) is never copied, whatever its record says;",
    "- a `linked-only` source stays a link; a `vendored` source without a license may not be redistributed;",
    "- a source with `publishable: false`, or one that is not on the machine that made the bundle.",
    "",
    "For such a source you see the citation (title, locator, upstream rule id), not the text.",
    "",
    "Also left out:",
    "",
    ...LEFT_OUT.map(([what, why]) => `- ${what}: ${why}.`),
    "",
  ].join("\n");
};

/** Next to a vendored pack: the license text must travel with the copy. */
const LICENSE_FILE = /^(LICEN[CS]E|NOTICE|COPYING|UPSTREAM)([.-].*)?$/i;

// ---- decision (pure) ----------------------------------------------------------------------
export type Decision =
  | { readonly action: "copy" }
  | { readonly action: "link"; readonly url: string }
  | { readonly action: "exclude"; readonly reason: string; readonly error?: string; readonly warning?: string };

export const decideSource = (s: Source): Decision => {
  const reason = whyNotPublishable(s);
  if (reason !== undefined) {
    if (!s.publishable) return { action: "exclude", reason };
    return FORBIDDEN_ROOTS.includes(s.root)
      ? { action: "exclude", reason, error: `source "${s.id}" is marked publishable but lives in private root "${s.root}"; set publishable to false` }
      : { action: "exclude", reason, warning: `source "${s.id}" is marked publishable, but ${reason}; the flag was ignored` };
  }
  if (s.root === "kb" && s.path === BUNDLE_README) return { action: "exclude", reason: "the bundle has its own README.md; the repository README links to files outside the bundle" };
  if (s.access === "public-url" || s.root === "url") return { action: "link", url: s.path };
  return { action: "copy" }; // access repo, or vendored with a license
};

// ---- model --------------------------------------------------------------------------------
export interface ManifestFile {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  /** Set for source text. */
  readonly source?: string;
}

export interface Manifest {
  readonly ok: boolean;
  readonly format: 1;
  readonly note: string;
  readonly counts: {
    readonly files: number;
    readonly bytes: number;
    readonly sources_total: number;
    readonly sources_copied: number;
    readonly sources_linked: number;
    readonly sources_excluded: number;
    readonly errors: number;
    readonly warnings: number;
  };
  readonly files: ReadonlyArray<ManifestFile>;
  readonly sources: {
    readonly copied: ReadonlyArray<{ readonly id: string; readonly path: string; readonly license: string | null }>;
    readonly linked: ReadonlyArray<{ readonly id: string; readonly url: string }>;
    readonly excluded: ReadonlyArray<{ readonly id: string; readonly root: string; readonly access: string; readonly reason: string }>;
  };
  readonly errors: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  /** Scan findings: file + line + pattern name. Never the matched text. */
  readonly findings: ReadonlyArray<Finding>;
}

/** The bundle was not started. Nothing was written. */
export class PublishRefused extends Data.TaggedError("PublishRefused")<{ readonly message: string }> {}

export interface PublishOptions {
  readonly out: string;
  readonly force: boolean;
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const SKIP_NAME = /^(\.|node_modules$)|\.tmp$/;

export const publish = (options: PublishOptions) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const crypto = yield* Crypto.Crypto;
    const store = yield* Store;
    const roots = yield* Roots;
    const git = yield* Git;
    const refuse = (message: string) => Effect.fail(new PublishRefused({ message }));
    const exists = (p: string) => fs.exists(p).pipe(Effect.orElseSucceed(() => false));
    const isDir = (p: string) => fs.stat(p).pipe(Effect.map((i) => i.type === "Directory"), Effect.orElseSucceed(() => false));
    const inside = (parent: string, child: string) => child === parent || child.startsWith(parent.endsWith(path.sep) ? parent : parent + path.sep);

    /** Real path of a path that may not exist yet: resolve the nearest existing ancestor. */
    const realish = (p: string): Effect.Effect<string> =>
      Effect.gen(function* () {
        let head = path.resolve(p);
        const rest: Array<string> = [];
        while (!(yield* exists(head)) && path.dirname(head) !== head) {
          rest.unshift(path.basename(head));
          head = path.dirname(head);
        }
        return path.join(yield* fs.realPath(head).pipe(Effect.orElseSucceed(() => head)), ...rest);
      });

    const dataDir = path.resolve(store.dataDir);
    const kbDir = path.dirname(dataDir);
    const out = yield* realish(options.out);

    // ---- guards on --out ---------------------------------------------------------------
    const top = yield* git.run(kbDir, ["rev-parse", "--show-toplevel"]);
    const protectedTrees = [yield* realish(kbDir), yield* realish(dataDir), ...(top.exitCode === 0 ? [yield* realish(top.stdout.trim())] : [])];
    for (const tree of protectedTrees) {
      if (inside(tree, out)) return yield* refuse(`--out ${out} is inside ${tree}; a bundle inside the repository could be committed by mistake. Choose a directory outside it`);
      if (inside(out, tree)) return yield* refuse(`--out ${out} contains ${tree}; choose an empty directory outside the repository`);
    }
    if (yield* exists(out)) {
      if (!(yield* isDir(out))) return yield* refuse(`--out ${out} is a file; give a directory`);
      const entries = yield* fs.readDirectory(out).pipe(Effect.orElseSucceed(() => [] as Array<string>));
      if (entries.length > 0) {
        if (!options.force) return yield* refuse(`--out ${out} is not empty; choose an empty directory (or --force to replace a previous bundle)`);
        const previous = yield* fs.readFileString(path.join(out, MANIFEST)).pipe(
          Effect.map((t) => JSON.parse(t) as { readonly files?: ReadonlyArray<{ readonly path?: unknown }> }),
          Effect.orElseSucceed(() => undefined),
        );
        if (previous === undefined || !Array.isArray(previous.files)) {
          return yield* refuse(`--out ${out} is not empty and holds no ${MANIFEST}; --force only replaces a previous bundle`);
        }
        // remove only what the previous bundle listed; anything else in the directory stays
        for (const f of previous.files) {
          if (typeof f.path !== "string") continue;
          const target = path.resolve(out, f.path);
          if (inside(out, target) && target !== out) yield* fs.remove(target, { force: true }).pipe(Effect.ignore);
        }
        yield* fs.remove(path.join(out, MANIFEST), { force: true }).pipe(Effect.ignore);
      }
    }

    // ---- the store must be valid -------------------------------------------------------
    const loaded = yield* store.load.pipe(Effect.mapError((e) => new PublishRefused({ message: e.message })));
    const invalid = errorsOf(loaded.issues);
    if (invalid.length > 0) {
      return yield* refuse(["the store is invalid; fix it before a bundle is made:", ...invalid.slice(0, 10).map((i) => `  ${formatIssue(i)}`)].join("\n"));
    }

    // ---- plan --------------------------------------------------------------------------
    interface Item { readonly to: string; readonly from?: string; readonly text?: string; readonly source?: string }
    /** `true` when `from` really lives inside `rootDir`. A symlink that leaves it is reported and never copied. */
    const stays = (rootDir: string, from: string, to: string) =>
      containedRealPath(rootDir, from).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.as(true),
        Effect.catch((e) => {
          warnings.push(`${to}: ${e._tag === "EscapesRoot" ? "symlink leaves its permitted directory" : "cannot be resolved (broken link?)"}; not copied`);
          return Effect.succeed(false);
        }),
      );
    const items = new Map<string, Item>();
    const errors: Array<string> = [];
    const warnings: Array<string> = [];
    const walk = (rootDir: string, dir: string, to: string, keep: (name: string) => boolean): Effect.Effect<void> =>
      Effect.gen(function* () {
        const names = (yield* fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => [] as Array<string>))).sort();
        for (const name of names) {
          if (SKIP_NAME.test(name)) continue;
          const from = path.join(dir, name);
          const directory = yield* isDir(from);
          if (!directory && !keep(name)) continue;
          if (!(yield* stays(rootDir, from, `${to}/${name}`))) continue;
          if (directory) yield* walk(rootDir, from, `${to}/${name}`, keep);
          else if (keep(name)) items.set(`${to}/${name}`, { to: `${to}/${name}`, from });
        }
      });

    yield* walk(dataDir, dataDir, "data", (n) => n.endsWith(".jsonl"));
    for (const rel of TOOL_PATHS) {
      const from = path.join(kbDir, ...rel.split("/"));
      if (!(yield* exists(from)) || !(yield* stays(kbDir, from, rel))) continue;
      if (yield* isDir(from)) yield* walk(kbDir, from, rel, () => true);
      else items.set(rel, { to: rel, from });
    }
    items.set(ROOTS_FILE, { to: ROOTS_FILE, text: JSON.stringify(BUNDLE_ROOTS, null, 2) + "\n" });
    items.set(".gitignore", { to: ".gitignore", text: BUNDLE_GITIGNORE });

    const copied: Array<{ id: string; path: string; license: string | null }> = [];
    const linked: Array<{ id: string; url: string }> = [];
    const excluded: Array<{ id: string; root: string; access: string; reason: string }> = [];
    const seenCompanions = new Set<string>();
    const exclude = (s: Source, reason: string) => excluded.push({ id: s.id, root: s.root, access: s.access, reason });

    for (const s of loaded.data.sources) {
      const decision = decideSource(s);
      if (decision.action === "link") {
        linked.push({ id: s.id, url: decision.url });
        continue;
      }
      if (decision.action === "exclude") {
        exclude(s, decision.reason);
        if (decision.error) errors.push(decision.error);
        if (decision.warning) warnings.push(decision.warning);
        continue;
      }
      // second guard at the copy seam: a change to decideSource must not open a private root
      if (!mayPublish(s)) {
        exclude(s, whyNotPublishable(s) ?? "not publishable");
        errors.push(`source "${s.id}": refused to copy (${whyNotPublishable(s)})`);
        continue;
      }
      const resolved = yield* roots.resolve(s.root, s.path);
      if (resolved._tag !== "available") {
        exclude(s, resolved._tag === "url" ? "a URL is cited, not copied" : `not available on this machine: ${resolved.reason}`);
        continue;
      }
      if (yield* isDir(resolved.absolute)) {
        exclude(s, "the path is a directory; only single files are copied");
        continue;
      }
      // Roots.resolve already refuses a path that leaves its root; this is the guard at the copy seam
      const status = yield* roots.root(s.root);
      const contained = status._tag === "available" && (yield* containedRealPath(status.dir, resolved.absolute).pipe(Effect.as(true), Effect.orElseSucceed(() => false)));
      if (status._tag !== "available" || !contained) {
        exclude(s, `the file resolves outside root "${s.root}" (symlink); not copied`);
        continue;
      }
      const to = `content/${s.root}/${s.path.replaceAll("\\", "/")}`;
      items.set(to, { to, from: resolved.absolute, source: s.id });
      copied.push({ id: s.id, path: to, license: s.license });

      const pack = /^external\/[^/]+(?=\/)/.exec(s.path)?.[0];
      if (s.access === "vendored" && pack !== undefined) {
        const packDir = path.join(status.dir, ...pack.split("/"));
        for (const name of (yield* fs.readDirectory(packDir).pipe(Effect.orElseSucceed(() => [] as Array<string>))).sort()) {
          const licenseTo = `content/${s.root}/${pack}/${name}`;
          if (!LICENSE_FILE.test(name) || items.has(licenseTo) || seenCompanions.has(licenseTo)) continue;
          seenCompanions.add(licenseTo);
          if (yield* stays(status.dir, path.join(packDir, name), licenseTo)) items.set(licenseTo, { to: licenseTo, from: path.join(packDir, name) });
        }
      }
    }

    items.set(BUNDLE_README, {
      to: BUNDLE_README,
      text: bundleReadme((rel) => rel === MANIFEST || items.has(rel), { copied: copied.length, linked: linked.length, excluded: excluded.length }),
    });

    // ---- copy + hash + scan ------------------------------------------------------------
    yield* fs.makeDirectory(out, { recursive: true }).pipe(Effect.mapError((e) => new PublishRefused({ message: `cannot create ${out}: ${e.message}` })));
    const files: Array<ManifestFile> = [];
    const findings: Array<Finding> = [];
    const decoder = new TextDecoder("utf-8", { fatal: false });
    for (const item of [...items.values()].sort((a, b) => cmp(a.to, b.to))) {
      const target = path.join(out, ...item.to.split("/"));
      const written = yield* Effect.gen(function* () {
        const bytes = item.from === undefined ? new TextEncoder().encode(item.text ?? "") : yield* fs.readFile(item.from);
        yield* fs.makeDirectory(path.dirname(target), { recursive: true });
        yield* fs.writeFile(target, bytes);
        return { bytes, sha256: hex(yield* crypto.digest("SHA-256", bytes)) };
      }).pipe(Effect.result);
      if (written._tag === "Failure") {
        errors.push(`${item.to}: copy failed: ${written.failure.message}`);
        continue;
      }
      files.push({ path: item.to, sha256: written.success.sha256, bytes: written.success.bytes.length, ...(item.source ? { source: item.source } : {}) });
      findings.push(...scanText(item.to, decoder.decode(written.success.bytes)));
    }

    const secretHits = findings.filter((f) => f.severity === "error");
    if (secretHits.length > 0) errors.push(`secret scan: ${secretHits.length} finding(s); the bundle must not leave this machine until each one is removed at its source`);
    const sortedExcluded = excluded.sort((a, b) => cmp(a.id, b.id));
    const manifest: Manifest = {
      ok: errors.length === 0,
      format: 1,
      note: "Prepared locally by `kb publish`. Nothing was uploaded. Sources under `excluded` are cited by the records but their text is not in this bundle.",
      counts: {
        files: files.length,
        bytes: files.reduce((n, f) => n + f.bytes, 0),
        sources_total: loaded.data.sources.length,
        sources_copied: copied.length,
        sources_linked: linked.length,
        sources_excluded: sortedExcluded.length,
        errors: errors.length,
        warnings: warnings.length + findings.filter((f) => f.severity === "warning").length,
      },
      files,
      sources: { copied: copied.sort((a, b) => cmp(a.id, b.id)), linked: linked.sort((a, b) => cmp(a.id, b.id)), excluded: sortedExcluded },
      errors,
      warnings,
      findings,
    };
    yield* fs.writeFileString(path.join(out, MANIFEST), JSON.stringify(manifest, null, 2) + "\n").pipe(
      Effect.mapError((e) => new PublishRefused({ message: `cannot write ${MANIFEST}: ${e.message}` })),
    );
    return { out, manifest };
  });

/** Human summary. Findings show file + line + pattern name only. */
export const renderPublish = (out: string, m: Manifest): string => {
  const reasons = new Map<string, number>();
  for (const e of m.sources.excluded) {
    const reason = e.reason.replace(/^not available on this machine: .*/, "not available on this machine");
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  const c = m.counts;
  return [
    `${m.ok ? "bundle ready" : "BUNDLE NOT OK"}: ${out}`,
    `  ${c.files} files, ${c.bytes} bytes; sources: ${c.sources_copied} copied, ${c.sources_linked} linked, ${c.sources_excluded} excluded (of ${c.sources_total})`,
    "  excluded sources by reason:",
    ...[...reasons.entries()].sort((a, b) => cmp(a[0], b[0])).map(([r, n]) => `    ${String(n).padStart(3)}  ${r}`),
    ...m.errors.map((e) => `  error: ${e}`),
    ...m.warnings.map((w) => `  warning: ${w}`),
    ...m.findings.map((f) => `  ${f.severity}: ${f.file}:${f.line} ${f.pattern}`),
    m.ok
      ? `  nothing was published; ${MANIFEST} lists every file with its sha256. Review it before the bundle leaves this machine`
      : `  the bundle was left in place for inspection and ${MANIFEST} says "ok": false; do not share it`,
  ].join("\n");
};
