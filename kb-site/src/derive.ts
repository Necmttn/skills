/** Derived state (PLAN section 3). Pure functions over decoded records. */
import {
  type App,
  type Evidence,
  type KbData,
  PHASES,
  releaseKey,
  type Requirement,
  type Status,
  type TrackingRecord,
} from "./schema.ts";

export const DERIVED_STATES = ["excluded", "retired", "blocked", "stale", "unverified", "complete", "in_progress", "todo"] as const;
export type DerivedState = (typeof DERIVED_STATES)[number];

const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Phase order from the plan, then id. */
export const compareRequirements = (a: Requirement, b: Requirement): number =>
  PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || compareStrings(a.id, b.id);

export const sortRequirements = (requirements: ReadonlyArray<Requirement>): ReadonlyArray<Requirement> =>
  [...requirements].sort(compareRequirements);

/** Natural order: digit runs compare as numbers, so 1.10 > 1.9 and 1.0(12) > 1.0(9). */
export const compareReleases = (a: string, b: string): number => {
  const split = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const [x, y] = [split(a), split(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const [p, q] = [x[i], y[i]];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const numeric = /^\d/.test(p) && /^\d/.test(q);
    const c = numeric ? Number(p) - Number(q) : compareStrings(p, q);
    if (c !== 0) return c;
  }
  return 0;
};

/**
 * Empty `applies_to` = every app. `platforms` and `tags` each match when the app has ANY listed
 * value; when both are given, both must match.
 */
export const applies = (requirement: Requirement, app: App): boolean => {
  const { platforms, tags } = requirement.applies_to;
  const any = (wanted: ReadonlyArray<string> | undefined, have: ReadonlyArray<string>) =>
    wanted === undefined || wanted.length === 0 || wanted.some((w) => have.includes(w));
  return any(platforms, app.platforms) && any(tags, app.tags);
};

/** `null` for `once` checks, and for `every_release` checks of an app with no release yet. */
export const targetRelease = (requirement: Requirement, app: App, override?: string): string | null =>
  requirement.cadence === "once" ? null : override ?? releaseKey(app.current_release);

export const isStale = (record: TrackingRecord, requirement: Requirement): boolean =>
  record.status === "done" && record.requirement_revision < requirement.revision;

/**
 * Evidence counts toward a record unless it is stamped with ANOTHER release. The comparison is strict
 * string equality: `"1.0"` and `"1.0(171)"` are different releases (a version without its build is not
 * that build). Evidence without `release` counts; `once` records (`release: null`) count everything.
 */
export const evidenceCounts = (record: Pick<TrackingRecord, "release">, evidence: Pick<Evidence, "release">): boolean =>
  record.release === null || evidence.release === undefined || evidence.release === record.release;

export const countingEvidence = (record: Pick<TrackingRecord, "release" | "evidence">): ReadonlyArray<Evidence> =>
  record.evidence.filter((e) => evidenceCounts(record, e));

/** `"1.0(171)"`, or `"1.0", "1.1"`: the releases the non-counting evidence belongs to, for messages. */
export const foreignReleases = (record: Pick<TrackingRecord, "release" | "evidence">): string =>
  [...new Set(record.evidence.filter((e) => !evidenceCounts(record, e)).map((e) => `"${e.release}"`))].join(", ");

export interface DerivedItem {
  readonly app: string;
  readonly requirement: string;
  readonly title: string;
  readonly phase: Requirement["phase"];
  readonly cadence: Requirement["cadence"];
  readonly acceptance: Requirement["acceptance"];
  readonly state: DerivedState;
  /** Why the item has this state, in words. */
  readonly reason: string;
  /** The release this state was judged for (`null` = not release bound). */
  readonly release: string | null;
  /** Newest other release with a `done` record. Old evidence never counts for the target release. */
  readonly last_done?: string;
  readonly status: Status | null;
  readonly owner: string | null;
  readonly notes: string;
  readonly evidence: ReadonlyArray<Evidence>;
  readonly requirement_revision: number | null;
  readonly current_revision: number;
  readonly updated_at: string | null;
  readonly updated_by: string | null;
}

const stateOf = (requirement: Requirement, app: App, record: TrackingRecord | undefined): readonly [DerivedState, string] => {
  if (!applies(requirement, app)) return ["excluded", "does not apply to this app (applies_to)"];
  if (requirement.acceptance === "retired") return ["retired", "the requirement is retired"];
  if (record === undefined) return ["todo", "no record for this release"];
  switch (record.status) {
    case "not_applicable":
      return ["excluded", `marked not applicable: ${record.notes}`];
    case "blocked":
      return ["blocked", record.notes];
    case "in_progress":
      return ["in_progress", "in progress"];
    case "todo":
      return ["todo", "marked todo"];
    case "done":
      if (isStale(record, requirement)) {
        return ["stale", `done at revision ${record.requirement_revision}, requirement is now revision ${requirement.revision}; review the evidence`];
      }
      if (requirement.evidence_required && countingEvidence(record).length === 0) {
        return ["unverified", record.evidence.length === 0
          ? "done without the required evidence"
          : `done without evidence for release "${record.release}"; the evidence on this record belongs to release ${foreignReleases(record)}`];
      }
      return ["complete", "done"];
  }
};

export interface DeriveOptions {
  /** Judge `every_release` checks against this release instead of the app's `current_release`. */
  readonly release?: string | undefined;
}

/** `records`: this app's tracking records (others are ignored). */
export const deriveItem = (
  requirement: Requirement,
  app: App,
  records: ReadonlyArray<TrackingRecord>,
  options: DeriveOptions = {},
): DerivedItem => {
  const release = targetRelease(requirement, app, options.release);
  const own = records.filter((r) => r.app === app.id && r.requirement === requirement.id);
  const record = requirement.cadence === "once" ? own.find((r) => r.release === null) : own.find((r) => r.release !== null && r.release === release);
  const [state, reason] = stateOf(requirement, app, record);
  const others = own
    .filter((r) => r !== record && r.status === "done" && r.release !== null)
    .map((r) => r.release as string)
    .sort(compareReleases);
  const lastDone = requirement.cadence === "every_release" && state === "todo" ? others.at(-1) : undefined;
  return {
    app: app.id,
    requirement: requirement.id,
    title: requirement.title,
    phase: requirement.phase,
    cadence: requirement.cadence,
    acceptance: requirement.acceptance,
    state,
    reason: lastDone === undefined ? reason : `${reason}; last done for ${lastDone}`,
    release,
    ...(lastDone === undefined ? {} : { last_done: lastDone }),
    status: record?.status ?? null,
    owner: record?.owner ?? null,
    notes: record?.notes ?? "",
    evidence: record?.evidence ?? [],
    requirement_revision: record?.requirement_revision ?? null,
    current_revision: requirement.revision,
    updated_at: record?.updated_at ?? null,
    updated_by: record?.updated_by ?? null,
  };
};

export type StateCounts = Readonly<Record<DerivedState, number>>;

export const countStates = (items: ReadonlyArray<{ readonly state: DerivedState }>): StateCounts => {
  const counts = Object.fromEntries(DERIVED_STATES.map((s) => [s, 0])) as Record<DerivedState, number>;
  for (const item of items) counts[item.state] += 1;
  return counts;
};

/** Filters on the requirement (not on any app's state). Absent or empty = no filter. */
export interface RequirementFilter {
  readonly phases?: ReadonlyArray<Requirement["phase"]> | undefined;
  readonly cadence?: Requirement["cadence"] | undefined;
  readonly acceptance?: Requirement["acceptance"] | undefined;
  /** `true`: only owner-gated checks. */
  readonly ownerGate?: boolean | undefined;
}

export const matchesFilter = (r: Requirement, f: RequirementFilter): boolean =>
  (f.phases === undefined || f.phases.length === 0 || f.phases.includes(r.phase)) &&
  (f.cadence === undefined || r.cadence === f.cadence) &&
  (f.acceptance === undefined || r.acceptance === f.acceptance) &&
  (f.ownerGate !== true || r.owner_gate);

/** The active filters in words, for the summary line and `--json`. */
export const describeFilter = (f: RequirementFilter): ReadonlyArray<string> => [
  ...(f.phases !== undefined && f.phases.length > 0 ? [`phase=${f.phases.join(",")}`] : []),
  ...(f.cadence === undefined ? [] : [`cadence=${f.cadence}`]),
  ...(f.acceptance === undefined ? [] : [`acceptance=${f.acceptance}`]),
  ...(f.ownerGate === true ? ["owner-gate"] : []),
];

export interface ChecklistOptions extends DeriveOptions, RequirementFilter {
  /** Keep only these states. When absent: every state except `retired` (every state when `acceptance` is filtered). */
  readonly states?: ReadonlyArray<DerivedState> | undefined;
}

export interface Checklist {
  readonly app: App;
  readonly release: string | null;
  readonly items: ReadonlyArray<DerivedItem>;
  /** Counts over the checks that pass the requirement filters, before the `states` filter. */
  readonly counts: StateCounts;
  /** Active filters in words (`phase=release`, `state=todo`, ...). Empty = unfiltered. */
  readonly filters: ReadonlyArray<string>;
  /** Checks that pass the requirement filters / every check in the store. */
  readonly matched: number;
  readonly total: number;
}

const checksOf = (data: KbData): ReadonlyArray<Requirement> => sortRequirements(data.requirements.filter((r) => r.kind === "check"));

export const checklist = (data: KbData, app: App, options: ChecklistOptions = {}): Checklist => {
  const records = data.tracking.filter((r) => r.app === app.id);
  const checks = checksOf(data);
  const all = checks.filter((r) => matchesFilter(r, options)).map((r) => deriveItem(r, app, records, options));
  const keep = options.states ?? (options.acceptance === undefined ? DERIVED_STATES.filter((s) => s !== "retired") : DERIVED_STATES);
  return {
    app,
    release: options.release ?? releaseKey(app.current_release),
    items: all.filter((i) => keep.includes(i.state)),
    counts: countStates(all),
    filters: [...describeFilter(options), ...(options.states === undefined ? [] : [`state=${options.states.join(",")}`])],
    matched: all.length,
    total: checks.length,
  };
};

export interface CompareCell {
  readonly state: DerivedState;
  readonly last_done?: string;
}

export interface CompareRow {
  readonly requirement: string;
  readonly title: string;
  readonly phase: Requirement["phase"];
  readonly cadence: Requirement["cadence"];
  /** Keyed by app id, in the order the apps were given. */
  readonly states: Readonly<Record<string, CompareCell>>;
}

export interface Comparison {
  readonly apps: ReadonlyArray<{ readonly id: string; readonly name: string; readonly release: string | null; readonly counts: StateCounts }>;
  readonly rows: ReadonlyArray<CompareRow>;
  /** Active filters in words (`phase=release`, `diff`, ...). Empty = unfiltered. */
  readonly filters: ReadonlyArray<string>;
  /** Checks that pass the requirement filters (the per-app counts cover these) / every comparable check. */
  readonly matched: number;
  readonly total: number;
}

export interface CompareOptions extends Pick<RequirementFilter, "phases" | "cadence"> {
  readonly includeRetired?: boolean | undefined;
  /** Keep only rows where the apps' derived states differ. The per-app counts are not reduced. */
  readonly diff?: boolean | undefined;
}

/** One row per check (retired checks are left out unless `includeRetired`), one column per app. */
export const compare = (data: KbData, apps: ReadonlyArray<App>, options: CompareOptions = {}): Comparison => {
  const comparable = checksOf(data).filter((r) => options.includeRetired === true || r.acceptance !== "retired");
  const checks = comparable.filter((r) => matchesFilter(r, options));
  const perApp = apps.map((app) => {
    const records = data.tracking.filter((r) => r.app === app.id);
    return { app, items: checks.map((r) => deriveItem(r, app, records)) };
  });
  return {
    apps: perApp.map(({ app, items }) => ({ id: app.id, name: app.name, release: releaseKey(app.current_release), counts: countStates(items) })),
    rows: checks.flatMap((r, index) => {
      const cells = perApp.map(({ app, items }) => {
        const item = items[index] as DerivedItem;
        return [app.id, item.last_done === undefined ? { state: item.state } : { state: item.state, last_done: item.last_done }] as const;
      });
      if (options.diff === true && new Set(cells.map(([, c]) => c.state)).size < 2) return [];
      return [{ requirement: r.id, title: r.title, phase: r.phase, cadence: r.cadence, states: Object.fromEntries(cells) }];
    }),
    filters: [...describeFilter(options), ...(options.diff === true ? ["diff (only rows where the states differ)"] : [])],
    matched: checks.length,
    total: comparable.length,
  };
};
