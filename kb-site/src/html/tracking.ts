/**
 * The "Tracking" section: apps overview, compare matrix, per-app checklists, requirement registry, conflicts.
 * Pure: every value comes from the core (`derive.compare`, `derive.checklist`, `views.refViews`) and is escaped here.
 */
import { type Checklist, type Comparison, DERIVED_STATES, type DerivedItem, type DerivedState } from "../derive.ts";
import { ACCEPTANCE, CADENCES, type Conflict, type KbData, PHASES, type Requirement } from "../schema.ts";
import type { RefView } from "../views.ts";
import { acceptanceBadge, accessBadge, marker, stateChip, stateLabelChip } from "./badges.ts";
import { esc, isSafeHref, linkOrCode } from "./escape.ts";

export interface TrackingInput {
  readonly data: KbData;
  /** `derive.compare` over every app, retired checks included. */
  readonly comparison: Comparison;
  /** `derive.checklist` per app, every state kept. */
  readonly checklists: ReadonlyArray<Checklist>;
  /** `views.refViews` over every requirement. */
  readonly refs: ReadonlyArray<RefView>;
  /** Source id -> anchor of the doc rendered in this page. */
  readonly docBySource: ReadonlyMap<string, string>;
  /** Public build: availability on the build machine is not shown (a reason may name a local directory). */
  readonly publicOnly?: boolean;
}

export interface NavLink {
  readonly id: string;
  readonly title: string;
}

export interface TrackingOutput {
  readonly html: string;
  readonly filtersHtml: string;
  readonly nav: ReadonlyArray<NavLink>;
}

/** Column order of the overview. `retired` is last: a retired rule is not app work. */
const OVERVIEW_STATES: ReadonlyArray<DerivedState> = ["complete", "stale", "blocked", "in_progress", "todo", "unverified", "excluded", "retired"];
const BAR_STATES: ReadonlyArray<DerivedState> = ["complete", "stale", "unverified", "blocked", "in_progress"];

const reqAnchor = (id: string): string => `req-${id}`;
const conflictAnchor = (id: string): string => `conflict-${id}`;
const reqLink = (id: string, text?: string): string => `<a href="#${esc(reqAnchor(id))}">${esc(text ?? id)}</a>`;

const fold = (summary: string, body: string, open: boolean, attrs = ""): string =>
  `<details class="fold"${open ? " open" : ""}${attrs}><summary>${summary}</summary><div class="fold-body">\n${body}\n</div></details>`;

const groupByPhase = <A>(items: ReadonlyArray<A>, phaseOf: (a: A) => string): ReadonlyArray<readonly [string, ReadonlyArray<A>]> =>
  PHASES.map((p) => [p, items.filter((i) => phaseOf(i) === p)] as const).filter(([, list]) => list.length > 0);

const countsText = (counts: Readonly<Record<DerivedState, number>>): string =>
  OVERVIEW_STATES.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${s}`).join(" · ");

// ---- source references ------------------------------------------------------------------
const sourceRef = (
  input: TrackingInput,
  sourceId: string,
  known: { readonly title: string | null; readonly root: string | null; readonly path: string | null } | undefined,
): string => {
  if (!known || known.root === null || known.path === null) return `<code>${esc(sourceId)}</code> <span class="muted">(no such source record)</span>`;
  const anchor = input.docBySource.get(sourceId);
  const title = esc(known.title ?? sourceId);
  if (anchor !== undefined) return `<a href="#${esc(anchor)}">${title}</a>`;
  if (known.root === "url") return isSafeHref(known.path) ? linkOrCode(known.path, known.title ?? known.path) : `${title} <code>${esc(known.path)}</code>`;
  return `${title} <code>${esc(`${known.root}:${known.path}`)}</code>`;
};

const refItem = (input: TrackingInput, ref: RefView): string => {
  const parts = [sourceRef(input, ref.source, ref)];
  if (ref.locator !== undefined) parts.push(`<span class="muted">at</span> ${esc(ref.locator)}`);
  if (ref.upstream_id !== undefined) {
    parts.push(`<span class="muted">upstream</span> <code>${esc(ref.upstream_id)}</code>${ref.upstream_status === undefined ? "" : ` <span class="muted">(${esc(ref.upstream_status)})</span>`}`);
  }
  parts.push(accessBadge(ref.access, ref.license, ref.publishable));
  if (input.publicOnly !== true && ref.availability === "unavailable" && input.docBySource.get(ref.source) === undefined) {
    parts.push(`<span class="muted">unavailable here: ${esc(ref.reason ?? "")}</span>`);
  }
  return `<li>${parts.join(" ")}</li>`;
};

// ---- filters ----------------------------------------------------------------------------
const select = (id: string, label: string, options: ReadonlyArray<readonly [string, string]>): string =>
  `<label>${esc(label)}<select id="${id}"><option value="">all</option>${
    options.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("")
  }</select></label>`;

const renderFilters = (data: KbData): string =>
  `<div class="filters" id="trk-filters">${
    [
      select("f-app", "app", data.apps.map((a) => [a.id, a.name] as const)),
      select("f-phase", "phase", PHASES.map((p) => [p, p] as const)),
      select("f-state", "state", DERIVED_STATES.map((s) => [s, s] as const)),
      select("f-cadence", "cadence", CADENCES.map((c) => [c, c] as const)),
      select("f-acceptance", "rule acceptance", ACCEPTANCE.map((a) => [a, a] as const)),
    ].join("")
  }<button type="button" id="f-reset">reset</button><span id="filter-count"></span></div>`;

// ---- apps overview ----------------------------------------------------------------------
const progressBar = (counts: Readonly<Record<DerivedState, number>>): string => {
  const applicable = DERIVED_STATES.reduce((n, s) => (s === "excluded" || s === "retired" ? n : n + counts[s]), 0);
  const segments = applicable === 0
    ? ""
    : BAR_STATES.filter((s) => counts[s] > 0)
      .map((s) => `<span class="b-${s}" style="width:${((counts[s] / applicable) * 100).toFixed(2)}%" title="${counts[s]} ${s}"></span>`)
      .join("");
  return `<div class="bar" role="img" aria-label="${counts.complete} of ${applicable} applicable checks complete">${segments}</div><span class="bar-label">${counts.complete}/${applicable} complete</span>`;
};

const renderOverview = (input: TrackingInput): string => {
  const rows = input.comparison.apps.map((a) => {
    const app = input.data.apps.find((x) => x.id === a.id);
    return `<tr class="unit trk-app-row" data-app="${esc(a.id)}"><td><a href="#${esc(`trk-app-${a.id}`)}">${esc(a.name)}</a><br><code>${esc(a.id)}</code></td><td>${
      a.release === null ? '<span class="muted">no release set</span>' : `<code>${esc(a.release)}</code>`
    }</td><td>${progressBar(a.counts)}</td>${OVERVIEW_STATES.map((s) => `<td class="num">${a.counts[s]}</td>`).join("")}<td>${
      esc((app?.platforms ?? []).join(", "))
    }</td></tr>`;
  });
  return `<article class="doc" id="trk-apps"><header><h1>Apps overview</h1><p class="src muted">One row per app in <code>data/apps.jsonl</code>. Counts are derived states over every check; the bar covers applicable checks only.</p></header>
<div class="tablewrap"><table class="trk"><thead><tr><th>app</th><th>release</th><th>progress</th>${
    OVERVIEW_STATES.map((s) => `<th>${stateLabelChip(s)}</th>`).join("")
  }<th>platforms</th></tr></thead><tbody>
${rows.join("\n")}
</tbody></table></div></article>`;
};

// ---- compare matrix ---------------------------------------------------------------------
const cellsAttr = (states: Readonly<Record<string, { readonly state: string }>>): string =>
  Object.entries(states).map(([app, cell]) => `${app}:${cell.state}`).join(" ");

const renderMatrix = (input: TrackingInput): string => {
  const byId = new Map(input.data.requirements.map((r) => [r.id, r] as const));
  const apps = input.comparison.apps;
  const head = `<thead><tr><th>check</th><th>cadence</th>${
    apps.map((a) => `<th class="app-col" data-col-app="${esc(a.id)}" title="${esc(a.id)}">${esc(a.name)}</th>`).join("")
  }</tr></thead>`;
  const phases = groupByPhase(input.comparison.rows, (r) => r.phase).map(([phase, rows]) => {
    const body = rows.map((row) => {
      const req = byId.get(row.requirement);
      const acceptance = req?.acceptance ?? "decided";
      return `<tr class="unit trk-row" data-phase="${esc(row.phase)}" data-cadence="${esc(row.cadence)}" data-acceptance="${esc(acceptance)}" data-cells="${esc(cellsAttr(row.states))}"><td class="req-cell">${
        reqLink(row.requirement, row.title)
      }<br><code>${esc(row.requirement)}</code> ${acceptanceBadge(acceptance)}</td><td>${esc(row.cadence)}</td>${
        apps.map((a) => `<td class="cell" data-col-app="${esc(a.id)}">${stateChip(row.states[a.id] ?? { state: "todo" })}</td>`).join("")
      }</tr>`;
    });
    return fold(
      `${esc(phase)} <span class="muted">${rows.length} check${rows.length === 1 ? "" : "s"}</span>`,
      `<div class="tablewrap"><table class="trk">${head}<tbody>\n${body.join("\n")}\n</tbody></table></div>`,
      true,
    );
  });
  return `<article class="doc" id="trk-compare"><header><h1>Compare matrix</h1><p class="src muted">Checks by phase (plan order) x apps. Round chips are app completion: ${
    DERIVED_STATES.map(stateLabelChip).join(" ")
  }. Square tags are rule acceptance: ${ACCEPTANCE.map(acceptanceBadge).join(" ")}.</p></header>
${phases.length === 0 ? '<p class="muted">No checks.</p>' : phases.join("\n")}
</article>`;
};

// ---- per-app checklists -----------------------------------------------------------------
const evidenceRef = (input: TrackingInput, kind: string, ref: string): string => {
  if (isSafeHref(ref)) return linkOrCode(ref);
  if (kind === "doc") {
    const sourceId = ref.split("#")[0] ?? "";
    const anchor = input.docBySource.get(sourceId);
    if (anchor !== undefined) return `<a href="#${esc(anchor)}"><code>${esc(ref)}</code></a>`;
  }
  return `<code>${esc(ref)}</code>`;
};

const renderItem = (input: TrackingInput, item: DerivedItem, requirement: Requirement | undefined): string => {
  const meta = [
    `cadence: ${esc(item.cadence)}`,
    item.cadence === "once" ? "release: not release bound" : item.release === null ? "release: no release set" : `release: <code>${esc(item.release)}</code>`,
    `owner: ${item.owner === null ? "unassigned" : esc(item.owner)}`,
  ];
  if (item.updated_at !== null) meta.push(`updated ${esc(item.updated_at)}${item.updated_by === null ? "" : ` by ${esc(item.updated_by)}`}`);
  if (item.requirement_revision !== null) meta.push(`judged at revision ${item.requirement_revision}`);
  const lines = [
    `<div class="head">${reqLink(item.requirement, item.title).replace("<a ", '<a class="title" ')} <code>${esc(item.requirement)}</code> ${
      stateChip(item.last_done === undefined ? { state: item.state } : { state: item.state, last_done: item.last_done })
    }${requirement?.owner_gate === true ? ` ${marker("owner gate", "gate")}` : ""}${
      requirement?.evidence_required === true ? ` ${marker("evidence required")}` : ""
    }</div>`,
    `<p class="meta">${meta.join(" · ")}</p>`,
  ];
  if (item.state === "stale") {
    lines.push(`<p class="review">needs review: done at revision ${item.requirement_revision ?? "?"}, requirement now revision ${item.current_revision}</p>`);
  }
  if (item.state === "unverified") lines.push(`<p class="review">done without the required evidence</p>`);
  if (item.state === "excluded" && item.status === null) lines.push(`<p class="meta">${esc(item.reason)}</p>`);
  if (item.notes !== "") lines.push(`<p class="notes">${esc(item.notes)}</p>`);
  if (item.evidence.length > 0) {
    lines.push(`<ul class="evidence">${
      item.evidence.map((e) =>
        `<li>${marker(e.kind)} ${evidenceRef(input, e.kind, e.ref)} <span class="muted">${esc(e.date)}${e.release === undefined ? "" : ` · release ${esc(e.release)}`}</span>${
          e.note === undefined ? "" : ` - ${esc(e.note)}`
        }</li>`
      ).join("")
    }</ul>`);
  }
  return `<div class="unit trk-item" id="${esc(`item-${item.app}--${item.requirement}`)}" data-app="${esc(item.app)}" data-phase="${esc(item.phase)}" data-cadence="${esc(item.cadence)}" data-acceptance="${esc(item.acceptance)}" data-state="${item.state}">${lines.join("")}</div>`;
};

const renderChecklist = (input: TrackingInput, list: Checklist): string => {
  const byId = new Map(input.data.requirements.map((r) => [r.id, r] as const));
  const phases = groupByPhase(list.items, (i) => i.phase).map(([phase, items]) => {
    const counts = Object.fromEntries(DERIVED_STATES.map((s) => [s, items.filter((i) => i.state === s).length])) as Record<DerivedState, number>;
    return fold(
      `${esc(phase)} <span class="muted">${countsText(counts)}</span>`,
      items.map((i) => renderItem(input, i, byId.get(i.requirement))).join("\n"),
      true,
    );
  });
  const app = list.app;
  const facts = [
    `release: ${list.release === null ? "no release set" : `<code>${esc(list.release)}</code>`}`,
    app.bundle_id === null ? null : `bundle <code>${esc(app.bundle_id)}</code>`,
    app.app_store_id === null ? null : `App Store id <code>${esc(app.app_store_id)}</code>`,
    app.tags.length === 0 ? "no tags" : `tags: ${esc(app.tags.join(", "))}`,
    `location: <code>${esc(`${app.root}:${app.path}`)}</code>`,
  ].filter((f): f is string => f !== null);
  return `<article class="doc" id="${esc(`trk-app-${app.id}`)}" data-app="${esc(app.id)}"><header><h1>${esc(app.name)} checklist</h1><p class="src muted">${facts.join(" · ")}</p>${
    app.notes === undefined || app.notes === "" ? "" : `<p class="src muted">${esc(app.notes)}</p>`
  }</header>
${fold(`${list.items.length} checks <span class="muted">${countsText(list.counts)}</span>`, phases.length === 0 ? '<p class="muted">No checks.</p>' : phases.join("\n"), false)}
</article>`;
};

// ---- requirement registry ---------------------------------------------------------------
const appliesText = (r: Requirement): string => {
  const parts: Array<string> = [];
  if ((r.applies_to.platforms ?? []).length > 0) parts.push(`platforms: ${(r.applies_to.platforms ?? []).join(", ")}`);
  if ((r.applies_to.tags ?? []).length > 0) parts.push(`tags (any): ${(r.applies_to.tags ?? []).join(", ")}`);
  return parts.length === 0 ? "all apps" : parts.join("; ");
};

const renderRequirement = (input: TrackingInput, r: Requirement, refs: ReadonlyArray<RefView>): string => {
  const row = r.kind === "check" ? input.comparison.rows.find((x) => x.requirement === r.id) : undefined;
  const conflicts = (r.conflicts ?? []).map((id) => {
    const c = input.data.conflicts.find((x) => x.id === id);
    return `<li><a href="#${esc(conflictAnchor(id))}">${esc(id)}</a> ${c ? `${marker(c.status)} ${esc(c.summary)}` : '<span class="muted">(no such conflict record)</span>'}</li>`;
  });
  const defs: Array<readonly [string, string]> = [
    ["what", esc(r.what)],
    ["how", esc(r.how)],
    ["applies to", esc(appliesText(r))],
  ];
  if ((r.supersedes ?? []).length > 0) defs.push(["supersedes", (r.supersedes ?? []).map((id) => reqLink(id)).join(", ")]);
  defs.push(["references", refs.length === 0 ? '<span class="muted">none</span>' : `<ul class="refs">${refs.map((ref) => refItem(input, ref)).join("")}</ul>`]);
  if (conflicts.length > 0) defs.push(["conflicts", `<ul class="refs">${conflicts.join("")}</ul>`]);
  if (row) {
    defs.push([
      "per app",
      `<div class="states">${
        input.comparison.apps.map((a) => `<span><a href="#${esc(`item-${a.id}--${r.id}`)}">${esc(a.name)}</a> ${stateChip(row.states[a.id] ?? { state: "todo" })}</span>`).join("")
      }</div>`,
    ]);
  }
  return `<div class="unit req" id="${esc(reqAnchor(r.id))}" data-phase="${esc(r.phase)}" data-cadence="${esc(r.cadence)}" data-acceptance="${esc(r.acceptance)}" data-cells="${
    row ? esc(cellsAttr(row.states)) : ""
  }"><h3>${esc(r.title)} <code>${esc(r.id)}</code> ${acceptanceBadge(r.acceptance)} ${marker(r.kind)}${r.owner_gate ? ` ${marker("owner gate", "gate")}` : ""}${
    r.evidence_required ? ` ${marker("evidence required")}` : ""
  }</h3><p class="meta">revision ${r.revision} · revised ${esc(r.revised_at)}${r.revision_note === "" ? "" : ` · ${esc(r.revision_note)}`} · phase ${esc(r.phase)} · cadence ${esc(r.cadence)}</p><dl>${
    defs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")
  }</dl></div>`;
};

const renderRegistry = (input: TrackingInput): string => {
  const refsByReq = new Map<string, Array<RefView>>();
  for (const ref of input.refs) refsByReq.set(ref.requirement, [...(refsByReq.get(ref.requirement) ?? []), ref]);
  const sorted = [...input.data.requirements].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const phases = groupByPhase(sorted, (r) => r.phase).map(([phase, list]) =>
    fold(
      `${esc(phase)} <span class="muted">${list.length} requirement${list.length === 1 ? "" : "s"}</span>`,
      list.map((r) => renderRequirement(input, r, refsByReq.get(r.id) ?? [])).join("\n"),
      false,
    )
  );
  const checks = input.data.requirements.filter((r) => r.kind === "check").length;
  return `<article class="doc" id="trk-requirements"><header><h1>Requirement registry</h1><p class="src muted">${input.data.requirements.length} requirements in <code>data/requirements.jsonl</code> (${checks} checks, ${
    input.data.requirements.length - checks
  } guidelines). The square tag is the acceptance of the rule; it says nothing about any app.</p></header>
${phases.length === 0 ? '<p class="muted">No requirements.</p>' : phases.join("\n")}
</article>`;
};

// ---- conflicts --------------------------------------------------------------------------
const renderConflict = (input: TrackingInput, c: Conflict): string => {
  const sides = c.sides.map((s) => {
    const source = input.data.sources.find((x) => x.id === s.source);
    return `<li>${sourceRef(input, s.source, source)}${source ? ` ${accessBadge(source.access, source.license, source.publishable)}` : ""} <span class="muted">at</span> ${esc(s.locator)}: ${esc(s.claim)}</li>`;
  });
  return `<div class="unit conflict conflict-${c.status}" id="${esc(conflictAnchor(c.id))}"><h3><code>${esc(c.id)}</code> ${marker(c.status, c.status === "open" ? "gate" : "")} <span class="muted">recorded ${esc(c.recorded_at)}</span></h3><p>${esc(c.summary)}</p><ul class="sides">${sides.join("")}</ul><p class="meta">affects: ${
    c.requirements.length === 0 ? "no requirement" : c.requirements.map((id) => reqLink(id)).join(", ")
  }</p>${c.resolution === null ? "" : `<p><strong>Resolution:</strong> ${esc(c.resolution)}</p>`}</div>`;
};

const renderConflicts = (input: TrackingInput): string => {
  const open = input.data.conflicts.filter((c) => c.status === "open").length;
  return `<article class="doc" id="trk-conflicts"><header><h1>Conflicts</h1><p class="src muted">${input.data.conflicts.length} recorded in <code>data/conflicts.jsonl</code>, ${open} open. Sources disagree here; no side was chosen silently.</p></header>
${input.data.conflicts.length === 0 ? '<p class="muted">No conflicts recorded.</p>' : input.data.conflicts.map((c) => renderConflict(input, c)).join("\n")}
</article>`;
};

// ---- section ----------------------------------------------------------------------------
export const renderTracking = (input: TrackingInput): TrackingOutput => ({
  filtersHtml: renderFilters(input.data),
  nav: [
    { id: "trk-apps", title: "Apps overview" },
    { id: "trk-compare", title: "Compare matrix" },
    ...input.checklists.map((l) => ({ id: `trk-app-${l.app.id}`, title: `${l.app.name} checklist` })),
    { id: "trk-requirements", title: "Requirement registry" },
    { id: "trk-conflicts", title: "Conflicts" },
  ],
  html: `<section class="kb-section" id="tracking"><div class="section-label">Tracking</div>
${renderOverview(input)}
${renderMatrix(input)}
${input.checklists.map((l) => renderChecklist(input, l)).join("\n")}
${renderRegistry(input)}
${renderConflicts(input)}
</section>`,
});
