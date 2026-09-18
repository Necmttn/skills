import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { errorsOf, warningsOf } from "../src/issue.ts";
import { Store } from "../src/store.ts";
import { app, baseFiles, conflict, lines, requirement, source, tracking, withStore } from "./helpers.ts";

const issuesFor = (over: Record<string, string | null>) => withStore(baseFiles(over), () => Store.use((s) => s.validate));

const expectError = (over: Record<string, string | null>, file: string, line: number, fragment: string) =>
  Effect.gen(function* () {
    const errors = errorsOf(yield* issuesFor(over));
    const hit = errors.find((i) => i.message.includes(fragment));
    assert.isDefined(hit, `no error containing "${fragment}" in:\n${errors.map((i) => i.message).join("\n")}`);
    assert.strictEqual(hit?.file, file);
    assert.strictEqual(hit?.line, line);
    assert.strictEqual(errors.length, 1, errors.map((i) => i.message).join("\n"));
  });

describe("validate", () => {
  it.effect("a valid store has no issues; missing tracking dir and files are fine", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* issuesFor({}), []);
      assert.deepStrictEqual(yield* issuesFor({ "conflicts.jsonl": null }), []);
    }));

  it.effect("dangling requirement -> source", () =>
    expectError({ "requirements.jsonl": lines([requirement({ refs: [{ source: "ghost" }] })]) }, "requirements.jsonl", 1, 'refs[0].source: source "ghost" does not exist'));

  it.effect("dangling requirement -> conflict", () =>
    expectError({ "requirements.jsonl": lines([requirement({ conflicts: ["ghost"] })]) }, "requirements.jsonl", 1, 'conflict "ghost" does not exist'));

  it.effect("dangling requirement -> superseded requirement", () =>
    expectError({ "requirements.jsonl": lines([requirement({ supersedes: ["old.rule"] })]) }, "requirements.jsonl", 1, 'requirement "old.rule" does not exist'));

  it.effect("dangling conflict -> source and -> requirement", () =>
    Effect.gen(function* () {
      const errors = errorsOf(
        yield* issuesFor({ "conflicts.jsonl": lines([conflict({ sides: [{ source: "ghost", locator: "", claim: "" }], requirements: ["nope"] })]) }),
      );
      assert.deepStrictEqual(errors.map((i) => [i.file, i.line, i._tag]), [["conflicts.jsonl", 1, "DanglingReference"], ["conflicts.jsonl", 1, "DanglingReference"]]);
    }));

  it.effect("dangling tracking -> requirement", () =>
    expectError({ "tracking/alpha.jsonl": lines([tracking({ requirement: "ghost" })]) }, "tracking/alpha.jsonl", 1, 'requirement "ghost" does not exist'));

  it.effect("dangling tracking -> app, and file name != app", () =>
    Effect.gen(function* () {
      const errors = errorsOf(yield* issuesFor({ "tracking/gamma.jsonl": lines([tracking({ app: "gamma" })]) }));
      assert.deepStrictEqual(errors.map((i) => i.message), ['app "gamma" does not exist in apps.jsonl']);
      const moved = errorsOf(yield* issuesFor({ "tracking/beta.jsonl": lines([tracking({ app: "alpha" })]) }));
      assert.deepStrictEqual(moved.map((i) => [i._tag, i.file]), [["FileNameMismatch", "tracking/beta.jsonl"]]);
    }));

  it.effect("tracking on a guideline", () =>
    expectError(
      { "requirements.jsonl": lines([requirement({ kind: "guideline", evidence_required: false })]), "tracking/alpha.jsonl": lines([tracking()]) },
      "tracking/alpha.jsonl",
      1,
      "is a guideline",
    ));

  it.effect("tracking on a retired requirement allows only not_applicable", () =>
    Effect.gen(function* () {
      const retired = { "requirements.jsonl": lines([requirement({ acceptance: "retired" })]) };
      yield* expectError({ ...retired, "tracking/alpha.jsonl": lines([tracking()]) }, "tracking/alpha.jsonl", 1, "is retired");
      assert.deepStrictEqual(yield* issuesFor({ ...retired, "tracking/alpha.jsonl": lines([tracking({ status: "not_applicable", notes: "gone" })]) }), []);
    }));

  it.effect("done + evidence_required without evidence", () =>
    expectError({ "tracking/alpha.jsonl": lines([tracking({ status: "done" })]) }, "tracking/alpha.jsonl", 1, 'status "done" needs evidence'));

  it.effect("a STALE done record without evidence is not an error (it derives stale; --ack-revision applies the evidence rule)", () =>
    Effect.gen(function* () {
      const reqs = lines([requirement({ id: "release.smoke", phase: "release", cadence: "every_release" }), requirement({ revision: 2 })]);
      const issues = yield* issuesFor({ "requirements.jsonl": reqs, "tracking/alpha.jsonl": lines([tracking({ status: "done", requirement_revision: 1 })]) });
      assert.deepStrictEqual(issues.map((i) => i.message), []);
      yield* expectError({ "requirements.jsonl": reqs, "tracking/alpha.jsonl": lines([tracking({ status: "done", requirement_revision: 2 })]) }, "tracking/alpha.jsonl", 1, 'status "done" needs evidence');
    }));

  it.effect("evidence for another release does not count: done 1.7.16 with evidence for 1.0(171) is an error that names that release", () =>
    Effect.gen(function* () {
      const e = (release?: string) => ({ kind: "build" as const, ref: "TestFlight", date: "2026-09-01", ...(release === undefined ? {} : { release }) });
      const smoke = (release: string, evidence: ReadonlyArray<ReturnType<typeof e>>) =>
        ({ "tracking/alpha.jsonl": lines([tracking({ requirement: "release.smoke", release, status: "done", evidence })]) });
      yield* expectError(smoke("1.7.16", [e("1.0(171)")]), "tracking/alpha.jsonl", 1, 'needs evidence for release "1.7.16"; the evidence on this record belongs to release "1.0(171)"');
      // strict comparison: a version without its build is a different release
      yield* expectError(smoke("1.0(171)", [e("1.0")]), "tracking/alpha.jsonl", 1, 'belongs to release "1.0"');
      yield* expectError(smoke("1.0", [e("1.0(171)")]), "tracking/alpha.jsonl", 1, 'belongs to release "1.0(171)"');
      assert.deepStrictEqual(yield* issuesFor(smoke("1.7.16", [e("1.0(171)"), e("1.7.16")])), []);
      assert.deepStrictEqual(yield* issuesFor(smoke("1.7.16", [e()])), [], "evidence without a release counts");
    }));

  it.effect("blocked / not_applicable without notes", () =>
    Effect.gen(function* () {
      yield* expectError({ "tracking/alpha.jsonl": lines([tracking({ status: "blocked" })]) }, "tracking/alpha.jsonl", 1, 'status "blocked" needs notes');
      yield* expectError({ "tracking/alpha.jsonl": lines([tracking({ status: "not_applicable" })]) }, "tracking/alpha.jsonl", 1, 'status "not_applicable" needs notes');
    }));

  it.effect("requirement_revision newer than the requirement", () =>
    expectError({ "tracking/alpha.jsonl": lines([tracking({ requirement_revision: 3 })]) }, "tracking/alpha.jsonl", 1, "requirement_revision 3 is newer than"));

  it.effect("release set on a once check, missing on every_release", () =>
    Effect.gen(function* () {
      yield* expectError({ "tracking/alpha.jsonl": lines([tracking({ release: "1.0" })]) }, "tracking/alpha.jsonl", 1, 'cadence "once"; release must be null');
      yield* expectError({ "tracking/alpha.jsonl": lines([tracking({ requirement: "release.smoke" })]) }, "tracking/alpha.jsonl", 1, 'cadence "every_release"; release must be set');
    }));

  it.effect("absolute paths and url/root mismatches are errors", () =>
    Effect.gen(function* () {
      yield* expectError({ "sources.jsonl": lines([source({ path: "/Users/me/PLAYBOOK.md" })]) }, "sources.jsonl", 1, "absolute path");
      yield* expectError({ "sources.jsonl": lines([source({ root: "url", path: "docs/x.md" })]) }, "sources.jsonl", 1, "needs a full http(s) URL");
      yield* expectError({ "apps.jsonl": lines([app({ path: "../apps/alpha" })]) }, "apps.jsonl", 1, 'no ".." segments');
    }));

  it.effect("a source in a private root flagged publishable is an error", () =>
    expectError(
      { "sources.jsonl": lines([source(), source({ id: "wiki-doc", kind: "wiki", root: "wiki", path: "note.md", access: "private-wiki", publishable: true })]) },
      "sources.jsonl", 2, 'root "wiki" is private and is never published; set "publishable" to false'));

  it.effect("collects every problem instead of stopping at the first", () =>
    Effect.gen(function* () {
      const issues = yield* issuesFor({
        "requirements.jsonl": lines([requirement({ refs: [{ source: "ghost" }] })]) + "not json\n",
        "tracking/alpha.jsonl": lines([tracking({ status: "blocked" }), tracking({ requirement: "ghost" })]),
        "apps.jsonl": lines([app({ id: "beta" }), app()]),
      });
      assert.strictEqual(errorsOf(issues).length, 4);
      assert.deepStrictEqual(warningsOf(issues).map((i) => i._tag), ["Unsorted", "Unsorted"]);
    }));

  it.effect("warns on tracking for a check that does not apply to the app", () =>
    Effect.gen(function* () {
      const issues = yield* issuesFor({
        "requirements.jsonl": lines([requirement({ applies_to: { platforms: ["android"] } })]),
        "tracking/alpha.jsonl": lines([tracking()]),
      });
      assert.deepStrictEqual(issues.map((i) => [i.severity, i._tag]), [["warning", "InvalidTracking"]]);
    }));
});
