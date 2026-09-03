import { describe, expect, test } from "bun:test";
import { BunFileSystem } from "@effect/platform-bun";
import { Effect } from "effect";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeEvent } from "./Event.ts";
import { Ledger, layer } from "./Ledger.ts";
import { FIXTURE_TEXT } from "../testing/fixture.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "fleet-ledger-"));

const run = <A, E>(path: string, body: Effect.Effect<A, E, Ledger>) =>
  Effect.runPromise(body.pipe(Effect.provide(layer(path)), Effect.provide(BunFileSystem.layer)));

describe("Ledger", () => {
  test("append writes one JSON line per event and creates the parent dir", async () => {
    const path = join(tmp(), "nested", "demo.jsonl");
    await run(
      path,
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        yield* ledger.append(makeEvent({ type: "fleet.note", subject: "", data: { text: "a" }, source: "s" }));
        yield* ledger.append(makeEvent({ type: "fleet.note", subject: "", data: { text: "b" }, source: "s" }));
      }),
    );
    const lines = readFileSync(path, "utf8").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!).data).toEqual({ text: "b" });
  });

  test("readAll returns events in order and counts malformed lines instead of failing", async () => {
    const path = join(tmp(), "demo.jsonl");
    writeFileSync(path, FIXTURE_TEXT);
    const { events, malformed } = await run(
      path,
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        return yield* ledger.readAll;
      }),
    );
    expect(events).toHaveLength(12);
    expect(events[0]!.type).toBe("fleet.run.started");
    expect(malformed).toHaveLength(1);
    expect(malformed[0]!.line).toBe(13);
  });

  test("readAll on a missing file is empty", async () => {
    const path = join(tmp(), "absent.jsonl");
    const { events, malformed } = await run(
      path,
      Effect.gen(function* () {
        return yield* (yield* Ledger).readAll;
      }),
    );
    expect(events).toHaveLength(0);
    expect(malformed).toHaveLength(0);
  });
});
