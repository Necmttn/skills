import { describe, expect, test } from "bun:test";
import { fold } from "../ledger/fold.ts";
import { joinRun } from "../run/Run.ts";
import { FIXTURE_EVENTS } from "../testing/fixture.ts";
import { FIXTURE_GRAPH } from "../testing/graphFixture.ts";
import { renderNext } from "./next.ts";

describe("renderNext", () => {
  const text = renderNext(joinRun(FIXTURE_GRAPH, fold(FIXTURE_EVENTS)), new Date("2026-09-03T10:00:00Z"));
  test("frontier block lists ready chunks with kind, lane, hold, needs, and a question flag", () => {
    const frontier = text.split("not ready")[0]!;
    expect(frontier).toContain("frontier (2)");
    expect(frontier).toContain("w1-docs | impl | mechanical");
    expect(frontier).toContain("q1-name | question | judgment");
    expect(frontier).toContain("needs answer");
    expect(frontier).not.toContain("w1-ui");
  });
  test("not-ready block names blockers and skips done chunks", () => {
    const rest = text.split("not ready")[1]!;
    expect(rest).toContain("w1-ui");
    expect(rest).toContain("waits on w0-ffi");
    expect(rest).not.toContain("w0-prunes");
  });
});
