import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { containedRealPath, mayPublish } from "../src/access.ts";
import { Roots } from "../src/roots.ts";
import { Store } from "../src/store.ts";
import { refViews } from "../src/views.ts";
import { baseFiles, lines, requirement, source, TestEnv, withStore } from "./helpers.ts";

describe("mayPublish", () => {
  it("needs the flag AND a non-private root AND an allowed access AND a license when vendored", () => {
    assert.isTrue(mayPublish(source()));
    assert.isTrue(mayPublish(source({ access: "vendored", license: "MIT" })));
    assert.isTrue(mayPublish(source({ root: "url", path: "https://example.com", access: "public-url" })));
    assert.isFalse(mayPublish(source({ publishable: false })));
    assert.isFalse(mayPublish(source({ access: "vendored", license: null })));
    for (const access of ["private-repo", "private-wiki", "local-only", "linked-only"] as const) assert.isFalse(mayPublish(source({ access })), access);
    for (const root of ["wiki", "apps", "home-skills"] as const) assert.isFalse(mayPublish(source({ root, access: "repo", license: "MIT" })), root);
    // the reviewer's record
    assert.isFalse(mayPublish(source({ root: "wiki", access: "private-wiki", publishable: true })));
  });
});

describe("containedRealPath", () => {
  it.effect("returns the real path inside the root; fails for a symlink or .. that leaves it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmp = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "kb-access-" }));
      const rootDir = path.join(tmp, "root");
      yield* fs.makeDirectory(path.join(rootDir, "sub"), { recursive: true });
      yield* fs.writeFileString(path.join(rootDir, "sub", "in.md"), "in");
      yield* fs.writeFileString(path.join(tmp, "secret.md"), "out");
      yield* fs.symlink(path.join(tmp, "secret.md"), path.join(rootDir, "leak.md"));
      yield* fs.symlink(path.join(rootDir, "sub", "in.md"), path.join(rootDir, "alias.md"));
      yield* fs.symlink(tmp, path.join(rootDir, "up"));

      assert.strictEqual(yield* containedRealPath(rootDir, path.join(rootDir, "sub", "in.md")), path.join(rootDir, "sub", "in.md"));
      assert.strictEqual(yield* containedRealPath(rootDir, path.join(rootDir, "alias.md")), path.join(rootDir, "sub", "in.md"));
      for (const escaping of ["leak.md", "up/secret.md", "../secret.md", "up"]) {
        const error = yield* containedRealPath(rootDir, path.join(rootDir, escaping)).pipe(Effect.flip);
        assert.strictEqual(error._tag, "EscapesRoot", escaping);
      }
      assert.strictEqual((yield* containedRealPath(rootDir, path.join(rootDir, "missing.md")).pipe(Effect.flip))._tag, "PlatformError");
    }).pipe(Effect.scoped, Effect.provide(TestEnv)));
});

describe("Roots containment", () => {
  it.effect("refs: a record path that leaves its root through a symlink is unavailable, never a location", () =>
    withStore(baseFiles({ "sources.jsonl": lines([source({ id: "leak", path: "LEAK.md" }), source()]), "requirements.jsonl": lines([requirement({ refs: [{ source: "leak" }, { source: "playbook" }] })]), "../PLAYBOOK.md": "# p\n" }), ({ dir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const outside = yield* fs.makeTempDirectoryScoped({ prefix: "kb-outside-" });
        yield* fs.writeFileString(path.join(outside, "secret.md"), "secret");
        yield* fs.symlink(path.join(outside, "secret.md"), path.join(path.dirname(dir), "LEAK.md"));
        const { data } = yield* Store.use((s) => s.load);
        const refs = yield* refViews(data, data.requirements);
        assert.deepStrictEqual(refs.map((r) => [r.source, r.availability, r.location === null]), [["leak", "unavailable", true], ["playbook", "available", false]]);
        assert.include(refs[0]?.reason, 'leaves root "kb"');
        assert.strictEqual((yield* Roots.use((r) => r.resolve("kb", "LEAK.md")))._tag, "unavailable");
      })));
});
