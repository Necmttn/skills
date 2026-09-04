import { describe, expect, test } from "bun:test";
import { renderStats } from "../render/stats.ts";
import { RETRY_EVENTS } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { computeStats } from "./stats.ts";

describe("computeStats", () => {
  const stats = computeStats(FIXTURE_GRAPH, RETRY_EVENTS);
  test("dwell per lane and stage: w1-ui (design) visited building three times (18, 9, 15 minutes)", () => {
    const building = stats.byLaneStage.find((item) => item.lane === "design" && item.stage === "building")!;
    expect(building.count).toBe(3);
    expect(building.maxMin).toBe(18);
    expect(Math.round(building.meanMin)).toBe(14);
  });
  test("attempts and causes", () => {
    expect(stats.attempts).toEqual([{ id: "w1-ui", attempts: 2, causes: ["initial", "gate_failed"] }]);
    expect(stats.causes.get("gate_failed")).toBe(1);
  });
  test("slowest lists the longest dwell first", () => {
    expect(stats.slowest[0]).toEqual({ id: "w1-ui", stage: "building", minutes: 18 });
  });
  test("evidence on merged chunks", () => {
    expect(stats.evidence.get("verified")).toBe(1);
  });
  test("renderStats prints every block", () => {
    const text = renderStats(stats);
    expect(text).toContain("time in stage (minutes) by lane");
    expect(text).toContain("design | building | 3 |");
    expect(text).toContain("retries");
    expect(text).toContain("w1-ui: 2 attempts (initial, gate_failed)");
    expect(text).toContain("slowest");
  });
});
