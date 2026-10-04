import { assert, describe, it } from "@effect/vitest";
import { type FileKind, AppsFile, parseJsonl, RequirementsFile, TrackingFile } from "../../src/jsonl.ts";
import { describeConflict, JUDGEMENT_FIELD, mergeJsonl, type MergeResult } from "../../src/sync/merge.ts";
import { app, lines, requirement, tracking } from "../helpers.ts";

const T = TrackingFile;
const t = tracking;
const a = t({ requirement: "a.one" });
const b = t({ requirement: "b.two" });
const c = t({ requirement: "c.three" });

const merged = (r: MergeResult): string => {
  if (r._tag !== "merged") assert.fail(`expected a clean merge, got ${r._tag}: ${JSON.stringify(r)}`);
  return r.text;
};
const conflicted = (r: MergeResult) => {
  if (r._tag !== "conflict") assert.fail(`expected a conflict, got ${r._tag}`);
  return r;
};
const records = (kind: FileKind<any>, text: string) => parseJsonl(kind, "f", text).records.map((r) => r.value);
const fields = (r: MergeResult) => conflicted(r).conflicts.map((x) => `${x.record}:${x.field}`);

/** Clean merges must not depend on which side git calls "ours" (rebase swaps them). */
const both = (kind: FileKind<any>, base: string, ours: string, theirs: string): string => {
  const text = merged(mergeJsonl(kind, base, ours, theirs));
  assert.strictEqual(merged(mergeJsonl(kind, base, theirs, ours)), text, "merge is not symmetric");
  return text;
};

describe("mergeJsonl: records", () => {
  it("a record changed or added on one side is taken; output is sorted and canonical", () => {
    const a2 = t({ requirement: "a.one", owner: "alice" });
    const text = both(T, lines([a, b]), lines([a2, b]), lines([b, a, c]));
    assert.strictEqual(text, lines([a2, b, c]));
    assert.deepStrictEqual(parseJsonl(T, "f", text).issues, []);
  });

  it("deleted on one side + unchanged on the other -> deleted; deleted on both -> deleted", () => {
    assert.strictEqual(both(T, lines([a, b, c]), lines([a, c]), lines([a, b, c])), lines([a, c]));
    assert.strictEqual(both(T, lines([a, b]), lines([a]), lines([a])), lines([a]));
  });

  it("deleted on one side + modified on the other -> conflict that keeps the modified record", () => {
    const b2 = t({ requirement: "b.two", notes: "changed" });
    for (const [ours, theirs, deleted] of [[lines([a]), lines([a, b2]), "ours deleted it"], [lines([a, b2]), lines([a]), "theirs deleted it"]] as const) {
      const r = conflicted(mergeJsonl(T, lines([a, b]), ours, theirs));
      assert.deepStrictEqual(fields(r), ["b.two:(record)"]);
      assert.include(describeConflict(r.conflicts[0]!), deleted);
      assert.deepStrictEqual(records(T, r.text), [a, b2]);
      assert.include(r.text, '<<<<<<< kb-conflict record "b.two" field "(record)"');
    }
  });

  it("the same change on both sides is not a conflict", () => {
    const a2 = t({ requirement: "a.one", status: "blocked", notes: "waiting" });
    assert.strictEqual(both(T, lines([a]), lines([a2]), lines([a2])), lines([a2]));
  });

  it("both sides added the same key: equal -> one record; different -> field merge against an empty base", () => {
    assert.strictEqual(both(T, "", lines([a]), lines([a])), lines([a]));
    const r = conflicted(mergeJsonl(T, "", lines([t({ requirement: "a.one", owner: "alice" })]), lines([t({ requirement: "a.one", owner: "bob" })])));
    assert.deepStrictEqual(fields(r), ["a.one:owner"]);
    // an app added twice with different tags: the tag lists union
    const text = both(AppsFile, "", lines([app({ tags: ["paid"] })]), lines([app({ tags: ["kids"] })]));
    assert.deepStrictEqual(records(AppsFile, text)[0].tags, ["kids", "paid"]);
  });

  it("an input that does not parse -> unparseable with a readable message, no text to write", () => {
    for (const broken of ["{not json\n", lines([{ ...a, status: "nope" }]), `<<<<<<< HEAD\n${lines([a])}=======\n${lines([a])}>>>>>>> x\n`]) {
      for (const args of [[broken, lines([a]), lines([a])], [lines([a]), broken, lines([a])], [lines([a]), lines([a]), broken]] as const) {
        const r = mergeJsonl(T, ...args, "tracking/alpha.jsonl");
        assert.strictEqual(r._tag, "unparseable");
        if (r._tag === "unparseable") {
          assert.include(r.message, "cannot merge tracking/alpha.jsonl");
          assert.match(r.message, /(base|ours|theirs) version of tracking\/alpha\.jsonl line \d+/);
          assert.notProperty(r, "text");
        }
      }
    }
  });

  it("a formatting-only difference (unsorted, key order) is not a parse failure", () => {
    const unsorted = lines([b, a]);
    assert.strictEqual(both(T, lines([a, b]), unsorted, lines([a, b, c])), lines([a, b, c]));
  });
});

describe("mergeJsonl: fields of one tracking record", () => {
  const base = t({ evidence: [{ kind: "doc", ref: "LAUNCH.md", date: "2026-08-01" }] });

  it("different fields merge; updated_at takes the later and updated_by follows it", () => {
    const ours = { ...base, owner: "alice", updated_at: "2026-09-03T10:00:00Z", updated_by: "alice" };
    const theirs = { ...base, notes: "privacy page is live", updated_at: "2026-09-04", updated_by: "bob" };
    const [r] = records(T, both(T, lines([base]), lines([ours]), lines([theirs])));
    assert.deepStrictEqual(r, { ...base, owner: "alice", notes: "privacy page is live", updated_at: "2026-09-04", updated_by: "bob" });
  });

  it("updated_by follows the later stamp even when the later editor is the base editor", () => {
    const ours = { ...base, owner: "alice", updated_at: "2026-09-05", updated_by: "alice" };
    const theirs = { ...base, notes: "n", updated_at: "2026-09-06", updated_by: base.updated_by };
    const [r] = records(T, both(T, lines([base]), lines([ours]), lines([theirs])));
    assert.deepStrictEqual([r.updated_at, r.updated_by], ["2026-09-06", "tester"]);
  });

  it("evidence unions by (kind, ref, date): base order first, additions by date; equal additions collapse", () => {
    const e1 = { kind: "link", ref: "https://a", date: "2026-09-05" } as const;
    const e2 = { kind: "build", ref: "42", date: "2026-09-03", note: "TestFlight" } as const;
    const ours = { ...base, evidence: [...base.evidence, e1], updated_at: "2026-09-05" };
    const theirs = { ...base, evidence: [e2, ...base.evidence, e1], updated_at: "2026-09-03" };
    const [r] = records(T, both(T, lines([base]), lines([ours]), lines([theirs])));
    assert.deepStrictEqual(r.evidence, [base.evidence[0], e2, e1]);
  });

  it("evidence removed on one side and kept on the other is removed; the same entry edited two ways conflicts", () => {
    const e1 = { kind: "link", ref: "https://a", date: "2026-09-05" } as const;
    const [r] = records(T, both(T, lines([base]), lines([{ ...base, evidence: [] }]), lines([{ ...base, evidence: [...base.evidence, e1] }])));
    assert.deepStrictEqual(r.evidence, [e1]);
    const note = (n: string) => lines([{ ...base, evidence: [{ ...base.evidence[0]!, note: n }] }]);
    assert.deepStrictEqual(fields(mergeJsonl(T, lines([base]), note("x"), note("y"))), ["setup.privacy:evidence"]);
  });

  it("both sides set a different status -> conflict on the judgement group; record line keeps ours, the block names both values", () => {
    const ours = { ...base, status: "done", updated_at: "2026-09-05" };
    const theirs = { ...base, status: "blocked", notes: "legal review", updated_at: "2026-09-06", updated_by: "bob" };
    const r = conflicted(mergeJsonl(T, lines([base]), lines([ours]), lines([theirs])));
    assert.deepStrictEqual(fields(r), [`setup.privacy:${JUDGEMENT_FIELD}`]);
    const group = (x: Record<string, unknown>) => ({ status: x.status, requirement_revision: x.requirement_revision, release: x.release, evidence: x.evidence });
    assert.include(describeConflict(r.conflicts[0]!), `record "setup.privacy" field "${JUDGEMENT_FIELD}": ours ${JSON.stringify(group(ours))} / theirs ${JSON.stringify(group(theirs))}`);
    assert.include(r.text, `<<<<<<< kb-conflict record "setup.privacy" field "${JUDGEMENT_FIELD}"\nours: ${JSON.stringify(group(ours))}\n=======\ntheirs: ${JSON.stringify(group(theirs))}\n>>>>>>> kb-conflict\n`);
    // the non-conflicting fields are already merged in the record line
    assert.deepStrictEqual(records(T, r.text), [{ ...ours, notes: "legal review", updated_at: "2026-09-06", updated_by: "bob" }]);
    // validate refuses the file
    assert.deepStrictEqual(parseJsonl(T, "f", r.text).issues.map((i) => i._tag), ["ConflictMarker"]);
    // swapped sides: the same record and field, labels swapped
    const swapped = conflicted(mergeJsonl(T, lines([base]), lines([theirs]), lines([ours])));
    assert.deepStrictEqual(fields(swapped), fields(r));
    assert.deepStrictEqual([swapped.conflicts[0]!.ours, swapped.conflicts[0]!.theirs], [group(theirs), group(ours)]);
  });

  it("status + requirement_revision + release + evidence move as ONE group: done@rev1 with evidence never combines with the other side's revision 2", () => {
    const e1 = { kind: "link", ref: "https://a", date: "2026-09-05" } as const;
    const ours = { ...base, status: "done", evidence: [...base.evidence, e1], updated_at: "2026-09-05" }; // judged at revision 1
    const theirs = { ...base, requirement_revision: 2, owner: "bob", updated_at: "2026-09-06", updated_by: "bob" }; // re-stamped after the rule changed
    for (const [x, y] of [[ours, theirs], [theirs, ours]] as const) {
      const r = conflicted(mergeJsonl(T, lines([base]), lines([x]), lines([y])));
      assert.deepStrictEqual(fields(r), [`setup.privacy:${JUDGEMENT_FIELD}`]);
      const [kept] = records(T, r.text);
      // the record line holds ONE side's whole group, never done + revision 2
      assert.deepStrictEqual([kept.status, kept.requirement_revision, kept.evidence], [x.status, x.requirement_revision, x.evidence]);
      assert.strictEqual(kept.owner, "bob");
    }
  });

  it("the group changed on one side only -> that side's whole group; never max(requirement_revision)", () => {
    const done = { ...base, status: "done", requirement_revision: 2, evidence: [] };
    const [r] = records(T, both(T, lines([{ ...base, requirement_revision: 3 }]), lines([done]), lines([{ ...base, requirement_revision: 3, owner: "bob" }])));
    assert.deepStrictEqual([r.status, r.requirement_revision, r.evidence, r.owner], ["done", 2, [], "bob"]);
    // both sides moved the revision to different values: no side is "higher", a person decides
    assert.deepStrictEqual(fields(mergeJsonl(T, lines([base]), lines([{ ...base, requirement_revision: 3 }]), lines([{ ...base, requirement_revision: 2 }]))), [`setup.privacy:${JUDGEMENT_FIELD}`]);
    assert.deepStrictEqual(fields(mergeJsonl(T, lines([base]), lines([{ ...base, owner: "alice" }]), lines([{ ...base, owner: "bob" }]))), ["setup.privacy:owner"]);
  });

  it("the tracking key is (requirement, release): two releases of one check never collide", () => {
    const r1 = t({ requirement: "release.smoke", release: "1.0" });
    const r2 = t({ requirement: "release.smoke", release: "1.1" });
    assert.strictEqual(both(T, "", lines([r1]), lines([r2])), lines([r1, r2]));
  });
});

describe("mergeJsonl: requirements", () => {
  const R = RequirementsFile;
  const base = requirement({ refs: [{ source: "playbook" }] });
  const revise = (over: object, note: string) => ({ ...base, ...over, revision: 2, revised_at: "2026-09-10", revision_note: note });

  it("one side revises the text (revision bump), the other edits the title -> merged with the bumped revision", () => {
    const ours = revise({ what: "new what" }, "tighter");
    const [r] = records(R, both(R, lines([base]), lines([ours]), lines([{ ...base, title: "Privacy policy URL" }])));
    assert.deepStrictEqual(r, { ...ours, title: "Privacy policy URL" });
  });

  it("both sides revise the rule -> conflict even when they touched different fields", () => {
    const r = conflicted(mergeJsonl(R, lines([base]), lines([revise({ what: "ours what" }, "same note")]), lines([revise({ how: "theirs how" }, "same note")])));
    assert.deepStrictEqual(fields(r), ["setup.privacy:how", "setup.privacy:what"]);
    assert.include(r.conflicts[0]!.reason, "both sides revised");
    const swapped = conflicted(mergeJsonl(R, lines([base]), lines([revise({ how: "theirs how" }, "same note")]), lines([revise({ what: "ours what" }, "same note")])));
    assert.deepStrictEqual(fields(swapped), fields(r));
  });

  it("both sides revise the same text two ways -> conflict on the text and the differing note", () => {
    const r = mergeJsonl(R, lines([base]), lines([revise({ what: "A" }, "alice")]), lines([revise({ what: "B" }, "bob")]));
    assert.deepStrictEqual(fields(r), ["setup.privacy:revision_note", "setup.privacy:what"]);
  });

  it("both sides make the identical revision -> clean", () => {
    const same = revise({ what: "A", applies_to: { platforms: ["ios"] } }, "n");
    assert.strictEqual(both(R, lines([base]), lines([same]), lines([same])), lines([same]));
  });

  it("refs / conflicts / supersedes union when nobody removed anything; a removal or edit conflicts", () => {
    const ours = { ...base, refs: [...base.refs, { source: "wiki-apps", upstream_id: "R-7" }], conflicts: ["c2"] };
    const theirs = { ...base, refs: [...base.refs, { source: "launch" }], conflicts: ["c1"], supersedes: ["old.rule"] };
    const [r] = records(R, both(R, lines([base]), lines([ours]), lines([theirs])));
    assert.deepStrictEqual(r.refs, [{ source: "playbook" }, { source: "launch" }, { source: "wiki-apps", upstream_id: "R-7" }]);
    assert.deepStrictEqual([r.conflicts, r.supersedes], [["c1", "c2"], ["old.rule"]]);

    const removed = { ...base, refs: [{ source: "launch" }] };
    assert.deepStrictEqual(fields(mergeJsonl(R, lines([base]), lines([ours]), lines([removed]))), ["setup.privacy:refs"]);
  });

  it("several conflicted records: every block follows its own record, conflicts come sorted", () => {
    const other = requirement({ id: "aso.title" });
    const r = conflicted(mergeJsonl(
      R,
      lines([other, base]),
      lines([{ ...other, title: "A" }, { ...base, title: "X" }]),
      lines([{ ...other, title: "B" }, { ...base, title: "Y" }]),
    ));
    assert.deepStrictEqual(fields(r), ["aso.title:title", "setup.privacy:title"]);
    const order = r.text.split("\n").filter((l) => l.startsWith("{") || l.startsWith("<<<<<<<")).map((l) => (l.startsWith("{") ? JSON.parse(l).id : "block"));
    assert.deepStrictEqual(order, ["aso.title", "block", "setup.privacy", "block"]);
  });
});
