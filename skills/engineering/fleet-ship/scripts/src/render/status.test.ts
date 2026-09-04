import { describe, expect, test } from "bun:test";
import { fold } from "../ledger/fold.ts";
import { joinRun } from "../run/Run.ts";
import { FIXTURE_EVENTS, RETRY_EVENTS } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { DEFAULT_WORKFLOW } from "../workflow/Workflow.ts";
import { renderStatus } from "./status.ts";

const NOW = new Date("2026-09-03T11:00:00Z");

describe("renderStatus", () => {
  test("a started chunk shows stage, step, attempts, blockers, dependents, acceptance", () => {
    const events = [...FIXTURE_EVENTS, ...RETRY_EVENTS.slice(1, 10)];
    const text = renderStatus(joinRun(FIXTURE_GRAPH, fold(events)), "w1-ui", NOW, DEFAULT_WORKFLOW)!;
    expect(text).toContain("chunk: w1-ui");
    expect(text).toContain("stage: in_review");
    expect(text).toContain("step: codex-review");
    expect(text).toContain("next steps: adversarial-review");
    expect(text).toContain("attempt: 2 (gate_failed)");
    expect(text).toContain("blocked by: w0-ffi (spawned)");
    expect(text).toContain("conflicts: w1-docs");
    expect(text).toContain("hold: human (not approved)");
    expect(text).toContain("acceptance: screens match");
  });
  test("dependents list their pane ids when known", () => {
    const text = renderStatus(joinRun(FIXTURE_GRAPH, fold(FIXTURE_EVENTS)), "w0-prunes", NOW, DEFAULT_WORKFLOW)!;
    expect(text).toContain("dependents: w1-ui (-), w1-docs (-)");
  });
  test("unknown chunk is null", () => {
    expect(renderStatus(joinRun(FIXTURE_GRAPH, fold(FIXTURE_EVENTS)), "nope", NOW, DEFAULT_WORKFLOW)).toBeNull();
  });
});
