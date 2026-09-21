/** The record store as an Effect service over FileSystem + Path + Crypto + Clock. */
import { Clock, Config, Console, Context, Crypto, Data, Effect, FileSystem, Layer, Option, Path, Result } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { errorsOf, formatIssue, type Issue, sortIssues } from "./issue.ts";
import {
  APPS_PATH,
  AppsFile,
  CONFLICTS_PATH,
  ConflictsFile,
  encodeJsonl,
  type FileKind,
  parseJsonl,
  REQUIREMENTS_PATH,
  RequirementsFile,
  SOURCES_PATH,
  SourcesFile,
  TRACKING_DIR,
  TrackingFile,
  trackingPath,
} from "./jsonl.ts";
import type { App, KbData, TrackingRecord } from "./schema.ts";
import { Today } from "./today.ts";
import { applyRevise, applySet, applySetRelease, type ReviseOutcome, type RevisePatch, type SetOutcome, type TrackingPatch } from "./transitions.ts";
import { type Location, validateData, type Where } from "./validate.ts";

// ---- errors -----------------------------------------------------------------------------
/** The change (or the store it would produce) breaks a rule. Nothing was written. */
export class Rejected extends Data.TaggedError("Rejected")<{ readonly issues: ReadonlyArray<Issue> }> {
  override get message() {
    return this.issues.map(formatIssue).join("\n");
  }
}

/** The file changed on disk between read and write. Nothing was written. */
export class ConcurrentEdit extends Data.TaggedError("ConcurrentEdit")<{ readonly file: string }> {
  override get message() {
    return `${this.file} changed on disk while this command ran; nothing was written, run the command again`;
  }
}

/** Another kb command holds the store lock. Nothing was written. */
export class StoreLocked extends Data.TaggedError("StoreLocked")<{ readonly lockFile: string; readonly holder: string }> {
  override get message() {
    return `another kb write is in progress (lock file ${this.lockFile}, held by ${this.holder}); nothing was written, run the command again. If no kb command is running, delete the lock file (it is broken automatically after ${LOCK_STALE_MS / 1000} s)`;
  }
}

/** A rename failed after an earlier rename of the same commit succeeded. The store holds a partial change. */
export class PartialWrite extends Data.TaggedError("PartialWrite")<{
  readonly written: ReadonlyArray<string>;
  readonly notWritten: ReadonlyArray<string>;
  readonly reason: string;
}> {
  override get message() {
    return `the write stopped part way: ${this.reason}. written: ${this.written.join(", ")}. NOT written: ${this.notWritten.join(", ")}. Run \`kb validate\`, then run the command again`;
  }
}

export type WriteError = ConcurrentEdit | StoreLocked | PartialWrite | StoreIo;

/** In the data dir. Content: JSON `{at, time, by, token}`. Gitignored. */
export const LOCK_FILE = ".kb.lock";
/** A lock older than this belongs to a run that died; the next writer breaks it with a warning. */
export const LOCK_STALE_MS = 60_000;

export class StoreIo extends Data.TaggedError("StoreIo")<{ readonly file: string; readonly reason: string }> {
  override get message() {
    return `${this.file}: ${this.reason}`;
  }
}

// ---- model ------------------------------------------------------------------------------
export interface FileState {
  /** Data-dir relative, forward slashes. */
  readonly path: string;
  /** `null`: the file did not exist at load time. */
  readonly text: string | null;
  /** SHA-256 hex of `text`. */
  readonly hash: string | null;
  readonly kind: FileKind<any>;
  readonly records: ReadonlyArray<unknown>;
  /** A parse problem that makes a rewrite lossy: `fmt` and writes leave the file alone. */
  readonly damaged: boolean;
}

export interface Loaded {
  readonly data: KbData;
  /** Parse problems and rule violations, sorted by file then line. */
  readonly issues: ReadonlyArray<Issue>;
  readonly files: ReadonlyMap<string, FileState>;
  readonly where: Where;
}

export interface FmtResult {
  readonly changed: ReadonlyArray<string>;
  /** Files left alone because they hold problems `fmt` cannot fix. */
  readonly skipped: ReadonlyArray<string>;
  readonly issues: ReadonlyArray<Issue>;
}

const LOSSY: ReadonlyArray<Issue["_tag"]> = ["MalformedJson", "SchemaViolation", "ConflictMarker", "DuplicateKey"];

export class Store extends Context.Service<
  Store,
  {
    readonly dataDir: string;
    readonly load: Effect.Effect<Loaded, StoreIo>;
    /** `load` + every issue. Never fails on bad data, only on I/O. */
    readonly validate: Effect.Effect<ReadonlyArray<Issue>, StoreIo>;
    /**
     * Validate `data`, then write the named files (data-dir relative) under the store lock: re-hash
     * EVERY loaded file, write every temp file, then rename. Fails with `Rejected` on any
     * error-severity issue, `ConcurrentEdit` when a file changed since `loaded`, `StoreLocked` when
     * another writer holds the lock (nothing written in all three), `PartialWrite` when a rename
     * failed after an earlier one succeeded. Returns the files whose content changed.
     */
    readonly commit: (
      loaded: Loaded,
      data: KbData,
      files: ReadonlyArray<string>,
    ) => Effect.Effect<ReadonlyArray<string>, Rejected | WriteError>;
    readonly setTracking: (
      app: string,
      requirement: string,
      patch: TrackingPatch,
    ) => Effect.Effect<SetOutcome, Rejected | WriteError>;
    readonly setRelease: (app: string, version: string, build?: string) => Effect.Effect<App, Rejected | WriteError>;
    /** A safe rule edit: a material change bumps `revision` by 1 and stamps `revised_at` + `revision_note`. */
    readonly revise: (requirement: string, patch: RevisePatch) => Effect.Effect<ReviseOutcome, Rejected | WriteError>;
    readonly fmt: Effect.Effect<FmtResult, WriteError>;
  }
>()("kb/Store") {
  /** `isDefault`: nobody named this directory (`--data` was not given), so a missing one gets the longer explanation. */
  static readonly layer = (dataDir: string, options: { readonly isDefault?: boolean } = {}): Layer.Layer<Store, never, FileSystem.FileSystem | Path.Path | Crypto.Crypto> =>
    Layer.effect(Store, make(dataDir, options.isDefault === true));
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export const MISSING_DEFAULT_DATA =
  "the default data directory does not exist. The store holds private material and may live apart from the code: " +
  "clone or copy the store to this path, or pass --data <dir> (and --roots <file> when its kb.roots.json is elsewhere)";

const make = (dataDir: string, isDefault: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const crypto = yield* Crypto.Crypto;
    let tmpCounter = 0;

    const abs = (rel: string) => path.join(dataDir, ...rel.split("/"));
    const io = (file: string) => (e: PlatformError) => new StoreIo({ file, reason: e.message });
    const hashOf = (file: string, text: string) =>
      crypto.digest("SHA-256", new TextEncoder().encode(text)).pipe(Effect.map(hex), Effect.mapError(io(file)));

    const read = (rel: string) =>
      Effect.gen(function* () {
        if (!(yield* fs.exists(abs(rel)))) return null;
        return yield* fs.readFileString(abs(rel));
      }).pipe(Effect.mapError(io(rel)));

    const load: Effect.Effect<Loaded, StoreIo> = Effect.gen(function* () {
      if (!(yield* fs.exists(dataDir).pipe(Effect.mapError(io(dataDir))))) {
        return yield* new StoreIo({ file: dataDir, reason: isDefault ? MISSING_DEFAULT_DATA : "data directory not found; pass --data <dir>" });
      }
      const files = new Map<string, FileState>();
      const locations = new Map<object, Location>();
      const issues: Array<Issue> = [];

      const loadFile = <A extends object>(kind: FileKind<A>, rel: string) =>
        Effect.gen(function* () {
          const text = yield* read(rel);
          const parsed = parseJsonl(kind, rel, text ?? "");
          for (const r of parsed.records) locations.set(r.value, { file: rel, line: r.line });
          issues.push(...parsed.issues);
          const records = parsed.records.map((r) => r.value);
          files.set(rel, {
            path: rel,
            text,
            hash: text === null ? null : yield* hashOf(rel, text),
            kind,
            records,
            damaged: parsed.issues.some((i) => LOSSY.includes(i._tag)),
          });
          return records;
        });

      const sources = yield* loadFile(SourcesFile, SOURCES_PATH);
      const requirements = yield* loadFile(RequirementsFile, REQUIREMENTS_PATH);
      const apps = yield* loadFile(AppsFile, APPS_PATH);
      const conflicts = yield* loadFile(ConflictsFile, CONFLICTS_PATH);

      const trackingDir = abs(TRACKING_DIR);
      const names = (yield* fs.exists(trackingDir).pipe(Effect.mapError(io(TRACKING_DIR))))
        ? (yield* fs.readDirectory(trackingDir).pipe(Effect.mapError(io(TRACKING_DIR)))).filter((n) => n.endsWith(".jsonl") && !n.startsWith(".")).sort()
        : [];
      const tracking: Array<TrackingRecord> = [];
      for (const name of names) tracking.push(...(yield* loadFile(TrackingFile, `${TRACKING_DIR}/${name}`)));

      const data: KbData = { sources, requirements, apps, conflicts, tracking };
      const where: Where = (record) => locations.get(record);
      return { data, issues: sortIssues([...issues, ...validateData(data, where)]), files, where };
    });

    // ---- the store lock: one writer at a time, from the re-hash to the last rename ----
    const lockFile = path.join(dataDir, LOCK_FILE);
    const by = Option.getOrElse(yield* Config.option(Config.string("KB_USER")).pipe(Effect.orElseSucceed(() => Option.none<string>())), () => "unknown");
    const lockInfo = (text: string): { readonly at?: number; readonly time?: string; readonly by?: string } => {
      try {
        const v: unknown = JSON.parse(text);
        return typeof v === "object" && v !== null ? v : {};
      } catch {
        return {};
      }
    };

    const acquire: Effect.Effect<string, StoreLocked | StoreIo> = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const token = `${now}.${tmpCounter++}.${Math.random().toString(36).slice(2)}`;
      const content = JSON.stringify({ at: now, time: new Date(now).toISOString(), by, token });
      const create = fs.writeFileString(lockFile, content, { flag: "wx" }).pipe(Effect.as(token), Effect.result);
      const first = yield* create;
      if (Result.isSuccess(first)) return token;
      if (first.failure.reason._tag !== "AlreadyExists") return yield* new StoreIo({ file: LOCK_FILE, reason: first.failure.message });

      const held = yield* fs.readFileString(lockFile).pipe(Effect.orElseSucceed(() => ""));
      const info = lockInfo(held);
      const holder = `${info.by ?? "unknown"} since ${info.time ?? "an unknown time"}`;
      // no readable timestamp (a writer died mid-create): fall back to the file's mtime
      const mtime = yield* fs.stat(lockFile).pipe(Effect.map((i) => Option.getOrUndefined(i.mtime)?.getTime()), Effect.orElseSucceed(() => undefined));
      const at = typeof info.at === "number" ? info.at : mtime ?? now;
      if (now - at <= LOCK_STALE_MS) return yield* new StoreLocked({ lockFile, holder });

      // Break it by rename: only one breaker wins. If the file we moved is not the stale one we read,
      // a new writer got in between: put it back and give up.
      const aside = `${lockFile}.stale.${token}`;
      const moved = yield* fs.rename(lockFile, aside).pipe(Effect.result);
      if (Result.isSuccess(moved)) {
        const text = yield* fs.readFileString(aside).pipe(Effect.orElseSucceed(() => held));
        if (text !== held) {
          yield* fs.rename(aside, lockFile).pipe(Effect.ignore);
          return yield* new StoreLocked({ lockFile, holder: "a writer that started just now" });
        }
        yield* fs.remove(aside, { force: true }).pipe(Effect.ignore);
        yield* Console.error(`warning: broke a stale kb lock (${lockFile}, held by ${holder}, older than ${LOCK_STALE_MS / 1000} s)`);
      }
      const second = yield* create;
      if (Result.isSuccess(second)) return token;
      return yield* new StoreLocked({ lockFile, holder: "a writer that started just now" });
    });

    /** Remove the lock only when it is still ours (a breaker may have replaced it). */
    const release = (token: string) =>
      fs.readFileString(lockFile).pipe(
        Effect.flatMap((text) => (text.includes(JSON.stringify(token)) ? fs.remove(lockFile, { force: true }) : Effect.void)),
        Effect.ignore,
      );

    const locked = <A, E>(body: Effect.Effect<A, E>): Effect.Effect<A, E | StoreLocked | StoreIo> =>
      Effect.acquireUseRelease(acquire, () => body, release);

    /**
     * Under the lock: every file of `loaded` and every target must still hash as read; then ALL temp
     * files are created (exclusively); then ALL are renamed. Before the first rename a failure writes nothing.
     */
    const writeFiles = (loaded: Loaded, writes: ReadonlyArray<readonly [rel: string, text: string]>) =>
      locked(Effect.gen(function* () {
        for (const rel of new Set([...loaded.files.keys(), ...writes.map(([rel]) => rel)])) {
          const current = yield* read(rel);
          const currentHash = current === null ? null : yield* hashOf(rel, current);
          if (currentHash !== (loaded.files.get(rel)?.hash ?? null)) return yield* new ConcurrentEdit({ file: rel });
        }
        const now = yield* Clock.currentTimeMillis;
        const staged: Array<{ readonly rel: string; readonly tmp: string; readonly target: string }> = [];
        const dropTemps = Effect.suspend(() => Effect.forEach(staged, (f) => fs.remove(f.tmp, { force: true }).pipe(Effect.ignore), { discard: true }));
        for (const [rel, text] of writes) {
          const target = abs(rel);
          const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${now}.${tmpCounter++}.tmp`);
          staged.push({ rel, tmp, target });
          yield* fs.makeDirectory(path.dirname(target), { recursive: true }).pipe(
            Effect.andThen(fs.writeFileString(tmp, text, { flag: "wx" })),
            Effect.mapError((e) => new StoreIo({ file: rel, reason: `${e.message}; nothing was written` })),
            Effect.onError(() => dropTemps),
          );
        }
        const written: Array<string> = [];
        for (const f of staged) {
          const renamed = yield* fs.rename(f.tmp, f.target).pipe(Effect.result);
          if (Result.isSuccess(renamed)) {
            written.push(f.rel);
            continue;
          }
          yield* dropTemps;
          const reason = `${f.rel}: ${renamed.failure.message}`;
          if (written.length === 0) return yield* new StoreIo({ file: f.rel, reason: `${renamed.failure.message}; nothing was written` });
          return yield* new PartialWrite({ written, notWritten: staged.map((x) => x.rel).filter((rel) => !written.includes(rel)), reason });
        }
        return written as ReadonlyArray<string>;
      }));

    const recordsFor = (data: KbData, rel: string): readonly [FileKind<any>, ReadonlyArray<unknown>] | undefined => {
      if (rel === SOURCES_PATH) return [SourcesFile, data.sources];
      if (rel === REQUIREMENTS_PATH) return [RequirementsFile, data.requirements];
      if (rel === APPS_PATH) return [AppsFile, data.apps];
      if (rel === CONFLICTS_PATH) return [ConflictsFile, data.conflicts];
      const app = /^tracking\/([^/]+)\.jsonl$/.exec(rel)?.[1];
      return app === undefined ? undefined : [TrackingFile, data.tracking.filter((t) => t.app === app)];
    };

    const commit = Effect.fn("Store.commit")(function* (loaded: Loaded, data: KbData, targets: ReadonlyArray<string>) {
      const parseErrors = loaded.issues.filter((i) => LOSSY.includes(i._tag) || i._tag === "BlankLine");
      const errors = errorsOf(sortIssues([...parseErrors, ...validateData(data, loaded.where)]));
      if (errors.length > 0) return yield* new Rejected({ issues: errors });
      const writes: Array<readonly [string, string]> = [];
      for (const rel of targets) {
        const entry = recordsFor(data, rel);
        if (!entry) return yield* new StoreIo({ file: rel, reason: "not a store file" });
        const text = encodeJsonl(entry[0], entry[1]);
        if (loaded.files.get(rel)?.text !== text) writes.push([rel, text]);
      }
      return yield* writeFiles(loaded, writes);
    });

    /** `now`: UTC to the second. `today`: the calendar date `Today` gives (UTC by default; the entries provide the local zone). */
    const stamp = Effect.gen(function* () {
      const ms = yield* Clock.currentTimeMillis;
      return { now: new Date(ms).toISOString().replace(/\.\d+Z$/, "Z"), today: (yield* Today)(ms) };
    });

    const setTracking = Effect.fn("Store.setTracking")(function* (app: string, requirement: string, patch: TrackingPatch) {
      const loaded = yield* load;
      const outcome = applySet(loaded.data, app, requirement, patch, yield* stamp);
      if (Result.isFailure(outcome)) return yield* new Rejected({ issues: outcome.failure });
      yield* commit(loaded, outcome.success.data, [trackingPath(app)]);
      return outcome.success;
    });

    const setRelease = Effect.fn("Store.setRelease")(function* (app: string, version: string, build?: string) {
      const loaded = yield* load;
      const outcome = applySetRelease(loaded.data, app, version, build);
      if (Result.isFailure(outcome)) return yield* new Rejected({ issues: outcome.failure });
      yield* commit(loaded, outcome.success.data, [APPS_PATH]);
      return outcome.success.app;
    });

    const revise = Effect.fn("Store.revise")(function* (requirement: string, patch: RevisePatch) {
      const loaded = yield* load;
      const outcome = applyRevise(loaded.data, requirement, patch, (yield* stamp).today);
      if (Result.isFailure(outcome)) return yield* new Rejected({ issues: outcome.failure });
      yield* commit(loaded, outcome.success.data, [REQUIREMENTS_PATH]);
      return outcome.success;
    });

    const fmt: Effect.Effect<FmtResult, WriteError> = Effect.gen(function* () {
      const loaded = yield* load;
      const writes: Array<readonly [string, string]> = [];
      const skipped: Array<string> = [];
      for (const state of loaded.files.values()) {
        if (state.text === null) continue;
        if (state.damaged) {
          skipped.push(state.path);
          continue;
        }
        const text = encodeJsonl(state.kind, state.records);
        if (text !== state.text) writes.push([state.path, text]);
      }
      const changed = writes.length === 0 ? [] : yield* writeFiles(loaded, writes);
      const issues = skipped.length === 0
        ? []
        : loaded.issues.filter((i) => skipped.includes(i.file) && LOSSY.includes(i._tag));
      return { changed, skipped, issues };
    });

    return Store.of({ dataDir, load, validate: Effect.map(load, (l) => l.issues), commit, setTracking, setRelease, revise, fmt });
  });
