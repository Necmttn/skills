/** `revise` (a safe rule edit), the unknown-author warning, and local calendar dates. */
import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import { TestClock } from "effect/testing";
import { makeRoot } from "../src/commands.ts";
import { dateInZone, Today, utcDate } from "../src/today.ts";
import { AnonymousEnv, app, baseFiles, cliRunner, lines, requirement, tracking, withStore } from "./helpers.ts";

const root = makeRoot("/nonexistent/default/data");
const link = { kind: "link", ref: "https://alpha.app/p", date: "2026-09-02" } as const;

const files = () =>
  baseFiles({
    "requirements.jsonl": lines([
      requirement({ id: "release.smoke", phase: "release", cadence: "every_release", title: "Smoke test", evidence_required: false }),
      requirement({ id: "setup.old", acceptance: "retired" }),
      requirement(),
    ]),
    "apps.jsonl": lines([app(), app({ id: "beta", name: "Beta", path: "apps/beta" })]),
    "tracking/alpha.jsonl": lines([
      tracking({ requirement: "release.smoke", release: "0.9", status: "done" }),
      tracking({ requirement: "release.smoke", release: "1.0", status: "done" }),
      tracking({ status: "done", evidence: [link] }),
    ]),
    "tracking/beta.jsonl": lines([tracking({ app: "beta", status: "in_progress" })]),
  });

const reqs = (text: string) => Object.fromEntries(text.split("\n").filter((l) => l !== "").map((l) => [JSON.parse(l).id, JSON.parse(l)]));

describe("revise", () => {
  it.effect("a material change bumps revision by exactly 1, stamps revised_at + revision_note, and reports the records that became stale", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = cliRunner(root, dir);
        yield* TestClock.setTime(Date.UTC(2026, 8, 19, 3, 0, 0));
        const out = yield* run("revise", "setup.privacy", "--what", "The policy URL answers 200 in every storefront.", "--note", "storefront check added", "--json");
        assert.isTrue(out.ok, out.stderr.join("\n"));
        const body = JSON.parse(out.stdout);
        assert.deepStrictEqual(
          [body.ok, body.bumped, body.previous_revision, body.requirement.revision, body.requirement.revised_at, body.requirement.revision_note, body.material, body.became_stale],
          [true, true, 1, 2, "2026-09-19", "storefront check added", ["what"], 1],
        );
        assert.deepStrictEqual(body.stale_records, [{ app: "alpha", release: null }]);
        assert.deepStrictEqual(body.warnings, []);
        assert.strictEqual(JSON.parse((yield* run("show", "setup.privacy", "--app", "alpha", "--json")).stdout).tracking.state, "stale");
        assert.isTrue((yield* run("validate")).ok);

        // every_release: both done records (old and current release) were judged at revision 1
        const smoke = yield* run("revise", "release.smoke", "--how", "Run the smoke list on a device.", "--evidence-required", "true", "--note", "device only");
        assert.isTrue(smoke.ok, smoke.stderr.join("\n"));
        assert.include(smoke.stdout, "release.smoke: revision 1 -> 2 (2026-09-19); changed how, evidence_required");
        assert.include(smoke.stdout, "2 tracking record(s) became stale in 1 app(s): alpha");
        assert.include(smoke.stdout, "--ack-revision");
        // a second bump of an already stale record makes nothing NEW stale
        const again = JSON.parse((yield* run("revise", "release.smoke", "--platform", "ios", "--note", "ios only", "--json")).stdout);
        assert.deepStrictEqual([again.requirement.revision, again.material, again.became_stale, again.requirement.applies_to], [3, ["applies_to"], 0, { platforms: ["ios"] }]);
      })));

  it.effect("a non-material edit does not bump; --acceptance is allowed and prints the owner reminder", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = cliRunner(root, dir);
        const out = yield* run("revise", "setup.privacy", "--title", "Privacy policy URL", "--acceptance", "verified");
        assert.isTrue(out.ok, out.stderr.join("\n"));
        assert.include(out.stdout, "revision stays 1 (no material change)");
        assert.include(out.stdout, "acceptance decided -> verified");
        assert.deepStrictEqual(out.stderr, ["warning: acceptance is the owner's call; a contributor proposes `candidate` and the owner decides"]);
        const shown = JSON.parse((yield* run("show", "setup.privacy", "--json")).stdout).requirement;
        assert.deepStrictEqual([shown.title, shown.acceptance, shown.revision, shown.revised_at, shown.revision_note], ["Privacy policy URL", "verified", 1, "2026-09-01", "seed"]);
        // the same text again is not a change, and an unchanged material value does not bump
        const same = yield* run("revise", "setup.privacy", "--what", "what", "--title", "Privacy policy URL");
        assert.isFalse(same.ok);
        assert.include(same.stderr[0] ?? "", "nothing to change");
      })));

  it.effect("rejections write nothing: missing note, note without a material change, unknown requirement, retired requirement", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = cliRunner(root, dir);
        const before = (yield* run("checks", "--json")).stdout;
        const noNote = yield* run("revise", "setup.privacy", "--what", "new outcome");
        assert.isFalse(noNote.ok);
        assert.match(noNote.stderr[0] ?? "", /^error: requirements\.jsonl \[setup\.privacy\]: a change to what is material: .*pass --note/);
        assert.include((yield* run("revise", "setup.privacy", "--what", "new outcome", "--note", "  ")).stderr[0] ?? "", "pass --note");
        assert.include((yield* run("revise", "setup.privacy", "--title", "T", "--note", "why")).stderr[0] ?? "", "--note is the revision note");
        const ghost = JSON.parse((yield* run("revise", "ghost", "--what", "x", "--note", "n", "--json")).stdout);
        assert.deepStrictEqual([ghost.ok, ghost.errors[0].tag, ghost.errors[0].id], [false, "NotFound", "ghost"]);
        assert.include((yield* run("revise", "setup.old", "--what", "x", "--note", "n")).stderr[0] ?? "", 'requirement "setup.old" is retired; only --acceptance may change');
        assert.include((yield* run("revise", "setup.old", "--title", "x")).stderr[0] ?? "", "is retired");
        assert.include((yield* run("revise", "setup.privacy", "--all-apps", "--platform", "ios", "--note", "n")).stderr[0] ?? "", "do not combine");
        assert.strictEqual((yield* run("checks", "--json")).stdout, before);

        const unretire = yield* run("revise", "setup.old", "--acceptance", "candidate");
        assert.isTrue(unretire.ok, unretire.stderr.join("\n"));
        assert.include(unretire.stdout, "acceptance retired -> candidate");
      })));
});

describe("author warning", () => {
  it.effect("no --by and no KB_USER: set, set-release, and revise still work and print ONE stderr warning; --json puts it in `warnings`", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = cliRunner(root, dir);
        const line = "warning: no author name; pass --by <name> or set KB_USER";
        const set = yield* run("set", "beta", "setup.privacy", "--owner", "sam");
        assert.deepStrictEqual([set.ok, set.stderr], [true, [line]]);
        assert.deepStrictEqual([(yield* run("set-release", "beta", "1.1")).stderr, (yield* run("revise", "setup.privacy", "--title", "T")).stderr], [[line], [line]]);

        const machine = yield* run("set", "beta", "setup.privacy", "--owner", "kim", "--json");
        assert.deepStrictEqual(machine.stderr, []);
        const body = JSON.parse(machine.stdout);
        assert.deepStrictEqual([body.ok, body.record.updated_by, body.warnings], [true, "unknown", ["no author name; pass --by <name> or set KB_USER"]]);
        assert.deepStrictEqual(JSON.parse((yield* run("set-release", "beta", "1.2", "--json")).stdout).warnings, ["no author name; pass --by <name> or set KB_USER"]);

        const named = yield* run("set", "beta", "setup.privacy", "--owner", "lee", "--by", "lee");
        assert.deepStrictEqual(named.stderr, []);
        assert.deepStrictEqual(JSON.parse((yield* run("set", "beta", "setup.privacy", "--owner", "x", "--by", "lee", "--json")).stdout).warnings, []);
      }), AnonymousEnv));
});

describe("local calendar dates", () => {
  // 2026-09-18 20:00 UTC is 2026-09-19 04:00 at UTC+8
  const instant = Date.UTC(2026, 8, 18, 20, 0, 0);

  it("dateInZone gives the wall-clock date; utcDate the UTC date", () => {
    assert.strictEqual(utcDate(instant), "2026-09-18");
    assert.strictEqual(dateInZone(DateTime.zoneMakeOffset(8 * 3_600_000))(instant), "2026-09-19");
    assert.strictEqual(dateInZone(DateTime.zoneMakeOffset(-5 * 3_600_000))(Date.UTC(2026, 8, 19, 2, 0, 0)), "2026-09-18");
  });

  it.effect("evidence date and revised_at use the provided zone; updated_at stays a UTC timestamp; the default is UTC", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const run = cliRunner(root, dir);
        yield* TestClock.setTime(instant);
        const local = <A, E, R>(e: Effect.Effect<A, E, R>) => Effect.provideService(e, Today, dateInZone(DateTime.zoneMakeOffset(8 * 3_600_000)));

        const set = JSON.parse((yield* local(run("set", "beta", "setup.privacy", "--status", "done", "--evidence", "link=https://b", "--json"))).stdout);
        assert.deepStrictEqual([set.record.evidence[0].date, set.record.updated_at], ["2026-09-19", "2026-09-18T20:00:00Z"]);
        const revised = JSON.parse((yield* local(run("revise", "setup.privacy", "--how", "new steps", "--note", "n", "--json"))).stdout);
        assert.strictEqual(revised.requirement.revised_at, "2026-09-19");

        const utc = JSON.parse((yield* run("set", "alpha", "release.smoke", "--status", "done", "--evidence", "build=41", "--json")).stdout);
        assert.strictEqual(utc.record.evidence.at(-1).date, "2026-09-18");
      })));
});
