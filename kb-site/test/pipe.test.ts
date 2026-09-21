import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { app, lines, requirement, source } from "./helpers.ts";

// Regression: Bun's console.log dropped piped output beyond 64 KiB when the reader was slow (see runtime.ts).
// The store is a generated fixture: this test must not need the real (private) kb-site/data.
describe("cli stdout through a slow pipe", () => {
  const tmp = mkdtempSync(join(tmpdir(), "kb-pipe-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("delivers a large --json document complete", () => {
    const data = join(tmp, "data");
    mkdirSync(data, { recursive: true });
    const checks = Array.from({ length: 300 }, (_, i) =>
      requirement({ id: `setup.check-${String(i).padStart(3, "0")}`, title: `Check ${i}`, what: "outcome ".repeat(20), how: "step ".repeat(20) }));
    writeFileSync(join(data, "sources.jsonl"), lines([source()]));
    writeFileSync(join(data, "requirements.jsonl"), lines(checks));
    writeFileSync(join(data, "apps.jsonl"), lines([app()]));
    writeFileSync(join(data, "conflicts.jsonl"), "");

    const cli = join(import.meta.dirname, "..", "cli.ts");
    const out = execFileSync("sh", ["-c", `bun "${cli}" --data "${data}" checklist alpha --json | (sleep 1; cat)`], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    expect(out.length).toBeGreaterThan(65536 * 2);
    const body = JSON.parse(out);
    expect([body.ok, body.items.length]).toEqual([true, 300]);
  }, 120_000);
});
