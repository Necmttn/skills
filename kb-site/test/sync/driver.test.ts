/** The `merge-driver` contract, `install-merge-driver`, and sync paths that need a scripted git. */
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, FileSystem, Layer, Path } from "effect";
import { Store } from "../../src/store.ts";
import { Git } from "../../src/sync/git.ts";
import { runSync } from "../../src/sync/sync.ts";
import { baseFiles, lines, TestEnv, tracking } from "../helpers.ts";
import { CLI, LONG, withWorld } from "./world.ts";

const exitCode = (error: unknown): number | undefined => {
  const failure = (error as Cause.Cause<{ readonly code?: number }>).reasons.find(Cause.isFailReason);
  return failure?.error.code;
};

describe("merge-driver command", () => {
  it.effect("writes the result to %A: exit 0 clean, exit 1 + stderr summary on conflict, exit 2 and ours untouched when an input is broken", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const here = w.at(w.tmp, ".");
        const file = (name: string, text: string) => Effect.as(fs.writeFileString(path.join(w.tmp, name), text), path.join(w.tmp, name));
        const base = tracking();
        const O = yield* file("base", lines([base]));
        const B = yield* file("theirs", lines([{ ...base, notes: "theirs note" }]));

        const A = yield* file("ours", lines([{ ...base, owner: "alice" }]));
        const clean = yield* here.kb("merge-driver", O, A, B, "kb-site/data/tracking/alpha.jsonl");
        assert.isTrue(clean.ok, clean.stderr);
        assert.strictEqual(yield* fs.readFileString(A), lines([{ ...base, owner: "alice", notes: "theirs note" }]));

        yield* fs.writeFileString(A, lines([{ ...base, notes: "ours note" }]));
        const conflict = yield* here.kb("merge-driver", O, A, B, "kb-site/data/tracking/alpha.jsonl");
        assert.strictEqual(exitCode(conflict.error), 1);
        assert.include(conflict.stderr, 'kb merge-driver: kb-site/data/tracking/alpha.jsonl: record "setup.privacy" field "notes": ours "ours note" / theirs "theirs note"');
        assert.include(yield* fs.readFileString(A), '<<<<<<< kb-conflict record "setup.privacy" field "notes"');

        const broken = "{oops\n";
        yield* fs.writeFileString(A, lines([base]));
        yield* fs.writeFileString(B, broken);
        const failed = yield* here.kb("merge-driver", O, A, B, "kb-site/data/tracking/alpha.jsonl");
        assert.strictEqual(exitCode(failed.error), 2);
        assert.include(failed.stderr, "theirs version of kb-site/data/tracking/alpha.jsonl line 1: malformed JSON");
        assert.include(failed.stderr, '"ours" was left untouched');
        assert.strictEqual(yield* fs.readFileString(A), lines([base]));

        const unknown = yield* here.kb("merge-driver", O, A, O, "notes/todo.jsonl");
        assert.strictEqual(exitCode(unknown.error), 2);
        assert.include(unknown.stderr, "not a store file");
      })), LONG);
});

describe("merge-driver input errors", () => {
  it.effect("an unreadable ours or theirs -> exit 2, ours untouched, the path named; only a MISSING base reads as empty", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const here = w.at(w.tmp, ".");
        const P = "kb-site/data/tracking/alpha.jsonl";
        const file = (name: string, text: string) => Effect.as(fs.writeFileString(path.join(w.tmp, name), text), path.join(w.tmp, name));
        const base = tracking();
        const O = yield* file("base", lines([base]));
        const A = yield* file("ours", lines([{ ...base, owner: "alice" }]));
        const B = yield* file("theirs", lines([{ ...base, notes: "theirs note" }]));
        const unreadable = path.join(w.tmp, "a-directory");
        yield* fs.makeDirectory(unreadable);

        // ours unreadable: the old driver read it as "", merged, wrote, and exited 0
        const noOurs = yield* here.kb("merge-driver", O, unreadable, B, P);
        assert.strictEqual(exitCode(noOurs.error), 2);
        assert.include(noOurs.stderr, `cannot read "ours" (${unreadable})`);
        assert.include(noOurs.stderr, '"ours" was left untouched');
        const gone = path.join(w.tmp, "not-there");
        assert.strictEqual(exitCode((yield* here.kb("merge-driver", O, gone, B, P)).error), 2);
        assert.isFalse(yield* fs.exists(gone), "a missing ours is never created");

        const noTheirs = yield* here.kb("merge-driver", O, A, unreadable, P);
        assert.strictEqual(exitCode(noTheirs.error), 2);
        assert.include(noTheirs.stderr, 'cannot read "theirs"');
        assert.strictEqual(exitCode((yield* here.kb("merge-driver", O, A, gone, P)).error), 2);
        assert.strictEqual(exitCode((yield* here.kb("merge-driver", unreadable, A, B, P)).error), 2, "an unreadable base is not an empty base");
        assert.strictEqual(yield* fs.readFileString(A), lines([{ ...base, owner: "alice" }]));

        // add/add: git passes an EMPTY temp file as %O; a missing base path means the same
        const added = yield* here.kb("merge-driver", gone, A, A, P);
        assert.isTrue(added.ok, added.stderr);
        assert.strictEqual(yield* fs.readFileString(A), lines([{ ...base, owner: "alice" }]));
      })), LONG);
});

describe("install-merge-driver", () => {
  it.effect("writes a root-relative driver into the LOCAL config, is idempotent, and git runs it from the worktree root", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const alice = yield* w.clone("alice");
        yield* alice.git("config", "--local", "--unset", "merge.kbjsonl.driver");
        // the clone's own kb-site/cli.ts: a shim onto the real entry, like a checkout of this repo
        yield* fs.writeFileString(
          path.join(alice.dir, "kb-site", "cli.ts"),
          `const p = Bun.spawnSync(["bun", ${JSON.stringify(CLI)}, ...process.argv.slice(2)], { stdio: ["inherit", "inherit", "inherit"] });\nprocess.exit(p.exitCode ?? 2);\n`,
        );

        const first = JSON.parse((yield* alice.kb("install-merge-driver", "--json")).stdout);
        assert.deepStrictEqual([first.ok, first.changed, first.portable, first.attributesOk], [true, true, true, true]);
        assert.strictEqual(first.config["merge.kbjsonl.driver"], "bun kb-site/cli.ts merge-driver %O %A %B %P");
        assert.strictEqual(yield* alice.git("config", "--local", "--get", "merge.kbjsonl.driver"), "bun kb-site/cli.ts merge-driver %O %A %B %P");
        assert.strictEqual(yield* alice.git("config", "--local", "--get", "merge.kbjsonl.name"), "kb record-level JSONL merge");
        const second = yield* alice.kb("install-merge-driver");
        assert.include(second.stdout, "already set in the LOCAL git config");

        // same record, different fields, on two branches: git's line merge would conflict, the driver merges
        yield* alice.git("checkout", "-b", "side");
        yield* alice.edit("tracking/alpha.jsonl", "setup.privacy", { notes: "from side" });
        yield* alice.git("commit", "-am", "side");
        yield* alice.git("checkout", "main");
        yield* alice.edit("tracking/alpha.jsonl", "setup.privacy", { owner: "alice" });
        yield* alice.git("commit", "-am", "main");
        // run the merge from a SUBDIRECTORY: the relative driver path only works if git runs it at the root
        const sub = w.at(path.join(alice.dir, "kb-site", "data", "tracking"), ".");
        yield* sub.git("merge", "--no-edit", "side");
        const record = (yield* alice.records("tracking/alpha.jsonl")).find((r) => r.requirement === "setup.privacy");
        assert.deepStrictEqual([record.owner, record.notes], ["alice", "from side"]);

        // an explicit cli outside the repository falls back to an absolute path
        const outside = JSON.parse((yield* alice.kb("install-merge-driver", "--cli", CLI, "--json")).stdout);
        assert.deepStrictEqual([outside.portable, outside.config["merge.kbjsonl.driver"]], [false, `bun ${CLI} merge-driver %O %A %B %P`]);

        const plain = w.at(path.join(w.tmp, "plain"), "data");
        yield* plain.write("sources.jsonl", "");
        const refused = yield* plain.kb("install-merge-driver");
        assert.isFalse(refused.ok);
        assert.include(refused.stderr, "is not inside a git repository");
      })), LONG);
});

describe("sync with a scripted git", () => {
  const script = (calls: Array<ReadonlyArray<string>>, push: { exitCode: number; stderr: string }, approved = true) =>
    Git.layerScripted((args) => {
      calls.push(args);
      const is = (...head: ReadonlyArray<string>) => head.every((h, i) => args[i] === h);
      if (is("rev-parse", "--show-toplevel")) return { stdout: "/repo\n" };
      if (is("rev-parse", "--show-prefix")) return { stdout: "data/\n" };
      if (is("rev-parse", "--git-path")) return { stdout: `.git/${args[2]}\n` };
      if (is("symbolic-ref")) return { stdout: "main\n" };
      if (is("remote", "get-url")) return { stdout: "git@private.example:kb/store.git\n" };
      if (is("remote")) return { stdout: "origin\n" };
      if (is("config", "--local", "--get-all", "kb.approvedRemote")) return approved ? { stdout: "git@private.example:kb/store.git\n" } : { exitCode: 1 };
      if (is("config", "--get", "branch.main.remote")) return { stdout: "origin\n" };
      if (is("config", "--get", "branch.main.merge")) return { stdout: "refs/heads/main\n" };
      if (is("rev-list")) return { stdout: "2\t0\n" };
      if (is("push")) return push;
      return {};
    });

  const run = (push: { exitCode: number; stderr: string }, approved = true, dryRun = false) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = path.join(yield* fs.makeTempDirectoryScoped({ prefix: "kb-scripted-" }), "data");
      for (const [rel, text] of Object.entries(baseFiles())) {
        yield* fs.makeDirectory(dir, { recursive: true });
        if (text !== null) yield* fs.writeFileString(path.join(dir, rel), text);
      }
      const calls: Array<ReadonlyArray<string>> = [];
      const outcome = yield* runSync({ commit: false, dryRun, noPush: false }).pipe(
        Effect.provide(Layer.mergeAll(Store.layer(dir), script(calls, push, approved))),
      );
      return { outcome, calls };
    }).pipe(Effect.scoped, Effect.provide(TestEnv));

  it.effect("a rejected push -> 'remote moved, run sync again'; no force, reset, or stash is ever issued", () =>
    Effect.gen(function* () {
      const { outcome, calls } = yield* run({ exitCode: 1, stderr: " ! [rejected]        HEAD -> main (fetch first)\nerror: failed to push some refs\n" });
      assert.deepStrictEqual([outcome.ok, outcome.state, outcome.pushed], [false, "remote-moved", false]);
      assert.include(outcome.message.join("\n"), "remote moved, run sync again");
      assert.deepStrictEqual(calls.find((c) => c[0] === "push"), ["push", "origin", "HEAD:refs/heads/main"]);
      const words = calls.flat();
      for (const banned of ["--force", "-f", "--force-with-lease", "reset", "stash", "clean", "checkout", "--abort", "--continue"]) assert.notInclude(words, banned);
    }));

  it.effect("an unapproved remote: no fetch, commit, rebase, or push call is ever issued, in a real run and in --dry-run", () =>
    Effect.gen(function* () {
      for (const dryRun of [false, true]) {
        const { outcome, calls } = yield* run({ exitCode: 0, stderr: "" }, false, dryRun);
        assert.deepStrictEqual([outcome.ok, outcome.state, outcome.unapproved], [false, "remote-not-approved", ["git@private.example:kb/store.git"]]);
        for (const verb of ["fetch", "push", "commit", "add", "rebase", "pull"]) assert.isFalse(calls.some((c) => c[0] === verb), `git ${verb} was called`);
      }
    }));

  it.effect("any other push failure is reported as it is; a good push reports the count", () =>
    Effect.gen(function* () {
      const denied = (yield* run({ exitCode: 128, stderr: "fatal: Could not read from remote repository.\n" })).outcome;
      assert.strictEqual(denied.state, "git-failed");
      assert.include(denied.message.join("\n"), "Could not read from remote repository");
      const good = (yield* run({ exitCode: 0, stderr: "" })).outcome;
      assert.deepStrictEqual([good.ok, good.state, good.pushed], [true, "pushed", true]);
    }));
});
