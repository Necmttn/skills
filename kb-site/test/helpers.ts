import { BunServices } from "@effect/platform-bun";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import { TestConsole } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Roots } from "../src/roots.ts";
import type { App, Conflict, Requirement, Source, TrackingRecord } from "../src/schema.ts";
import { Store } from "../src/store.ts";

/** True when the real (private) store is not next to the code. Tests that need it skip; nothing else may depend on it. */
export const REAL_DATA_ABSENT = !existsSync(join(import.meta.dirname, "..", "data", "requirements.jsonl"));

export const source = (over: Partial<Source> = {}): Source => ({
  id: "playbook",
  title: "Playbook",
  kind: "playbook",
  root: "kb",
  path: "PLAYBOOK.md",
  access: "repo",
  license: null,
  publishable: true,
  ...over,
});

export const requirement = (over: Partial<Requirement> = {}): Requirement => ({
  id: "setup.privacy",
  kind: "check",
  title: "Privacy policy",
  acceptance: "decided",
  revision: 1,
  revised_at: "2026-09-01",
  revision_note: "seed",
  phase: "setup",
  cadence: "once",
  applies_to: {},
  evidence_required: true,
  owner_gate: false,
  what: "what",
  how: "how",
  refs: [{ source: "playbook" }],
  ...over,
});

export const app = (over: Partial<App> = {}): App => ({
  id: "alpha",
  name: "Alpha",
  bundle_id: null,
  app_store_id: null,
  platforms: ["ios"],
  tags: [],
  root: "apps",
  path: "apps/alpha",
  current_release: { version: "1.0" },
  ...over,
});

export const tracking = (over: Partial<TrackingRecord> = {}): TrackingRecord => ({
  app: "alpha",
  requirement: "setup.privacy",
  release: null,
  status: "in_progress",
  requirement_revision: 1,
  owner: null,
  notes: "",
  evidence: [],
  updated_at: "2026-09-02",
  updated_by: "tester",
  ...over,
});

export const conflict = (over: Partial<Conflict> = {}): Conflict => ({
  id: "c1",
  summary: "Two sources disagree",
  sides: [{ source: "playbook", locator: "#a", claim: "A" }],
  requirements: ["setup.privacy"],
  status: "open",
  resolution: null,
  recorded_at: "2026-09-01",
  ...over,
});

export const lines = (records: ReadonlyArray<unknown>): string => records.map((r) => JSON.stringify(r) + "\n").join("");

/** A small valid store. Override any file by data-dir relative path; `null` leaves the file out. */
export const baseFiles = (over: Record<string, string | null> = {}): Record<string, string | null> => ({
  "sources.jsonl": lines([source()]),
  "requirements.jsonl": lines([
    requirement({ id: "release.smoke", phase: "release", cadence: "every_release", title: "Smoke test" }),
    requirement(),
  ]),
  "apps.jsonl": lines([app(), app({ id: "beta", name: "Beta", path: "apps/beta", current_release: null })]),
  "conflicts.jsonl": "",
  ...over,
});

export const envWith = (config: Record<string, string>) => Layer.mergeAll(BunServices.layer, ConfigProvider.layer(ConfigProvider.fromUnknown(config)));
export const TestEnv = envWith({ KB_USER: "tester" });
/** No `KB_USER`: the author resolves to `unknown`. */
export const AnonymousEnv = envWith({});

/** Write `files` into a scoped temp dir (`<tmp>/data`), then run `f` with `Store` and `Roots` on it. */
export const withStore = <A, E>(
  files: Record<string, string | null>,
  // `f` may need Store, Roots, and anything in TestEnv (platform services, Crypto, the cli Environment)
  f: (ctx: { readonly dir: string; readonly write: (rel: string, text: string) => Effect.Effect<void> }) => Effect.Effect<A, E, any>,
  env: Layer.Layer<any> = TestEnv,
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "kb-test-" });
    const dir = path.join(tmp, "data");
    const write = (rel: string, text: string) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(path.dirname(path.join(dir, rel)), { recursive: true });
        yield* fs.writeFileString(path.join(dir, rel), text);
      }).pipe(Effect.orDie);
    yield* fs.makeDirectory(dir, { recursive: true });
    for (const [rel, text] of Object.entries(files)) if (text !== null) yield* write(rel, text);
    return yield* f({ dir, write }).pipe(Effect.provide(Layer.mergeAll(Store.layer(dir), Roots.layer(dir))));
  }).pipe(Effect.scoped, Effect.provide(env)) as Effect.Effect<A, E>;

export const messages = (issues: ReadonlyArray<{ readonly message: string }>): string => issues.map((i) => i.message).join("\n");

/** Run a kb root command in-process on `dir`; each call returns what that call printed. */
export const cliRunner = (root: Command.Command<any, any, any, any, any>, dir: string, globalArgs: ReadonlyArray<string> = []) => {
  return (...argv: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      const seenOut = (yield* TestConsole.logLines).length;
      const seenErr = (yield* TestConsole.errorLines).length;
      const exit = yield* Effect.exit(Command.runWith(root, { version: "0.0.0" })(["--data", dir, ...globalArgs, ...argv]));
      const out = (yield* TestConsole.logLines).map(String);
      const err = (yield* TestConsole.errorLines).map(String);
      return { ok: exit._tag === "Success", stdout: out.slice(seenOut).join("\n"), stderr: err.slice(seenErr) };
    }) as Effect.Effect<{ readonly ok: boolean; readonly stdout: string; readonly stderr: ReadonlyArray<string> }, never, any>;
};
