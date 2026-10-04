/** `merge-driver`, `install-merge-driver`, `sync`. They own their exit codes (git reads them). */
import { Config, Console, Data, Effect, FileSystem, Option, Path, Runtime } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { jsonFlag, Reported } from "../commands.ts";
import { kindForPath } from "../jsonl.ts";
import * as Render from "../render.ts";
import { Store } from "../store.ts";
import { Git, SYNC_REBASE_ENV } from "./git.ts";
import { describeConflict, mergeJsonl } from "./merge.ts";
import { APPROVE_FLAG, APPROVED_REMOTE_KEY, approvedRemotes, CANNOT_VERIFY, DRIVER_PREFIX, PRIVATE_MATERIAL, remoteUrls, renderSync, runSync } from "./sync.ts";

export const DRIVER_NAME = "kbjsonl";
export const DRIVER_TITLE = "kb record-level JSONL merge";
export const ATTRIBUTES_LINE = "kb-site/data/**/*.jsonl merge=kbjsonl";

/** Already printed. Exit 1 = conflicts (git's contract), 2 = the driver could not merge at all. */
export class DriverExit extends Data.TaggedError("Reported")<{ readonly code: number }> {
  override readonly [Runtime.errorExitCode] = this.code;
  override get message() {
    return this.code === 1 ? "merge conflicts" : "merge driver failed";
  }
}

const say = (line: string) => Console.error(`${DRIVER_PREFIX} ${line}`);

// ---- merge-driver -------------------------------------------------------------------------
/** Git contract: read %O %A %B, write the result to %A, exit 0 clean / nonzero conflict. */
export const runMergeDriver = (basePath: string, oursPath: string, theirsPath: string, storePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const kind = kindForPath(storePath);
    if (kind === undefined) {
      yield* say(`${storePath}: not a store file (expected sources, requirements, apps, conflicts, or tracking/<app>.jsonl); left untouched`);
      return yield* new DriverExit({ code: 2 });
    }
    // A read error is never "empty text": an unreadable "ours" read as "" would be merged, written, and exit 0.
    // Git hands an EMPTY temp file as %O for an add/add, so only a missing base path also reads as empty.
    const read = (side: "base" | "ours" | "theirs", p: string) =>
      fs.readFileString(p).pipe(
        Effect.catch((e) =>
          side === "base" && e.reason._tag === "NotFound"
            ? Effect.succeed("")
            : say(`${storePath}: cannot read "${side}" (${p}): ${e.message}`).pipe(
              Effect.andThen(say(`${storePath}: "ours" was left untouched and nothing was merged`)),
              Effect.andThen(Effect.fail(new DriverExit({ code: 2 }))),
            )
        ),
      );
    const [base, ours, theirs] = [yield* read("base", basePath), yield* read("ours", oursPath), yield* read("theirs", theirsPath)];
    const result = mergeJsonl(kind, base, ours, theirs, storePath);
    if (result._tag === "unparseable") {
      for (const line of result.message.split("\n")) yield* say(line);
      yield* say(`${storePath}: "ours" was left untouched and "theirs" is NOT in it; fix the broken version, then merge again`);
      return yield* new DriverExit({ code: 2 });
    }
    const written = yield* fs.writeFileString(oursPath, result.text).pipe(Effect.result);
    if (written._tag === "Failure") {
      yield* say(`${storePath}: cannot write the merge result: ${written.failure.message}`);
      return yield* new DriverExit({ code: 2 });
    }
    if (result._tag === "merged") return;
    const rebasing = Option.isSome(yield* Config.option(Config.string(SYNC_REBASE_ENV)).pipe(Effect.orElseSucceed(() => Option.none<string>())));
    yield* say(`${storePath}: ${result.conflicts.length} conflict(s)${rebasing ? ' ("ours" = remote, "theirs" = your local change)' : ""}`);
    for (const c of result.conflicts) yield* say(`${storePath}: ${describeConflict(c)}`);
    return yield* new DriverExit({ code: 1 });
  });

export const mergeDriverCommand = Command.make(
  "merge-driver",
  {
    base: Argument.string("base").pipe(Argument.withDescription("%O: ancestor version (temp file)")),
    ours: Argument.string("ours").pipe(Argument.withDescription("%A: current version; the result is written here")),
    theirs: Argument.string("theirs").pipe(Argument.withDescription("%B: other version (temp file)")),
    path: Argument.string("path").pipe(Argument.withDescription("%P: the file's path in the repository")),
  },
  ({ base, ours, theirs, path }) => runMergeDriver(base, ours, theirs, path),
).pipe(Command.withDescription("Git merge driver: record-level 3-way merge (git calls this; see install-merge-driver)"));

// ---- install-merge-driver -----------------------------------------------------------------
const shellQuote = (s: string): string => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`);

export const installMergeDriver = (cliOverride: string | undefined) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const store = yield* Store;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dataDir = path.resolve(store.dataDir);
    const fail = (message: string) => Effect.fail(new InstallProblem({ message }));
    const top = yield* git.run(dataDir, ["rev-parse", "--show-toplevel"]);
    if (top.exitCode !== 0) return yield* fail(`${dataDir} is not inside a git repository; the merge driver lives in a repository's local config`);
    const toplevel = top.stdout.trim();

    // git runs drivers from the worktree root, so a root-relative cli path works from any cwd and any clone location
    const cliAbs = cliOverride !== undefined ? path.resolve(cliOverride) : path.join(path.dirname(dataDir), "cli.ts");
    if (!(yield* fs.exists(cliAbs).pipe(Effect.orElseSucceed(() => false)))) {
      return yield* fail(`${cliAbs} does not exist; pass --cli <path to cli.ts>`);
    }
    const real = (p: string) => fs.realPath(p).pipe(Effect.orElseSucceed(() => p));
    const rel = path.relative(yield* real(toplevel), yield* real(cliAbs));
    const inside = rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
    const cli = inside ? rel.split(path.sep).join("/") : cliAbs;
    const driver = `bun ${shellQuote(cli)} merge-driver %O %A %B %P`;

    const entries = [[`merge.${DRIVER_NAME}.name`, DRIVER_TITLE], [`merge.${DRIVER_NAME}.driver`, driver]] as const;
    let changed = false;
    for (const [key, value] of entries) {
      const current = yield* git.run(toplevel, ["config", "--local", "--get", key]);
      if (current.exitCode === 0 && current.stdout.replace(/\n$/, "") === value) continue;
      const set = yield* git.run(toplevel, ["config", "--local", key, value]);
      if (set.exitCode !== 0) return yield* fail(`git config ${key} failed: ${set.stderr.trim()}`);
      changed = true;
    }
    const attributes = yield* fs.readFileString(path.join(toplevel, ".gitattributes")).pipe(Effect.orElseSucceed(() => ""));
    const attributesOk = attributes.split("\n").some((l) => /\.jsonl\s+.*merge=kbjsonl/.test(l));
    return { toplevel, changed, portable: inside, config: Object.fromEntries(entries) as Record<string, string>, attributesOk };
  });

export class InstallProblem extends Data.TaggedError("InstallProblem")<{ readonly message: string }> {
  override readonly [Runtime.errorExitCode] = 1;
}

export const installMergeDriverCommand = Command.make(
  "install-merge-driver",
  {
    cli: Flag.string("cli").pipe(Flag.optional, Flag.withDescription("Path to cli.ts (default: next to the data dir)")),
    json: jsonFlag,
  },
  ({ cli, json }) =>
    installMergeDriver(Option.getOrUndefined(cli)).pipe(
      Effect.flatMap((r) =>
        Console.log(
          json ? Render.json({ ok: true, ...r }) : [
            `${r.changed ? "wrote" : "already set in"} the LOCAL git config of ${r.toplevel}:`,
            ...Object.entries(r.config).map(([k, v]) => `  ${k} = ${v}`),
            r.portable ? "the driver path is relative to the repository root (git runs drivers there)" : "note: cli.ts is outside this repository, so the driver uses an absolute path",
            r.attributesOk
              ? ".gitattributes routes the store files to this driver"
              : `warning: .gitattributes has no kbjsonl line; add: ${ATTRIBUTES_LINE}`,
            "git never copies this config into a clone: every contributor runs this once per clone",
          ].join("\n"),
        )
      ),
      Effect.catchTag("InstallProblem", (e) =>
        (json ? Console.log(Render.json({ ok: false, errors: [{ message: e.message }] })) : Console.error(`error: ${e.message}`)).pipe(
          Effect.andThen(Effect.fail(new Reported({ issues: [] }))),
        )),
    ),
).pipe(Command.withDescription("Register the record-level merge driver in this clone's local git config"));

// ---- sync ---------------------------------------------------------------------------------
export const syncCommand = Command.make(
  "sync",
  {
    remote: Flag.string("remote").pipe(Flag.optional, Flag.withDescription("Remote name (default: the current branch's upstream)")),
    branch: Flag.string("branch").pipe(Flag.optional, Flag.withDescription("Remote branch (default: the upstream branch)")),
    commit: Flag.boolean("commit").pipe(Flag.withDefault(false), Flag.withDescription("Validate, then commit uncommitted data-dir changes first (needs -m)")),
    message: Flag.string("message").pipe(Flag.withAlias("m"), Flag.optional, Flag.withDescription("Commit message for --commit")),
    dryRun: Flag.boolean("dry-run").pipe(Flag.withDefault(false), Flag.withDescription("Fetch (approved remotes only), show ahead/behind and the plan; change nothing")),
    noPush: Flag.boolean("no-push").pipe(Flag.withDefault(false), Flag.withDescription("Stop after validate")),
    json: jsonFlag,
  },
  (f) =>
    Effect.gen(function* () {
      const outcome = yield* runSync({
        remote: Option.getOrUndefined(f.remote),
        branch: Option.getOrUndefined(f.branch),
        commit: f.commit,
        message: Option.getOrUndefined(f.message),
        dryRun: f.dryRun,
        noPush: f.noPush,
      }).pipe(Effect.catch((e) => Effect.succeed({ ok: false, state: "git-failed" as const, steps: [], message: [String((e as { message?: unknown }).message ?? e)] })));
      if (f.json) yield* Console.log(Render.json(outcome));
      else if (outcome.ok) yield* Console.log(renderSync(outcome));
      else yield* Console.error(renderSync(outcome));
      if (!outcome.ok) return yield* new Reported({ issues: [] });
    }),
).pipe(Command.withDescription("Share the store through git with an APPROVED remote (see approve-remote): fetch, rebase, validate, push. Stops with the state named."));

// ---- approve-remote -----------------------------------------------------------------------
/**
 * Record in the LOCAL git config that the owner checked a remote and it is private. A remote NAME is
 * resolved to its URLs now, so a later `git remote set-url` is not covered by this approval.
 */
export const approveRemote = (target: string, verified: boolean) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const store = yield* Store;
    const path = yield* Path.Path;
    const dataDir = path.resolve(store.dataDir);
    const fail = (message: string) => Effect.fail(new InstallProblem({ message }));
    const g = (...args: ReadonlyArray<string>) => git.run(dataDir, args);
    if (!verified) {
      return yield* fail(`${PRIVATE_MATERIAL}; confirm the remote is private before approving (${CANNOT_VERIFY}). Check it yourself, then run the command again with ${APPROVE_FLAG}. Nothing was approved`);
    }
    const top = yield* g("rev-parse", "--show-toplevel");
    if (top.exitCode !== 0) return yield* fail(`${dataDir} is not inside a git repository; an approval lives in a repository's local config`);
    const names = (yield* g("remote")).stdout.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    const isName = names.includes(target);
    if (!isName && !/[:/]/.test(target)) {
      return yield* fail(`"${target}" is not a remote here (remotes: ${names.join(", ") || "none"}) and does not look like a URL; pass a remote name or the exact URL`);
    }
    const urls = isName ? yield* remoteUrls(g, target) : [target.trim()];
    if (urls.length === 0) return yield* fail(`remote "${target}" has no URL`);
    const before = yield* approvedRemotes(g);
    const added: Array<string> = [];
    for (const url of urls) {
      if (before.includes(url)) continue;
      const set = yield* g("config", "--local", "--add", APPROVED_REMOTE_KEY, url);
      if (set.exitCode !== 0) return yield* fail(`git config --add ${APPROVED_REMOTE_KEY} failed: ${set.stderr.trim()}`);
      added.push(url);
    }
    return { toplevel: top.stdout.trim(), urls, added, approved: yield* approvedRemotes(g) };
  });

export const approveRemoteCommand = Command.make(
  "approve-remote",
  {
    target: Argument.string("remote").pipe(Argument.withDescription("A remote name (resolved to its URLs now) or an exact URL")),
    verified: Flag.boolean("i-verified-private").pipe(Flag.withDefault(false), Flag.withDescription("Mandatory: you checked the remote yourself and it is private")),
    json: jsonFlag,
  },
  ({ target, verified, json }) =>
    approveRemote(target, verified).pipe(
      Effect.flatMap((r) =>
        Console.log(
          json ? Render.json({ ok: true, ...r }) : [
            `${r.added.length > 0 ? "approved" : "already approved"} for this store, in the LOCAL git config of ${r.toplevel} (${APPROVED_REMOTE_KEY}):`,
            ...r.urls.map((u) => `  ${u}`),
            "kb did not check the visibility; you confirmed it. An approval names an exact URL: a changed URL needs a new approval",
            `to withdraw every approval: git config --local --unset-all ${APPROVED_REMOTE_KEY}`,
          ].join("\n"),
        )
      ),
      Effect.catchTag("InstallProblem", (e) =>
        (json ? Console.log(Render.json({ ok: false, errors: [{ message: e.message }] })) : Console.error(`error: ${e.message}`)).pipe(
          Effect.andThen(Effect.fail(new Reported({ issues: [] }))),
        )),
    ),
).pipe(Command.withDescription("Approve a PRIVATE remote for sync (local git config). kb cannot check visibility: you confirm it"));

/** Ready for `makeRoot(dir, [...syncCommands])`: the git commands carry the live `Git` layer. */
export const syncCommands = [
  mergeDriverCommand,
  installMergeDriverCommand.pipe(Command.provide(Git.layer)),
  syncCommand.pipe(Command.provide(Git.layer)),
  approveRemoteCommand.pipe(Command.provide(Git.layer)),
] as const;
