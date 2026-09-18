/** Cross-record rules (PLAN section 4). Pure; collects every problem. */
import { PRIVATE_ROOTS } from "./access.ts";
import { applies, countingEvidence, foreignReleases, isStale } from "./derive.ts";
import { issue, type Issue, type IssueTag, type Severity } from "./issue.ts";
import { APPS_PATH, CONFLICTS_PATH, REQUIREMENTS_PATH, SOURCES_PATH, trackingPath } from "./jsonl.ts";
import type { KbData, TrackingRecord } from "./schema.ts";

export interface Location {
  readonly file: string;
  readonly line?: number | undefined;
}
/** Where a record object was read from. Unknown records fall back to their canonical file. */
export type Where = (record: object) => Location | undefined;

const isUrl = (s: string): boolean => /^https?:\/\/\S+$/.test(s);

const pathProblem = (root: string, path: string): string | undefined => {
  if (root === "url") return isUrl(path) ? undefined : `root "url" needs a full http(s) URL in "path", got "${path}"`;
  if (isUrl(path)) return `"path" is a URL but root is "${root}"; use root "url"`;
  if (path.startsWith("/") || path.startsWith("~") || /^[A-Za-z]:[\\/]/.test(path)) return `"path" must be relative to root "${root}", got absolute path "${path}"`;
  if (path.split(/[\\/]/).includes("..")) return `"path" must stay inside root "${root}" (no ".." segments)`;
  return undefined;
};

export const validateData = (data: KbData, where: Where = () => undefined): ReadonlyArray<Issue> => {
  const issues: Array<Issue> = [];
  const sources = new Set(data.sources.map((s) => s.id));
  const conflicts = new Set(data.conflicts.map((c) => c.id));
  const requirements = new Map(data.requirements.map((r) => [r.id, r]));
  const apps = new Map(data.apps.map((a) => [a.id, a]));

  const at = (record: object, fallback: string) => where(record) ?? { file: fallback };
  const add = (tag: IssueTag, record: object, fallback: string, id: string, message: string, severity: Severity = "error") => {
    const loc = at(record, fallback);
    issues.push(issue(tag, loc.file, message, { line: loc.line, id, severity }));
  };

  for (const s of data.sources) {
    const problem = pathProblem(s.root, s.path);
    if (problem) add("InvalidPath", s, SOURCES_PATH, s.id, problem);
    if (s.publishable && PRIVATE_ROOTS.includes(s.root)) {
      add("InvalidAccess", s, SOURCES_PATH, s.id, `root "${s.root}" is private and is never published; set "publishable" to false`);
    }
  }

  for (const a of data.apps) {
    const problem = pathProblem(a.root, a.path);
    if (problem) add("InvalidPath", a, APPS_PATH, a.id, problem);
  }

  for (const r of data.requirements) {
    const dangling = (what: string, target: string) => add("DanglingReference", r, REQUIREMENTS_PATH, r.id, `${what} "${target}" does not exist`);
    r.refs.forEach((ref, i) => sources.has(ref.source) || dangling(`refs[${i}].source: source`, ref.source));
    (r.conflicts ?? []).forEach((c) => conflicts.has(c) || dangling("conflicts: conflict", c));
    (r.supersedes ?? []).forEach((s) => requirements.has(s) || dangling("supersedes: requirement", s));
    if (r.kind === "guideline" && r.cadence !== "once") {
      add("InvalidTracking", r, REQUIREMENTS_PATH, r.id, `a guideline must use cadence "once", got "${r.cadence}"`);
    }
  }

  for (const c of data.conflicts) {
    const dangling = (what: string, target: string) => add("DanglingReference", c, CONFLICTS_PATH, c.id, `${what} "${target}" does not exist`);
    c.sides.forEach((side, i) => sources.has(side.source) || dangling(`sides[${i}].source: source`, side.source));
    c.requirements.forEach((r) => requirements.has(r) || dangling("requirements: requirement", r));
    if (c.status === "resolved" && (c.resolution ?? "").trim() === "") {
      add("InvalidTracking", c, CONFLICTS_PATH, c.id, 'a "resolved" conflict needs a "resolution"');
    }
  }

  for (const t of data.tracking) issues.push(...validateTracking(t, requirements, apps, at(t, trackingPath(t.app))));
  return issues;
};

const validateTracking = (
  t: TrackingRecord,
  requirements: ReadonlyMap<string, KbData["requirements"][number]>,
  apps: ReadonlyMap<string, KbData["apps"][number]>,
  loc: Location,
): ReadonlyArray<Issue> => {
  const out: Array<Issue> = [];
  const id = t.release === null ? t.requirement : `${t.requirement}@${t.release}`;
  const add = (tag: IssueTag, message: string, severity: Severity = "error") =>
    out.push(issue(tag, loc.file, message, { line: loc.line, id, severity }));

  if (loc.file !== trackingPath(t.app)) add("FileNameMismatch", `record for app "${t.app}" is in ${loc.file}; it belongs in ${trackingPath(t.app)}`);
  const app = apps.get(t.app);
  if (!app) add("DanglingReference", `app "${t.app}" does not exist in apps.jsonl`);
  const r = requirements.get(t.requirement);
  if (!r) add("DanglingReference", `requirement "${t.requirement}" does not exist in requirements.jsonl`);

  if (t.status === "blocked" && t.notes.trim() === "") add("InvalidTracking", 'status "blocked" needs notes that say what blocks it');
  if (t.status === "not_applicable" && t.notes.trim() === "") add("InvalidTracking", 'status "not_applicable" needs notes that say why');
  if (!r) return out;

  if (r.kind === "guideline") add("InvalidTracking", `"${r.id}" is a guideline; only checks are tracked per app`);
  if (r.acceptance === "retired" && t.status !== "not_applicable") {
    add("InvalidTracking", `requirement "${r.id}" is retired; the only status allowed is "not_applicable", got "${t.status}"`);
  }
  // A stale record was judged against an older revision (which may not have required evidence). It derives
  // `stale`, never `complete`, and `set --ack-revision` applies the evidence rule when it is re-confirmed.
  if (t.status === "done" && r.evidence_required && !isStale(t, r) && countingEvidence(t).length === 0) {
    add("InvalidTracking", t.evidence.length === 0
      ? `status "done" needs evidence: "${r.id}" has evidence_required`
      : `status "done" needs evidence for release "${t.release}"; the evidence on this record belongs to release ${foreignReleases(t)}, and old evidence never counts for another release`);
  }
  if (t.requirement_revision > r.revision) {
    add("InvalidTracking", `requirement_revision ${t.requirement_revision} is newer than "${r.id}" revision ${r.revision}`);
  }
  if (r.cadence === "once" && t.release !== null) add("InvalidTracking", `"${r.id}" has cadence "once"; release must be null, got "${t.release}"`);
  if (r.cadence === "every_release" && t.release === null) add("InvalidTracking", `"${r.id}" has cadence "every_release"; release must be set`);
  if (app && r.kind === "check" && !applies(r, app) && t.status !== "not_applicable") {
    add("InvalidTracking", `"${r.id}" does not apply to app "${app.id}" (applies_to); this record is ignored`, "warning");
  }
  return out;
};
