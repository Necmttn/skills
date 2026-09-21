import { assert, describe, it } from "@effect/vitest";
import { applies, checklist, compare, compareReleases, deriveItem, targetRelease } from "../src/derive.ts";
import type { KbData } from "../src/schema.ts";
import { app, requirement, source, tracking } from "./helpers.ts";

const evidence = [{ kind: "link", ref: "https://x", date: "2026-09-01" }] as const;

describe("applicability and target release", () => {
  it("empty applies_to applies to all; platforms and tags match on any value, both must match", () => {
    const ios = app({ platforms: ["ios"], tags: ["subscription"] });
    assert.isTrue(applies(requirement(), ios));
    assert.isTrue(applies(requirement({ applies_to: { platforms: [], tags: [] } }), ios));
    assert.isTrue(applies(requirement({ applies_to: { platforms: ["android", "ios"] } }), ios));
    assert.isFalse(applies(requirement({ applies_to: { platforms: ["android"] } }), ios));
    assert.isTrue(applies(requirement({ applies_to: { tags: ["subscription"] } }), ios));
    assert.isFalse(applies(requirement({ applies_to: { platforms: ["ios"], tags: ["ads"] } }), ios));
  });

  it("target release: null for once, current release (with build) for every_release", () => {
    const a = app({ current_release: { version: "1.2", build: "40" } });
    assert.strictEqual(targetRelease(requirement(), a), null);
    assert.strictEqual(targetRelease(requirement({ cadence: "every_release" }), a), "1.2(40)");
    assert.strictEqual(targetRelease(requirement({ cadence: "every_release" }), a, "2.0"), "2.0");
    assert.strictEqual(targetRelease(requirement({ cadence: "every_release" }), app({ current_release: null })), null);
  });

  it("orders releases naturally", () => {
    assert.deepStrictEqual(["1.10", "1.9", "1.0(12)", "1.0(9)", "1.0"].sort(compareReleases), ["1.0", "1.0(9)", "1.0(12)", "1.9", "1.10"]);
  });
});

describe("derived state", () => {
  const r = requirement();
  const a = app();
  const state = (record?: Parameters<typeof tracking>[0], req = r) => deriveItem(req, a, record ? [tracking(record)] : []).state;

  it("covers every state in the plan table", () => {
    assert.strictEqual(state(), "todo");
    assert.strictEqual(state({ status: "todo" }), "todo");
    assert.strictEqual(state({ status: "in_progress" }), "in_progress");
    assert.strictEqual(state({ status: "blocked", notes: "waiting" }), "blocked");
    assert.strictEqual(state({ status: "not_applicable", notes: "no login" }), "excluded");
    assert.strictEqual(state({ status: "done", evidence }), "complete");
    assert.strictEqual(state({ status: "done" }), "unverified");
    assert.strictEqual(state({ status: "done" }, requirement({ evidence_required: false })), "complete");
    assert.strictEqual(state({ status: "done", evidence }, requirement({ revision: 2 })), "stale");
    assert.strictEqual(state({ status: "done", evidence }, requirement({ applies_to: { platforms: ["android"] } })), "excluded");
    assert.strictEqual(state({ status: "not_applicable", notes: "x" }, requirement({ acceptance: "retired" })), "retired");
  });

  it("every_release: evidence stamped with another release does not count -> unverified", () => {
    const r = requirement({ id: "release.smoke", cadence: "every_release" });
    const a = app({ current_release: { version: "1.7.16" } });
    const state = (ev: ReadonlyArray<{ readonly release?: string }>) =>
      deriveItem(r, a, [tracking({ requirement: r.id, release: "1.7.16", status: "done", evidence: ev.map((x) => ({ ...evidence[0], ...x })) })]);
    assert.strictEqual(state([{ release: "1.0(171)" }]).state, "unverified");
    assert.include(state([{ release: "1.0(171)" }]).reason, '"1.0(171)"');
    assert.strictEqual(state([{ release: "1.7.16(3)" }]).state, "unverified");
    assert.strictEqual(state([{ release: "1.7.16" }]).state, "complete");
    assert.strictEqual(state([{}]).state, "complete");
  });

  it("every_release: a done record for an older release is todo with last_done", () => {
    const smoke = requirement({ id: "release.smoke", cadence: "every_release" });
    const records = [
      tracking({ requirement: "release.smoke", release: "1.0", status: "done", evidence }),
      tracking({ requirement: "release.smoke", release: "0.9", status: "done", evidence }),
    ];
    const current = deriveItem(smoke, app({ current_release: { version: "1.0" } }), records);
    assert.strictEqual(current.state, "complete");
    assert.strictEqual(current.last_done, undefined);
    const next = deriveItem(smoke, app({ current_release: { version: "1.1" } }), records);
    assert.strictEqual(next.state, "todo");
    assert.strictEqual(next.last_done, "1.0");
    assert.deepStrictEqual(next.evidence, []);
    assert.strictEqual(deriveItem(smoke, app({ current_release: null }), records).last_done, "1.0");
    assert.strictEqual(deriveItem(smoke, app(), records, { release: "0.9" }).state, "complete");
  });
});

describe("checklist and compare", () => {
  const data: KbData = {
    sources: [source()],
    conflicts: [],
    requirements: [
      requirement({ id: "submission.z", phase: "submission" }),
      requirement({ id: "setup.b" }),
      requirement({ id: "setup.a" }),
      requirement({ id: "idea.guide", phase: "idea", kind: "guideline" }),
      requirement({ id: "setup.old", acceptance: "retired" }),
      requirement({ id: "setup.watch", applies_to: { platforms: ["watchos"] } }),
      requirement({ id: "setup.rev", revision: 2 }),
    ],
    apps: [app(), app({ id: "beta", platforms: ["ios", "watchos"] })],
    tracking: [
      tracking({ requirement: "setup.a", status: "done", evidence }),
      tracking({ requirement: "setup.rev", status: "done", evidence }),
      tracking({ requirement: "setup.b", status: "blocked", notes: "legal" }),
      tracking({ app: "beta", requirement: "setup.a", status: "not_applicable", notes: "no accounts" }),
      tracking({ app: "beta", requirement: "setup.rev", status: "done", requirement_revision: 2, evidence }),
    ],
  };

  it("orders by phase then id, leaves out guidelines, hides retired by default", () => {
    const list = checklist(data, app());
    assert.deepStrictEqual(list.items.map((i) => i.requirement), ["setup.a", "setup.b", "setup.rev", "setup.watch", "submission.z"]);
    assert.strictEqual(list.counts.retired, 1);
    assert.deepStrictEqual(checklist(data, app(), { states: ["retired", "blocked"] }).items.map((i) => i.requirement), ["setup.b", "setup.old"]);
  });

  it("compare distinguishes blocked, excluded, stale, and complete, with per-app counts", () => {
    const c = compare(data, data.apps);
    const cell = (req: string, id: string) => c.rows.find((r) => r.requirement === req)?.states[id]?.state;
    assert.deepStrictEqual(c.rows.map((r) => r.requirement), ["setup.a", "setup.b", "setup.rev", "setup.watch", "submission.z"]);
    assert.strictEqual(cell("setup.a", "alpha"), "complete");
    assert.strictEqual(cell("setup.a", "beta"), "excluded");
    assert.strictEqual(cell("setup.b", "alpha"), "blocked");
    assert.strictEqual(cell("setup.rev", "alpha"), "stale");
    assert.strictEqual(cell("setup.rev", "beta"), "complete");
    assert.strictEqual(cell("setup.watch", "alpha"), "excluded");
    assert.strictEqual(cell("setup.watch", "beta"), "todo");
    assert.deepStrictEqual(c.apps.map((a) => [a.id, a.counts.complete, a.counts.stale, a.counts.blocked, a.counts.excluded, a.counts.todo]), [
      ["alpha", 1, 1, 1, 1, 1],
      ["beta", 1, 0, 0, 1, 3],
    ]);
  });
});
