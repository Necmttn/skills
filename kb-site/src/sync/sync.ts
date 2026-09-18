/**
 * `kb sync`: commit (optional) -> fetch -> rebase -> validate -> push, with a named stop at every step.
 *
 * Rebase, not merge: the store is one record per line in one shared branch, so a linear history
 * keeps `git log -p data/` readable and each local commit is replayed (and merge-driven) on its
 * own. Cost: during a rebase git gives the merge driver the REMOTE file as "ours" and the local
 * commit as "theirs". The driver is symmetric in its decisions (see merge.ts); only the labels
 * swap, and every sync message says which side is which.
 *
 * Never runs: push --force, reset, stash, clean, checkout of files, rebase --continue/--abort.
 */
import { Effect, FileSystem, Path } from "effect";
import { errorsOf, formatIssue } from "../issue.ts";
import { Store } from "../store.ts";
import { Git, type GitResult } from "./git.ts";

export const DRIVER_PREFIX = "kb merge-driver:";

export interface SyncOptions {
  readonly remote?: string | undefined;
  readonly branch?: string | undefined;
  readonly commit: boolean;
  readonly message?: string | undefined;
  readonly dryRun: boolean;
  readonly noPush: boolean;
}

export type SyncState =
  | "pushed"
  | "up-to-date"
  | "validated"
  | "dry-run"
  | "not-a-repo"
  | "no-remote"
  | "no-upstream"
  | "remote-not-approved"
  | "in-progress"
  | "dirty"
  | "dirty-elsewhere"
  | "usage"
  | "invalid"
  | "conflict"
  | "remote-moved"
  | "git-failed";

export interface SyncOutcome {
  readonly ok: boolean;
  readonly state: SyncState;
  /** What happened, in order. */
  readonly steps: ReadonlyArray<string>;
  /** Why it stopped and what to do next. */
  readonly message: ReadonlyArray<string>;
  readonly remote?: string;
  readonly branch?: string;
  /** Every fetch and push URL of `remote`, and those with no approval. */
  readonly urls?: ReadonlyArray<string>;
  readonly unapproved?: ReadonlyArray<string>;
  readonly ahead?: number;
  readonly behind?: number;
  readonly dirty?: ReadonlyArray<string>;
  readonly conflicts?: ReadonlyArray<string>;
  readonly pushed?: boolean;
}

export const NO_REMOTE = "this store is local only until the owner picks a remote";

/** LOCAL git config, multi-valued: the exact remote URLs the owner approved for this store. */
export const APPROVED_REMOTE_KEY = "kb.approvedRemote";
export const APPROVE_FLAG = "--i-verified-private";
export const PRIVATE_MATERIAL = "the store holds private material";
export const CANNOT_VERIFY = "kb cannot verify by itself whether a remote is private or public";
export const approveCommand = (remote: string): string => `bun kb-site/cli.ts approve-remote ${remote} ${APPROVE_FLAG}`;

type RunGit = (...args: ReadonlyArray<string>) => Effect.Effect<GitResult>;

/** Every URL git would use for `remote`, fetch and push, after `insteadOf` rewrites. Empty: no such remote. */
export const remoteUrls = (g: RunGit, remote: string) =>
  Effect.gen(function* () {
    const fetch = yield* g("remote", "get-url", "--all", remote);
    const push = yield* g("remote", "get-url", "--push", "--all", remote);
    if (fetch.exitCode !== 0 || push.exitCode !== 0) return [] as ReadonlyArray<string>;
    return [...new Set([...lines(fetch.stdout), ...lines(push.stdout)].map((l) => l.trim()))];
  });

export const approvedRemotes = (g: RunGit) =>
  Effect.map(g("config", "--local", "--get-all", APPROVED_REMOTE_KEY), (r) => (r.exitCode === 0 ? lines(r.stdout).map((l) => l.trim()) : []));

/** How to get from "no usable remote" to a working sync. Never suggests a push: sync pushes, after the guard. */
const remoteSetupSteps = (local: string): ReadonlyArray<string> => [
  `${PRIVATE_MATERIAL}, so it must live in a PRIVATE remote that the owner picks:`,
  "  1. pick (or create) a private remote; check its visibility yourself, " + CANNOT_VERIFY,
  "  2. git remote add <name> <url>",
  `  3. ${approveCommand("<name>")}`,
  `  4. set the upstream: git config branch.${local}.remote <name> && git config branch.${local}.merge refs/heads/${local}`,
  `     (or pass --remote <name> --branch ${local} on each sync)`,
  "  5. run sync again; sync does the first push itself, after validate",
];

const lines = (text: string): ReadonlyArray<string> => text.split("\n").map((l) => l.trimEnd()).filter((l) => l !== "");
const tail = (r: GitResult): ReadonlyArray<string> => lines(r.stderr === "" ? r.stdout : r.stderr).slice(-8).map((l) => `  git: ${l}`);

export const runSync = (options: SyncOptions) =>
  Effect.gen(function* () {
    const git = yield* Git;
    const store = yield* Store;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dataDir = path.resolve(store.dataDir);
    const steps: Array<string> = [];
    let info: Partial<SyncOutcome> = {};
    const stop = (state: SyncState, message: ReadonlyArray<string>, ok = false): SyncOutcome => ({ ok, state, steps, message, ...info });

    // ---- (a) repository, branch, remote --------------------------------------------------
    if (!(yield* fs.exists(dataDir).pipe(Effect.orElseSucceed(() => false)))) {
      return stop("not-a-repo", [`data directory ${dataDir} does not exist; pass --data <dir>`]);
    }
    const g = (...args: ReadonlyArray<string>) => git.run(dataDir, args);
    const top = yield* g("rev-parse", "--show-toplevel");
    if (top.exitCode !== 0) return stop("not-a-repo", [`${dataDir} is not inside a git repository; sync needs one (\`git init\`, then add a remote)`]);
    const toplevel = top.stdout.trim();
    const prefix = (yield* g("rev-parse", "--show-prefix")).stdout.trim(); // "kb-site/data/"
    const shown = prefix === "" ? "." : prefix.replace(/\/$/, "");
    steps.push(`repository ${toplevel}, data dir ${shown}`);

    for (const marker of ["rebase-merge", "rebase-apply", "MERGE_HEAD"]) {
      const p = (yield* g("rev-parse", "--git-path", marker)).stdout.trim();
      if (p !== "" && (yield* fs.exists(path.resolve(dataDir, p)).pipe(Effect.orElseSucceed(() => false)))) {
        const unmerged = lines((yield* g("diff", "--name-only", "--diff-filter=U")).stdout);
        const rebase = marker !== "MERGE_HEAD";
        return stop("in-progress", [
          `a ${rebase ? "rebase" : "merge"} is already in progress in this repository; sync does not continue or abort it for you`,
          ...(unmerged.length > 0 ? ["unresolved files:", ...unmerged.map((f) => `  ${f}`)] : []),
          ...resolveSteps(unmerged, rebase),
        ]);
      }
    }

    const head = yield* g("symbolic-ref", "--short", "-q", "HEAD");
    if (head.exitCode !== 0) return stop("git-failed", ["HEAD is detached; check out a branch before sync"]);
    const local = head.stdout.trim();

    const remotes = lines((yield* g("remote")).stdout);
    const cfg = (key: string) => Effect.map(g("config", "--get", key), (r) => (r.exitCode === 0 ? r.stdout.trim() : ""));
    const upstreamRemote = yield* cfg(`branch.${local}.remote`);
    const upstreamBranch = (yield* cfg(`branch.${local}.merge`)).replace(/^refs\/heads\//, "");
    const remote = options.remote ?? (upstreamRemote !== "" && upstreamRemote !== "." ? upstreamRemote : undefined);
    if (remotes.length === 0 || (options.remote !== undefined && !remotes.includes(options.remote))) {
      return stop("no-remote", [
        options.remote !== undefined && remotes.length > 0
          ? `no remote configured: remote "${options.remote}" does not exist here (remotes: ${remotes.join(", ")})`
          : `no remote configured: this repository has no git remote, so there is nothing to sync with; ${NO_REMOTE}`,
        ...remoteSetupSteps(local),
      ]);
    }
    const approved = yield* approvedRemotes(g);
    if (remote === undefined) {
      const described: Array<string> = [];
      for (const name of remotes) {
        const urls = yield* remoteUrls(g, name);
        described.push(`  ${name} = ${urls.join(", ") || "(no url)"} (${urls.length > 0 && urls.every((u) => approved.includes(u)) ? "approved" : "NOT approved for this store"})`);
      }
      return stop("no-upstream", [
        `no upstream configured for branch "${local}": sync does not pick a remote for you. Remotes here:`,
        ...described,
        "a remote of the code repository is not automatically a place for the store; nothing was fetched or pushed",
        ...remoteSetupSteps(local),
      ]);
    }
    const branch = options.branch ?? (options.remote === undefined && upstreamBranch !== "" ? upstreamBranch : local);
    info = { remote, branch };
    steps.push(`branch ${local} -> ${remote}/${branch}`);

    // ---- (a2) the remote must be one the owner approved: before any commit, fetch, or push ----
    const urls = yield* remoteUrls(g, remote);
    const unapproved = urls.filter((u) => !approved.includes(u));
    if (urls.length === 0 || unapproved.length > 0) {
      info = { ...info, urls, unapproved };
      return stop("remote-not-approved", [
        urls.length === 0
          ? `remote "${remote}" has no URL that git can resolve; sync refuses a remote it cannot name`
          : `remote "${remote}" is not approved for this store: ${unapproved.join(", ")}`,
        `${PRIVATE_MATERIAL}; ${CANNOT_VERIFY}`,
        ...(approved.length > 0 ? [`approved here: ${approved.join(", ")} (an approval names an exact URL; a changed URL needs a new approval)`] : []),
        `check the remote's visibility yourself. Only when it is private, run: ${approveCommand(remote)}`,
        "nothing was committed, fetched, or pushed",
      ]);
    }
    steps.push(`remote ${remote} is approved (${urls.join(", ")})`);

    // ---- (b) uncommitted changes ---------------------------------------------------------
    const dirtyData = () => Effect.map(g("status", "--porcelain", "--untracked-files=all", "--", "."), (r) => lines(r.stdout).map((l) => l.slice(3)));
    let dirty = yield* dirtyData();
    if (options.commit && (options.message ?? "").trim() === "") return stop("usage", ["--commit needs a message: --commit -m \"what changed\""]);

    if (options.dryRun) {
      info = { ...info, dirty };
    } else if (dirty.length > 0) {
      info = { ...info, dirty };
      if (!options.commit) {
        return stop("dirty", [
          `the data dir has uncommitted changes (${dirty.length} file(s)); sync only moves commits`,
          ...dirty.map((f) => `  ${f}`),
          `commit them yourself, or run: sync --commit -m "what changed"  (validates, then commits only ${shown})`,
        ]);
      }
      const problems = errorsOf(yield* store.validate);
      if (problems.length > 0) {
        return stop("invalid", ["the store is invalid; nothing was committed, fetched, or pushed", ...problems.map((i) => `  ${formatIssue(i)}`)]);
      }
      const add = yield* g("add", "--", ".");
      if (add.exitCode !== 0) return stop("git-failed", ["git add failed", ...tail(add)]);
      const commit = yield* g("commit", "-m", options.message!, "--", ".");
      if (commit.exitCode !== 0) return stop("git-failed", ["git commit failed; nothing was fetched or pushed", ...tail(commit)]);
      steps.push(`committed ${dirty.length} data file(s): ${options.message}`);
      dirty = yield* dirtyData();
    }

    // ---- (c) fetch + ahead/behind --------------------------------------------------------
    const fetch = yield* g("fetch", remote);
    if (fetch.exitCode !== 0) return stop("git-failed", [`git fetch ${remote} failed (network, credentials, or a wrong URL); nothing changed locally`, ...tail(fetch)]);
    steps.push(`fetched ${remote}`);
    const target = `refs/remotes/${remote}/${branch}`;
    const remoteExists = (yield* g("rev-parse", "--verify", "-q", target)).exitCode === 0;
    const count = Effect.fn(function* () {
      if (!remoteExists) return { ahead: Number((yield* g("rev-list", "--count", "HEAD")).stdout.trim() || 0), behind: 0 };
      const [a, b] = (yield* g("rev-list", "--left-right", "--count", `HEAD...${target}`)).stdout.trim().split(/\s+/);
      return { ahead: Number(a ?? 0), behind: Number(b ?? 0) };
    });
    let { ahead, behind } = yield* count();
    info = { ...info, ahead, behind };
    steps.push(remoteExists ? `${ahead} commit(s) ahead, ${behind} behind ${remote}/${branch}` : `${remote}/${branch} does not exist yet; ${ahead} local commit(s)`);

    if (options.dryRun) {
      return stop("dry-run", [
        "dry run: fetched only; no commit, rebase, or push was made. A real sync would:",
        dirty.length > 0
          ? `  1. STOP: ${dirty.length} uncommitted data file(s) (${dirty.slice(0, 3).join(", ")}${dirty.length > 3 ? ", ..." : ""}); needs --commit -m <msg>`
          : "  1. find the data dir clean",
        behind > 0 ? `  2. rebase ${ahead} local commit(s) onto ${remote}/${branch} (${behind} new); the merge driver merges records` : "  2. skip the rebase (nothing new on the remote)",
        "  3. run validate; stop before push when the store is invalid",
        options.noPush ? "  4. stop (--no-push)" : ahead > 0 ? `  4. git push ${remote} HEAD:${branch} (never forced)` : "  4. push nothing (no local commits)",
      ], true);
    }

    // ---- (d, e) rebase -------------------------------------------------------------------
    if (behind > 0) {
      const other = lines((yield* g("status", "--porcelain", "--untracked-files=no")).stdout);
      if (other.length > 0) {
        return stop("dirty-elsewhere", [
          "tracked files outside the data dir have uncommitted changes; a rebase needs a clean tree and sync never stashes",
          ...other.slice(0, 10).map((l) => `  ${l.slice(3)}`),
          "commit or stash them yourself, then run sync again",
        ]);
      }
      const rebase = yield* g("rebase", "--merge", target);
      if (rebase.exitCode !== 0) {
        const unmerged = lines((yield* g("diff", "--name-only", "--diff-filter=U")).stdout);
        const driver = lines(rebase.stderr).filter((l) => l.startsWith(DRIVER_PREFIX)).map((l) => `  ${l.slice(DRIVER_PREFIX.length).trim()}`);
        info = { ...info, conflicts: unmerged, pushed: false };
        if (unmerged.length === 0) return stop("git-failed", ["git rebase failed; nothing was pushed", ...tail(rebase), "to go back: git rebase --abort"]);
        return stop("conflict", [
          `conflict: ${unmerged.length} file(s) need a decision; the rebase is paused and nothing was pushed`,
          ...unmerged.map((f) => `  ${f}`),
          ...driver,
          ...resolveSteps(unmerged, true),
        ]);
      }
      steps.push(`rebased onto ${remote}/${branch}`);
      ({ ahead, behind } = yield* count());
      info = { ...info, ahead, behind };
    }

    // ---- (f) validate --------------------------------------------------------------------
    const problems = errorsOf(yield* store.validate);
    if (problems.length > 0) {
      info = { ...info, pushed: false };
      return stop("invalid", [
        "the store is invalid after the merge; nothing was pushed",
        ...problems.map((i) => `  ${formatIssue(i)}`),
        "fix the records, commit, then run sync again",
      ]);
    }
    steps.push("validated");
    if (options.noPush) return stop("validated", ["--no-push: stopped after validate; nothing was pushed"], true);

    // ---- (g) push ------------------------------------------------------------------------
    if (ahead === 0) return stop("up-to-date", [`up to date with ${remote}/${branch}; nothing to push`], true);
    const push = yield* g("push", remote, `HEAD:refs/heads/${branch}`);
    if (push.exitCode !== 0) {
      info = { ...info, pushed: false };
      const moved = /\[rejected\]|non-fast-forward|fetch first/.test(push.stderr);
      return moved
        ? stop("remote-moved", ["remote moved, run sync again (someone pushed while this sync ran; your commits are safe locally, nothing was forced)"])
        : stop("git-failed", ["git push failed; your commits are safe locally", ...tail(push)]);
    }
    info = { ...info, pushed: true, ahead: 0 };
    steps.push(`pushed ${ahead} commit(s) to ${remote}/${branch}`);
    return stop("pushed", [`synced: pushed ${ahead} commit(s) to ${remote}/${branch}`], true);
  });

/** The exact commands to finish or undo a paused rebase or merge. */
export const resolveSteps = (files: ReadonlyArray<string>, rebase: boolean): ReadonlyArray<string> => [
  ...(rebase ? ['sides: sync rebases your commits onto the remote, so "ours" = the remote version and "theirs" = your local change'] : []),
  "to resolve:",
  "  1. open each file; for every block from `<<<<<<< kb-conflict` to `>>>>>>> kb-conflict`:",
  "     put the value you choose into the record line above the block, then delete the block lines",
  "  2. bun kb-site/cli.ts fmt && bun kb-site/cli.ts validate",
  `  3. git add ${files.length > 0 ? files.join(" ") : "<file>"}`,
  rebase ? "  4. git -c core.editor=true rebase --continue" : "  4. git commit --no-edit",
  "  5. run sync again",
  rebase ? "to give up and return to your commits as they were: git rebase --abort" : "to give up: git merge --abort",
];

export const renderSync = (o: SyncOutcome): string => [...o.steps.map((s) => `- ${s}`), ...o.message].join("\n");
