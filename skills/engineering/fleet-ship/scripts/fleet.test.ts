import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_TEXT } from "./src/testing/fixture.ts";

const CLI = new URL("./fleet.ts", import.meta.url).pathname;

const fleet = (args: ReadonlyArray<string>, env: Record<string, string> = {}) => {
  const proc = Bun.spawnSync(["bun", CLI, ...args], { env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
};

describe("fleet log", () => {
  test("appends one CloudEvents line with coerced data and the FLEET_SOURCE", () => {
    const ledger = join(mkdtempSync(join(tmpdir(), "fleet-cli-")), "demo.jsonl");
    const r = fleet(["log", ledger, "fleet.chunk.merged", "mbp/w0", "pr=Necmttn/ax#784", "closed=3"], { FLEET_SOURCE: "fleet/demo/mbp" });
    expect(r.code).toBe(0);
    const rec = JSON.parse(readFileSync(ledger, "utf8").trim());
    expect(rec.type).toBe("fleet.chunk.merged");
    expect(rec.source).toBe("fleet/demo/mbp");
    expect(rec.data).toEqual({ pr: "Necmttn/ax#784", closed: 3 });
  });

  test("a '-' subject is empty and the source defaults to fleet/<stem>/<host>", () => {
    const ledger = join(mkdtempSync(join(tmpdir(), "fleet-cli-")), "demo.jsonl");
    const r = fleet(["log", ledger, "fleet.note", "-", "text=x"], { FLEET_SOURCE: "" });
    expect(r.code).toBe(0);
    const rec = JSON.parse(readFileSync(ledger, "utf8").trim());
    expect(rec.subject).toBe("");
    expect(rec.source.startsWith("fleet/demo/")).toBe(true);
  });

  test("rejects a type outside fleet.* with exit 2 and writes nothing", () => {
    const ledger = join(mkdtempSync(join(tmpdir(), "fleet-cli-")), "demo.jsonl");
    const r = fleet(["log", ledger, "chunk.merged", "x"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("fleet.");
  });
});

describe("fleet state", () => {
  test("renders the view from the ledger without a server", () => {
    const ledger = join(mkdtempSync(join(tmpdir(), "fleet-cli-")), "demo.jsonl");
    writeFileSync(ledger, FIXTURE_TEXT);
    const r = fleet(["state", ledger, "--tail", "3"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("epic: demo");
    expect(r.out).toContain("malformed: 1");
    expect(r.out).toContain("action log (last 3)");
    expect(r.err).toContain("line 13");
  });

  test("exit 2 when the ledger does not exist", () => {
    const r = fleet(["state", "/nonexistent/x.jsonl"]);
    expect(r.code).toBe(2);
  });
});

describe("fleet teardown", () => {
  test("dry-run prints the plan table and exits 0", () => {
    const ledger = join(mkdtempSync(join(tmpdir(), "fleet-cli-")), "demo.jsonl");
    writeFileSync(ledger, FIXTURE_TEXT);
    const r = fleet(["teardown", ledger, "--epic", "demo", "--session", "fleet-demo"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("would-stop-session");
    expect(r.out).toContain("already-closed");
  });

  test("an invalid ledger exits 2", () => {
    const ledger = join(mkdtempSync(join(tmpdir(), "fleet-cli-")), "demo.jsonl");
    writeFileSync(ledger, JSON.stringify({ specversion: "1.0", id: "1", source: "s", type: "fleet.resource.minted", time: "2026-09-03T00:00:00Z", subject: "pane:", data: {} }) + "\n");
    const r = fleet(["teardown", ledger, "--epic", "demo", "--session", "fleet-demo"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("empty resource id");
  });
});
