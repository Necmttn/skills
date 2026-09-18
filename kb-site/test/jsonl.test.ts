import { assert, describe, it } from "@effect/vitest";
import { AppsFile, conflictBlock, encodeJsonl, kindForPath, parseJsonl, RequirementsFile, TrackingFile } from "../src/jsonl.ts";
import { app, lines, requirement, tracking } from "./helpers.ts";

describe("parseJsonl", () => {
  it("reports a malformed line with file and 1-based line number, keeps the good lines", () => {
    const text = lines([app()]) + "{\"id\": oops\n" + lines([app({ id: "beta" })]);
    const parsed = parseJsonl(AppsFile, "apps.jsonl", text);
    assert.deepStrictEqual(parsed.records.map((r) => [r.value.id, r.line]), [["alpha", 1], ["beta", 3]]);
    const [problem] = parsed.issues;
    assert.strictEqual(parsed.issues.length, 1);
    assert.strictEqual(problem?._tag, "MalformedJson");
    assert.strictEqual(problem?.file, "apps.jsonl");
    assert.strictEqual(problem?.line, 2);
    assert.match(problem?.message ?? "", /^malformed JSON: /);
  });

  it("reports a schema violation with the field path, distinct from malformed JSON", () => {
    const bad = { ...requirement(), phase: "launch", refs: [{ source: 7 }], revision: 0 };
    const parsed = parseJsonl(RequirementsFile, "requirements.jsonl", lines([bad]));
    assert.strictEqual(parsed.records.length, 0);
    assert.isTrue(parsed.issues.every((i) => i._tag === "SchemaViolation" && i.line === 1 && i.id === "setup.privacy"));
    const text = parsed.issues.map((i) => i.message).join("\n");
    assert.include(text, 'field "phase": Expected "idea"');
    assert.include(text, 'field "refs[0].source": Expected string');
    assert.include(text, 'field "revision"');
  });

  it("rejects ids that break the id pattern, and unknown keys", () => {
    const parsed = parseJsonl(AppsFile, "apps.jsonl", lines([{ ...app(), id: "Alpha_1" }, { ...app(), note: "typo" }]));
    assert.include(parsed.issues[0]?.message ?? "", 'field "id": Expected an id matching');
    assert.include(parsed.issues[1]?.message ?? "", 'field "note"');
  });

  it("reports a duplicate id and keeps the first record", () => {
    const parsed = parseJsonl(AppsFile, "apps.jsonl", lines([app(), app({ name: "Again" })]));
    assert.deepStrictEqual(parsed.records.map((r) => r.value.name), ["Alpha"]);
    assert.strictEqual(parsed.issues[0]?._tag, "DuplicateKey");
    assert.strictEqual(parsed.issues[0]?.line, 2);
    assert.include(parsed.issues[0]?.message ?? "", 'duplicate id "alpha" (first seen on line 1)');
  });

  it("treats (requirement, release) as the tracking key", () => {
    const parsed = parseJsonl(
      TrackingFile,
      "tracking/alpha.jsonl",
      lines([tracking({ requirement: "r", release: "1.0" }), tracking({ requirement: "r", release: "1.1" }), tracking({ requirement: "r", release: "1.0" })]),
    );
    assert.strictEqual(parsed.records.length, 2);
    assert.include(parsed.issues[0]?.message ?? "", 'duplicate (requirement, release) "r@1.0"');
  });

  it("warns on an unsorted file", () => {
    const parsed = parseJsonl(AppsFile, "apps.jsonl", lines([app({ id: "beta" }), app()]));
    assert.strictEqual(parsed.records.length, 2);
    assert.deepStrictEqual(parsed.issues.map((i) => [i._tag, i.severity, i.line]), [["Unsorted", "warning", 2]]);
  });

  it("warns on non-canonical text, accepts canonical text", () => {
    assert.deepStrictEqual(parseJsonl(AppsFile, "apps.jsonl", encodeJsonl(AppsFile, [app()])).issues, []);
    const spaced = JSON.stringify(app(), null, 1).replaceAll("\n", "") + "\n";
    assert.deepStrictEqual(parseJsonl(AppsFile, "apps.jsonl", spaced).issues.map((i) => i._tag), ["NotCanonical"]);
    assert.deepStrictEqual(parseJsonl(AppsFile, "apps.jsonl", encodeJsonl(AppsFile, [app()]).trimEnd()).issues.map((i) => i._tag), ["NotCanonical"]);
  });

  it("reports blank lines, tolerates the final newline and an empty file", () => {
    assert.deepStrictEqual(parseJsonl(AppsFile, "apps.jsonl", "").issues, []);
    const parsed = parseJsonl(AppsFile, "apps.jsonl", lines([app()]) + "\n" + lines([app({ id: "beta" })]));
    assert.deepStrictEqual(parsed.issues.map((i) => [i._tag, i.line]), [["BlankLine", 2]]);
    assert.strictEqual(parsed.records.length, 2);
  });

  it("reports git conflict markers as one problem per block and skips the block", () => {
    const text = lines([app()]) + "<<<<<<< HEAD\n" + lines([app({ id: "beta" })]) + "=======\n" + lines([app({ id: "beta", name: "B2" })]) + ">>>>>>> theirs\n";
    const parsed = parseJsonl(AppsFile, "apps.jsonl", text);
    assert.deepStrictEqual(parsed.records.map((r) => r.value.id), ["alpha"]);
    assert.deepStrictEqual(parsed.issues.map((i) => [i._tag, i.line]), [["ConflictMarker", 2]]);
    assert.include(parsed.issues[0]?.message ?? "", "unresolved git merge conflict on lines 2-6");
  });

  it("reports our merge-driver conflict block, an unclosed block, and a stray marker", () => {
    const block = conflictBlock({ key: "alpha", field: "name", ours: "A", theirs: "B" });
    const parsed = parseJsonl(AppsFile, "apps.jsonl", lines([app()]) + block + "\n");
    assert.include(parsed.issues[0]?.message ?? "", "unresolved merge-driver conflict block on lines 2-6");
    assert.include(parseJsonl(AppsFile, "a", "<<<<<<< HEAD\n" + lines([app()])).issues[0]?.message ?? "", "no closing marker");
    assert.include(parseJsonl(AppsFile, "a", lines([app()]) + "=======\n").issues[0]?.message ?? "", "stray merge conflict marker");
  });
});

describe("encodeJsonl", () => {
  it("uses the fixed key order (nested too), sorts by key, ends with a newline", () => {
    const scrambled = { notes: "n", current_release: { build: "2", version: "1.0" }, path: "p", root: "apps", tags: [], platforms: [], app_store_id: null, bundle_id: null, name: "Beta", id: "beta" } as const;
    const text = encodeJsonl(AppsFile, [scrambled, app()]);
    assert.strictEqual(
      text,
      '{"id":"alpha","name":"Alpha","bundle_id":null,"app_store_id":null,"platforms":["ios"],"tags":[],"root":"apps","path":"apps/alpha","current_release":{"version":"1.0"}}\n' +
        '{"id":"beta","name":"Beta","bundle_id":null,"app_store_id":null,"platforms":[],"tags":[],"root":"apps","path":"p","current_release":{"version":"1.0","build":"2"},"notes":"n"}\n',
    );
  });

  it("is stable: encode(decode(encode(x))) === encode(x)", () => {
    const records = [tracking({ requirement: "b", release: "1.10" }), tracking({ requirement: "b", release: null }), tracking({ requirement: "a", evidence: [{ kind: "link", ref: "x", date: "2026-01-01", note: "n" }] })];
    const once = encodeJsonl(TrackingFile, records);
    const parsed = parseJsonl(TrackingFile, "tracking/alpha.jsonl", once);
    assert.deepStrictEqual(parsed.issues, []);
    assert.strictEqual(encodeJsonl(TrackingFile, parsed.records.map((r) => r.value)), once);
    assert.strictEqual(encodeJsonl(TrackingFile, [...records].reverse()), once);
  });

  it("maps paths to file kinds", () => {
    assert.strictEqual(kindForPath("kb-site/data/tracking/alpha.jsonl")?.name, "tracking");
    assert.strictEqual(kindForPath("kb-site/data/apps.jsonl")?.name, "apps");
    assert.strictEqual(kindForPath("README.md"), undefined);
  });
});
