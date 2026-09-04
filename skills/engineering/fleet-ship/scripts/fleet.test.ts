import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { event, FIXTURE_EVENTS, FIXTURE_TEXT, RETRY_EVENTS } from "./src/testing/fixture.ts";
import { FIXTURE_GRAPH_CYCLE, writeEpicDir } from "./src/testing/graphFixture.ts";

const CLI = new URL("./fleet.ts", import.meta.url).pathname;

const fleet = (args: ReadonlyArray<string>, env: Record<string, string> = {}) => {
  const proc = Bun.spawnSync(["bun", CLI, ...args], { env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
};

const tmpRoot = () => mkdtempSync(join(tmpdir(), "fleet-epic-"));
const lastLine = (dir: string, slug = "mbp") => JSON.parse(readFileSync(join(dir, `ledger.${slug}.jsonl`), "utf8").trim().split("\n").at(-1)!);

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

describe("fleet log (epic mode guard)", () => {
  test("an allowed transition appends to this machine's ledger file", () => {
    const dir = writeEpicDir(tmpRoot(), { events: [...FIXTURE_EVENTS, event("fleet.chunk.spawned", "mbp/w1-docs")] });
    const r = fleet(["log", dir, "fleet.chunk.building", "mbp/w1-docs", "pane=w1:p3"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(lastLine(dir).type).toBe("fleet.chunk.building");
  });
  test("skipping the gate is refused with exit 2 and the allowed targets", () => {
    const dir = writeEpicDir(tmpRoot());
    const r = fleet(["log", dir, "fleet.chunk.merged", "mbp/w0-ffi"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(2);
    expect(r.err).toContain("spawned");
    expect(r.err).toContain("planned");
  });
  test("--force with a reason records forced=true", () => {
    const dir = writeEpicDir(tmpRoot());
    const r = fleet(["log", "--force", dir, "fleet.chunk.merged", "mbp/w0-ffi", "reason=owner merged by hand"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(lastLine(dir).data).toMatchObject({ forced: true, reason: "owner merged by hand" });
  });
  test("--force without a reason is exit 2", () => {
    const dir = writeEpicDir(tmpRoot());
    expect(fleet(["log", "--force", dir, "fleet.chunk.merged", "mbp/w0-ffi"], { FLEET_SLUG: "mbp" }).code).toBe(2);
  });
  test("an unknown chunk id is exit 2 unless --adhoc", () => {
    const dir = writeEpicDir(tmpRoot());
    expect(fleet(["log", dir, "fleet.chunk.spawned", "mbp/hotfix-9"], { FLEET_SLUG: "mbp" }).code).toBe(2);
    const r = fleet(["log", "--adhoc", dir, "fleet.chunk.spawned", "mbp/hotfix-9"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(lastLine(dir).data.adhoc).toBe(true);
  });
  test("an unknown step for the stage is exit 2; a known one passes", () => {
    const events = [...FIXTURE_EVENTS, event("fleet.chunk.spawned", "mbp/w1-docs")];
    const dir = writeEpicDir(tmpRoot(), { events });
    expect(fleet(["log", dir, "fleet.chunk.building", "mbp/w1-docs", "step=consensus"], { FLEET_SLUG: "mbp" }).code).toBe(2);
    expect(fleet(["log", dir, "fleet.chunk.building", "mbp/w1-docs", "step=tdd-red"], { FLEET_SLUG: "mbp" }).code).toBe(0);
  });
  test("a bad evidence value is exit 2", () => {
    const dir = writeEpicDir(tmpRoot(), { events: RETRY_EVENTS.slice(0, 3) });
    expect(fleet(["log", dir, "fleet.chunk.built", "mbp/w1-ui", "evidence=trust-me"], { FLEET_SLUG: "mbp" }).code).toBe(2);
  });
  test("a held chunk cannot merge without hold=approved", () => {
    const events = [...FIXTURE_EVENTS, ...RETRY_EVENTS.slice(1, 11)];
    const dir = writeEpicDir(tmpRoot(), { events });
    expect(fleet(["log", dir, "fleet.chunk.merged", "mbp/w1-ui"], { FLEET_SLUG: "mbp" }).code).toBe(2);
    expect(fleet(["log", dir, "fleet.chunk.merged", "mbp/w1-ui", "hold=approved"], { FLEET_SLUG: "mbp" }).code).toBe(0);
  });
  test("legacy single-file mode has no guard", () => {
    const ledger = join(tmpRoot(), "demo.jsonl");
    expect(fleet(["log", ledger, "fleet.chunk.merged", "mbp/anything"]).code).toBe(0);
  });
  test("a step update inside the same stage is accepted", () => {
    const dir = writeEpicDir(tmpRoot(), { events: RETRY_EVENTS.slice(0, 10) }); // w1-ui is in_review with step codex-review
    const r = fleet(["log", dir, "fleet.chunk.in_review", "mbp/w1-ui", "step=adversarial-review"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(lastLine(dir).data).toMatchObject({ step: "adversarial-review" });
  });
});

describe("fleet graph check", () => {
  test("clean graph exits 0 and says so", () => {
    const dir = writeEpicDir(tmpRoot());
    const r = fleet(["graph", "check", dir]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("ok");
  });
  test("a cycle exits 2 with G120", () => {
    const dir = writeEpicDir(tmpRoot(), { graph: { ...FIXTURE_GRAPH_CYCLE } });
    const r = fleet(["graph", "check", dir]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("G120");
  });
});

describe("fleet init", () => {
  test("creates the home layout, an empty graph, DECISIONS.md, knowhow dirs, and prints the git recipe", () => {
    const home = join(tmpRoot(), "home");
    const r = fleet(["init", home, "demo", "--repo", "Necmttn/ax", "--plan", "docs/superpowers/plans/demo.md", "--plan-sha", "abc1234"]);
    expect(r.code).toBe(0);
    expect(existsSync(join(home, "demo", "graph.json"))).toBe(true);
    expect(existsSync(join(home, "demo", "DECISIONS.md"))).toBe(true);
    expect(existsSync(join(home, "knowhow", "inbox"))).toBe(true);
    expect(existsSync(join(home, "knowhow", "KNOWHOW.md"))).toBe(true);
    expect(readFileSync(join(home, ".gitignore"), "utf8")).toContain(".dagr/");
    expect(JSON.parse(readFileSync(join(home, "demo", "graph.json"), "utf8"))).toMatchObject({ epic: "demo", integration_branch: "epic/demo", chunks: [] });
    expect(r.out).toContain("git worktree add --orphan");
  });
  test("is idempotent: a second run does not overwrite an edited graph", () => {
    const home = join(tmpRoot(), "home");
    fleet(["init", home, "demo", "--repo", "Necmttn/ax", "--plan", "p.md"]);
    writeFileSync(join(home, "demo", "graph.json"), "{\"edited\":true}");
    const r = fleet(["init", home, "demo", "--repo", "Necmttn/ax", "--plan", "p.md"]);
    expect(r.code).toBe(0);
    expect(readFileSync(join(home, "demo", "graph.json"), "utf8")).toBe("{\"edited\":true}");
  });
});

describe("fleet next / status", () => {
  test("next prints the frontier from an epic dir", () => {
    const r = fleet(["next", writeEpicDir(tmpRoot())], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("frontier (2)");
    expect(r.out).toContain("w1-docs");
  });
  test("status prints one chunk and exit 2 for an unknown one", () => {
    const dir = writeEpicDir(tmpRoot());
    const ok = fleet(["status", dir, "mbp/w0-prunes"], { FLEET_SLUG: "mbp" });
    expect(ok.code).toBe(0);
    expect(ok.out).toContain("stage: merged");
    expect(fleet(["status", dir, "nope"], { FLEET_SLUG: "mbp" }).code).toBe(2);
  });
  test("next without a graph.json is exit 2 with a hint", () => {
    const dir = writeEpicDir(tmpRoot(), { graph: null });
    const r = fleet(["next", dir], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(2);
    expect(r.err).toContain("fleet init");
  });
});

describe("fleet state (epic mode)", () => {
  test("renders depth groups and the frontier from an epic dir", () => {
    const r = fleet(["state", writeEpicDir(tmpRoot()), "--tail", "3"], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("depth 0");
    expect(r.out).toContain("frontier: 2");
    expect(r.out).toContain("not started");
  });
});

describe("fleet stats", () => {
  test("prints the stats blocks from an epic dir", () => {
    const r = fleet(["stats", writeEpicDir(tmpRoot(), { events: RETRY_EVENTS })], { FLEET_SLUG: "mbp" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("time in stage");
    expect(r.out).toContain("w1-ui: 2 attempts");
  });
});
