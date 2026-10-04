import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, PlatformError } from "effect";
import { TestClock, TestConsole } from "effect/testing";
import { Roots } from "../src/roots.ts";
import { LOCK_FILE, Store } from "../src/store.ts";
import { applySet, applySetRelease } from "../src/transitions.ts";
import { app, baseFiles, lines, requirement, source, tracking, withStore } from "./helpers.ts";

const readAll = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const out: Record<string, string> = {};
    for (const rel of (yield* fs.readDirectory(dir, { recursive: true })).sort()) {
      const full = path.join(dir, rel);
      if ((yield* fs.stat(full)).type === "File") out[rel] = yield* fs.readFileString(full);
    }
    return out;
  });

const scenario = Effect.gen(function* () {
  const store = yield* Store;
  yield* store.setTracking("beta", "setup.privacy", { status: "blocked", note: "legal", by: "b" });
  yield* store.setTracking("alpha", "setup.privacy", { status: "done", evidence: [{ kind: "link", ref: "https://x" }], by: "a" });
  yield* store.setTracking("alpha", "release.smoke", { status: "in_progress", owner: "neco", by: "a" });
  yield* store.setRelease("beta", "0.1");
});

describe("Store writes", () => {
  it.effect("two runs of the same edits give byte-identical files", () =>
    Effect.gen(function* () {
      const first = yield* withStore(baseFiles(), ({ dir }) => Effect.andThen(scenario, readAll(dir)));
      const second = yield* withStore(baseFiles(), ({ dir }) => Effect.andThen(scenario, readAll(dir)));
      assert.deepStrictEqual(Object.keys(first), ["apps.jsonl", "conflicts.jsonl", "requirements.jsonl", "sources.jsonl", "tracking/alpha.jsonl", "tracking/beta.jsonl"]);
      assert.deepStrictEqual(first, second);
      assert.isTrue(Object.values(first).every((text) => text === "" || text.endsWith("\n")));
      assert.deepStrictEqual(first["tracking/alpha.jsonl"]?.split("\n").map((l) => (l === "" ? "" : JSON.parse(l).requirement)), ["release.smoke", "setup.privacy", ""]);
    }));

  it.effect("atomic write leaves no temp file, and creates the tracking dir on demand", () =>
    withStore(baseFiles(), ({ dir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        assert.isFalse(yield* fs.exists(path.join(dir, "tracking")));
        yield* scenario;
        assert.deepStrictEqual((yield* fs.readDirectory(path.join(dir, "tracking"))).sort(), ["alpha.jsonl", "beta.jsonl"]);
        assert.deepStrictEqual((yield* fs.readDirectory(dir)).sort(), ["apps.jsonl", "conflicts.jsonl", "requirements.jsonl", "sources.jsonl", "tracking"]);
      })));

  it.effect("ConcurrentEdit: refuses to write when the file changed between read and write", () =>
    withStore(baseFiles({ "tracking/alpha.jsonl": lines([tracking()]) }), ({ dir, write }) =>
      Effect.gen(function* () {
        const store = yield* Store;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const loaded = yield* store.load;
        const next = applySet(loaded.data, "alpha", "setup.privacy", { owner: "me", by: "me" }, { now: "2026-09-18T00:00:00Z", today: "2026-09-18" });
        assert.isTrue(next._tag === "Success");
        if (next._tag !== "Success") return;

        const theirs = lines([tracking({ owner: "someone-else" })]);
        yield* write("tracking/alpha.jsonl", theirs);
        const error = yield* store.commit(loaded, next.success.data, ["tracking/alpha.jsonl"]).pipe(Effect.flip);
        assert.strictEqual(error._tag, "ConcurrentEdit");
        assert.include(error.message, "tracking/alpha.jsonl changed on disk");
        assert.strictEqual(yield* fs.readFileString(path.join(dir, "tracking/alpha.jsonl")), theirs);
        assert.deepStrictEqual(yield* fs.readDirectory(path.join(dir, "tracking")), ["alpha.jsonl"]);

        // a file that appears after the read is a concurrent edit too
        const fresh = yield* store.load;
        const forBeta = applySet(fresh.data, "beta", "setup.privacy", { owner: "me", by: "me" }, { now: "2026-09-18T00:00:00Z", today: "2026-09-18" });
        if (forBeta._tag !== "Success") return assert.fail("applySet failed");
        yield* write("tracking/beta.jsonl", lines([tracking({ app: "beta" })]));
        assert.strictEqual((yield* store.commit(fresh, forBeta.success.data, ["tracking/beta.jsonl"]).pipe(Effect.flip))._tag, "ConcurrentEdit");
      })));

  it.effect("refuses every write while the store has an error, and writes nothing", () =>
    withStore(baseFiles({ "tracking/alpha.jsonl": lines([tracking()]) + "{broken\n" }), ({ dir }) =>
      Effect.gen(function* () {
        const before = yield* readAll(dir);
        const error = yield* Store.use((s) => s.setTracking("alpha", "setup.privacy", { owner: "me", by: "me" })).pipe(Effect.flip);
        assert.strictEqual(error._tag, "Rejected");
        assert.include(error.message, "tracking/alpha.jsonl:2: malformed JSON");
        assert.strictEqual((yield* Store.use((s) => s.setRelease("alpha", "9.9")).pipe(Effect.flip))._tag, "Rejected");
        assert.deepStrictEqual(yield* readAll(dir), before);
      })));

  it.effect("load fails with a clear message when the data dir is missing", () =>
    withStore({}, ({ dir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(dir, { recursive: true });
        const error = yield* Store.use((s) => s.load).pipe(Effect.flip);
        assert.include(error.message, "data directory not found");
      })));
});

/** A second `Store` on the same dir whose `rename` first runs `before` (a writer arriving mid-commit) and may fail. */
const hookedStore = (dir: string, before: (from: string, to: string) => Effect.Effect<void, PlatformError.PlatformError, any>) =>
  Store.layer(dir).pipe(
    Layer.provide(Layer.effect(
      FileSystem.FileSystem,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const context = yield* Effect.context<never>();
        return { ...fs, rename: (from: string, to: string) => before(from, to).pipe(Effect.provide(context), Effect.andThen(fs.rename(from, to))) } as FileSystem.FileSystem;
      }),
    )),
  );

describe("Store lock", () => {
  it.effect("a writer that arrives between the hash check and the rename is refused, not overwritten", () =>
    withStore(baseFiles({ "tracking/alpha.jsonl": lines([tracking()]) }), ({ dir }) =>
      Effect.gen(function* () {
        const plain = yield* Store;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const second: Array<string> = [];
        const racing = hookedStore(dir, () =>
          plain.setTracking("alpha", "setup.privacy", { note: "second writer", by: "b" }).pipe(
            Effect.match({ onFailure: (e) => second.push(`${e._tag}: ${e.message}`), onSuccess: () => second.push("written") }),
          ));
        yield* Store.use((s) => s.setTracking("alpha", "setup.privacy", { owner: "first", by: "a" })).pipe(Effect.provide(racing));
        assert.strictEqual(second.length, 1);
        assert.include(second[0], "StoreLocked: another kb write is in progress (lock file ");
        assert.include(second[0], path.join(dir, LOCK_FILE));
        const [record] = (yield* plain.load).data.tracking;
        assert.deepStrictEqual([record?.owner, record?.notes], ["first", ""]);
        assert.isFalse(yield* fs.exists(path.join(dir, LOCK_FILE)), "the lock is released");
        // and the refused writer succeeds on its next run
        yield* plain.setTracking("alpha", "setup.privacy", { note: "second writer", by: "b" });
        assert.deepStrictEqual((yield* plain.load).data.tracking.map((t) => [t.owner, t.notes]), [["first", "second writer"]]);
      })));

  it.effect("the lock is released when the write fails; a held lock names who and when; a lock older than 60 s is broken with a warning", () =>
    withStore(baseFiles(), ({ dir }) =>
      Effect.gen(function* () {
        const store = yield* Store;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const lock = path.join(dir, LOCK_FILE);
        assert.strictEqual((yield* store.setTracking("alpha", "nope", { owner: "x", by: "a" }).pipe(Effect.flip))._tag, "Rejected");
        assert.isFalse(yield* fs.exists(lock));

        yield* fs.writeFileString(lock, JSON.stringify({ at: 0, time: "1970-01-01T00:00:00Z", by: "crashed-run", token: "t" }));
        const held = yield* store.setRelease("beta", "0.1").pipe(Effect.flip);
        assert.strictEqual(held._tag, "StoreLocked");
        assert.include(held.message, "held by crashed-run since 1970-01-01T00:00:00Z");
        assert.include(held.message, "nothing was written");
        assert.isTrue(yield* fs.exists(lock));
        assert.include(yield* fs.readFileString(path.join(dir, "apps.jsonl")), '"id":"beta"');
        assert.notInclude(yield* fs.readFileString(path.join(dir, "apps.jsonl")), '"0.1"');

        yield* TestClock.adjust("61 seconds");
        yield* store.setRelease("beta", "0.1");
        assert.include(yield* fs.readFileString(path.join(dir, "apps.jsonl")), '"version":"0.1"');
        assert.include((yield* TestConsole.errorLines).map(String).join("\n"), "warning: broke a stale kb lock");
        assert.isFalse(yield* fs.exists(lock));
        assert.deepStrictEqual((yield* fs.readDirectory(dir)).filter((n) => n.startsWith(".")), []);
      })));
});

describe("multi-file commit", () => {
  const twoFiles = Effect.gen(function* () {
    const loaded = yield* Store.use((s) => s.load);
    const released = applySetRelease(loaded.data, "alpha", "2.0");
    if (released._tag !== "Success") return assert.fail("applySetRelease failed");
    const next = applySet(released.success.data, "alpha", "setup.privacy", { owner: "me", by: "me" }, { now: "2026-09-18T00:00:00Z", today: "2026-09-18" });
    if (next._tag !== "Success") return assert.fail("applySet failed");
    return { loaded, data: next.success.data };
  });
  const TARGETS = ["apps.jsonl", "tracking/alpha.jsonl"];

  it.effect("every target hash is verified before ANY file is written", () =>
    withStore(baseFiles({ "tracking/alpha.jsonl": lines([tracking()]) }), ({ dir, write }) =>
      Effect.gen(function* () {
        const { loaded, data } = yield* twoFiles;
        yield* write("tracking/alpha.jsonl", lines([tracking({ owner: "someone-else" })]));
        const before = yield* readAll(dir);
        const error = yield* Store.use((s) => s.commit(loaded, data, TARGETS)).pipe(Effect.flip);
        assert.strictEqual(error._tag, "ConcurrentEdit");
        assert.include(error.message, "tracking/alpha.jsonl changed on disk");
        assert.deepStrictEqual(yield* readAll(dir), before, "apps.jsonl was written before the second file failed");
      })));

  it.effect("a failure after the first rename names exactly which files were and were not written", () =>
    withStore(baseFiles({ "tracking/alpha.jsonl": lines([tracking()]) }), ({ dir }) =>
      Effect.gen(function* () {
        const { loaded, data } = yield* twoFiles;
        const failing = hookedStore(dir, (_, to) =>
          to.endsWith("alpha.jsonl")
            ? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "rename", pathOrDescriptor: to, description: "disk says no" }))
            : Effect.void);
        const error = yield* Store.use((s) => s.commit(loaded, data, TARGETS)).pipe(Effect.provide(failing), Effect.flip);
        assert.strictEqual(error._tag, "PartialWrite");
        assert.include(error.message, "written: apps.jsonl");
        assert.include(error.message, "NOT written: tracking/alpha.jsonl");
        const after = yield* readAll(dir);
        assert.include(after["apps.jsonl"], '"version":"2.0"');
        assert.strictEqual(after["tracking/alpha.jsonl"], lines([tracking()]));
        assert.deepStrictEqual(Object.keys(after).filter((n) => n.includes(".tmp") || n.includes(".lock")), [], "no temp or lock file is left");
      })));
});

describe("fmt", () => {
  it.effect("sorts, fixes key order and blank lines, is idempotent, and then validate is clean", () =>
    withStore(
      baseFiles({
        "apps.jsonl": lines([app({ id: "beta" })]) + "\n" + JSON.stringify(Object.fromEntries(Object.entries(app()).reverse()), null, 1).replaceAll("\n", "") + "\n",
        "tracking/alpha.jsonl": lines([tracking(), tracking({ requirement: "release.smoke", release: "1.0" })]),
      }),
      ({ dir }) =>
        Effect.gen(function* () {
          const store = yield* Store;
          const first = yield* store.fmt;
          assert.deepStrictEqual([...first.changed].sort(), ["apps.jsonl", "tracking/alpha.jsonl"]);
          const after = yield* readAll(dir);
          assert.strictEqual(after["apps.jsonl"], lines([app(), app({ id: "beta" })]));
          assert.deepStrictEqual((yield* store.fmt).changed, []);
          assert.deepStrictEqual(yield* readAll(dir), after);
          assert.deepStrictEqual(yield* store.validate, []);
        }),
    ));

  it.effect("leaves a damaged file alone and reports why", () =>
    withStore(baseFiles({ "apps.jsonl": lines([app({ id: "beta" }), app()]) + "<<<<<<< HEAD\n=======\n>>>>>>> x\n" }), ({ dir }) =>
      Effect.gen(function* () {
        const before = yield* readAll(dir);
        const result = yield* Store.use((s) => s.fmt);
        assert.deepStrictEqual(result.skipped, ["apps.jsonl"]);
        assert.deepStrictEqual(result.issues.map((i) => i._tag), ["ConflictMarker"]);
        assert.deepStrictEqual(yield* readAll(dir), before);
      })));
});

describe("Roots", () => {
  it.effect("kb and skills derive from the data dir; others come from kb.roots.json; url passes through", () =>
    withStore(baseFiles({ "sources.jsonl": lines([source()]) }), ({ dir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const kb = path.dirname(dir);
        yield* fs.writeFileString(path.join(kb, "PLAYBOOK.md"), "# p");
        yield* fs.makeDirectory(path.join(kb, "private-apps", "apps", "alpha"), { recursive: true });
        yield* fs.writeFileString(path.join(kb, "kb.roots.json"), JSON.stringify({ apps: "private-apps", wiki: "/does/not/exist" }));
        return kb;
      }).pipe(
        Effect.flatMap((kb) =>
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const roots = yield* Roots;
            assert.deepStrictEqual(yield* roots.resolve("kb", "PLAYBOOK.md"), { _tag: "available", root: "kb", path: "PLAYBOOK.md", absolute: path.join(kb, "PLAYBOOK.md") });
            assert.strictEqual((yield* roots.resolve("kb", "MISSING.md"))._tag, "unavailable");
            assert.deepStrictEqual(yield* roots.resolve("url", "https://example.com/a"), { _tag: "url", root: "url", url: "https://example.com/a" });
            const home = yield* roots.resolve("home-skills", "x/SKILL.md");
            assert.strictEqual(home._tag, "unavailable");
            assert.include(home._tag === "unavailable" ? home.reason : "", 'private root "home-skills"');
            assert.include(home._tag === "unavailable" ? home.reason : "", "KB_ROOT_HOME_SKILLS");
            const wiki = yield* roots.root("wiki");
            assert.include(wiki._tag === "unavailable" ? wiki.reason : "", "does not exist");
            assert.strictEqual((yield* roots.resolve("kb", "../escape.md"))._tag, "unavailable");
          }).pipe(Effect.provide(Roots.layer(dir)))
        ),
      )));
});
