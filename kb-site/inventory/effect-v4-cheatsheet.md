# Effect v4 cheat-sheet for a Bun CLI (verified 2026-09-18)

Every snippet below is copied from a probe that was type-checked (`tsc --noEmit`, strict) and run in
`/tmp/effect-v4-probe` (Bun 1.3.14, TypeScript 5.9.3). Items not run are marked **UNVERIFIED**.
Primary source of truth on disk: `node_modules/effect/src/**` and the shipped agent docs
`node_modules/effect/ai-docs/src/**` (runnable examples per topic: `01_effect/03_services`, `60_child-process`,
`70_cli`, `09_testing`). Read those before trusting memory or v3 docs.

## 1. Versions that worked

```json
{
  "dependencies": {
    "effect": "4.0.0-rc.112",
    "@effect/platform-bun": "4.0.0-rc.112"
  },
  "devDependencies": {
    "@effect/vitest": "4.0.0-rc.112",
    "vitest": "4.1.11",
    "@types/bun": "latest",
    "typescript": "^5.9.0"
  },
  "overrides": {
    "@effect/platform-node-shared": "4.0.0-rc.112"
  }
}
```

- Pin exact versions (no `^`). Same pin as the owner's `skills/engineering/fleet-ship/scripts/package.json`,
  `forge-interviews`, `quota-widget`.
- **The `overrides` block is required on a fresh install.** `@effect/platform-bun@rc.112` depends on
  `@effect/platform-node-shared@^4.0.0-rc.112`; a fresh `bun add` resolved it to `rc.115`, which imports
  `effect/unstable/net/NetAddress` (absent in rc.112) and crashes at startup:
  `Cannot find module 'effect/unstable/net/NetAddress'`. After install, check
  `jq -r .version node_modules/@effect/platform-node-shared/package.json` equals the `effect` version.
- `@effect/vitest@rc.112` peer-requires `vitest >=4.1.0 <5`. vitest 3.x is out of range.
- tsconfig: the `bun init` default works unchanged (`module: Preserve`, `moduleResolution: bundler`,
  `allowImportingTsExtensions`, `verbatimModuleSyntax`, `strict`, `noImplicitOverride`,
  `noUncheckedIndexedAccess`). Import local files with the `.ts` extension.

## 2. Import lines (all verified)

```ts
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Clock, Console, Context, Data, DateTime, Effect, FileSystem, Layer, Option, Path, Result, Runtime, Schema, SchemaIssue, Stream } from "effect"
import { Argument, CliError, Command, Flag } from "effect/unstable/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { TestClock, TestConsole } from "effect/testing"
import { assert, describe, it, layer } from "@effect/vitest"
```

- `FileSystem`, `Path`, `Terminal`, `Stdio`, `PlatformError` now live in core `effect` (no `@effect/platform`).
  Service tags: `FileSystem.FileSystem`, `Path.Path`.
- `BunServices.layer` provides `ChildProcessSpawner | Crypto | FileSystem | Path | Terminal | Stdio`.
- Exist but **UNVERIFIED** (export checked, not run): `effect/unstable/http` (`HttpClient`, `HttpClientRequest`,
  `HttpClientResponse`, `FetchHttpClient`), `effect/unstable/persistence` `KeyValueStore`
  (`layerMemory`, `layerFileSystem`, `layerStorage`).

## 3. Service + Layer (live + test), FileSystem/Path, atomic write, Clock, Schema, errors

`src/core.ts` (ran OK):

```ts
import { Clock, Context, Data, Effect, FileSystem, Layer, Path, Schema, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"

// ---------- Schema ----------
export const Status = Schema.Literals(["open", "done"])
export type Status = typeof Status.Type

export const Item = Schema.Struct({
  id: Schema.String,
  status: Status,
  kind: Schema.Union([Schema.Literal("app"), Schema.Literal("screen")]), // Union takes an ARRAY
  note: Schema.optional(Schema.String), // key may be absent OR undefined
  tag: Schema.optionalKey(Schema.String), // key may be absent, never undefined
  count: Schema.Number
})
export type Item = typeof Item.Type

export const ItemsJson = Schema.fromJsonString(Schema.Array(Item)) // string <-> Item[]

// ---------- Errors ----------
export class StoreError extends Schema.TaggedError<StoreError>()("StoreError", {
  path: Schema.String,
  reason: Schema.String
}) {}

export class GitError extends Data.TaggedError("GitError")<{
  readonly exitCode: number
  readonly stderr: string
}> {}

// ---------- Service ----------
export class Store extends Context.Service<Store, {
  readonly load: Effect.Effect<ReadonlyArray<Item>, StoreError>
  save(items: ReadonlyArray<Item>): Effect.Effect<void, StoreError>
}>()("probe/Store") {
  // live layer: file backed, needs FileSystem + Path
  static readonly layer = (file: string) =>
    Layer.effect(
      Store,
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path

        const load = Effect.gen(function*() {
          const exists = yield* fs.exists(file)
          if (!exists) return []
          const text = yield* fs.readFileString(file)
          return yield* Schema.decodeUnknownEffect(ItemsJson)(text)
        }).pipe(
          Effect.mapError((e) => new StoreError({ path: file, reason: e.message }))
        )

        const save = Effect.fn("Store.save")(function*(items: ReadonlyArray<Item>) {
          const text = yield* Schema.encodeEffect(ItemsJson)(items)
          const dir = path.dirname(file)
          yield* fs.makeDirectory(dir, { recursive: true })
          // atomic write: temp file in the SAME directory, then rename
          const now = yield* Clock.currentTimeMillis
          const tmp = path.join(dir, `.${path.basename(file)}.${now}.tmp`)
          yield* fs.writeFileString(tmp, text)
          yield* fs.rename(tmp, file)
        }, Effect.mapError((e) => new StoreError({ path: file, reason: e.message })))

        return Store.of({ load, save })
      })
    )

  // test layer: in memory
  static readonly layerTest = Layer.sync(Store, () => {
    let state: ReadonlyArray<Item> = []
    return Store.of({
      load: Effect.sync(() => state),
      save: (items) => Effect.sync(() => { state = items })
    })
  })
}
```

Notes (all observed):

- Use a service: `const store = yield* Store`, or `Store.use((s) => s.load)`. Service type: `Store["Service"]`.
- `Layer.succeed(Store, impl)` and `Layer.succeed(Store)(impl)` both compile and run.
- Provide: `Effect.provide(Store.layer(file))`; compose `StoreLive.pipe(Layer.provideMerge(BunServices.layer))`.
- `Effect.fn("name")(function*(...) {...}, ...pipeables)` - the extra arguments are pipe steps over the result.
- Clock: `yield* Clock.currentTimeMillis` (number), `Clock.currentTimeNanos` (bigint),
  `yield* DateTime.now` + `DateTime.formatIso(now)` -> `2026-09-18T15:13:47.741Z`.
- Temp dir: `fs.makeTempDirectoryScoped({ prefix })` needs a `Scope` (`Effect.scoped`) and removes itself.
  Other verified `fs` calls: `exists`, `readFileString`, `writeFileString`, `makeDirectory(dir, { recursive: true })`,
  `rename`, `readDirectory`, `remove`.
- After the atomic save the directory listing is exactly `[ "items.json" ]` (no temp file remains).

### Schema decode / encode / readable errors (ran OK)

```ts
const bad: unknown = { id: 1, status: "nope", kind: "app" }
// { errors: "all" } collects every issue; default stops at the first
const err = yield* Schema.decodeUnknownEffect(Item)(bad, { errors: "all" }).pipe(Effect.flip)
err._tag       // "SchemaError"
err.message    // already human readable, see below
SchemaIssue.makeFormatterDefault()(err.issue)             // same string
SchemaIssue.makeFormatterStandardSchemaV1()(err.issue)    // { issues: [{ path, message }] }

Schema.decodeUnknownExit(Item)(bad)._tag   // "Failure"  (sync, no throw)
Schema.decodeUnknownSync(Item)(bad)        // throws Error with the same message
yield* Schema.encodeEffect(Schema.fromJsonString(Item))(item)   // -> JSON string
```

Actual `err.message` output:

```
Expected string
  at ["id"]
Expected "open" | "done"
  at ["status"]
Missing key
  at ["count"]
```

Standard format output: `{"issues":[{"path":["id"],"message":"Expected string"},{"path":["status"],"message":"Expected \"open\" | \"done\""},{"path":["count"],"message":"Missing key"}]}`

- `SchemaIssue.defaultFormatter` exists in JS but is NOT in the `.d.ts` (rc.112): use `makeFormatterDefault()`.
- Also exported (not run, **UNVERIFIED**): `Schema.decodeUnknownResult`, `encodeSync`, `encodeUnknownEffect`,
  `Schema.Class`, `Schema.TaggedClass`, `Schema.TaggedStruct`, `Schema.NullOr`, `Schema.toCodecJson`,
  `Schema.UnknownFromJsonString`.

### Tagged errors

- Both are valid in rc.112: `Schema.TaggedError<Self>()("Tag", { fields })` (serializable, used by effect's own
  docs and by `CliError`) and `Data.TaggedError("Tag")<{ fields }>` (plain).
- `Schema.TaggedErrorClass` does NOT exist in rc.112 (`rg TaggedErrorClass node_modules/effect/src/Schema.ts` = 0 hits).
- Errors are yieldable: `return yield* new GitError({ exitCode, stderr })`.
- With `noImplicitOverride`, custom `message` getter and exit-code marker need `override`.

## 4. Child process (git) - ran OK

```ts
export const gitVersion = Effect.gen(function*() {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const out = yield* spawner.string(ChildProcess.make("git", ["--version"]))   // whole stdout
  const code = yield* spawner.exitCode(ChildProcess.make("git", ["--version"])) // only exit code
  return { out: out.trim(), code }
})
// -> {"out":"git version 2.50.1 (Apple Git-155)","code":0}

// stdout + stderr + exit code from ONE run
export const runGit = Effect.fn("runGit")(function*(args: ReadonlyArray<string>, cwd?: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const handle = yield* spawner.spawn(ChildProcess.make("git", args, { cwd }))
  const [stdout, stderr, exitCode] = yield* Effect.all([
    handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
    handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
    handle.exitCode
  ], { concurrency: "unbounded" })
  if (exitCode !== 0) return yield* new GitError({ exitCode, stderr })
  return { stdout, exitCode }
}, Effect.scoped) // spawn needs a Scope
```

- **`spawner.string` / `lines` do NOT fail on a nonzero exit code.** `git not-a-command` returned `Success`.
  Use `spawn` + `handle.exitCode` (above) when the exit code matters.
- A missing binary fails with `PlatformError`, `reason._tag === "NotFound"`.
- Spawner methods: `spawn` (needs `Scope`), `exitCode`, `string`, `lines`, `streamString`, `streamLines`;
  options `{ includeStderr?: boolean }`. Command options: `cwd`, `env`, `extendEnv`, `shell`.
  `ChildProcess.pipeTo`, `setCwd`, `setEnv` exist (**UNVERIFIED**, see `ai-docs/src/60_child-process`).
- Handle: `pid`, `exitCode`, `isRunning`, `kill`, `stdout`, `stderr`, `all` (streams of `Uint8Array`).
- `ExitCode` is a branded number; comparing with `!== 0` compiles.

## 5. CLI - `src/cli.ts` (ran OK)

```ts
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Console, Data, Effect, Layer, Option, Runtime } from "effect"
import { Argument, CliError, Command, Flag } from "effect/unstable/cli"
import { Store } from "./core.ts"

// custom exit code: runMain reads [Runtime.errorExitCode] from the failure
class NotFound extends Data.TaggedError("NotFound")<{ readonly id: string }> {
  override readonly [Runtime.errorExitCode] = 3
  override get message() {
    return `item not found: ${this.id}`
  }
}

// boolean flags are REQUIRED unless they have a default
const json = Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print machine readable JSON"))

const add = Command.make(
  "add",
  {
    id: Argument.string("id").pipe(Argument.withDescription("Item id")),
    kind: Flag.choice("kind", ["app", "screen"]).pipe(Flag.withAlias("k"), Flag.withDefault("app")),
    note: Flag.string("note").pipe(Flag.optional), // Option<string>
    count: Flag.integer("count").pipe(Flag.withDefault(1)),
    json
  },
  Effect.fn("cli.add")(function*({ id, kind, note, count, json }) {
    const store = yield* Store
    const items = yield* store.load
    const item = {
      id,
      kind,
      count,
      status: "open" as const,
      ...(Option.isSome(note) ? { note: note.value } : {})
    }
    yield* store.save([...items, item])
    yield* Console.log(json ? JSON.stringify(item) : `added ${id} (${kind})`)
  })
).pipe(Command.withDescription("Add an item"))

const show = Command.make(
  "show",
  { id: Argument.string("id"), json },
  Effect.fn("cli.show")(function*({ id, json }) {
    const store = yield* Store
    const found = (yield* store.load).find((i) => i.id === id)
    if (!found) return yield* new NotFound({ id })
    yield* Console.log(json ? JSON.stringify(found) : `${found.id} ${found.status}`)
  })
)

const boom = Command.make("boom", {}, () =>
  Effect.fail(new CliError.UserError({ cause: new Error("bad input"), userMessage: "bad input from user" })))

export const root = Command.make("probe").pipe(
  Command.withDescription("Probe CLI"),
  Command.withSubcommands([add, show, boom])
)

const StoreLive = Store.layer(process.env.PROBE_FILE ?? "/tmp/effect-v4-probe/.data/items.json")
const MainLayer = StoreLive.pipe(Layer.provideMerge(BunServices.layer))

if (import.meta.main) {
  Command.run(root, { version: "0.0.1" }).pipe(
    // print domain failures as one clean stderr line; CliError is already rendered by Command.run
    Effect.tapError((e) => CliError.isCliError(e) ? Effect.void : Console.error(`error: ${e.message}`)),
    Effect.provide(MainLayer),
    // no "[ts] ERROR (#2): ..." stack dump; the exit code still comes from the failure
    BunRuntime.runMain({ disableErrorReporting: true })
  )
}
```

Observed behaviour:

| Invocation | stdout / stderr | exit |
|---|---|---|
| `add a1 --kind screen --note hi --json` | `{"id":"a1","kind":"screen","count":1,"status":"open","note":"hi"}` | 0 |
| `add -k screen a2` (flags before or after the argument both work) | `added a2 (screen)` | 0 |
| `add --no-json a4` (`--no-<flag>` negation is built in) | `added a4 (app)` | 0 |
| `show zzz` | stderr `error: item not found: zzz` | 3 |
| `boom` (`CliError.UserError`) | stderr `ERROR / bad input from user` | 1 |
| `add --kind bogus x` | help on stdout; stderr `Invalid value for flag --kind: "bogus". Expected: "app" \| "screen"` | 1 |
| `add` (no argument) | help on stdout; stderr `Missing required argument: id` | 1 |
| `--help`, `--version` | help / `probe v0.0.1` | 0 |

Exit code rules (`effect/src/Runtime.ts` `defaultTeardown`): success 0; interrupt only 130; failure =
`error[Runtime.errorExitCode]` if it is a number, else 1. `CliError.ShowHelp` sets 1 when it carries errors,
0 for plain `--help`. `runMain` options: `{ disableErrorReporting?, teardown? }` only.

- `Command.run(cmd, { version })` reads argv from the `Stdio` service (no `process.argv` argument).
  `Command.runWith(cmd, { version })(argv: ReadonlyArray<string>)` takes explicit args (tests; fleet.ts uses it
  with `process.argv.slice(2)`). Option `renderErrors: false` makes the host own error printing.
- Built-in global flags: `--help/-h`, `--version/-v`, `--wizard`, `--completions`, `--log-level`. Do not reuse
  these names.
- Without `disableErrorReporting`, a domain failure prints a log line with a stack trace to stderr.
- Other params (from `effect-solutions show cli`, **UNVERIFIED**): `Argument.optional`, `Argument.withDefault`,
  `Argument.variadic()`, `Argument.atLeast(1)`.

## 6. Testing with @effect/vitest - `test/store.test.ts` (7 tests passed)

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"]
  }
})
```

Run with **`bun --bun vitest run`**. Plain `bunx vitest run` runs under Node and fails on the barrel import:
`Cannot find package 'bun' imported from @effect/platform-bun/dist/BunRedis.js`. Alternative that passed under
Node: deep imports everywhere, `import * as BunServices from "@effect/platform-bun/BunServices"` and
`import * as BunRuntime from "@effect/platform-bun/BunRuntime"`.

```ts
import { BunServices } from "@effect/platform-bun"
import { assert, describe, it, layer } from "@effect/vitest"
import { Clock, Context, Effect, FileSystem, Layer, Path } from "effect"
import { TestClock, TestConsole } from "effect/testing"
import { Command } from "effect/unstable/cli"
import { root } from "../src/cli.ts"
import { gitVersion, Store } from "../src/core.ts"

// 1. in-memory test layer, provided per test (fresh state per test)
describe("Store (in-memory layer)", () => {
  it.effect("save then load", () =>
    Effect.gen(function*() {
      const store = yield* Store
      yield* store.save([{ id: "a", status: "open", kind: "app", count: 1 }])
      assert.strictEqual((yield* store.load).length, 1)
    }).pipe(Effect.provide(Store.layerTest)))

  it.effect("TestClock starts at 0 and is adjustable", () =>
    Effect.gen(function*() {
      assert.strictEqual(yield* Clock.currentTimeMillis, 0)
      yield* TestClock.adjust("1 second")
      assert.strictEqual(yield* Clock.currentTimeMillis, 1000)
    }))
})

// 2. live Store on a real temp directory; the dir lives as long as the layer
class TmpDir extends Context.Service<TmpDir, { readonly dir: string }>()("test/TmpDir") {
  static readonly layer = Layer.effect(
    TmpDir,
    Effect.gen(function*() {
      const fs = yield* FileSystem.FileSystem
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "store-test-" })
      return TmpDir.of({ dir })
    })
  )
}

const StoreOnTmp = Layer.unwrap(
  Effect.gen(function*() {
    const { dir } = yield* TmpDir
    const path = yield* Path.Path
    return Store.layer(path.join(dir, "data", "items.json"))
  })
).pipe(
  Layer.provideMerge(TmpDir.layer),
  Layer.provideMerge(BunServices.layer)
)

layer(StoreOnTmp)("Store (real FileSystem, temp dir)", (it) => {
  it.effect("atomic save leaves only the target file", () =>
    Effect.gen(function*() {
      const store = yield* Store
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const { dir } = yield* TmpDir
      yield* store.save([{ id: "a", status: "done", kind: "screen", count: 2 }])
      assert.deepStrictEqual(yield* fs.readDirectory(path.join(dir, "data")), ["items.json"])
    }))

  it.effect("corrupt file -> StoreError with readable reason", () =>
    Effect.gen(function*() {
      const store = yield* Store
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const { dir } = yield* TmpDir
      yield* fs.writeFileString(path.join(dir, "data", "items.json"), `[{"id":1}]`)
      const err = yield* Effect.flip(store.load)
      assert.strictEqual(err._tag, "StoreError")
      assert.include(err.reason, "Expected string")
      // the layer (and its temp dir) is SHARED by every test in this block: clean up
      yield* fs.remove(path.join(dir, "data", "items.json"))
    }))

  it.effect("spawns git", () =>
    Effect.gen(function*() {
      const v = yield* gitVersion
      assert.strictEqual(v.code, 0)
    }))

  // drive the CLI in-process with explicit argv; TestConsole captures Console.log
  it.effect("cli add --json prints JSON", () =>
    Effect.gen(function*() {
      const run = Command.runWith(root, { version: "0.0.0" })
      yield* run(["add", "z9", "--kind", "screen", "--json"])
      const lines = yield* TestConsole.logLines
      assert.deepStrictEqual(JSON.parse(String(lines.at(-1))), { id: "z9", kind: "screen", count: 1, status: "open" })
    }))

  it.effect("cli show <missing> fails with NotFound", () =>
    Effect.gen(function*() {
      const err = yield* Effect.flip(Command.runWith(root, { version: "0.0.0" })(["show", "nope"]))
      assert.strictEqual((err as { _tag: string })._tag, "NotFound")
    }))
})
```

- `it.effect` provides `TestClock` (starts at 0) and `TestConsole`. `it.live` uses real services.
- Inside `layer(L)("name", (it) => ...)` the `it` has **no `.live`** (type `MethodsNonLive`; runtime
  `it.live is not a function`). `it.effect` still ran the real `git` subprocess and real file I/O without a problem.
  `layer(L, { excludeTestServices: true })` exists (**UNVERIFIED**).
- One `layer(...)` block = one shared layer instance, torn down in `afterAll`. State leaks between tests; this
  caused two real failures in the probe until the corrupt file was removed. The temp dir was gone after the run.
- The owner's repos use `bun:test` with plain `Effect.runPromise`, not `@effect/vitest`
  (fleet-ship `scripts/fleet.test.ts:1`). `@effect/vitest` is verified here but has no owner precedent.

## 7. v3 -> v4 gotchas (each one observed)

1. `Flag.boolean("x")` alone is a REQUIRED flag: omitting it fails with `Missing required flag: --x`, help, exit 1.
   Always `Flag.boolean("x").pipe(Flag.withDefault(false))`. `effect-solutions show cli` shows the bare form; it is
   stale on this point. It is also stale on "flags must come before arguments": both orders worked.
2. Fresh installs drift: pin `@effect/platform-node-shared` with `overrides` (section 1) or the CLI crashes on import.
3. `spawner.string`/`lines` succeed on a nonzero exit code. Check `handle.exitCode` yourself.
4. Vitest must run under Bun (`bun --bun vitest run`) or use deep `@effect/platform-bun/<Module>` imports.
5. Exit codes come from `[Runtime.errorExitCode]` on the error value; `runMain` has no exit-code option.
   Use `runMain({ disableErrorReporting: true })` + `Effect.tapError` for a clean one-line stderr.
6. Renames checked in `src/Effect.ts` / `src/Context.ts`: `Effect.catchAll` -> `Effect.catch`; `Effect.either` ->
   `Effect.result` (`Result.isFailure(r)`, `r.failure` / `r.success`); `Effect.fork` -> `Effect.forkChild`,
   `forkDaemon` -> `forkDetach`; `Effect.Service`, `Effect.Tag`, `Context.Tag`, `Context.GenericTag` are gone ->
   `Context.Service` (+ `Context.Reference`); `tapErrorCause` -> `tapCause`, `catchAllCause` -> `catchCause`.
   (`catch`, `result`, `Layer.succeed` forms were run; the fork / cause renames are export checks only.)
7. Schema: `Schema.Union([...])` and `Schema.Literals([...])` take arrays; `decodeUnknown` -> `decodeUnknownEffect`;
   `parseJson` -> `fromJsonString`; parse failure is `SchemaError` with `.issue` and a readable `.message`
   (no `ParseResult.TreeFormatter`); `optional` vs `optionalKey` differ (undefined allowed or not).
8. `@effect/platform` and `@effect/cli` packages are not used: platform services are in `effect`, CLI is
   `effect/unstable/cli`, processes are `effect/unstable/process` (v3 `Command` from platform is gone).
9. `unstable/*` modules change between rc builds. Re-verify against `node_modules/effect/src` after any version bump.
   `ax` is on `4.0.0-beta.78` and `lalph` on `beta.36`; their code may not match rc.112.

## 8. Owner example projects to imitate

Best match (same repo, same pin `4.0.0-rc.112`, Bun CLI):
`/Users/necmttn/Projects/necmttn-skills-wt/app-knowledge-tracking/skills/engineering/fleet-ship/scripts/`

- `fleet.ts:13-15` - import lines for platform-bun, effect, `effect/unstable/cli`.
- `fleet.ts:88-92` - `Command.make` with `Flag.boolean(...).pipe(Flag.withDefault(false), Flag.withDescription(...))`.
- `fleet.ts:180` - nested group: `Command.make("graph").pipe(Command.withDescription, Command.withSubcommands([...]))`.
- `fleet.ts:220-244` - positional `Argument.string` commands.
- `fleet.ts:324-326` - root command with nine subcommands.
- `fleet.ts:329-362` - own exit-code mapping (usage errors = 2) around
  `Command.runWith(root, { version })(process.argv.slice(2))`, and stderr printing for non-`CliError` failures.
- `src/ledger/Ledger.ts:12,37,61` - `Context.Service` with two `Layer.effect` constructors.
- `session-handoff.ts:99-101` - `ChildProcessSpawner` + `ChildProcess.make(cmd, args, { cwd })` + `spawner.string`.
- `package.json` - exact pins, `bun test`, `tsc --noEmit`.

Second (larger, but `4.0.0-beta.78`, so treat API details with care): `/Users/necmttn/Projects/ax/apps/axctl/`

- `src/cli/index.ts:203` - subcommand registry; `:236` `Command.runWith`; `:456-503` error reporting inside the
  effect and `BunRuntime.runMain`.
- `src/cli/commands/costs.ts:46-183` - flag-heavy commands (`Flag.optional`, `Flag.withDefault(false)`), grouped.
- `src/classifiers/service.ts:47`, `src/classifiers/core.ts:330` - `Context.Service` with a named shape interface.

Also on rc.112: `/Users/necmttn/Projects/forge-interviews/src/main/services.ts:56-64` (compact `Context.Service`
declarations).

Local guidance CLI: `effect-solutions list` / `effect-solutions show <topic>` (topics: quick-start, project-setup,
tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli). Useful, but see
gotcha 1: it is not fully in step with rc.112.

Probe sources (not committed): `/tmp/effect-v4-probe/src/{core,cli,probe-core,probe-misc}.ts`,
`/tmp/effect-v4-probe/test/store.test.ts`.
