/** `checklist` / `compare` filters and the `--roots` global flag. */
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestConsole } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { makeRoot } from "../src/commands.ts";
import { app, baseFiles, cliRunner, envWith, lines, requirement, source, tracking, withStore } from "./helpers.ts";

const root = makeRoot("/nonexistent/default/data");
const link = { kind: "link", ref: "https://x", date: "2026-09-02" } as const;

const files = () =>
  baseFiles({
    "requirements.jsonl": lines([
      requirement({ id: "release.smoke", phase: "release", cadence: "every_release", evidence_required: false }),
      requirement({ id: "setup.gate", owner_gate: true, acceptance: "verified" }),
      requirement({ id: "setup.old", acceptance: "retired" }),
      requirement(),
      requirement({ id: "submission.notes", phase: "submission", acceptance: "candidate" }),
    ]),
    "apps.jsonl": lines([app(), app({ id: "beta", name: "Beta", path: "apps/beta" })]),
    "tracking/alpha.jsonl": lines([tracking({ status: "done", evidence: [link] }), tracking({ requirement: "submission.notes", status: "done", evidence: [link] })]),
    "tracking/beta.jsonl": lines([tracking({ app: "beta", requirement: "submission.notes", status: "done", evidence: [link] })]),
  });

type Item = { readonly requirement: string };
const ids = (body: { readonly items: ReadonlyArray<Item> }) => body.items.map((i) => i.requirement);

describe("checklist filters", () => {
  it.effect("--phase (repeatable), --cadence, --owner-gate, --acceptance: the counts cover the filtered set and the line says so", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = cliRunner(root, dir);
        const json = (...argv: ReadonlyArray<string>) => Effect.map(run("checklist", "alpha", ...argv, "--json"), (r) => JSON.parse(r.stdout));

        const all = yield* json();
        assert.deepStrictEqual([ids(all), all.filters, all.matched, all.total], [["setup.gate", "setup.privacy", "submission.notes", "release.smoke"], [], 5, 5]);
        assert.notInclude((yield* run("checklist", "alpha")).stdout, "filtered");

        const phases = yield* json("--phase", "setup", "--phase", "release");
        assert.deepStrictEqual([ids(phases), phases.filters, phases.matched, phases.total], [["setup.gate", "setup.privacy", "release.smoke"], ["phase=setup,release"], 4, 5]);
        assert.deepStrictEqual([phases.counts.complete, phases.counts.todo, phases.counts.retired], [1, 2, 1]);

        assert.deepStrictEqual(ids(yield* json("--cadence", "every_release")), ["release.smoke"]);
        const gated = yield* json("--owner-gate");
        assert.deepStrictEqual([ids(gated), gated.filters, gated.counts.todo, gated.counts.complete], [["setup.gate"], ["owner-gate"], 1, 0]);
        // an acceptance filter shows every state, the retired one included
        assert.deepStrictEqual(ids(yield* json("--acceptance", "retired")), ["setup.old"]);
        assert.deepStrictEqual(ids(yield* json("--acceptance", "candidate", "--phase", "submission")), ["submission.notes"]);
        assert.deepStrictEqual(ids(yield* json("--phase", "setup", "--state", "complete")), ["setup.privacy"]);

        const text = (yield* run("checklist", "alpha", "--phase", "setup", "--state", "complete")).stdout;
        assert.include(text, "retired 1, complete 1, todo 1 (filtered: phase=setup; state=complete; counts cover 3 of 5 checks, 1 shown)");
        assert.isFalse((yield* run("checklist", "alpha", "--phase", "nope")).ok);
      })));
});

describe("compare filters", () => {
  it.effect("--diff keeps only rows where the states differ; --phase / --cadence filter; the per-app count table stays", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = cliRunner(root, dir);
        const json = (...argv: ReadonlyArray<string>) => Effect.map(run("compare", "alpha", "beta", ...argv, "--json"), (r) => JSON.parse(r.stdout));
        const rows = (body: { readonly rows: ReadonlyArray<Item> }) => body.rows.map((r) => r.requirement);

        const all = yield* json();
        assert.deepStrictEqual([rows(all), all.filters, all.matched, all.total], [["setup.gate", "setup.privacy", "submission.notes", "release.smoke"], [], 4, 4]);

        const diff = yield* json("--diff");
        assert.deepStrictEqual(rows(diff), ["setup.privacy"]);
        assert.deepStrictEqual(diff.rows[0].states, { alpha: { state: "complete" }, beta: { state: "todo" } });
        assert.deepStrictEqual(diff.apps.map((a: { id: string; counts: { complete: number } }) => [a.id, a.counts.complete]), [["alpha", 2], ["beta", 1]], "counts are not reduced by --diff");
        assert.strictEqual(diff.filters[0], "diff (only rows where the states differ)");

        const setup = yield* json("--phase", "setup", "--phase", "submission");
        assert.deepStrictEqual([rows(setup), setup.matched, setup.total], [["setup.gate", "setup.privacy", "submission.notes"], 3, 4]);
        assert.deepStrictEqual(setup.apps.map((a: { counts: { complete: number; todo: number } }) => [a.counts.complete, a.counts.todo]), [[2, 1], [1, 2]]);
        assert.deepStrictEqual(rows(yield* json("--cadence", "every_release")), ["release.smoke"]);
        assert.deepStrictEqual(rows(yield* json("--cadence", "every_release", "--diff")), []);

        const text = (yield* run("compare", "alpha", "beta", "--diff", "--phase", "setup")).stdout;
        assert.include(text, "filtered: phase=setup; diff (only rows where the states differ); counts cover 2 of 4 checks, 1 row(s) shown");
        assert.match(text, /APP\s+RELEASE\s+EXCLUDED/);
        assert.include((yield* run("compare", "alpha", "beta", "--diff", "--cadence", "every_release")).stdout, "no matching checks");
      })));
});

describe("--roots", () => {
  const sources = lines([source(), source({ id: "apps-doc", root: "apps", path: "docs/A.md", access: "private-repo", publishable: false })]);
  const reqs = lines([requirement({ id: "release.smoke", phase: "release", cadence: "every_release" }), requirement({ refs: [{ source: "apps-doc" }] })]);

  const world = (dir: string) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // the roots file and the private root live AWAY from the data dir's parent (a `--data /tmp/copy` run)
      const elsewhere = path.join(path.dirname(path.dirname(dir)), `${path.basename(path.dirname(dir))}-elsewhere`);
      yield* fs.makeDirectory(path.join(elsewhere, "private-apps", "docs"), { recursive: true });
      yield* fs.writeFileString(path.join(elsewhere, "private-apps", "docs", "A.md"), "# A");
      const rootsFile = path.join(elsewhere, "my.roots.json");
      yield* fs.writeFileString(rootsFile, JSON.stringify({ apps: "private-apps" }));
      yield* Effect.addFinalizer(() => fs.remove(elsewhere, { recursive: true }).pipe(Effect.ignore));
      return { rootsFile, expected: path.join(elsewhere, "private-apps", "docs", "A.md") };
    });
  const ref = (stdout: string) => JSON.parse(stdout).refs[0] as { availability: string; location?: string; reason?: string };

  it.effect("without it the private root is unavailable and the reason names --roots and KB_ROOTS_FILE; with it the root resolves relative to the roots file", () =>
    withStore(baseFiles({ "sources.jsonl": sources, "requirements.jsonl": reqs }), ({ dir }) =>
      Effect.gen(function* () {
        const { rootsFile, expected } = yield* world(dir);
        const missing = ref((yield* cliRunner(root, dir)("refs", "setup.privacy", "--json")).stdout);
        assert.strictEqual(missing.availability, "unavailable");
        for (const part of ['private root "apps"', "kb.roots.json", "KB_ROOT_APPS", "--roots <file>", "KB_ROOTS_FILE"]) assert.include(missing.reason ?? "", part);
        assert.include((yield* cliRunner(root, dir)("refs", "setup.privacy")).stdout, "--roots <file>");

        const found = ref((yield* cliRunner(root, dir, ["--roots", rootsFile])("refs", "setup.privacy", "--json")).stdout);
        assert.deepStrictEqual([found.availability, found.location], ["available", expected]);
      }).pipe(Effect.scoped)));

  it.effect("KB_ROOTS_FILE does the same; --roots wins over it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "kb-roots-env-" });
      yield* fs.makeDirectory(`${tmp}/private-apps/docs`, { recursive: true });
      yield* fs.writeFileString(`${tmp}/private-apps/docs/A.md`, "# A");
      yield* fs.writeFileString(`${tmp}/env.roots.json`, JSON.stringify({ apps: "private-apps" }));
      yield* fs.writeFileString(`${tmp}/flag.roots.json`, JSON.stringify({ apps: "nowhere" }));
      yield* withStore(baseFiles({ "sources.jsonl": sources, "requirements.jsonl": reqs }), ({ dir }) =>
        Effect.gen(function* () {
          assert.strictEqual(ref((yield* cliRunner(root, dir)("refs", "setup.privacy", "--json")).stdout).availability, "available");
          const flagged = ref((yield* cliRunner(root, dir, ["--roots", `${tmp}/flag.roots.json`])("refs", "setup.privacy", "--json")).stdout);
          assert.strictEqual(flagged.availability, "unavailable");
          assert.include(flagged.reason ?? "", "does not exist");
        }), envWith({ KB_USER: "tester", KB_ROOTS_FILE: `${tmp}/env.roots.json` }));
    }).pipe(Effect.scoped, Effect.provide(envWith({}))));
});

describe("a missing data dir", () => {
  it.effect("the DEFAULT dir (no --data) gets one friendly line that names --data and --roots; a named dir gets the short one", () =>
    withStore(baseFiles(), ({ dir }) =>
      Effect.gen(function* () {
        const missing = `${dir}-not-here`;
        const exit = yield* Effect.exit(Command.runWith(makeRoot(missing), { version: "0.0.0" })(["validate"]));
        assert.strictEqual(exit._tag, "Failure");
        const err = (yield* TestConsole.errorLines).map(String);
        assert.strictEqual(err.length, 1);
        for (const part of [missing, "the default data directory does not exist", "private material", "pass --data <dir>", "--roots <file>"]) assert.include(err[0] ?? "", part);

        const named = yield* cliRunner(makeRoot(dir), missing)("validate");
        assert.isFalse(named.ok);
        assert.include(named.stderr[0] ?? "", "data directory not found; pass --data <dir>");
        assert.notInclude(named.stderr[0] ?? "", "default data directory");
      })));
});
