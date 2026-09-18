/**
 * kb subcommands. Runtime-agnostic: `cli.ts` provides the platform services.
 *
 * To add a subcommand: build it with `Command.make`, wrap the handler in `reporting(json, ...)`,
 * and pass it to `makeRoot(defaultDataDir, [yourCommand])`. Handlers may use `Store` and `Roots`.
 */
import { Config, Console, Data, Effect, Layer, Option, Runtime } from "effect";
import { Argument, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { checklist, compare, DERIVED_STATES, sortRequirements } from "./derive.ts";
import { errorsOf, formatIssue, issue, type Issue, warningsOf } from "./issue.ts";
import * as Render from "./render.ts";
import { Roots } from "./roots.ts";
import { ACCEPTANCE, CADENCES, EVIDENCE_KINDS, type EvidenceKind, type KbData, PHASES, REQUIREMENT_KINDS, STATUSES } from "./schema.ts";
import { type Loaded, Store } from "./store.ts";
import type { EvidenceInput } from "./transitions.ts";
import { refViews, showView } from "./views.ts";

// ---- errors and output ------------------------------------------------------------------
/** The problems were already printed. The entry point only sets the exit code. */
export class Reported extends Data.TaggedError("Reported")<{ readonly issues: ReadonlyArray<Issue> }> {
  override readonly [Runtime.errorExitCode] = 1;
  override get message() {
    return this.issues.map(formatIssue).join("\n");
  }
}

/** A user mistake found by a handler (unknown id, bad flag value). */
export class UserProblem extends Data.TaggedError("UserProblem")<{ readonly issues: ReadonlyArray<Issue> }> {}

export const userProblem = (message: string, id?: string): UserProblem => new UserProblem({ issues: [issue("Usage", "", message, { id })] });

const issuesOf = (error: unknown): ReadonlyArray<Issue> => {
  const e = error as { readonly _tag?: string; readonly issues?: ReadonlyArray<Issue>; readonly file?: string; readonly message?: string };
  if ((e?._tag === "Rejected" || e?._tag === "UserProblem" || e?._tag === "Reported") && e.issues) return e.issues;
  if (e?._tag === "ConcurrentEdit" || e?._tag === "StoreLocked" || e?._tag === "PartialWrite") return [issue("ConcurrentEdit", "", String(e.message))];
  return [issue("Io", "", e?.message ? String(e.message).split("\n")[0] ?? "" : String(error))];
};

export const issueJson = (i: Issue) => ({
  tag: i._tag,
  severity: i.severity,
  ...(i.file === "" ? {} : { file: i.file }),
  ...(i.line === undefined ? {} : { line: i.line }),
  ...(i.id === undefined ? {} : { id: i.id }),
  message: i.message,
});

/** Human: one stderr line per problem. `--json`: `{ok:false, errors:[...]}` on stdout. Then exit 1. */
export const reportFailure = (asJson: boolean, issues: ReadonlyArray<Issue>) =>
  (asJson
    ? Console.log(Render.json({ ok: false, errors: issues.map(issueJson) }))
    : Effect.forEach(issues, (i) => Console.error(formatIssue(i)), { discard: true })).pipe(
      Effect.andThen(Effect.fail(new Reported({ issues }))),
    );

/**
 * Run a handler; print its result as text or JSON; turn every failure into clean lines.
 * `warnings` (when the handler gives them): one `warning: ...` stderr line each, or the `warnings` array with `--json`.
 */
export const reporting = <A, E, R>(
  asJson: boolean,
  effect: Effect.Effect<A, E, R>,
  show: (a: A) => { readonly json: object; readonly text: string; readonly warnings?: ReadonlyArray<string> },
): Effect.Effect<void, Reported, R> =>
  effect.pipe(
    Effect.flatMap((a) => {
      const out = show(a);
      if (asJson) return Console.log(Render.json({ ok: true, ...out.json, ...(out.warnings === undefined ? {} : { warnings: out.warnings }) }));
      return Effect.forEach(out.warnings ?? [], (w) => Console.error(`warning: ${w}`), { discard: true }).pipe(Effect.andThen(Console.log(out.text)));
    }),
    Effect.catch((e) => (e instanceof Reported ? Effect.fail(e) : reportFailure(asJson, issuesOf(e)))),
  );

/** Load for a read command. Bad records are skipped; say so on stderr, keep stdout clean. */
const loadForRead = Effect.gen(function* () {
  const store = yield* Store;
  const loaded = yield* store.load;
  const errors = errorsOf(loaded.issues).length;
  if (errors > 0) yield* Console.error(`warning: the store has ${errors} validation error(s); output may be incomplete, run \`kb validate\``);
  return loaded;
});

const findApp = (data: KbData, id: string) => {
  const app = data.apps.find((a) => a.id === id);
  return app ? Effect.succeed(app) : Effect.fail(userProblem(`app "${id}" does not exist; run \`kb apps\` to list apps`, id));
};

const findRequirement = (data: KbData, id: string) => {
  const r = data.requirements.find((x) => x.id === id);
  return r ? Effect.succeed(r) : Effect.fail(userProblem(`requirement "${id}" does not exist; run \`kb checks\` to list checks`, id));
};

// ---- flags ------------------------------------------------------------------------------
export const jsonFlag = Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print machine-readable JSON"));

/** Global `--data <dir>`: the record store to use. */
export const DataDir = GlobalFlag.setting("data")({
  flag: Flag.string("data").pipe(Flag.withDescription("Data directory (default: data/ next to cli.ts)"), Flag.optional),
});

/** Global `--roots <file>`: the content-root map. Without it a `--data` copy elsewhere loses the private-root mapping. */
export const RootsFile = GlobalFlag.setting("roots")({
  flag: Flag.string("roots").pipe(Flag.withDescription("Roots file (default: $KB_ROOTS_FILE, else kb.roots.json next to the data dir)"), Flag.optional),
});

export const UNKNOWN_AUTHOR = "unknown";
export const NO_AUTHOR_WARNING = "no author name; pass --by <name> or set KB_USER";
const byFlag = Flag.string("by").pipe(
  Flag.withFallbackConfig(Config.string("KB_USER").pipe(Config.withDefault(UNKNOWN_AUTHOR))),
  Flag.withDescription("Who makes this change (default: $KB_USER)"),
);
const authorWarnings = (by: string): ReadonlyArray<string> => (by.trim() === "" || by === UNKNOWN_AUTHOR ? [NO_AUTHOR_WARNING] : []);

const phaseFilter = Flag.choice("phase", PHASES).pipe(Flag.atLeast(0), Flag.withDescription("Keep only this phase (repeatable)"));
const cadenceFilter = Flag.choice("cadence", CADENCES).pipe(Flag.optional, Flag.withDescription("Keep only this cadence"));

// ---- read commands ----------------------------------------------------------------------
const appsCommand = Command.make("apps", { json: jsonFlag }, ({ json }) =>
  reporting(json, loadForRead, ({ data }) => ({ json: { apps: data.apps }, text: Render.renderApps(data.apps) }))).pipe(
    Command.withDescription("List apps"),
  );

const checksCommand = Command.make(
  "checks",
  {
    phase: Flag.choice("phase", PHASES).pipe(Flag.optional),
    cadence: Flag.choice("cadence", CADENCES).pipe(Flag.optional),
    acceptance: Flag.choice("acceptance", ACCEPTANCE).pipe(Flag.optional),
    kind: Flag.choice("kind", REQUIREMENT_KINDS).pipe(Flag.optional, Flag.withDescription("check or guideline (default: both)")),
    json: jsonFlag,
  },
  ({ phase, cadence, acceptance, kind, json }) =>
    reporting(json, loadForRead, ({ data }) => {
      const keep = <T>(want: Option.Option<T>, have: T) => Option.isNone(want) || want.value === have;
      const requirements = sortRequirements(
        data.requirements.filter((r) => keep(phase, r.phase) && keep(cadence, r.cadence) && keep(acceptance, r.acceptance) && keep(kind, r.kind)),
      );
      return { json: { requirements }, text: Render.renderChecks(requirements) };
    }),
).pipe(Command.withDescription("List checks and guidelines"));

const checklistCommand = Command.make(
  "checklist",
  {
    app: Argument.string("app"),
    release: Flag.string("release").pipe(Flag.optional, Flag.withDescription("Judge every_release checks against this release")),
    state: Flag.choice("state", DERIVED_STATES).pipe(Flag.atLeast(0), Flag.withDescription("Keep only this derived state (repeatable)")),
    phase: phaseFilter,
    cadence: cadenceFilter,
    ownerGate: Flag.boolean("owner-gate").pipe(Flag.withDefault(false), Flag.withDescription("Keep only owner-gated checks")),
    acceptance: Flag.choice("acceptance", ACCEPTANCE).pipe(Flag.optional, Flag.withDescription("Keep only checks with this acceptance")),
    json: jsonFlag,
  },
  ({ app, release, state, phase, cadence, ownerGate, acceptance, json }) =>
    reporting(
      json,
      Effect.gen(function* () {
        const { data } = yield* loadForRead;
        return checklist(data, yield* findApp(data, app), {
          release: Option.getOrUndefined(release),
          states: state.length === 0 ? undefined : state,
          phases: phase,
          cadence: Option.getOrUndefined(cadence),
          ownerGate,
          acceptance: Option.getOrUndefined(acceptance),
        });
      }),
      (c) => ({
        json: { app: c.app.id, release: c.release, filters: c.filters, matched: c.matched, total: c.total, counts: c.counts, items: c.items },
        text: Render.renderChecklist(c),
      }),
    ),
).pipe(Command.withDescription("One app's checklist with derived state"));

const showCommand = Command.make(
  "show",
  { requirement: Argument.string("requirement"), app: Flag.string("app").pipe(Flag.optional), json: jsonFlag },
  ({ requirement, app, json }) =>
    reporting(
      json,
      Effect.gen(function* () {
        const { data } = yield* loadForRead;
        const r = yield* findRequirement(data, requirement);
        const a = Option.isSome(app) ? yield* findApp(data, app.value) : undefined;
        if (a && r.kind === "guideline") return yield* userProblem(`"${r.id}" is a guideline; only checks are tracked per app, remove --app`, r.id);
        return yield* showView(data, r, a);
      }),
      (view) => ({ json: view, text: Render.renderShow(view) }),
    ),
).pipe(Command.withDescription("What to do, how, references, conflicts, and per-app state"));

const compareCommand = Command.make(
  "compare",
  {
    apps: Argument.string("app").pipe(Argument.atLeast(2)),
    diff: Flag.boolean("diff").pipe(Flag.withDefault(false), Flag.withDescription("Keep only rows where the apps' derived states differ")),
    phase: phaseFilter,
    cadence: cadenceFilter,
    json: jsonFlag,
  },
  ({ apps, diff, phase, cadence, json }) =>
    reporting(
      json,
      Effect.gen(function* () {
        const { data } = yield* loadForRead;
        return compare(data, yield* Effect.forEach([...new Set(apps)], (id) => findApp(data, id)), { diff, phases: phase, cadence: Option.getOrUndefined(cadence) });
      }),
      (c) => ({ json: c, text: Render.renderCompare(c) }),
    ),
).pipe(Command.withDescription("Compare apps check by check"));

const refsCommand = Command.make(
  "refs",
  { requirement: Argument.string("requirement").pipe(Argument.optional), json: jsonFlag },
  ({ requirement, json }) =>
    reporting(
      json,
      Effect.gen(function* () {
        const { data } = yield* loadForRead;
        const selected = Option.isSome(requirement) ? [yield* findRequirement(data, requirement.value)] : data.requirements;
        return yield* refViews(data, selected);
      }),
      (refs) => ({ json: { refs }, text: Render.renderRefs(refs) }),
    ),
).pipe(Command.withDescription("Resolved references: location, access, availability on this machine"));

const conflictsCommand = Command.make(
  "conflicts",
  { status: Flag.choice("status", ["open", "resolved"]).pipe(Flag.optional), json: jsonFlag },
  ({ status, json }) =>
    reporting(json, loadForRead, ({ data }) => {
      const conflicts = data.conflicts.filter((c) => Option.isNone(status) || c.status === status.value);
      return { json: { conflicts }, text: Render.renderConflicts(conflicts) };
    }),
).pipe(Command.withDescription("Recorded source conflicts"));

// ---- write commands ---------------------------------------------------------------------
const parseEvidence = (raw: string, date: string | undefined, note: string | undefined) => {
  const at = raw.indexOf("=");
  const kind = raw.slice(0, Math.max(at, 0));
  const ref = raw.slice(at + 1);
  if (at <= 0 || ref === "" || !(EVIDENCE_KINDS as ReadonlyArray<string>).includes(kind)) {
    return Effect.fail(userProblem(`--evidence "${raw}": expected kind=ref with kind one of ${EVIDENCE_KINDS.join(", ")}`));
  }
  return Effect.succeed<EvidenceInput>({ kind: kind as EvidenceKind, ref, date, note });
};

const setCommand = Command.make(
  "set",
  {
    app: Argument.string("app"),
    requirement: Argument.string("requirement"),
    status: Flag.choice("status", STATUSES).pipe(Flag.optional),
    owner: Flag.string("owner").pipe(Flag.optional, Flag.withDescription('Owner name; "" clears it')),
    note: Flag.string("note").pipe(Flag.optional, Flag.withDescription("Replaces the notes; required to block, exclude, or reopen")),
    evidence: Flag.string("evidence").pipe(Flag.atLeast(0), Flag.withDescription(`kind=ref (repeatable); kinds: ${EVIDENCE_KINDS.join(", ")}`)),
    evidenceDate: Flag.string("evidence-date").pipe(Flag.optional, Flag.withDescription("YYYY-MM-DD (default: today)")),
    evidenceNote: Flag.string("evidence-note").pipe(Flag.optional),
    release: Flag.string("release").pipe(Flag.optional, Flag.withDescription("every_release checks only (default: the app's current_release)")),
    ackRevision: Flag.boolean("ack-revision").pipe(Flag.withDefault(false), Flag.withDescription("Re-confirm a done check after its requirement was revised")),
    by: byFlag,
    json: jsonFlag,
  },
  (f) =>
    reporting(
      f.json,
      Effect.gen(function* () {
        const store = yield* Store;
        const evidence = yield* Effect.forEach(f.evidence, (raw) =>
          parseEvidence(raw, Option.getOrUndefined(f.evidenceDate), Option.getOrUndefined(f.evidenceNote)));
        return yield* store.setTracking(f.app, f.requirement, {
          status: Option.getOrUndefined(f.status),
          owner: Option.getOrUndefined(f.owner),
          note: Option.getOrUndefined(f.note),
          evidence,
          release: Option.getOrUndefined(f.release),
          ackRevision: f.ackRevision,
          by: f.by,
        });
      }),
      ({ record, previous }) => ({ json: { record, previous: previous ?? null }, text: Render.renderSet(record, previous), warnings: authorWarnings(f.by) }),
    ),
).pipe(Command.withDescription("Set status, owner, notes, evidence for one app and check"));

const setReleaseCommand = Command.make(
  "set-release",
  { app: Argument.string("app"), version: Argument.string("version"), build: Flag.string("build").pipe(Flag.optional), by: byFlag, json: jsonFlag },
  ({ app, version, build, by, json }) =>
    reporting(json, Store.use((s) => s.setRelease(app, version, Option.getOrUndefined(build))), (a) => ({
      json: { app: a },
      text: `${a.id}: current_release = ${Render.releaseText(a)}`,
      warnings: authorWarnings(by),
    })),
).pipe(Command.withDescription("Set an app's current release; every_release checks start over"));

const reviseCommand = Command.make(
  "revise",
  {
    requirement: Argument.string("requirement"),
    what: Flag.string("what").pipe(Flag.optional, Flag.withDescription("MATERIAL: the outcome to reach")),
    how: Flag.string("how").pipe(Flag.optional, Flag.withDescription("MATERIAL: the steps")),
    evidenceRequired: Flag.choice("evidence-required", ["true", "false"]).pipe(Flag.optional, Flag.withDescription("MATERIAL: true or false")),
    platform: Flag.string("platform").pipe(Flag.atLeast(0), Flag.withDescription("MATERIAL: applies_to.platforms (repeatable; replaces applies_to together with --tag)")),
    tag: Flag.string("tag").pipe(Flag.atLeast(0), Flag.withDescription("MATERIAL: applies_to.tags (repeatable; replaces applies_to together with --platform)")),
    allApps: Flag.boolean("all-apps").pipe(Flag.withDefault(false), Flag.withDescription("MATERIAL: clear applies_to (the check applies to every app)")),
    title: Flag.string("title").pipe(Flag.optional, Flag.withDescription("Not material: no revision bump")),
    acceptance: Flag.choice("acceptance", ACCEPTANCE).pipe(Flag.optional, Flag.withDescription("Not material. Acceptance is the owner's call")),
    note: Flag.string("note").pipe(Flag.optional, Flag.withDescription("The revision note: what changed and why. Mandatory for a material change")),
    by: byFlag,
    json: jsonFlag,
  },
  (f) =>
    reporting(
      f.json,
      Effect.gen(function* () {
        if (f.allApps && (f.platform.length > 0 || f.tag.length > 0)) return yield* userProblem("--all-apps clears applies_to; do not combine it with --platform or --tag", f.requirement);
        const store = yield* Store;
        return yield* store.revise(f.requirement, {
          what: Option.getOrUndefined(f.what),
          how: Option.getOrUndefined(f.how),
          evidenceRequired: Option.isNone(f.evidenceRequired) ? undefined : f.evidenceRequired.value === "true",
          appliesTo: f.allApps
            ? {}
            : f.platform.length > 0 || f.tag.length > 0
            ? { ...(f.platform.length > 0 ? { platforms: f.platform } : {}), ...(f.tag.length > 0 ? { tags: f.tag } : {}) }
            : undefined,
          title: Option.getOrUndefined(f.title),
          acceptance: Option.getOrUndefined(f.acceptance),
          note: Option.getOrUndefined(f.note),
        });
      }),
      (o) => ({
        json: {
          requirement: o.requirement,
          previous_revision: o.previous.revision,
          bumped: o.material.length > 0,
          material: o.material,
          became_stale: o.becameStale.length,
          stale_records: o.becameStale,
        },
        text: Render.renderRevise(o),
        warnings: [...authorWarnings(f.by), ...(o.requirement.acceptance === o.previous.acceptance ? [] : [Render.ACCEPTANCE_REMINDER])],
      }),
    ),
).pipe(Command.withDescription("Edit a rule safely: a material change bumps the revision by 1 and makes done records stale"));

const summary = (loaded: Loaded): string => {
  const d = loaded.data;
  return `${d.sources.length} sources, ${d.requirements.length} requirements, ${d.apps.length} apps, ${d.conflicts.length} conflicts, ${d.tracking.length} tracking records`;
};

const validateCommand = Command.make("validate", { json: jsonFlag }, ({ json }) =>
  Effect.gen(function* () {
    const store = yield* Store;
    const loaded = yield* store.load;
    const [errors, warnings] = [errorsOf(loaded.issues), warningsOf(loaded.issues)];
    if (json) {
      yield* Console.log(Render.json({ ok: errors.length === 0, errors: errors.map(issueJson), warnings: warnings.map(issueJson) }));
    } else {
      yield* Effect.forEach(loaded.issues, (i) => Console.error(formatIssue(i)), { discard: true });
      yield* Console.log(`${errors.length === 0 ? "ok" : "invalid"}: ${summary(loaded)}; ${errors.length} error(s), ${warnings.length} warning(s)`);
    }
    if (errors.length > 0) return yield* new Reported({ issues: errors });
  }).pipe(Effect.catch((e) => (e instanceof Reported ? Effect.fail(e) : reportFailure(json, issuesOf(e)))))).pipe(
    Command.withDescription("Check every file and rule; exit 1 on any error"),
  );

const fmtCommand = Command.make("fmt", { json: jsonFlag }, ({ json }) =>
  Effect.gen(function* () {
    const store = yield* Store;
    const result = yield* store.fmt;
    if (result.skipped.length > 0) {
      if (!json) yield* Effect.forEach(result.changed, (f) => Console.log(`formatted ${f}`), { discard: true });
      return yield* reportFailure(json, result.issues);
    }
    yield* Console.log(
      json
        ? Render.json({ ok: true, changed: result.changed })
        : result.changed.length === 0
        ? "already formatted"
        : result.changed.map((f) => `formatted ${f}`).join("\n"),
    );
  }).pipe(Effect.catch((e) => (e instanceof Reported ? Effect.fail(e) : reportFailure(json, issuesOf(e)))))).pipe(
    Command.withDescription("Rewrite files in canonical form: key order, sorted, one record per line"),
  );

// ---- root -------------------------------------------------------------------------------
export const coreCommands = [
  appsCommand,
  checksCommand,
  checklistCommand,
  showCommand,
  compareCommand,
  refsCommand,
  conflictsCommand,
  setCommand,
  setReleaseCommand,
  reviseCommand,
  validateCommand,
  fmtCommand,
] as const;

/** `Store` + `Roots` on the directory named by `--data`, else `defaultDataDir`. */
export const kbLayer = (defaultDataDir: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const named = yield* DataDir;
      const dir = Option.getOrElse(named, () => defaultDataDir);
      return Layer.mergeAll(Store.layer(dir, { isDefault: Option.isNone(named) }), Roots.layer(dir, Option.getOrUndefined(yield* RootsFile)));
    }),
  );

export const VERSION = "0.1.0";

/** The `kb` root command. `extra`: more subcommands (sync, publish, ...); they get `Store` and `Roots` too. */
export const makeRoot = <const Extra extends ReadonlyArray<Command.Command<any, any, any, any, any>> = readonly []>(
  defaultDataDir: string,
  extra?: Extra,
) =>
  Command.make("kb").pipe(
    Command.withDescription("App knowledge base: checks, per-app tracking, references"),
    Command.withSubcommands([...coreCommands, ...((extra ?? []) as Extra)]),
    Command.provide(kbLayer(defaultDataDir)),
    Command.withGlobalFlags([DataDir, RootsFile]),
  );
