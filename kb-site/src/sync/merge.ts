/**
 * Record-level 3-way merge for store files. Pure: text in, text out, no services.
 *
 * Symmetry: `mergeJsonl(kind, base, A, B)` and `mergeJsonl(kind, base, B, A)` make the same
 * decisions. A clean merge gives byte-identical text both ways. A conflicted merge names the same
 * records and fields both ways; only the `ours:` / `theirs:` labels and the placeholder value kept
 * in the record line swap. This matters because `git rebase` hands the driver the UPSTREAM file
 * as "ours" (%A) and the local commit as "theirs" (%B), the reverse of `git merge`.
 */
import { conflictBlock, encodeRecord, type FileKind, parseJsonl } from "../jsonl.ts";

export interface MergeConflict {
  /** Human record id: `id`, or `requirement@release` for tracking. */
  readonly record: string;
  /** Field name, or `(record)` when one side deleted the record and the other changed it. */
  readonly field: string;
  /** `null` with field `(record)`: that side deleted the record. */
  readonly ours: unknown;
  readonly theirs: unknown;
  readonly reason: string;
}

export type MergeResult =
  | { readonly _tag: "merged"; readonly text: string; readonly conflicts: readonly [] }
  | { readonly _tag: "conflict"; readonly text: string; readonly conflicts: ReadonlyArray<MergeConflict> }
  /** An input does not parse. Nothing can be merged safely; the caller must leave "ours" untouched. */
  | { readonly _tag: "unparseable"; readonly message: string };

type Rec = Readonly<Record<string, unknown>>;

export const RECORD_FIELD = "(record)";

/** Requirement fields whose change is a new revision of the rule (PLAN section 2). */
export const MATERIAL_FIELDS: ReadonlyArray<string> = ["what", "how", "evidence_required", "applies_to"];

/**
 * Tracking: these fields are ONE judgement ("this status, judged at this revision, for this release,
 * on this evidence"). They merge as a group, never field by field: side A's `done` + evidence at
 * revision 1 must not meet side B's `requirement_revision: 2` and read as a current, complete record.
 */
export const JUDGEMENT_FIELDS: ReadonlyArray<string> = ["status", "requirement_revision", "release", "evidence"];
export const JUDGEMENT_FIELD = JUDGEMENT_FIELDS.join("+");

/** Arrays that union when neither side removed or edited a base element. */
const UNION_FIELDS: ReadonlyArray<string> = ["refs", "conflicts", "supersedes", "tags"];

// ---- canonical comparison -----------------------------------------------------------------
const canonical = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// ---- field strategies ---------------------------------------------------------------------
type FieldOutcome = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: string };

const asArray = (v: unknown): ReadonlyArray<unknown> => (Array.isArray(v) ? v : []);

/** Union when every base element survives on both sides. Order: base order, then additions sorted. */
const unionArrays = (base: unknown, ours: unknown, theirs: unknown): FieldOutcome => {
  const b = asArray(base).map(canonical);
  const has = (side: unknown) => new Set(asArray(side).map(canonical));
  const [o, t] = [has(ours), has(theirs)];
  if (!b.every((x) => o.has(x) && t.has(x))) return { ok: false, reason: "both sides changed this list and one side removed or edited an entry" };
  const out = new Map<string, unknown>();
  for (const x of asArray(base)) out.set(canonical(x), x);
  const added = [...asArray(ours), ...asArray(theirs)].filter((x) => !out.has(canonical(x)));
  for (const x of added.sort((x, y) => cmp(canonical(x), canonical(y)))) out.set(canonical(x), x);
  return { ok: true, value: [...out.values()] };
};

const evidenceKey = (e: unknown): string => {
  const v = (e ?? {}) as Rec;
  return canonical([v.kind, v.ref, v.date]);
};
const evidenceOrder = (e: unknown): string => {
  const v = (e ?? {}) as Rec;
  return canonical([v.date, v.kind, v.ref]);
};

/** 3-way set merge keyed by `(kind, ref, date)`. Order: surviving base entries, then additions by date. */
const mergeEvidence = (base: unknown, ours: unknown, theirs: unknown): FieldOutcome => {
  const index = (side: unknown) => new Map(asArray(side).map((e) => [evidenceKey(e), e] as const));
  const [b, o, t] = [index(base), index(ours), index(theirs)];
  const kept: Array<unknown> = [];
  const added: Array<unknown> = [];
  for (const key of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
    const [be, oe, te] = [b.get(key), o.get(key), t.get(key)];
    let pick: unknown;
    if (same(oe, te)) pick = oe;
    else if (same(oe, be)) pick = te;
    else if (same(te, be)) pick = oe;
    else return { ok: false, reason: `both sides changed the evidence entry ${key} in different ways` };
    if (pick === undefined) continue;
    (be === undefined ? added : kept).push(pick);
  }
  return { ok: true, value: [...kept, ...added.sort((x, y) => cmp(evidenceOrder(x), evidenceOrder(y)))] };
};

const time = (v: unknown): number => {
  const n = typeof v === "string" ? Date.parse(v) : Number.NaN;
  return Number.isNaN(n) ? 0 : n;
};

// ---- one record ---------------------------------------------------------------------------
interface RecordMerge {
  readonly value: Rec;
  readonly conflicts: ReadonlyArray<Omit<MergeConflict, "record">>;
}

/** Both sides hold the record and differ. `base` is `{}` when both sides added it. */
const mergeRecord = (kind: FileKind<any>, base: Rec, ours: Rec, theirs: Rec): RecordMerge => {
  const out: Record<string, unknown> = {};
  const conflicts: Array<Omit<MergeConflict, "record">> = [];
  const changedBoth = (f: string) => !same(ours[f], base[f]) && !same(theirs[f], base[f]) && !same(ours[f], theirs[f]);
  const set = (f: string, v: unknown) => {
    if (v !== undefined) out[f] = v;
  };

  // Two people revised the same rule: their `revision` numbers collide even when the text fields differ.
  const revisedOurs = MATERIAL_FIELDS.some((f) => !same(ours[f], base[f]));
  const revisedTheirs = MATERIAL_FIELDS.some((f) => !same(theirs[f], base[f]));
  const doubleRevision = kind.name === "requirements" && revisedOurs && revisedTheirs &&
    MATERIAL_FIELDS.some((f) => !same(ours[f], theirs[f]));

  // Tracking: the later edit owns the stamp. Ties break on the text so the choice is symmetric.
  const stampFromOurs = ((): boolean => {
    const d = time(ours.updated_at) - time(theirs.updated_at);
    if (d !== 0) return d > 0;
    return cmp(canonical([ours.updated_at, ours.updated_by]), canonical([theirs.updated_at, theirs.updated_by])) >= 0;
  })();

  // Tracking: resolve the judgement group first. One side changed it -> that side's whole group.
  // Both changed it: same status + revision -> union the evidence; anything else -> a person decides.
  let group: Rec | undefined;
  if (kind.name === "tracking") {
    const pick = (r: Rec): Rec => Object.fromEntries(JUDGEMENT_FIELDS.map((f) => [f, r[f]]));
    const [gb, go, gt] = [pick(base), pick(ours), pick(theirs)];
    if (same(go, gt) || same(gt, gb)) group = go;
    else if (same(go, gb)) group = gt;
    else if (same({ ...go, evidence: null }, { ...gt, evidence: null })) {
      const evidence = mergeEvidence(base.evidence, ours.evidence, theirs.evidence);
      group = evidence.ok ? { ...go, evidence: evidence.value } : go;
      if (!evidence.ok) conflicts.push({ field: "evidence", ours: ours.evidence, theirs: theirs.evidence, reason: evidence.reason });
    } else {
      group = go;
      conflicts.push({
        field: JUDGEMENT_FIELD,
        ours: go,
        theirs: gt,
        reason: "both sides changed the status, the revision it was judged at, or its evidence; these move together, take one side's whole group",
      });
    }
  }

  for (const f of kind.order.keys) {
    const [b, o, t] = [base[f], ours[f], theirs[f]];
    if (group !== undefined && JUDGEMENT_FIELDS.includes(f)) {
      set(f, group[f]);
      continue;
    }
    if (doubleRevision && MATERIAL_FIELDS.includes(f) && !same(o, t)) {
      conflicts.push({ field: f, ours: o, theirs: t, reason: "both sides revised this requirement; merge the two revisions by hand and set one revision number" });
      set(f, o);
      continue;
    }
    if (same(o, t)) set(f, o);
    else if (same(o, b)) set(f, t);
    else if (same(t, b)) set(f, o);
    else if (kind.name === "tracking" && (f === "updated_at" || f === "updated_by")) set(f, stampFromOurs ? o : t);
    else {
      const merged: FieldOutcome = UNION_FIELDS.includes(f) && Array.isArray(o) && Array.isArray(t)
        ? unionArrays(b, o, t)
        : { ok: false, reason: "both sides changed this field to different values" };
      if (merged.ok) set(f, merged.value);
      else {
        conflicts.push({ field: f, ours: o, theirs: t, reason: merged.reason });
        set(f, o);
      }
    }
  }
  // `updated_by` follows `updated_at` when both sides stamped the record, even if one name equals the base.
  if (kind.name === "tracking" && changedBoth("updated_at")) set("updated_by", stampFromOurs ? ours.updated_by : theirs.updated_by);
  return { value: out, conflicts };
};

// ---- whole file ---------------------------------------------------------------------------
const label = (side: string, file: string) => `${side} version of ${file}`;

/**
 * Merge three versions of one store file. `base` may be "" (file added on both sides).
 * On conflict the record line keeps the "ours" value and one conflict block per field follows it,
 * so `kb validate` reports `ConflictMarker` until a person decides.
 */
export const mergeJsonl = (kind: FileKind<any>, base: string, ours: string, theirs: string, file = `${kind.name}.jsonl`): MergeResult => {
  const sides = [["base", base], ["ours", ours], ["theirs", theirs]] as const;
  const parsed = sides.map(([side, text]) => ({ side, result: parseJsonl(kind, label(side, file), text) }));
  const problems = parsed.flatMap((p) => p.result.issues.filter((i) => i.severity === "error"));
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).map((i) => `  ${i.file}${i.line === undefined ? "" : ` line ${i.line}`}: ${i.message}`);
    const more = problems.length > 5 ? [`  ... and ${problems.length - 5} more`] : [];
    return {
      _tag: "unparseable",
      message: [`cannot merge ${file}: an input does not parse, so records could be lost. Nothing was merged.`, ...shown, ...more].join("\n"),
    };
  }
  const index = (n: number) => new Map(parsed[n]!.result.records.map((r) => [kind.key(r.value), r.value as Rec] as const));
  const [b, o, t] = [index(0), index(1), index(2)];

  const chunks: Array<{ readonly key: string; readonly text: string }> = [];
  const conflicts: Array<MergeConflict> = [];
  const emit = (key: string, value: Rec, found: ReadonlyArray<Omit<MergeConflict, "record">>) => {
    const record = kind.id(value);
    const blocks = found.map((c) => conflictBlock({ key: record, field: c.field, ours: c.ours, theirs: c.theirs }) + "\n");
    chunks.push({ key, text: encodeRecord(kind, value) + "\n" + blocks.join("") });
    conflicts.push(...found.map((c) => ({ record, ...c })));
  };

  for (const key of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
    const [br, or, tr] = [b.get(key), o.get(key), t.get(key)];
    if (or === undefined && tr === undefined) continue; // deleted on both sides
    if (or === undefined || tr === undefined) {
      const survivor = (or ?? tr)!;
      if (br === undefined) emit(key, survivor, []); // added on one side
      else if (same(survivor, br)) continue; // deleted on one side, untouched on the other
      else {
        emit(key, survivor, [{
          field: RECORD_FIELD,
          ours: or ?? null,
          theirs: tr ?? null,
          reason: "one side deleted this record and the other side changed it",
        }]);
      }
      continue;
    }
    if (same(or, tr)) emit(key, or, []);
    else if (br !== undefined && same(or, br)) emit(key, tr, []);
    else if (br !== undefined && same(tr, br)) emit(key, or, []);
    else {
      const merged = mergeRecord(kind, br ?? {}, or, tr);
      emit(key, merged.value, merged.conflicts);
    }
  }

  const text = chunks.sort((x, y) => cmp(x.key, y.key)).map((c) => c.text).join("");
  conflicts.sort((x, y) => cmp(x.record, y.record) || cmp(x.field, y.field));
  return conflicts.length === 0 ? { _tag: "merged", text, conflicts: [] } : { _tag: "conflict", text, conflicts };
};

/** One line per conflict, naming record + field + both values. */
export const describeConflict = (c: MergeConflict): string =>
  c.field === RECORD_FIELD
    ? `record ${JSON.stringify(c.record)}: ${c.ours === null ? "ours deleted it" : "theirs deleted it"}, the other side changed it`
    : `record ${JSON.stringify(c.record)} field ${JSON.stringify(c.field)}: ours ${JSON.stringify(c.ours)} / theirs ${JSON.stringify(c.theirs)} (${c.reason})`;
