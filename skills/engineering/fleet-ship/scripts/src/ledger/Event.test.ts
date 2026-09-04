import { describe, expect, test } from "bun:test";
import { isFleetType } from "./Event.ts";

describe("isFleetType", () => {
  test("accepts underscore stages in the fleet namespace only", () => {
    expect(isFleetType("fleet.chunk.in_review")).toBe(true);
    expect(isFleetType("chunk.merged")).toBe(false);
  });
});
