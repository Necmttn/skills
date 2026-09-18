/** JSONL parse with per-line problems, and the deterministic encoder. Pure: no services. */
import { Result, Schema, SchemaIssue } from "effect";
import { issue, type Issue } from "./issue.ts";
import {
  App,
  APP_ORDER,
  Conflict,
  CONFLICT_ORDER,
  type KeyOrder,
  Requirement,
  REQUIREMENT_ORDER,
  Source,
  SOURCE_ORDER,
  TRACKING_ORDER,
  TrackingRecord,
} from "./schema.ts";

// ---- file kinds -------------------------------------------------------------------------
export interface FileKind<A> {
  readonly name: "sources" | "requirements" | "apps" | "conflicts" | "tracking";
  readonly schema: Schema.Codec<A, any>;
  readonly order: KeyOrder;
  /** Sort key and uniqueness key. */
  readonly key: (record: A) => string;
  /** The id shown in problems. */
  readonly id: (record: A) => string;
  readonly keyLabel: string;
}

const byId = <A extends { readonly id: string }>(
  name: FileKind<A>["name"],
  schema: Schema.Codec<A, any>,
  order: KeyOrder,
): FileKind<A> => ({ name, schema, order, key: (r) => r.id, id: (r) => r.id, keyLabel: "id" });

export const trackingKey = (requirement: string, release: string | null): string => `${requirement}\u0000${release ?? ""}`;

export const SourcesFile = byId<Source>("sources", Source, SOURCE_ORDER);
export const RequirementsFile = byId<Requirement>("requirements", Requirement, REQUIREMENT_ORDER);
export const AppsFile = byId<App>("apps", App, APP_ORDER);
export const ConflictsFile = byId<Conflict>("conflicts", Conflict, CONFLICT_ORDER);
export const TrackingFile: FileKind<TrackingRecord> = {
  name: "tracking",
  schema: TrackingRecord,
  order: TRACKING_ORDER,
  key: (r) => trackingKey(r.requirement, r.release),
  id: (r) => (r.release === null ? r.requirement : `${r.requirement}@${r.release}`),
  keyLabel: "(requirement, release)",
};

export const SOURCES_PATH = "sources.jsonl";
export const REQUIREMENTS_PATH = "requirements.jsonl";
export const APPS_PATH = "apps.jsonl";
export const CONFLICTS_PATH = "conflicts.jsonl";
export const TRACKING_DIR = "tracking";
export const trackingPath = (app: string): string => `${TRACKING_DIR}/${app}.jsonl`;

/** Data-dir relative path (forward slashes) -> file kind. The merge driver uses this on `%P`. */
export const kindForPath = (relPath: string): FileKind<any> | undefined => {
  const p = relPath.replaceAll("\\", "/");
  if (/(^|\/)tracking\/[^/]+\.jsonl$/.test(p)) return TrackingFile;
  const base = p.slice(p.lastIndexOf("/") + 1);
  return base === SOURCES_PATH
    ? SourcesFile
    : base === REQUIREMENTS_PATH
    ? RequirementsFile
    : base === APPS_PATH
    ? AppsFile
    : base === CONFLICTS_PATH
    ? ConflictsFile
    : undefined;
};

// ---- conflict blocks --------------------------------------------------------------------
export const KB_CONFLICT_LABEL = "kb-conflict";
const MARKER = /^(<{7}|={7}|>{7}|\|{7})( |$)/;

/**
 * The block our merge driver writes for a same-field conflict. Not JSON on purpose: `validate`
 * refuses the file until a person picks a value and deletes the markers.
 */
export const conflictBlock = (c: { readonly key: string; readonly field: string; readonly ours: unknown; readonly theirs: unknown }): string =>
  [
    `<<<<<<< ${KB_CONFLICT_LABEL} record ${JSON.stringify(c.key)} field ${JSON.stringify(c.field)}`,
    `ours: ${JSON.stringify(c.ours)}`,
    "=======",
    `theirs: ${JSON.stringify(c.theirs)}`,
    `>>>>>>> ${KB_CONFLICT_LABEL}`,
  ].join("\n");

// ---- parse ------------------------------------------------------------------------------
export interface Line<A> {
  readonly value: A;
  readonly line: number;
}

export interface Parsed<A> {
  /** Valid records, first occurrence of each key, in file order. */
  readonly records: ReadonlyArray<Line<A>>;
  readonly issues: ReadonlyArray<Issue>;
}

const formatStandard = SchemaIssue.makeFormatterStandardSchemaV1();

const fieldPath = (path: ReadonlyArray<unknown> | undefined): string =>
  (path ?? []).reduce<string>((acc, seg) => {
    const key = typeof seg === "object" && seg !== null && "key" in seg ? (seg as { key: unknown }).key : seg;
    return typeof key === "number" ? `${acc}[${key}]` : acc === "" ? String(key) : `${acc}.${String(key)}`;
  }, "");

const rawId = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" ? v.id : typeof v.requirement === "string" ? v.requirement : undefined;
};

const jsonReason = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/^JSON Parse error: /, "");

export const parseJsonl = <A>(kind: FileKind<A>, file: string, text: string): Parsed<A> => {
  const issues: Array<Issue> = [];
  const records: Array<Line<A>> = [];
  const seen = new Map<string, number>();
  const decode = Schema.decodeUnknownResult(kind.schema as Schema.Codec<A, unknown>);
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  let conflictStart: number | undefined;
  let previousKey: string | undefined;
  let unsortedAt: number | undefined;

  const closeConflict = (start: number, end: number, label: string) =>
    issues.push(
      issue(
        "ConflictMarker",
        file,
        `unresolved ${label} on lines ${start}-${end}; keep one version, delete the marker lines, then run \`kb fmt\``,
        { line: start },
      ),
    );

  lines.forEach((withCr, index) => {
    const line = index + 1;
    const raw = withCr.endsWith("\r") ? withCr.slice(0, -1) : withCr;
    const marker = MARKER.exec(raw);
    if (conflictStart !== undefined) {
      if (marker?.[1] === ">>>>>>>") {
        const opener = lines[conflictStart - 1] ?? "";
        closeConflict(conflictStart, line, opener.includes(KB_CONFLICT_LABEL) ? "merge-driver conflict block" : "git merge conflict");
        conflictStart = undefined;
      }
      return;
    }
    if (marker) {
      if (marker[1] === "<<<<<<<") conflictStart = line;
      else issues.push(issue("ConflictMarker", file, `stray merge conflict marker "${marker[1]}"; delete it`, { line }));
      return;
    }
    if (raw.trim() === "") {
      issues.push(issue("BlankLine", file, "blank line; every line must hold one JSON record (`kb fmt` removes it)", { line }));
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      issues.push(issue("MalformedJson", file, `malformed JSON: ${jsonReason(e)}`, { line }));
      return;
    }
    const decoded = decode(json, { errors: "all", onExcessProperty: "error" });
    if (Result.isFailure(decoded)) {
      for (const problem of formatStandard(decoded.failure.issue).issues) {
        const at = fieldPath(problem.path);
        issues.push(
          issue("SchemaViolation", file, `${at === "" ? "record" : `field "${at}"`}: ${problem.message.replaceAll("\n", " ")}`, {
            line,
            id: rawId(json),
          }),
        );
      }
      return;
    }
    const value = decoded.success;
    const key = kind.key(value);
    const first = seen.get(key);
    if (first !== undefined) {
      issues.push(
        issue("DuplicateKey", file, `duplicate ${kind.keyLabel} "${kind.id(value)}" (first seen on line ${first})`, {
          line,
          id: kind.id(value),
        }),
      );
      return;
    }
    seen.set(key, line);
    if (previousKey !== undefined && key < previousKey && unsortedAt === undefined) unsortedAt = line;
    previousKey = key;
    records.push({ value, line });
  });

  if (conflictStart !== undefined) closeConflict(conflictStart, lines.length, "merge conflict (no closing marker)");

  const clean = issues.length === 0;
  if (unsortedAt !== undefined) {
    issues.push(
      issue("Unsorted", file, `records are not sorted by ${kind.keyLabel}; run \`kb fmt\``, { line: unsortedAt, severity: "warning" }),
    );
  } else if (clean && encodeJsonl(kind, records.map((r) => r.value)) !== text) {
    issues.push(
      issue("NotCanonical", file, "file is not in canonical form (key order, spacing, or final newline); run `kb fmt`", {
        severity: "warning",
      }),
    );
  }
  return { records, issues };
};

// ---- encode -----------------------------------------------------------------------------
const ordered = (order: KeyOrder, value: unknown): unknown => {
  if (Array.isArray(value)) return value.map((v) => ordered(order, v));
  if (typeof value !== "object" || value === null) return value;
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of order.keys) {
    if (source[key] === undefined) continue;
    const nested = order.nested?.[key];
    out[key] = nested ? ordered(nested, source[key]) : source[key];
  }
  return out;
};

export const encodeRecord = <A>(kind: FileKind<A>, record: A): string => JSON.stringify(ordered(kind.order, record));

const compareKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const sortRecords = <A>(kind: FileKind<A>, records: ReadonlyArray<A>): ReadonlyArray<A> =>
  [...records].sort((a, b) => compareKeys(kind.key(a), kind.key(b)));

/** Fixed key order, sorted by primary key, one record per line, `\n` terminated. Empty -> "". */
export const encodeJsonl = <A>(kind: FileKind<A>, records: ReadonlyArray<A>): string =>
  sortRecords(kind, records).map((r) => encodeRecord(kind, r) + "\n").join("");
