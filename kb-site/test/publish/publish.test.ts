import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { buildSite } from "../../src/html/site.ts";
import { Roots } from "../../src/roots.ts";
import { Store } from "../../src/store.ts";
import { refViews } from "../../src/views.ts";
import { decideSource, type Manifest, publish } from "../../src/publish/publish.ts";
import { scanText } from "../../src/publish/scan.ts";
import { Git } from "../../src/sync/git.ts";
import { baseFiles, lines, source, withStore } from "../helpers.ts";
import { LONG, root } from "../sync/world.ts";
import { TestConsole } from "effect/testing";
import { Command } from "effect/unstable/cli";

// Assembled at run time so this test file never holds a string a scanner would flag.
const fakeGithubToken = ["ghp", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"].join("_");
const fakeAwsKey = "AKIA" + "ABCDEFGHIJKLMNOP";

const SOURCES = [
  source(), // kb / repo / publishable -> copied
  source({ id: "draft", path: "DRAFT.md", publishable: false }),
  source({ id: "pack.skill", kind: "external", path: "external/pack/skills/a/SKILL.md", access: "vendored", license: "MIT" }),
  source({ id: "nolicense.guide", kind: "external", path: "external/nolicense/GUIDE.md", access: "vendored", license: null, publishable: true }),
  source({ id: "paid.course", kind: "url", root: "url", path: "https://example.com/course", access: "linked-only", publishable: false }),
  source({ id: "apple.docs", kind: "url", root: "url", path: "https://developer.apple.com/app-store/review/guidelines/", access: "public-url", publishable: true }),
  source({ id: "apps.playbook", root: "apps", path: "docs/playbooks/new-app.md", access: "private-repo", publishable: false }),
  source({ id: "wiki.apps", kind: "wiki", root: "wiki", path: "playbook/apps.md", access: "private-wiki", publishable: false }),
  source({ id: "missing", path: "NOT-THERE.md" }),
];

const kbFiles: Record<string, string> = {
  "PLAYBOOK.md": "# Playbook\nShip it.\n",
  "DRAFT.md": "draft, not for sharing\n",
  "external/pack/skills/a/SKILL.md": "# Skill A\n",
  "external/pack/LICENSE": "MIT License\n",
  "external/pack/UPSTREAM.md": "pinned\n",
  "external/nolicense/GUIDE.md": "all rights reserved\n",
  "cli.ts": "// cli\n",
  "package.json": "{}\n",
  "src/core.ts": "export const x = 1;\n",
  "src/.hidden": "no\n",
  "docs/CONTRIBUTING.md": "# Contributing\n",
  "docs/PLAN.md": "internal plan\n",
  "kb.roots.json": "{}\n",
};

/** A kb dir around `withStore`'s data dir, plus private roots mapped through kb.roots.json. */
const withFixture = <A, E>(
  sources: ReadonlyArray<unknown>,
  extra: Record<string, string>,
  f: (ctx: { readonly kb: string; readonly out: string; readonly tmp: string }) => Effect.Effect<A, E, any>,
) =>
  withStore(baseFiles({ "sources.jsonl": lines(sources) }), ({ dir }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const kb = path.dirname(dir);
      for (const [rel, text] of Object.entries({ ...kbFiles, ...extra })) {
        yield* fs.makeDirectory(path.dirname(path.join(kb, rel)), { recursive: true });
        yield* fs.writeFileString(path.join(kb, rel), text);
      }
      const tmp = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "kb-publish-" }));
      return yield* f({ kb, tmp, out: path.join(tmp, "bundle") });
    }).pipe(Effect.provide(Git.layer)));

const sorted = (xs: ReadonlyArray<string>) => [...xs].sort();

describe("decideSource", () => {
  it("copies only repo text and licensed vendored text; links public URLs; never opens a private root", () => {
    const by = Object.fromEntries(SOURCES.map((s) => [s.id, decideSource(s)]));
    assert.deepStrictEqual(by["playbook"], { action: "copy" });
    assert.deepStrictEqual(by["pack.skill"], { action: "copy" });
    assert.deepStrictEqual(by["apple.docs"], { action: "link", url: "https://developer.apple.com/app-store/review/guidelines/" });
    assert.deepStrictEqual(by["draft"], { action: "exclude", reason: "publishable is false" });
    assert.include((by["paid.course"] as { reason: string }).reason, "linked-only");
    assert.include((by["nolicense.guide"] as { reason: string; warning: string }).reason, "without a license");
    assert.include((by["nolicense.guide"] as { warning: string }).warning, "the flag was ignored");
    for (const rootName of ["wiki", "apps", "home-skills"] as const) {
      // a record that claims everything still loses
      const d = decideSource(source({ id: "x", root: rootName, access: "repo", license: "MIT", publishable: true }));
      assert.strictEqual(d.action, "exclude");
      assert.include((d as { error: string }).error, `private root "${rootName}"`);
    }
    assert.strictEqual(decideSource(source({ access: "linked-only", publishable: true, license: "MIT" })).action, "exclude");
  });
});

describe("publish", () => {
  it.effect("bundles records, tool files, and publishable text; lists everything else with the reason", () =>
    withFixture(SOURCES, {}, ({ out }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { manifest: m } = yield* publish({ out, force: false });
        assert.isTrue(m.ok, JSON.stringify(m.errors));
        assert.deepStrictEqual(m.files.map((f) => f.path), sorted([
          ".gitignore",
          "README.md",
          "kb.roots.json",
          "cli.ts",
          "content/kb/PLAYBOOK.md",
          "content/kb/external/pack/LICENSE",
          "content/kb/external/pack/UPSTREAM.md",
          "content/kb/external/pack/skills/a/SKILL.md",
          "data/apps.jsonl",
          "data/conflicts.jsonl",
          "data/requirements.jsonl",
          "data/sources.jsonl",
          "docs/CONTRIBUTING.md",
          "docs/PLAN.md",
          "package.json",
          "src/core.ts",
        ]));
        assert.deepStrictEqual(m.sources.copied.map((s) => s.id), ["pack.skill", "playbook"]);
        assert.deepStrictEqual(m.sources.linked, [{ id: "apple.docs", url: "https://developer.apple.com/app-store/review/guidelines/" }]);
        const reasons = Object.fromEntries(m.sources.excluded.map((e) => [e.id, e.reason]));
        assert.deepStrictEqual(Object.keys(reasons), ["apps.playbook", "draft", "missing", "nolicense.guide", "paid.course", "wiki.apps"]);
        assert.include(reasons["apps.playbook"], 'root "apps" is private');
        assert.include(reasons["wiki.apps"], 'root "wiki" is private');
        assert.include(reasons["missing"], "not available on this machine");
        assert.include(reasons["nolicense.guide"], "without a license");
        assert.include(reasons["paid.course"], "linked-only");
        assert.strictEqual(reasons["draft"], "publishable is false");
        assert.deepStrictEqual(m.warnings.length, 1); // the contradictory flag on nolicense.guide
        assert.deepStrictEqual(
          [m.counts.files, m.counts.sources_total, m.counts.sources_copied, m.counts.sources_linked, m.counts.sources_excluded, m.counts.errors],
          [16, 9, 2, 1, 6, 0],
        );
        assert.match(m.files[0]!.sha256, /^[0-9a-f]{64}$/);
        assert.isFalse(yield* fs.exists(path.join(out, "content", "kb", "external", "nolicense")));
        assert.isFalse(yield* fs.exists(path.join(out, "content", "kb", "DRAFT.md")));
        assert.isFalse(yield* fs.exists(path.join(out, "docs", "MIGRATION.md")));
        // the repository's machine-specific kb.roots.json ("{}" here) is never copied; the bundle gets its own
        assert.deepStrictEqual(JSON.parse(yield* fs.readFileString(path.join(out, "kb.roots.json"))), { kb: "content/kb", skills: "content/skills" });
        assert.notInclude(yield* fs.readFileString(path.join(out, ".gitignore")), "kb.roots.json");
        assert.strictEqual(yield* fs.readFileString(path.join(out, "content", "kb", "PLAYBOOK.md")), "# Playbook\nShip it.\n");
        assert.deepStrictEqual(JSON.parse(yield* fs.readFileString(path.join(out, "MANIFEST.json"))), m);
      })), LONG);

  it.effect("the bundle has its OWN README: run steps, manifest, exclusions; the repository README is not copied; every relative link resolves inside the bundle", () =>
    withFixture([...SOURCES, source({ id: "kb.readme", path: "README.md" })], {
      "README.md": "# kb-site\nPlan: [docs/PLAN.md](./docs/PLAN.md). Seeding: [docs/MIGRATION.md](./docs/MIGRATION.md).\n",
      "docs/MIGRATION.md": "how the private sources were read\n",
    }, ({ out }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { manifest: m } = yield* publish({ out, force: false });
        assert.isTrue(m.ok, JSON.stringify(m.errors));
        const readme = yield* fs.readFileString(path.join(out, "README.md"));
        for (const part of ["bun install", "bun cli.ts --help", "bun build.ts", "MANIFEST.json", "Excluded", "private", "docs/MIGRATION.md"]) assert.include(readme, part);
        assert.notInclude(readme, "# kb-site");

        const links = [...readme.matchAll(/\]\(([^)\s]+)\)/g)].map((x) => x[1] as string).filter((l) => !/^[a-z]+:/i.test(l) && !l.startsWith("#"));
        assert.isAbove(links.length, 3);
        for (const link of links) {
          const target = path.resolve(out, link.split("#")[0] as string);
          assert.isTrue(target.startsWith(out + path.sep), `${link} leaves the bundle`);
          assert.isTrue(yield* fs.exists(target), `dead link in the bundle README: ${link}`);
        }
        // the repository README (its links point outside the bundle) is listed, not copied
        assert.isFalse(yield* fs.exists(path.join(out, "content", "kb", "README.md")));
        assert.include(m.sources.excluded.find((e) => e.id === "kb.readme")?.reason ?? "", "the bundle has its own README.md");
        assert.isFalse(yield* fs.exists(path.join(out, "docs", "MIGRATION.md")));
      })), LONG);

  it.effect("a bundle without docs/PLAN.md has no link to it", () =>
    withFixture(SOURCES, {}, ({ kb, out }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.remove(path.join(kb, "docs", "PLAN.md"));
        yield* publish({ out, force: false });
        assert.notInclude(yield* fs.readFileString(path.join(out, "README.md")), "](./docs/PLAN.md)");
      })), LONG);

  it.effect("the manifest is deterministic: two runs into two directories are byte-identical", () =>
    withFixture(SOURCES, {}, ({ out, tmp }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* publish({ out, force: false });
        yield* publish({ out: path.join(tmp, "again"), force: false });
        const [a, b] = [yield* fs.readFileString(path.join(out, "MANIFEST.json")), yield* fs.readFileString(path.join(tmp, "again", "MANIFEST.json"))];
        assert.strictEqual(a, b);
        assert.notInclude(a, tmp, "no absolute path in the manifest");
      })), LONG);

  it.effect("a private root flagged publishable is refused at the record level: no bundle is started", () =>
    withFixture(
      [...SOURCES, source({ id: "wiki.leak", kind: "wiki", root: "wiki", path: "secret.md", access: "repo", license: "MIT", publishable: true })],
      { "kb.roots.json": JSON.stringify({ wiki: "./private-wiki" }), "private-wiki/secret.md": "owner only\n" },
      ({ out }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const message = (yield* Effect.flip(publish({ out, force: false }))).message;
          assert.include(message, "the store is invalid");
          assert.include(message, 'root "wiki" is private and is never published');
          assert.isFalse(yield* fs.exists(out));
        }),
    ), LONG);

  it.effect("symlinks that leave their root are skipped and reported: companion files, tool files, tool dirs, data files", () =>
    withFixture(SOURCES, {}, ({ out, kb, tmp }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const SECRET = "OUTSIDE-SECRET-c41d";
        const outside = path.join(tmp, "outside");
        yield* fs.makeDirectory(path.join(outside, "dir"), { recursive: true });
        for (const name of ["LICENSE", "leak.ts", "dir/inner.ts", "PLAYBOOK.md"]) yield* fs.writeFileString(path.join(outside, name), `${SECRET}\n`);
        yield* fs.writeFileString(path.join(outside, "zeta.jsonl"), "");
        yield* fs.remove(path.join(kb, "external", "pack", "LICENSE"));
        yield* fs.symlink(path.join(outside, "LICENSE"), path.join(kb, "external", "pack", "LICENSE"));
        yield* fs.symlink(path.join(outside, "leak.ts"), path.join(kb, "src", "leak.ts"));
        yield* fs.symlink(path.join(outside, "dir"), path.join(kb, "src", "linked-dir"));
        yield* fs.makeDirectory(path.join(kb, "data", "tracking"), { recursive: true });
        yield* fs.symlink(path.join(outside, "zeta.jsonl"), path.join(kb, "data", "tracking", "zeta.jsonl"));
        yield* fs.remove(path.join(kb, "PLAYBOOK.md"));
        yield* fs.symlink(path.join(outside, "PLAYBOOK.md"), path.join(kb, "PLAYBOOK.md"));
        // a symlink that stays inside is fine
        yield* fs.symlink(path.join(kb, "src", "core.ts"), path.join(kb, "src", "alias.ts"));

        const { manifest: m } = yield* publish({ out, force: false });
        const paths = m.files.map((f) => f.path);
        for (const gone of ["content/kb/external/pack/LICENSE", "src/leak.ts", "src/linked-dir/inner.ts", "data/tracking/zeta.jsonl", "content/kb/PLAYBOOK.md"]) {
          assert.notInclude(paths, gone);
          assert.isFalse(yield* fs.exists(path.join(out, ...gone.split("/"))), gone);
        }
        assert.include(paths, "src/alias.ts");
        const warned = m.warnings.join("\n");
        for (const name of ["content/kb/external/pack/LICENSE", "src/leak.ts", "src/linked-dir", "data/tracking/zeta.jsonl"]) assert.include(warned, `${name}: symlink leaves`, name);
        assert.include(m.sources.excluded.find((e) => e.id === "playbook")?.reason, 'leaves root "kb"');
        assert.notInclude(JSON.stringify(m), tmp);
        for (const f of m.files) assert.notInclude(yield* fs.readFileString(path.join(out, ...f.path.split("/"))), SECRET, f.path);
      })), LONG);

  it.effect("the bundle is self-contained: its kb.roots.json makes refs and the HTML build find the copied text under content/", () =>
    withFixture(SOURCES, {}, ({ out }) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        yield* publish({ out, force: false });
        const bundleData = path.join(out, "data");
        const inBundle = Effect.gen(function* () {
          const { data } = yield* Store.use((s) => s.load);
          const resolved = yield* Roots.use((r) => r.resolve("kb", "PLAYBOOK.md"));
          assert.deepStrictEqual(resolved, { _tag: "available", root: "kb", path: "PLAYBOOK.md", absolute: path.join(out, "content", "kb", "PLAYBOOK.md") });
          assert.strictEqual((yield* Roots.use((r) => r.resolve("kb", "external/pack/skills/a/SKILL.md")))._tag, "available");
          assert.strictEqual((yield* Roots.use((r) => r.resolve("kb", "DRAFT.md")))._tag, "unavailable");
          const refs = yield* refViews(data, data.requirements);
          assert.deepStrictEqual(refs.map((r) => [r.source, r.location]), [["playbook", path.join(out, "content", "kb", "PLAYBOOK.md")], ["playbook", path.join(out, "content", "kb", "PLAYBOOK.md")]]);
          const site = yield* buildSite({ stamp: "FIXED", sections: [{ id: "p", title: "P", docs: [{ id: "d", title: "Playbook", source: "playbook" }] }] });
          assert.deepStrictEqual(site.docs.map((d) => d.kind), ["rendered"]);
          assert.include(site.html, "Ship it.");
        });
        yield* inBundle.pipe(Effect.provide(Layer.mergeAll(Store.layer(bundleData), Roots.layer(bundleData))));
      })), LONG);

  it.effect("secret scan: errors fail the command, the bundle stays, MANIFEST says ok:false, values are never printed", () =>
    withFixture(
      [...SOURCES.slice(0, 1), source({ id: "with.key", path: "KEYS.md", notes: `reviewer login ${fakeAwsKey}` })],
      { "KEYS.md": `# Setup\n\nexport GITHUB_TOKEN=${fakeGithubToken}\nmail jane.doe@corp.io or support@corp.io\nsee /Users/jane/Projects/app/notes\n` },
      ({ out, kb }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const run = yield* Effect.exit(Command.runWith(root, { version: "0.0.0" })(["--data", path.join(kb, "data"), "publish", "--out", out]));
          assert.strictEqual(run._tag, "Failure");
          const printed = (yield* TestConsole.errorLines).map(String).join("\n");
          assert.include(printed, "BUNDLE NOT OK");
          assert.include(printed, "error: content/kb/KEYS.md:3 github-token");
          assert.include(printed, "error: data/sources.jsonl:2 aws-access-key-id"); // the JSONL records are scanned too
          assert.include(printed, "warning: content/kb/KEYS.md:4 email-address");
          assert.include(printed, "warning: content/kb/KEYS.md:5 absolute-home-path");
          assert.notInclude(printed, fakeGithubToken);
          assert.notInclude(printed, fakeAwsKey);

          const text = yield* fs.readFileString(path.join(out, "MANIFEST.json"));
          const m = JSON.parse(text) as Manifest;
          assert.isFalse(m.ok);
          assert.deepStrictEqual(m.findings.map((f) => `${f.severity} ${f.file}:${f.line} ${f.pattern}`), [
            "error content/kb/KEYS.md:3 github-token",
            "warning content/kb/KEYS.md:4 email-address",
            "warning content/kb/KEYS.md:5 absolute-home-path",
            "error data/sources.jsonl:2 aws-access-key-id",
          ]);
          assert.notInclude(text, fakeGithubToken);
          assert.isTrue(yield* fs.exists(path.join(out, "content", "kb", "KEYS.md")), "nothing is deleted silently");
        }),
    ), LONG);

  it.effect("--out is refused inside the repository, when not empty, and --force only replaces a previous bundle", () =>
    withFixture(SOURCES, {}, ({ out, kb, tmp }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const refusal = (o: string, force = false) => Effect.map(Effect.flip(publish({ out: o, force })), (e) => e.message);
        assert.include(yield* refusal(path.join(kb, "dist", "bundle")), "is inside");
        assert.include(yield* refusal(path.join(kb, "data")), "is inside");
        assert.include(yield* refusal(path.dirname(kb)), "contains");
        assert.isFalse(yield* fs.exists(path.join(kb, "dist")));

        const busy = path.join(tmp, "busy");
        yield* fs.makeDirectory(busy);
        yield* fs.writeFileString(path.join(busy, "thesis.txt"), "mine\n");
        assert.include(yield* refusal(busy), "is not empty");
        assert.include(yield* refusal(busy, true), "--force only replaces a previous bundle");
        assert.deepStrictEqual(yield* fs.readDirectory(busy), ["thesis.txt"]);

        // a previous bundle: --force replaces its files, drops stale ones, and leaves strangers alone
        yield* publish({ out, force: false });
        assert.include(yield* refusal(out), "is not empty");
        yield* fs.writeFileString(path.join(out, "stranger.txt"), "not ours\n");
        yield* fs.remove(path.join(kb, "external", "pack", "skills", "a", "SKILL.md"));
        const { manifest } = yield* publish({ out, force: true });
        assert.isFalse(manifest.files.some((f) => f.path.endsWith("SKILL.md")));
        assert.isFalse(yield* fs.exists(path.join(out, "content", "kb", "external", "pack", "skills", "a", "SKILL.md")));
        assert.strictEqual(yield* fs.readFileString(path.join(out, "stranger.txt")), "not ours\n");
      })), LONG);

  it.effect("an invalid store is not bundled", () =>
    withFixture([...SOURCES, source()], {}, ({ out }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const message = (yield* Effect.flip(publish({ out, force: false }))).message;
        assert.include(message, "the store is invalid");
        assert.include(message, "duplicate id");
        assert.isFalse(yield* fs.exists(out));
      })), LONG);
});

describe("scanText", () => {
  const hit = (text: string) => scanText("f", text).map((f) => `${f.severity}:${f.pattern}`);
  it("flags each secret pattern as an error", () => {
    const samples: Record<string, string> = {
      "private-key-block": ["-----BEGIN", "OPENSSH", "PRIVATE KEY-----"].join(" "),
      "sk-api-key": "key = " + ["sk", "proj", "a1B2c3D4e5F6g7H8i9J0k1L2"].join("-"),
      "stripe-live-key": ["sk", "live", "4eC39HqLyjWDarjtT1zdp7dc"].join("_"),
      "github-token": fakeGithubToken,
      "slack-token": ["xoxb", "123456789012", "abcdefghijklmnop"].join("-"),
      "aws-access-key-id": fakeAwsKey,
      "jwt": ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", "dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"].join("."),
      "authorization-bearer": "Authorization: Bearer " + "a9f3c1e7b2d84f60a1c5e9d3",
      "password-assignment": "password" + ": hunter2-prod",
    };
    for (const [pattern, text] of Object.entries(samples)) assert.include(hit(`x\n${text}\n`), `error:${pattern}`, pattern);
  });

  it("placeholders and generic mailboxes pass; a personal address and a home path warn", () => {
    assert.deepStrictEqual(hit("Authorization: Bearer $TOKEN\nAuthorization: Bearer <token>\nPassword: <password>\npassword: string\n"), []);
    assert.deepStrictEqual(hit("mail noreply@apple.com, support@corp.io, git@github.com:me/repo.git, icon@2x.png, jane@example.com"), []);
    assert.deepStrictEqual(hit("ask jane.doe@corp.io"), ["warning:email-address"]);
    assert.deepStrictEqual(hit("cd /Users/jane/Projects\ncd /Users/<name>/x\ncd ~/Projects"), ["warning:absolute-home-path"]);
  });

  it("a NUL byte does not hide a secret: the text is scanned anyway and the file is flagged unscannable-binary", () => {
    const nul = String.fromCharCode(0);
    assert.deepStrictEqual(hit(`${nul}\nexport T=${fakeGithubToken}\n`), ["warning:unscannable-binary", "error:github-token"]);
    // UTF-16 style text: a NUL between every character
    assert.include(hit([...fakeAwsKey].join(nul)), "error:aws-access-key-id");
    assert.deepStrictEqual(hit("plain text\n"), []);
  });
});
