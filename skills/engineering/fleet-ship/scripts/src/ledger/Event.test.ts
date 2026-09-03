import { describe, expect, test } from "bun:test";
import { Result } from "effect";
import { makeEvent, parseLine } from "./Event.ts";

describe("FleetEvent", () => {
  test("makeEvent mints a CloudEvents 1.0 record with a unique id and a Z time", () => {
    const one = makeEvent({ type: "fleet.chunk.merged", subject: "mbp/w0", data: { pr: "x#1" }, source: "fleet/demo/mbp" });
    const two = makeEvent({ type: "fleet.note", subject: "", data: {}, source: "fleet/demo/mbp" });
    expect(one.specversion).toBe("1.0");
    expect(one.type).toBe("fleet.chunk.merged");
    expect(one.subject).toBe("mbp/w0");
    expect(one.data).toEqual({ pr: "x#1" });
    expect(one.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(one.id).not.toBe(two.id);
  });

  test("parseLine accepts a valid record", () => {
    const line = JSON.stringify(makeEvent({ type: "fleet.note", subject: "", data: { text: "hi" }, source: "s" }));
    const parsed = parseLine(line);
    expect(Result.isSuccess(parsed)).toBe(true);
    if (Result.isSuccess(parsed)) expect(parsed.success.data).toEqual({ text: "hi" });
  });

  test("parseLine rejects a type outside the fleet.* namespace", () => {
    const line = JSON.stringify({ ...makeEvent({ type: "fleet.note", subject: "", data: {}, source: "s" }), type: "chunk.merged" });
    expect(Result.isFailure(parseLine(line))).toBe(true);
  });

  test("parseLine rejects non-JSON and non-object lines with a reason", () => {
    const bad = parseLine("this line is not json");
    expect(Result.isFailure(bad)).toBe(true);
    if (Result.isFailure(bad)) expect(bad.failure.reason).toContain("JSON");
    expect(Result.isFailure(parseLine("42"))).toBe(true);
  });
});
