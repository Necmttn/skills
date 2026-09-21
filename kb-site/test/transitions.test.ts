import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { checklist, deriveItem } from "../src/derive.ts";
import type { Requirement } from "../src/schema.ts";
import { Store } from "../src/store.ts";
import type { TrackingPatch } from "../src/transitions.ts";
import { app, baseFiles, lines, messages, requirement, withStore } from "./helpers.ts";

const by = "tester";
const link = [{ kind: "link", ref: "https://alpha.app/privacy" }] as const;

const set = (appId: string, req: string, patch: Omit<TrackingPatch, "by">) => Store.use((s) => s.setTracking(appId, req, { ...patch, by }));
const rejected = (appId: string, req: string, patch: Omit<TrackingPatch, "by">) =>
  set(appId, req, patch).pipe(
    Effect.flip,
    Effect.map((e) => {
      assert.strictEqual(e._tag, "Rejected");
      return e._tag === "Rejected" ? messages(e.issues) : "";
    }),
  );

const derived = (appId: string, req: string) =>
  Effect.gen(function* () {
    const { data } = yield* Store.use((s) => s.load);
    const a = data.apps.find((x) => x.id === appId)!;
    return deriveItem(data.requirements.find((r) => r.id === req)!, a, data.tracking);
  });

const smoke: Requirement = requirement({ id: "release.smoke", phase: "release", cadence: "every_release", title: "Smoke test" });

describe("set transitions", () => {
  it.effect("done without required evidence is rejected; with evidence it is complete", () =>
    withStore(baseFiles(), () =>
      Effect.gen(function* () {
        assert.include(yield* rejected("alpha", "setup.privacy", { status: "done" }), "requires evidence");
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "todo");
        const { record } = yield* set("alpha", "setup.privacy", { status: "done", evidence: link, owner: "neco" });
        assert.deepStrictEqual(record.evidence, [{ kind: "link", ref: "https://alpha.app/privacy", date: "1970-01-01" }]);
        assert.strictEqual(record.updated_at, "1970-01-01T00:00:00Z");
        assert.strictEqual(record.updated_by, "tester");
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "complete");
        assert.deepStrictEqual(yield* Store.use((s) => s.validate), []);
      })));

  it.effect("evidence added while in progress counts when marking done later; duplicates are dropped", () =>
    withStore(baseFiles(), () =>
      Effect.gen(function* () {
        yield* set("alpha", "setup.privacy", { status: "in_progress", evidence: link });
        const { record } = yield* set("alpha", "setup.privacy", { status: "done", evidence: link });
        assert.strictEqual(record.evidence.length, 1);
      })));

  it.effect("blocked and not_applicable without a note are rejected", () =>
    withStore(baseFiles(), () =>
      Effect.gen(function* () {
        assert.include(yield* rejected("alpha", "setup.privacy", { status: "blocked" }), 'status "blocked" needs --note');
        assert.include(yield* rejected("alpha", "setup.privacy", { status: "not_applicable", note: "  " }), 'status "not_applicable" needs --note');
        yield* set("alpha", "setup.privacy", { status: "blocked", note: "waiting for legal" });
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "blocked");
        yield* set("alpha", "setup.privacy", { status: "not_applicable", note: "no data collected" });
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "excluded");
      })));

  it.effect("reopening a done check without a note is rejected", () =>
    withStore(baseFiles(), () =>
      Effect.gen(function* () {
        yield* set("alpha", "setup.privacy", { status: "done", evidence: link });
        assert.include(yield* rejected("alpha", "setup.privacy", { status: "in_progress" }), "reopening a done check (done -> in_progress) needs --note");
        const { record } = yield* set("alpha", "setup.privacy", { status: "in_progress", note: "policy page is down" });
        assert.strictEqual(record.notes, "policy page is down");
        assert.strictEqual(record.evidence.length, 1);
      })));

  it.effect("retired requirement: only not_applicable; guideline, unknown ids, empty patch are rejected", () =>
    withStore(
      baseFiles({
        "requirements.jsonl": lines([requirement({ id: "aso.guide", kind: "guideline", phase: "aso", evidence_required: false }), requirement({ acceptance: "retired" })]),
      }),
      () =>
        Effect.gen(function* () {
          assert.include(yield* rejected("alpha", "setup.privacy", { status: "in_progress" }), "is retired");
          yield* set("alpha", "setup.privacy", { status: "not_applicable", note: "rule retired" });
          assert.include(yield* rejected("alpha", "aso.guide", { status: "in_progress" }), "is a guideline");
          assert.include(yield* rejected("ghost", "setup.privacy", { status: "in_progress" }), 'app "ghost" does not exist');
          assert.include(yield* rejected("alpha", "ghost", { status: "in_progress" }), 'requirement "ghost" does not exist');
          assert.include(yield* rejected("beta", "setup.privacy", {}), "nothing to change");
        }),
    ));

  it.effect("revision staleness: done at rev 1, requirement bumped to rev 2 -> stale; --ack-revision needs a note or evidence", () =>
    withStore(baseFiles(), ({ write }) =>
      Effect.gen(function* () {
        yield* set("alpha", "setup.privacy", { status: "done", evidence: link });
        yield* write("requirements.jsonl", lines([smoke, requirement({ revision: 2, revision_note: "must list data types" })]));
        const stale = yield* derived("alpha", "setup.privacy");
        assert.strictEqual(stale.state, "stale");
        assert.strictEqual(stale.requirement_revision, 1);
        assert.deepStrictEqual(yield* Store.use((s) => s.validate), []);

        assert.include(yield* rejected("alpha", "setup.privacy", { ackRevision: true }), "--ack-revision needs --note or new --evidence");
        assert.include(yield* rejected("alpha", "setup.privacy", { owner: "sam" }), "changed since this was done (revision 1 -> 2)");
        assert.include(yield* rejected("alpha", "setup.privacy", { status: "done", evidence: [{ kind: "note", ref: "x" }] }), "--ack-revision");
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "stale");

        const { record } = yield* set("alpha", "setup.privacy", { ackRevision: true, note: "policy lists the data types" });
        assert.strictEqual(record.requirement_revision, 2);
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "complete");
        assert.include(yield* rejected("alpha", "setup.privacy", { ackRevision: true, note: "again" }), "nothing to acknowledge");
      })));

  it.effect("--ack-revision with new evidence also re-confirms; a stale item can be reopened instead", () =>
    withStore(baseFiles(), ({ write }) =>
      Effect.gen(function* () {
        yield* set("alpha", "setup.privacy", { status: "done", evidence: link });
        yield* set("beta", "setup.privacy", { status: "done", evidence: link });
        yield* write("requirements.jsonl", lines([smoke, requirement({ revision: 2 })]));
        yield* set("alpha", "setup.privacy", { ackRevision: true, evidence: [{ kind: "screenshot", ref: "shots/policy.png" }] });
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).evidence.length, 2);
        yield* set("beta", "setup.privacy", { status: "todo", note: "policy lacks the new section" });
        assert.strictEqual((yield* derived("beta", "setup.privacy")).state, "todo");
      })));

  it.effect("--ack-revision with evidence the record already holds and no note is rejected", () =>
    withStore(baseFiles(), ({ write }) =>
      Effect.gen(function* () {
        const dated = [{ ...link[0], date: "2026-09-01" }];
        yield* set("alpha", "setup.privacy", { status: "done", evidence: dated });
        yield* write("requirements.jsonl", lines([smoke, requirement({ revision: 2 })]));
        assert.include(yield* rejected("alpha", "setup.privacy", { ackRevision: true, evidence: dated }), "--ack-revision needs --note or new --evidence");
        assert.include(yield* rejected("alpha", "setup.privacy", { ackRevision: true, evidence: dated, note: "  " }), "already on the record");
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "stale");
        yield* set("alpha", "setup.privacy", { ackRevision: true, evidence: [...dated, { kind: "note", ref: "re-read the policy" }] });
        assert.strictEqual((yield* derived("alpha", "setup.privacy")).state, "complete");
      })));

  it.effect("set: evidence for another release does not count toward done; new evidence is stamped with the record release", () =>
    withStore(baseFiles(), () =>
      Effect.gen(function* () {
        const old = { kind: "build", ref: "TestFlight 0.9", release: "0.9" } as const;
        assert.include(yield* rejected("alpha", "release.smoke", { status: "done", evidence: [old] }), 'evidence for release "1.0"; the evidence given belongs to release "0.9"');
        const { record } = yield* set("alpha", "release.smoke", { status: "done", evidence: [old, { kind: "build", ref: "TestFlight 1.0" }] });
        assert.deepStrictEqual(record.evidence.map((e) => e.release), ["0.9", "1.0"]);
        assert.strictEqual((yield* set("alpha", "setup.privacy", { status: "done", evidence: link })).record.evidence[0]?.release, undefined);
      })));

  it.effect("every_release binding: done for 1.0, after set-release 1.1 it is todo with last_done", () =>
    withStore(baseFiles(), ({ dir }) =>
      Effect.gen(function* () {
        const { record } = yield* set("alpha", "release.smoke", { status: "done", evidence: [{ kind: "build", ref: "TestFlight 1.0" }] });
        assert.strictEqual(record.release, "1.0");
        assert.strictEqual(record.evidence[0]?.release, "1.0");
        assert.strictEqual((yield* derived("alpha", "release.smoke")).state, "complete");

        const updated = yield* Store.use((s) => s.setRelease("alpha", "1.1", "12"));
        assert.deepStrictEqual(updated.current_release, { version: "1.1", build: "12" });
        const next = yield* derived("alpha", "release.smoke");
        assert.strictEqual(next.state, "todo");
        assert.strictEqual(next.release, "1.1(12)");
        assert.strictEqual(next.last_done, "1.0");

        yield* set("alpha", "release.smoke", { status: "in_progress" });
        const { data } = yield* Store.use((s) => s.load);
        assert.deepStrictEqual(data.tracking.map((t) => [t.release, t.status]), [["1.0", "done"], ["1.1(12)", "in_progress"]]);
        assert.strictEqual(checklist(data, data.apps[0]!, { release: "1.0" }).items.find((i) => i.requirement === "release.smoke")?.state, "complete");

        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        assert.include(yield* fs.readFileString(path.join(dir, "apps.jsonl")), '"current_release":{"version":"1.1","build":"12"}');
      })));

  it.effect("every_release without a release anywhere fails clearly; --release on a once check is rejected", () =>
    withStore(baseFiles(), () =>
      Effect.gen(function* () {
        assert.include(yield* rejected("beta", "release.smoke", { status: "in_progress" }), 'app "beta" has no current_release; pass --release');
        const { record } = yield* set("beta", "release.smoke", { status: "in_progress", release: "0.1" });
        assert.strictEqual(record.release, "0.1");
        assert.include(yield* rejected("beta", "setup.privacy", { status: "in_progress", release: "0.1" }), 'cadence "once"');
        assert.include(yield* Store.use((s) => s.setRelease("alpha", "1.0 (2)")).pipe(Effect.flip, Effect.map((e) => e.message)), "without spaces or parentheses");
        assert.deepStrictEqual((yield* Store.use((s) => s.setRelease("alpha", "2.0"))).current_release, { version: "2.0" });
      })));

  it.effect("app() fixture sanity: owner can be cleared", () =>
    withStore(baseFiles({ "apps.jsonl": lines([app()]) }), () =>
      Effect.gen(function* () {
        yield* set("alpha", "setup.privacy", { owner: "neco" });
        assert.strictEqual((yield* set("alpha", "setup.privacy", { owner: "" })).record.owner, null);
      })));
});
