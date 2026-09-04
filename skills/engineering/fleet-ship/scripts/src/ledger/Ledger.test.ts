import { describe, expect, test } from "bun:test";
import { BunFileSystem } from "@effect/platform-bun";
import { Effect } from "effect";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeEvent } from "./Event.ts";
import { Ledger, layer, layerDir } from "./Ledger.ts";
import { FIXTURE_EVENTS, FIXTURE_TEXT, RETRY_EVENTS } from "../testing/fixture.ts";

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

describe("Ledger.layerDir", () => {
  const runDir = <A, E>(dir: string, slug: string, body: Effect.Effect<A, E, Ledger>) =>
    Effect.runPromise(body.pipe(Effect.provide(layerDir(dir, slug)), Effect.provide(BunFileSystem.layer)));

  test("append writes to ledger.<slug>.jsonl and readAll merges every machine's file by time", async () => {
    const dir = join(tmp(), "demo");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ledger.vps.jsonl"), RETRY_EVENTS.map((e) => JSON.stringify(e)).join("\n") + "\n");
    writeFileSync(join(dir, "ledger.mbp.jsonl"), FIXTURE_EVENTS.slice(0, 2).map((e) => JSON.stringify(e)).join("\n") + "\nnot json\n");
    const { events, malformed } = await runDir(
      dir, "mbp",
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        yield* ledger.append(makeEvent({ type: "fleet.note", subject: "", data: { text: "late" }, source: "s", now: new Date("2026-09-03T12:00:00Z") }));
        return yield* ledger.readAll;
      }),
    );
    expect(events).toHaveLength(RETRY_EVENTS.length + 2 + 1);
    expect(events.at(-1)!.data).toEqual({ text: "late" });
    expect(events[0]!.type).toBe("fleet.run.started");
    expect(malformed).toHaveLength(1);
    expect(malformed[0]!.file).toBe("ledger.mbp.jsonl");
    expect(readFileSync(join(dir, "ledger.mbp.jsonl"), "utf8").trimEnd().split("\n")).toHaveLength(4);
  });

  test("readAll on an empty directory is empty and append creates the directory", async () => {
    const dir = join(tmp(), "fresh");
    const { events } = await runDir(
      dir, "mbp",
      Effect.gen(function* () {
        const ledger = yield* Ledger;
        const before = yield* ledger.readAll;
        expect(before.events).toHaveLength(0);
        yield* ledger.append(makeEvent({ type: "fleet.note", subject: "", data: {}, source: "s" }));
        return yield* ledger.readAll;
      }),
    );
    expect(events).toHaveLength(1);
  });
});
