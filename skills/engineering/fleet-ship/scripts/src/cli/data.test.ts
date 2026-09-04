import { describe, expect, test } from "bun:test";
import { Result } from "effect";
import { parseData } from "./data.ts";

describe("parseData", () => {
  test("splits key=value on the first '=' and keeps later '=' in the value", () => {
    const r = parseData(["pr=Necmttn/ax#784", "gist=a=b"]);
    expect(Result.isSuccess(r)).toBe(true);
    if (Result.isSuccess(r)) expect(r.success).toEqual({ pr: "Necmttn/ax#784", gist: "a=b" });
  });

  test("coerces integers and booleans, leaves everything else a string", () => {
    const r = parseData(["closed=3", "ok=true", "no=false", "sha=1390e639", "neg=-7"]);
    if (Result.isFailure(r)) throw new Error(r.failure);
    expect(r.success).toEqual({ closed: 3, ok: true, no: false, sha: "1390e639", neg: -7 });
  });

  test("last duplicate key wins", () => {
    const r = parseData(["a=1", "a=2"]);
    if (Result.isFailure(r)) throw new Error(r.failure);
    expect(r.success).toEqual({ a: 2 });
  });

  test("rejects a pair without '='", () => {
    const r = parseData(["oops"]);
    expect(Result.isFailure(r)).toBe(true);
    if (Result.isFailure(r)) expect(r.failure).toContain("key=value");
  });
});
