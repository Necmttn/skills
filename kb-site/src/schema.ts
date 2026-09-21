/** Record contract (PLAN section 2). Key-order arrays drive the deterministic encoder. */
import { Schema } from "effect";

export const ID_PATTERN = /^[a-z0-9][a-z0-9.-]*$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

export const Id = Schema.String.check(Schema.isPattern(ID_PATTERN, { message: "Expected an id matching ^[a-z0-9][a-z0-9.-]*$" }));
export const DateString = Schema.String.check(Schema.isPattern(DATE_PATTERN, { message: "Expected a date (YYYY-MM-DD)" }));
export const Timestamp = Schema.String.check(
  Schema.isPattern(TIMESTAMP_PATTERN, { message: "Expected a date (YYYY-MM-DD) or an ISO timestamp" }),
);
const Revision = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

// ---- enums ------------------------------------------------------------------------------
export const SOURCE_KINDS = ["playbook", "skill", "ledger", "wiki", "checklist", "template", "external", "url"] as const;
export const ROOTS = ["kb", "skills", "apps", "wiki", "home-skills", "url"] as const;
export const ACCESS = ["repo", "private-repo", "private-wiki", "local-only", "vendored", "linked-only", "public-url"] as const;
export const REQUIREMENT_KINDS = ["check", "guideline"] as const;
export const ACCEPTANCE = ["candidate", "decided", "verified", "retired"] as const;
export const PHASES = ["idea", "setup", "build", "monetization", "analytics", "aso", "submission", "release", "post-launch"] as const;
export const CADENCES = ["once", "every_release"] as const;
export const STATUSES = ["todo", "in_progress", "blocked", "done", "not_applicable"] as const;
export const EVIDENCE_KINDS = ["link", "commit", "build", "command", "screenshot", "doc", "note"] as const;
export const CONFLICT_STATUSES = ["open", "resolved"] as const;

export const RootName = Schema.Literals(ROOTS);
export type RootName = typeof RootName.Type;
export const Phase = Schema.Literals(PHASES);
export type Phase = typeof Phase.Type;
export const Cadence = Schema.Literals(CADENCES);
export type Cadence = typeof Cadence.Type;
export const Acceptance = Schema.Literals(ACCEPTANCE);
export type Acceptance = typeof Acceptance.Type;
export const Status = Schema.Literals(STATUSES);
export type Status = typeof Status.Type;
export const EvidenceKind = Schema.Literals(EVIDENCE_KINDS);
export type EvidenceKind = typeof EvidenceKind.Type;

// ---- records ----------------------------------------------------------------------------
export const Source = Schema.Struct({
  id: Id,
  title: Schema.String,
  kind: Schema.Literals(SOURCE_KINDS),
  root: RootName,
  path: Schema.String,
  access: Schema.Literals(ACCESS),
  license: Schema.NullOr(Schema.String),
  publishable: Schema.Boolean,
  notes: Schema.optionalKey(Schema.String),
});
export type Source = typeof Source.Type;

export const Ref = Schema.Struct({
  source: Id,
  locator: Schema.optionalKey(Schema.String),
  upstream_id: Schema.optionalKey(Schema.String),
  upstream_status: Schema.optionalKey(Schema.String),
});
export type Ref = typeof Ref.Type;

export const AppliesTo = Schema.Struct({
  platforms: Schema.optionalKey(Schema.Array(Schema.String)),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type AppliesTo = typeof AppliesTo.Type;

export const Requirement = Schema.Struct({
  id: Id,
  kind: Schema.Literals(REQUIREMENT_KINDS),
  title: Schema.String,
  acceptance: Acceptance,
  revision: Revision,
  revised_at: DateString,
  revision_note: Schema.String,
  phase: Phase,
  cadence: Cadence,
  applies_to: AppliesTo,
  evidence_required: Schema.Boolean,
  owner_gate: Schema.Boolean,
  what: Schema.String,
  how: Schema.String,
  refs: Schema.Array(Ref),
  supersedes: Schema.optionalKey(Schema.Array(Id)),
  conflicts: Schema.optionalKey(Schema.Array(Id)),
});
export type Requirement = typeof Requirement.Type;

export const Release = Schema.Struct({
  version: Schema.String.check(Schema.isMinLength(1)),
  build: Schema.optionalKey(Schema.String.check(Schema.isMinLength(1))),
});
export type Release = typeof Release.Type;

export const App = Schema.Struct({
  id: Id,
  name: Schema.String,
  bundle_id: Schema.NullOr(Schema.String),
  app_store_id: Schema.NullOr(Schema.String),
  platforms: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
  root: RootName,
  path: Schema.String,
  current_release: Schema.NullOr(Release),
  notes: Schema.optionalKey(Schema.String),
});
export type App = typeof App.Type;

export const Evidence = Schema.Struct({
  kind: EvidenceKind,
  ref: Schema.String.check(Schema.isMinLength(1)),
  date: DateString,
  release: Schema.optionalKey(Schema.String),
  note: Schema.optionalKey(Schema.String),
});
export type Evidence = typeof Evidence.Type;

export const TrackingRecord = Schema.Struct({
  app: Id,
  requirement: Id,
  release: Schema.NullOr(Schema.String.check(Schema.isMinLength(1))),
  status: Status,
  requirement_revision: Revision,
  owner: Schema.NullOr(Schema.String),
  notes: Schema.String,
  evidence: Schema.Array(Evidence),
  updated_at: Timestamp,
  updated_by: Schema.String,
});
export type TrackingRecord = typeof TrackingRecord.Type;

export const ConflictSide = Schema.Struct({ source: Id, locator: Schema.String, claim: Schema.String });
export type ConflictSide = typeof ConflictSide.Type;

export const Conflict = Schema.Struct({
  id: Id,
  summary: Schema.String,
  sides: Schema.Array(ConflictSide),
  requirements: Schema.Array(Id),
  status: Schema.Literals(CONFLICT_STATUSES),
  resolution: Schema.NullOr(Schema.String),
  recorded_at: DateString,
});
export type Conflict = typeof Conflict.Type;

// ---- key order (top level, then nested objects by field name) ------------------------------
export interface KeyOrder {
  readonly keys: ReadonlyArray<string>;
  readonly nested?: Readonly<Record<string, KeyOrder>>;
}

const order = (schema: { readonly fields: object }, nested?: Record<string, KeyOrder>): KeyOrder =>
  nested ? { keys: Object.keys(schema.fields), nested } : { keys: Object.keys(schema.fields) };

export const SOURCE_ORDER = order(Source);
export const REQUIREMENT_ORDER = order(Requirement, { applies_to: order(AppliesTo), refs: order(Ref) });
export const APP_ORDER = order(App, { current_release: order(Release) });
export const TRACKING_ORDER = order(TrackingRecord, { evidence: order(Evidence) });
export const CONFLICT_ORDER = order(Conflict, { sides: order(ConflictSide) });

export const SOURCE_KEYS = SOURCE_ORDER.keys;
export const REQUIREMENT_KEYS = REQUIREMENT_ORDER.keys;
export const APP_KEYS = APP_ORDER.keys;
export const TRACKING_KEYS = TRACKING_ORDER.keys;
export const CONFLICT_KEYS = CONFLICT_ORDER.keys;

// ---- releases ---------------------------------------------------------------------------
/** `"<version>"` or `"<version>(<build>)"`: the `release` value tracking records carry. */
export const releaseKey = (release: Release | null): string | null =>
  release === null ? null : release.build === undefined ? release.version : `${release.version}(${release.build})`;

// ---- the whole store --------------------------------------------------------------------
export interface KbData {
  readonly sources: ReadonlyArray<Source>;
  readonly requirements: ReadonlyArray<Requirement>;
  readonly apps: ReadonlyArray<App>;
  readonly conflicts: ReadonlyArray<Conflict>;
  /** Every app's tracking records, all files merged. */
  readonly tracking: ReadonlyArray<TrackingRecord>;
}

export const emptyData: KbData = { sources: [], requirements: [], apps: [], conflicts: [], tracking: [] };
