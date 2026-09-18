/**
 * Build the one-page knowledge browser from the SAME records the CLI reads.
 * Runtime-agnostic: records through `Store`, paths through `Roots`, text through `FileSystem`, time through `Clock`.
 */
import { DateTime, Effect, FileSystem } from "effect";
import { mayPublish, whyNotPublishable } from "../access.ts";
import { checklist, compare, DERIVED_STATES } from "../derive.ts";
import { errorsOf, formatIssue, type Issue, warningsOf } from "../issue.ts";
import { Roots } from "../roots.ts";
import type { KbData, Source } from "../schema.ts";
import { Store } from "../store.ts";
import { refViews } from "../views.ts";
import { accessBadge } from "./badges.ts";
import { CLIENT_SCRIPT } from "./client.ts";
import { esc, isSafeHref, linkOrCode } from "./escape.ts";
import { type ManifestDoc, type ManifestSection, SECTIONS } from "./manifest.ts";
import { chunkByH2, inline, mdToHtml, renderExperiments, renderSota } from "./markdown.ts";
import { CSS } from "./styles.ts";
import { renderTracking } from "./tracking.ts";

export interface BuildOptions {
  /** Render ONLY sources that pass `mayPublish` (access.ts); every other doc becomes a citation card. */
  readonly publicOnly?: boolean;
  /** Fixed "generated" text. When absent the Clock is read. With a fixed stamp the output is byte-identical. */
  readonly stamp?: string | undefined;
  /** Defaults to the real manifest. */
  readonly sections?: ReadonlyArray<ManifestSection>;
}

export type DocOutcomeKind = "rendered" | "linked" | "cited";

export interface DocOutcome {
  readonly doc: string;
  readonly source: string;
  readonly kind: DocOutcomeKind;
  /** Why the text is not shown (`cited` only). */
  readonly reason?: string;
}

export interface BuildResult {
  readonly html: string;
  readonly docs: ReadonlyArray<DocOutcome>;
  /** Manifest docs whose source id has no record in `sources.jsonl`. */
  readonly unmapped: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<Issue>;
  readonly warnings: ReadonlyArray<Issue>;
  readonly counts: {
    readonly sources: number;
    readonly requirements: number;
    readonly apps: number;
    readonly tracking: number;
    readonly conflicts: number;
  };
}

interface RenderedDoc {
  readonly outcome: DocOutcome;
  readonly html: string;
}

const header = (doc: ManifestDoc, source: Source | undefined): string =>
  `<header><h1>${inline(doc.title)}</h1><p class="src muted">source: <code>${esc(source ? `${source.root}:${source.path}` : doc.source)}</code> <code>${esc(doc.source)}</code> ${
    source ? accessBadge(source.access, source.license, source.publishable) : accessBadge(null, null, null)
  }</p></header>`;

/** The citation card: what the source is and why its text is not here. Never an error. */
const citation = (doc: ManifestDoc, source: Source | undefined, reason: string): RenderedDoc => ({
  outcome: { doc: doc.id, source: doc.source, kind: "cited", reason },
  html: `<article class="doc" id="${esc(doc.id)}">${header(doc, source)}<div class="citation"><p><strong>Cited, text not shown.</strong> ${esc(reason)}</p>${
    source?.kind === undefined ? "" : `<p class="muted">kind: ${esc(source.kind)} · license: ${esc(source.license ?? "none stated")}</p>`
  }</div></article>`,
});

/** A linked-only source: the link and OUR notes from the record. The target is never fetched or inlined. */
const linked = (doc: ManifestDoc, source: Source): RenderedDoc => ({
  outcome: { doc: doc.id, source: doc.source, kind: "linked" },
  html: `<article class="doc" id="${esc(doc.id)}">${header(doc, source)}<div class="citation"><p><strong>Linked only.</strong> ${
    isSafeHref(source.path) ? linkOrCode(source.path) : `<code>${esc(source.path)}</code>`
  }</p><p class="muted">The text of this source is never copied or fetched. License: ${esc(source.license ?? "none stated")}.</p>${
    source.notes === undefined || source.notes === "" ? "" : `<p>Our notes: ${esc(source.notes)}</p>`
  }</div></article>`,
});

const renderDoc = (doc: ManifestDoc, data: KbData, publicOnly: boolean) =>
  Effect.gen(function* () {
    const source = data.sources.find((s) => s.id === doc.source);
    if (!source) return citation(doc, undefined, `no source record "${doc.source}" in data/sources.jsonl`);
    if (source.access === "linked-only" || source.root === "url") return linked(doc, source);
    // the shared policy, BEFORE any text is read: the flag alone never opens a private root or a private access
    if (publicOnly && !mayPublish(source)) {
      return citation(doc, source, `not publishable (${whyNotPublishable(source)}); the text is left out of the public build`);
    }
    const roots = yield* Roots;
    const fs = yield* FileSystem.FileSystem;
    const resolved = yield* roots.resolve(source.root, source.path);
    if (resolved._tag === "url") return linked(doc, source);
    // A reason may name a local directory: a public build says less.
    if (resolved._tag === "unavailable") {
      return citation(doc, source, publicOnly ? "unavailable on the build machine" : `unavailable here: ${resolved.reason}`);
    }
    const text = yield* fs.readFileString(resolved.absolute).pipe(Effect.orElseSucceed(() => null));
    if (text === null) return citation(doc, source, `unavailable here: ${source.root}:${source.path} is not a readable file`);
    const body = doc.special === "sota"
      ? renderSota(text, doc.id)
      : doc.special === "experiments"
      ? renderExperiments(text, doc.id)
      : chunkByH2(mdToHtml(text, doc.id));
    const rendered: RenderedDoc = {
      outcome: { doc: doc.id, source: doc.source, kind: "rendered" },
      html: `<article class="doc" id="${esc(doc.id)}">\n${header(doc, source)}\n${body}\n</article>`,
    };
    return rendered;
  });

const stampText = (stamp: string | undefined) =>
  stamp !== undefined
    ? Effect.succeed(stamp)
    : Effect.map(DateTime.now, (now) => `${DateTime.formatIso(now).slice(0, 16).replace("T", " ")} UTC`);

export const buildSite = Effect.fn("html.buildSite")(function* (options: BuildOptions = {}) {
  const publicOnly = options.publicOnly === true;
  const sections = options.sections ?? SECTIONS;
  const store = yield* Store;
  const loaded = yield* store.load;
  const data = loaded.data;
  const errors = errorsOf(loaded.issues);
  const warnings = warningsOf(loaded.issues);

  // ---- prose ----
  const renderedSections: Array<{ readonly section: ManifestSection; readonly docs: ReadonlyArray<RenderedDoc> }> = [];
  for (const section of sections) {
    const docs: Array<RenderedDoc> = [];
    for (const doc of section.docs) docs.push(yield* renderDoc(doc, data, publicOnly));
    renderedSections.push({ section, docs });
  }
  const outcomes = renderedSections.flatMap((s) => s.docs.map((d) => d.outcome));
  const docBySource = new Map<string, string>();
  for (const o of outcomes) if (o.kind === "rendered" && !docBySource.has(o.source)) docBySource.set(o.source, o.doc);

  // ---- records: the same core calls the CLI makes ----
  const tracking = renderTracking({
    data,
    comparison: compare(data, data.apps, { includeRetired: true }),
    checklists: data.apps.map((app) => checklist(data, app, { states: DERIVED_STATES })),
    refs: yield* refViews(data, data.requirements),
    docBySource,
    publicOnly,
  });

  const nav = [
    `<div class="nav-group"><a class="nav-section" href="#tracking">Tracking</a>${
      tracking.nav.map((n) => `<a class="nav-doc" href="#${esc(n.id)}">${esc(n.title)}</a>`).join("")
    }</div>`,
    ...sections.map((s) =>
      `<div class="nav-group"><a class="nav-section" href="#${esc(s.id)}">${esc(s.title)}</a>${
        s.docs.map((d) => `<a class="nav-doc" href="#${esc(d.id)}">${inline(d.title)}</a>`).join("")
      }</div>`
    ),
  ].join("\n");

  const prose = renderedSections.map(({ section, docs }) =>
    `<section class="kb-section" id="${esc(section.id)}"><div class="section-label">${esc(section.title)}</div>\n${docs.map((d) => d.html).join("\n")}</section>`
  ).join("\n");

  const rendered = outcomes.filter((o) => o.kind === "rendered").length;
  const linkedCount = outcomes.filter((o) => o.kind === "linked").length;
  const cited = outcomes.filter((o) => o.kind === "cited").length;
  const checks = data.requirements.filter((r) => r.kind === "check").length;
  const openConflicts = data.conflicts.filter((c) => c.status === "open").length;

  const banners = [
    errors.length === 0
      ? ""
      : `<div class="banner" id="validation-banner"><strong>The record store has ${errors.length} validation error${errors.length === 1 ? "" : "s"}.</strong> Records with problems are left out, so this page may be incomplete. Run <code>bun kb-site/cli.ts validate</code>.<ul>${
        errors.map((e) => `<li>${esc(formatIssue(e))}</li>`).join("")
      }</ul></div>`,
    publicOnly
      ? `<div class="banner banner-public" id="public-banner"><strong>Public build.</strong> Only sources marked <code>publishable</code> show their text. Every other source is a citation card.</div>`
      : "",
  ].join("\n");

  const stamp = yield* stampText(options.stamp);
  const footer = `<footer>Generated ${esc(stamp)} by <code>kb-site/build.ts</code> (${publicOnly ? "public" : "local"} build). Records: ${data.sources.length} sources, ${data.requirements.length} requirements (${checks} checks, ${
    data.requirements.length - checks
  } guidelines), ${data.apps.length} apps, ${data.tracking.length} tracking records, ${data.conflicts.length} conflicts (${openConflicts} open). Validation: ${
    errors.length === 0 ? "ok" : `${errors.length} error${errors.length === 1 ? "" : "s"}`
  }, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}. Docs: ${rendered} rendered, ${linkedCount} linked only, ${cited} cited without text. The records in <code>kb-site/data/</code> are the truth for checks and state; the markdown sources are the truth for prose. Edit them and rebuild.</footer>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge Base · Tracking + Current SOTA</title>
<style>${CSS}</style>
</head>
<body>
<div class="layout">
<nav>
  <p class="brand">Knowledge Base</p>
  <p class="brand-sub">tracking · onboarding · paywalls · UX · design · growth</p>
  <input id="search" type="search" placeholder="Filter (press /)" autocomplete="off">
  ${nav}
</nav>
<main>
${banners}
${tracking.filtersHtml}
<p id="noresults">Nothing matches the filter.</p>
${tracking.html}
${prose}
${footer}
</main>
</div>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>
`;

  const result: BuildResult = {
    html,
    docs: outcomes,
    unmapped: outcomes.filter((o) => o.kind === "cited" && data.sources.every((s) => s.id !== o.source)).map((o) => `${o.doc} -> ${o.source}`),
    errors,
    warnings,
    counts: {
      sources: data.sources.length,
      requirements: data.requirements.length,
      apps: data.apps.length,
      tracking: data.tracking.length,
      conflicts: data.conflicts.length,
    },
  };
  return result;
});
