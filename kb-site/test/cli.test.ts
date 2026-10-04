import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestConsole } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { makeRoot, reporting } from "../src/commands.ts";
import { Store } from "../src/store.ts";
import { app, baseFiles, conflict, lines, requirement, source, withStore } from "./helpers.ts";

const root = makeRoot("/nonexistent/default/data");

/** Run the CLI in-process; returns what it printed since the previous call. */
const makeRun = (dir: string) => {
  let seenOut = 0;
  let seenErr = 0;
  return (...argv: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Command.runWith(root, { version: "0.0.0" })(["--data", dir, ...argv]));
      const out = (yield* TestConsole.logLines).map(String);
      const err = (yield* TestConsole.errorLines).map(String);
      const result = { ok: exit._tag === "Success", stdout: out.slice(seenOut).join("\n"), stderr: err.slice(seenErr) };
      seenOut = out.length;
      seenErr = err.length;
      return result;
    });
};

const files = () =>
  baseFiles({
    "sources.jsonl": lines([source(), source({ id: "wiki-apps", kind: "wiki", root: "wiki", path: "playbook/apps.md", access: "private-wiki", publishable: false })]),
    "requirements.jsonl": lines([
      requirement({ id: "release.smoke", phase: "release", cadence: "every_release", title: "Smoke test" }),
      requirement({ refs: [{ source: "playbook", locator: "#privacy" }, { source: "wiki-apps", upstream_id: "R-7", upstream_status: "accepted" }], conflicts: ["c1"] }),
      requirement({ id: "setup.watch", evidence_required: false, applies_to: { platforms: ["watchos"] } }),
    ]),
    "apps.jsonl": lines([app(), app({ id: "beta", name: "Beta", path: "apps/beta", platforms: ["ios", "watchos"], current_release: null })]),
    "conflicts.jsonl": lines([conflict({ sides: [{ source: "playbook", locator: "#a", claim: "A" }, { source: "wiki-apps", locator: "R-7", claim: "B" }] })]),
  });

describe("cli", () => {
  it.effect("apps / checks --json", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = makeRun(dir);
        const apps = JSON.parse((yield* run("apps", "--json")).stdout);
        assert.isTrue(apps.ok);
        assert.deepStrictEqual(apps.apps.map((a: { id: string }) => a.id), ["alpha", "beta"]);
        const checks = JSON.parse((yield* run("checks", "--cadence", "once", "--json")).stdout);
        assert.deepStrictEqual(checks.requirements.map((r: { id: string }) => r.id), ["setup.privacy", "setup.watch"]);
        const text = (yield* run("checks")).stdout;
        assert.match(text, /^ID\s+KIND\s+PHASE/);
        assert.isFalse(text.split("\n").some((l) => l !== l.trimEnd()));
      })));

  it.effect("show --json resolves references, conflicts, and with --app the derived state + evidence", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = makeRun(dir);
        yield* run("set", "alpha", "setup.privacy", "--status", "done", "--evidence", "link=https://alpha.app/p?a=b", "--evidence-note", "live");
        const shown = JSON.parse((yield* run("show", "setup.privacy", "--app", "alpha", "--json")).stdout);
        assert.strictEqual(shown.requirement.what, "what");
        assert.deepStrictEqual(shown.conflicts.map((c: { id: string; summary: string }) => [c.id, c.summary]), [["c1", "Two sources disagree"]]);
        assert.deepStrictEqual(shown.refs.map((r: { source: string; availability: string }) => [r.source, r.availability]), [["playbook", "unavailable"], ["wiki-apps", "unavailable"]]);
        assert.include(shown.refs[1].reason, 'private root "wiki"');
        assert.strictEqual(shown.refs[1].upstream_id, "R-7");
        assert.strictEqual(shown.tracking.state, "complete");
        assert.deepStrictEqual(shown.tracking.evidence, [{ kind: "link", ref: "https://alpha.app/p?a=b", date: "1970-01-01", note: "live" }]);
        assert.deepStrictEqual(shown.apps, [{ app: "alpha", state: "complete" }, { app: "beta", state: "todo" }]);

        const text = (yield* run("show", "setup.privacy", "--app", "alpha")).stdout;
        for (const part of ["WHAT", "HOW", "REFERENCES", "CONFLICTS", "revision 1", "cadence once", "evidence: required", 'unavailable here (private root "wiki"', "APP alpha - complete", "https://alpha.app/p?a=b"]) {
          assert.include(text, part);
        }
      })));

  it.effect("set --json through a lifecycle; --by defaults from KB_USER; checklist and compare --json", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = makeRun(dir);
        const started = JSON.parse((yield* run("set", "alpha", "release.smoke", "--status", "in_progress", "--owner", "neco", "--json")).stdout);
        assert.strictEqual(started.record.release, "1.0");
        assert.strictEqual(started.record.updated_by, "tester");
        assert.strictEqual(started.previous, null);
        const done = JSON.parse((yield* run("set", "alpha", "release.smoke", "--status", "done", "--evidence", "build=tf-1.0", "--evidence", "commit=abc123", "--by", "sam", "--json")).stdout);
        assert.strictEqual(done.record.updated_by, "sam");
        assert.strictEqual(done.record.evidence.length, 2);
        yield* run("set", "beta", "setup.privacy", "--status", "blocked", "--note", "legal review");
        yield* run("set-release", "alpha", "1.1", "--build", "5");

        const list = JSON.parse((yield* run("checklist", "alpha", "--json")).stdout);
        assert.strictEqual(list.release, "1.1(5)");
        assert.deepStrictEqual(list.items.map((i: { requirement: string; state: string; last_done?: string }) => [i.requirement, i.state, i.last_done]), [
          ["setup.privacy", "todo", undefined],
          ["setup.watch", "excluded", undefined],
          ["release.smoke", "todo", "1.0"],
        ]);
        const onlyExcluded = JSON.parse((yield* run("checklist", "alpha", "--state", "excluded", "--json")).stdout);
        assert.deepStrictEqual(onlyExcluded.items.map((i: { requirement: string }) => i.requirement), ["setup.watch"]);
        const old = JSON.parse((yield* run("checklist", "alpha", "--release", "1.0", "--json")).stdout);
        assert.strictEqual(old.items.at(-1).state, "complete");

        const matrix = JSON.parse((yield* run("compare", "alpha", "beta", "--json")).stdout);
        assert.deepStrictEqual(matrix.rows.map((r: { requirement: string; states: Record<string, { state: string }> }) => [r.requirement, r.states.alpha?.state, r.states.beta?.state]), [
          ["setup.privacy", "todo", "blocked"],
          ["setup.watch", "excluded", "todo"],
          ["release.smoke", "todo", "todo"],
        ]);
        assert.strictEqual(matrix.apps[1].counts.blocked, 1);
        assert.include((yield* run("compare", "alpha", "beta")).stdout, "todo (last done 1.0)");
      })));

  it.effect("errors: one clean stderr line per problem; with --json, {ok:false, errors} on stdout", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = makeRun(dir);
        const human = yield* run("set", "alpha", "setup.privacy", "--status", "done");
        assert.isFalse(human.ok);
        assert.strictEqual(human.stdout, "");
        assert.strictEqual(human.stderr.length, 1);
        assert.match(human.stderr[0] ?? "", /^error: tracking\/alpha\.jsonl \[setup\.privacy\]: "setup\.privacy" requires evidence/);

        const machine = yield* run("set", "alpha", "setup.privacy", "--status", "done", "--json");
        assert.isFalse(machine.ok);
        assert.deepStrictEqual(machine.stderr, []);
        const body = JSON.parse(machine.stdout);
        assert.strictEqual(body.ok, false);
        assert.deepStrictEqual(body.errors.map((e: { tag: string; id: string }) => [e.tag, e.id]), [["InvalidTransition", "setup.privacy"]]);

        assert.include((yield* run("checklist", "ghost")).stderr[0] ?? "", 'app "ghost" does not exist');
        assert.include((yield* run("show", "ghost", "--json")).stdout, '"ok": false');
        assert.include((yield* run("set", "alpha", "setup.privacy", "--evidence", "nokind")).stderr[0] ?? "", "expected kind=ref");
      })));

  it.effect("validate: exit 0 when clean, exit 1 with every problem listed; fmt; refs; conflicts", () =>
    withStore(files(), ({ dir, write }) =>
      Effect.gen(function* () {
        const run = makeRun(dir);
        const clean = yield* run("validate");
        assert.isTrue(clean.ok);
        assert.match(clean.stdout, /^ok: 2 sources, 3 requirements, 2 apps, 1 conflicts, 0 tracking records; 0 error\(s\), 0 warning\(s\)$/);
        assert.include((yield* run("conflicts")).stdout, "c1  [open] Two sources disagree");
        assert.strictEqual(JSON.parse((yield* run("refs", "setup.privacy", "--json")).stdout).refs.length, 2);

        yield* write("apps.jsonl", lines([app({ id: "beta" }), app()]));
        assert.deepStrictEqual((yield* run("validate")).stderr, ["warning: apps.jsonl:2: records are not sorted by id; run `kb fmt`"]);
        assert.strictEqual((yield* run("fmt")).stdout, "formatted apps.jsonl");
        assert.strictEqual((yield* run("fmt")).stdout, "already formatted");

        yield* write("tracking/alpha.jsonl", "{nope\n<<<<<<< HEAD\n=======\n>>>>>>> b\n");
        const broken = yield* run("validate", "--json");
        assert.isFalse(broken.ok);
        assert.deepStrictEqual(JSON.parse(broken.stdout).errors.map((e: { tag: string; line: number }) => [e.tag, e.line]), [["MalformedJson", 1], ["ConflictMarker", 2]]);
        assert.isFalse((yield* run("fmt")).ok);
      })));

  it.effect("extra subcommands get Store through makeRoot", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const count = Command.make("count", {}, () => reporting(false, Store.use((s) => s.load), (l) => ({ json: {}, text: `apps=${l.data.apps.length}` })));
        yield* Command.runWith(makeRoot("/unused", [count]), { version: "0.0.0" })(["--data", dir, "count"]);
        assert.strictEqual(String((yield* TestConsole.logLines).at(-1)), "apps=2");
      })));
});
