/** Plain-text renderers: aligned columns, no color, stable output. */
import { type Checklist, type Comparison, type CompareCell, DERIVED_STATES, type DerivedItem, type StateCounts } from "./derive.ts";
import { releaseKey, type App, type Conflict, type Evidence, type Requirement, type TrackingRecord } from "./schema.ts";
import type { ReviseOutcome } from "./transitions.ts";
import type { RefView, ShowView } from "./views.ts";

export const json = (value: unknown): string => JSON.stringify(value, null, 2);

/** Left-aligned columns, two spaces apart, no trailing spaces. */
export const table = (headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>): string => {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)));
  const line = (cells: ReadonlyArray<string>) => cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join("  ").trimEnd();
  return [line(headers), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
};

const dash = (s: string | null | undefined): string => (s === null || s === undefined || s === "" ? "-" : s);
const indent = (text: string, by = "  "): string => text.split("\n").map((l) => (l === "" ? l : by + l)).join("\n");

export const releaseText = (app: App): string => dash(releaseKey(app.current_release));

export const countsLine = (counts: StateCounts): string =>
  DERIVED_STATES.filter((s) => counts[s] > 0).map((s) => `${s} ${counts[s]}`).join(", ") || "no checks";

export const cellText = (cell: CompareCell): string => (cell.last_done === undefined ? cell.state : `${cell.state} (last done ${cell.last_done})`);

export const renderApps = (apps: ReadonlyArray<App>): string =>
  apps.length === 0
    ? "no apps"
    : table(
      ["ID", "NAME", "RELEASE", "PLATFORMS", "LOCATION", "TAGS"],
      apps.map((a) => [a.id, a.name, dash(releaseKey(a.current_release)), dash(a.platforms.join(",")), `${a.root}:${a.path}`, dash(a.tags.join(","))]),
    );

export const renderChecks = (requirements: ReadonlyArray<Requirement>): string =>
  requirements.length === 0
    ? "no matching requirements"
    : table(
      ["ID", "KIND", "PHASE", "CADENCE", "ACCEPTANCE", "REV", "EVIDENCE", "TITLE"],
      requirements.map((r) => [r.id, r.kind, r.phase, r.cadence, r.acceptance, String(r.revision), r.evidence_required ? "required" : "-", r.title]),
    );

export const renderChecklist = (c: Checklist): string =>
  [
    `${c.app.id} (${c.app.name}) - release ${dash(c.release)}`,
    countsLine(c.counts) + (c.filters.length === 0 ? "" : ` (filtered: ${c.filters.join("; ")}; counts cover ${c.matched} of ${c.total} checks, ${c.items.length} shown)`),
    "",
    c.items.length === 0
      ? "no matching checks"
      : table(
        ["STATE", "PHASE", "ID", "RELEASE", "OWNER", "TITLE", "DETAIL"],
        c.items.map((i) => [i.state, i.phase, i.requirement, dash(i.release), dash(i.owner), i.title, detail(i)]),
      ),
  ].join("\n");

const detail = (i: DerivedItem): string =>
  i.state === "complete" || i.state === "in_progress"
    ? i.evidence.length === 0 ? "-" : `${i.evidence.length} evidence`
    : i.state === "todo" && i.last_done === undefined
    ? "-"
    : i.state === "todo"
    ? `last done ${i.last_done}`
    : i.reason;

const evidenceLines = (evidence: ReadonlyArray<Evidence>): string =>
  evidence.length === 0
    ? "  (none)"
    : evidence
      .map((e) => `  ${e.date}  ${e.kind}  ${e.ref}${e.release === undefined ? "" : `  [release ${e.release}]`}${e.note === undefined ? "" : `  - ${e.note}`}`)
      .join("\n");

const refLine = (r: RefView): string => {
  const where = r.availability === "url"
    ? dash(r.location)
    : `${dash(r.root)}:${dash(r.path)}${r.locator === undefined ? "" : ` @ ${r.locator}`}`;
  const upstream = r.upstream_id === undefined ? "" : `  upstream ${r.upstream_id}${r.upstream_status === undefined ? "" : ` (${r.upstream_status})`}`;
  const here = r.availability === "available" ? `available: ${r.location}` : r.availability === "url" ? "url" : `unavailable here (${r.reason})`;
  return `${r.source}  ${dash(r.title)}\n    ${where}${upstream}\n    access ${dash(r.access)}, ${here}`;
};

export const renderRefs = (refs: ReadonlyArray<RefView>): string => {
  if (refs.length === 0) return "no references";
  const out: Array<string> = [];
  let current = "";
  for (const r of refs) {
    if (r.requirement !== current) {
      if (current !== "") out.push("");
      out.push(r.requirement);
      current = r.requirement;
    }
    out.push(indent(refLine(r)));
  }
  return out.join("\n");
};

export const renderShow = (v: ShowView): string => {
  const r = v.requirement;
  const applies = [
    ...(r.applies_to.platforms?.length ? [`platforms ${r.applies_to.platforms.join(",")}`] : []),
    ...(r.applies_to.tags?.length ? [`tags ${r.applies_to.tags.join(",")}`] : []),
  ].join("; ") || "all apps";
  const out = [
    `${r.id} - ${r.title}`,
    `${r.kind} | phase ${r.phase} | cadence ${r.cadence} | acceptance ${r.acceptance}${r.owner_gate ? " | owner gate" : ""}`,
    `revision ${r.revision} (${r.revised_at})${r.revision_note === "" ? "" : `: ${r.revision_note}`}`,
    `applies to: ${applies}`,
    `evidence: ${r.evidence_required ? "required to mark done" : "optional"}`,
    ...(r.supersedes?.length ? [`supersedes: ${r.supersedes.join(", ")}`] : []),
    "",
    "WHAT",
    indent(r.what),
    "",
    "HOW",
    indent(r.how),
    "",
    "REFERENCES",
    v.refs.length === 0 ? "  (none)" : v.refs.map((x) => indent(refLine(x))).join("\n"),
  ];
  if (v.conflicts.length > 0) {
    out.push("", "CONFLICTS");
    for (const c of v.conflicts) out.push("missing" in c ? `  ${c.id}  (missing from conflicts.jsonl)` : `  ${c.id}  [${c.status}] ${c.summary}`);
  }
  if (v.tracking) {
    const t = v.tracking;
    out.push(
      "",
      `APP ${t.app} - ${t.state}${t.release === null ? "" : ` for release ${t.release}`}`,
      `  ${t.reason}`,
      `  status ${dash(t.status)} | owner ${dash(t.owner)} | judged at revision ${t.requirement_revision ?? "-"} of ${t.current_revision}`,
      ...(t.notes === "" ? [] : [`  notes: ${t.notes}`]),
      ...(t.updated_at === null ? [] : [`  updated ${t.updated_at} by ${dash(t.updated_by)}`]),
      "  evidence:",
      indent(evidenceLines(t.evidence)),
    );
  } else if (v.apps.length > 0) {
    out.push("", "APPS", table(["APP", "STATE"], v.apps.map((a) => [a.app, cellText(a)])).split("\n").map((l) => `  ${l}`).join("\n"));
  }
  return out.join("\n");
};

export const renderCompare = (c: Comparison): string => {
  const ids = c.apps.map((a) => a.id);
  return [
    c.rows.length === 0
      ? "no matching checks"
      : table(
        ["PHASE", "ID", ...ids.map((id) => id.toUpperCase())],
        c.rows.map((row) => [row.phase, row.requirement, ...ids.map((id) => cellText(row.states[id] ?? { state: "todo" }))]),
      ),
    "",
    ...(c.filters.length === 0 ? [] : [`filtered: ${c.filters.join("; ")}; counts cover ${c.matched} of ${c.total} checks, ${c.rows.length} row(s) shown`]),
    table(["APP", "RELEASE", ...DERIVED_STATES.map((s) => s.toUpperCase())], c.apps.map((a) => [a.id, dash(a.release), ...DERIVED_STATES.map((s) => String(a.counts[s]))])),
  ].join("\n");
};

export const renderConflicts = (conflicts: ReadonlyArray<Conflict>): string =>
  conflicts.length === 0
    ? "no conflicts"
    : conflicts
      .map((c) =>
        [
          `${c.id}  [${c.status}] ${c.summary}  (recorded ${c.recorded_at})`,
          ...c.sides.map((s) => `  ${s.source} @ ${s.locator}: ${s.claim}`),
          `  requirements: ${c.requirements.join(", ") || "-"}`,
          ...(c.resolution === null ? [] : [`  resolution: ${c.resolution}`]),
        ].join("\n")
      )
      .join("\n\n");

export const renderRevise = (o: ReviseOutcome): string => {
  const r = o.requirement;
  const apps = [...new Set(o.becameStale.map((t) => t.app))];
  return [
    o.material.length === 0
      ? `${r.id}: updated, revision stays ${r.revision} (no material change)`
      : `${r.id}: revision ${o.previous.revision} -> ${r.revision} (${r.revised_at}); changed ${o.material.join(", ")}`,
    o.material.length === 0
      ? "no tracking record became stale"
      : `${o.becameStale.length} tracking record(s) became stale${apps.length === 0 ? "" : ` in ${apps.length} app(s): ${apps.join(", ")}`}${o.becameStale.length === 0 ? "" : "; each owner reviews, then runs `kb set <app> " + r.id + " --ack-revision`"}`,
    ...(o.requirement.acceptance === o.previous.acceptance ? [] : [`acceptance ${o.previous.acceptance} -> ${r.acceptance}`]),
  ].join("\n");
};

export const ACCEPTANCE_REMINDER = "acceptance is the owner's call; a contributor proposes `candidate` and the owner decides";

export const renderSet = (record: TrackingRecord, previous: TrackingRecord | undefined): string =>
  `${record.app} ${record.requirement}${record.release === null ? "" : ` @ ${record.release}`}: ${previous?.status ?? "todo"} -> ${record.status}` +
  ` (revision ${record.requirement_revision}, ${record.evidence.length} evidence, owner ${dash(record.owner)})`;
