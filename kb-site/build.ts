#!/usr/bin/env bun
/**
 * Knowledge-base site builder.
 *
 * Reads the curated kb-site files (SOTA.md, EXPERIMENTS.md), the knowledge
 * skills (mobile-onboarding-catalog, ux-psychology), and the apps-repo
 * playbooks, and renders one self-contained dist/index.html.
 *
 * The markdown files stay the single source of truth - this script is a view.
 *
 *   bun kb-site/build.ts          # build dist/index.html
 *   bun kb-site/build.ts --open   # build and open in the browser
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const KB_DIR = import.meta.dir;
const SKILLS_ENG = resolve(KB_DIR, "../skills/engineering");
const APPS_REPO = "/Users/necmttn/Projects/apps";
const PLAYBOOKS = join(APPS_REPO, "docs/playbooks");

type Doc = {
  id: string;
  title: string;
  path: string;
  special?: "sota" | "experiments";
};
type Section = { id: string; title: string; docs: Doc[] };

const SECTIONS: Section[] = [
  {
    id: "sota",
    title: "Current SOTA",
    docs: [{ id: "sota-doc", title: "Verdicts by domain", path: join(KB_DIR, "SOTA.md"), special: "sota" }],
  },
  {
    id: "experiments",
    title: "Experiments",
    docs: [{ id: "experiments-doc", title: "Our experiment ledger", path: join(KB_DIR, "EXPERIMENTS.md"), special: "experiments" }],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    docs: [
      { id: "onb-patterns", title: "Patterns (P1-P17)", path: join(SKILLS_ENG, "mobile-onboarding-catalog/SKILL.md") },
      { id: "onb-catalog", title: "App catalog + benchmarks", path: join(SKILLS_ENG, "mobile-onboarding-catalog/CATALOG.md") },
      { id: "onb-screens", title: "Screen wireframes", path: join(SKILLS_ENG, "mobile-onboarding-catalog/SCREENS.md") },
    ],
  },
  {
    id: "paywalls",
    title: "Paywalls",
    docs: [{ id: "pw-playbook", title: "Paywall experiments playbook", path: join(PLAYBOOKS, "paywall-experiments.md") }],
  },
  {
    id: "ux",
    title: "UX Psychology",
    docs: [
      { id: "ux-rules", title: "The twelve rules", path: join(SKILLS_ENG, "ux-psychology/SKILL.md") },
      { id: "ux-reference", title: "Reference + evidence", path: join(SKILLS_ENG, "ux-psychology/REFERENCE.md") },
    ],
  },
  {
    id: "design",
    title: "Design",
    docs: [{ id: "design-law", title: "Lock In Chinese DESIGN.md (law)", path: join(APPS_REPO, "apps/lockin-chinese/ios/DESIGN.md") }],
  },
  {
    id: "aso",
    title: "ASO",
    docs: [{ id: "aso-lockin", title: "Lock In Chinese ASO playbook", path: join(PLAYBOOKS, "aso-lockin-chinese.md") }],
  },
  {
    id: "shipping",
    title: "Shipping",
    docs: [
      { id: "ship-sop", title: "Ship SOP (phases + owner gates)", path: join(KB_DIR, "SHIPPING.md") },
      { id: "ship-lockin-launch", title: "Lock In Chinese launch checklist", path: join(APPS_REPO, "apps/lockin-chinese/docs/LAUNCH_CHECKLIST.md") },
      { id: "ship-lockin-state", title: "Lock In Chinese submission state", path: join(APPS_REPO, "apps/lockin-chinese/docs/APP_STORE_SUBMISSION.md") },
      { id: "ship-lang-readiness", title: "Language-app launch readiness", path: join(PLAYBOOKS, "lockin-language-launch-readiness.md") },
    ],
  },
  {
    id: "appreview",
    title: "App Review",
    docs: [
      { id: "rejections", title: "Rejection ledger", path: join(KB_DIR, "REJECTIONS.md"), special: "experiments" },
      { id: "submission-gate", title: "Submission playbook (the gate)", path: join(PLAYBOOKS, "app-store-submission.md") },
      { id: "rej-family-controls", title: "Evidence: 2.5.1 Family Controls (2026-08-04)", path: join(APPS_REPO, "apps/lockin-chinese/docs/review/2026-08-04-family-controls-rejection.md") },
      { id: "rej-skip-trial", title: "Evidence: 3.1.2(c) skip-trial toggle (2026-08-12)", path: join(APPS_REPO, "apps/lockin-chinese/docs/review/2026-08-12-skip-trial-toggle-rejection.md") },
    ],
  },
  {
    id: "growth",
    title: "Growth & Analytics",
    docs: [
      { id: "growth-ops", title: "Growth-ops operating system", path: join(PLAYBOOKS, "growth-ops.md") },
      { id: "growth-tricks", title: "Growth tricks", path: join(PLAYBOOKS, "growth-tricks.md") },
      { id: "analytics", title: "Analytics per app", path: join(PLAYBOOKS, "analytics-per-app.md") },
    ],
  },
];

// ---------- markdown -> html ----------

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function inline(raw: string): string {
  let s = esc(raw);
  // protect code spans
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  // images -> plain text, links -> anchors
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const href = String(u);
    const ext = /^https?:/.test(href);
    return `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

function mdToHtml(md: string, docId: string): string {
  // strip yaml frontmatter
  md = md.replace(/^---\n[\s\S]*?\n---\n/, "");
  const lines = md.split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  // list stack of levels
  let listStack: number[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeLists = (toDepth = 0) => {
    while (listStack.length > toDepth) {
      out.push("</li></ul>");
      listStack.pop();
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inCode) {
      if (/^```/.test(line)) {
        out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else codeBuf.push(line);
      continue;
    }
    if (/^```/.test(line)) {
      flushPara();
      closeLists();
      inCode = true;
      continue;
    }

    // table
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      flushPara();
      closeLists();
      const cells = (l: string) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => inline(c.trim()));
      const head = cells(line);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && /^\s*\|/.test(lines[j])) {
        rows.push(cells(lines[j]));
        j++;
      }
      out.push('<div class="tablewrap"><table><thead><tr>');
      out.push(...head.map((h) => `<th>${h}</th>`));
      out.push("</tr></thead><tbody>");
      for (const r of rows) out.push("<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>");
      out.push("</tbody></table></div>");
      i = j - 1;
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      closeLists();
      const lvl = h[1].length;
      const text = h[2];
      out.push(`<h${lvl} id="${docId}--${slug(text)}">${inline(text)}</h${lvl}>`);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushPara();
      closeLists();
      out.push("<hr>");
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara();
      closeLists();
      const quote: string[] = [line.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1])) quote.push(lines[++i].replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    const li = line.match(/^(\s*)(?:[-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flushPara();
      const depth = Math.floor(li[1].length / 2) + 1;
      if (depth > listStack.length) {
        out.push('<ul class="kb-list"><li>');
        listStack.push(depth);
      } else {
        closeLists(depth);
        out.push("</li><li>");
      }
      out.push(inline(li[2]));
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushPara();
      // blank line inside a list only ends it if the next content line is not a list item
      const next = lines.slice(i + 1).find((l) => !/^\s*$/.test(l));
      if (listStack.length && (!next || !/^\s*(?:[-*]|\d+\.)\s+/.test(next))) closeLists();
      continue;
    }

    // continuation of a list item (indented text)
    if (listStack.length && /^\s{2,}/.test(line)) {
      out.push(" " + inline(line.trim()));
      continue;
    }

    closeLists();
    para.push(line.trim());
  }
  flushPara();
  closeLists();
  if (inCode) out.push(`<pre><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  return out.join("\n");
}

// ---------- special renderers ----------

function renderSota(md: string, docId: string): string {
  md = md.replace(/^---\n[\s\S]*?\n---\n/, "");
  const out: string[] = [];
  const lines = md.split("\n");
  let intro: string[] = [];
  let seenSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      if (!seenSection && intro.length) {
        out.push(mdToHtml(intro.join("\n"), docId + "-intro"));
        intro = [];
      }
      seenSection = true;
      out.push(`<h2 id="${docId}--${slug(h2[1])}">${inline(h2[1])}</h2>`);
      continue;
    }
    const v = line.match(/^-\s+\[(sota|directional|retired)\]\s+(.*)$/);
    if (v) {
      const [, status, rest] = v;
      out.push(
        `<div class="verdict verdict-${status}"><span class="badge badge-${status}">${status}</span><div class="verdict-body">${inline(rest)}</div></div>`,
      );
      continue;
    }
    if (/^#\s/.test(line)) continue; // page h1 comes from the doc header
    if (!seenSection) intro.push(line);
    else if (!/^\s*$/.test(line)) out.push(`<p class="muted">${inline(line.trim())}</p>`);
  }
  return out.join("\n");
}

function renderExperiments(md: string, docId: string): string {
  md = md.replace(/^---\n[\s\S]*?\n---\n/, "");
  const out: string[] = [];
  const parts = md.split(/^(?=##\s)/m);
  for (const part of parts) {
    const h2 = part.match(/^##\s+(.*)$/m);
    if (!h2) {
      out.push(mdToHtml(part.replace(/^#\s.*$/m, ""), docId + "-intro"));
      continue;
    }
    out.push(`<h2 id="${docId}--${slug(h2[1])}">${inline(h2[1])}</h2>`);
    const body = part.slice(part.indexOf("\n") + 1);
    const blocks = body.split(/^(?=###\s)/m);
    for (const block of blocks) {
      const h3 = block.match(/^###\s+(.*)$/m);
      if (!h3) {
        if (block.trim()) out.push(mdToHtml(block, docId));
        continue;
      }
      const status = block.match(/\*\*Status:\*\*\s*(\w+)/)?.[1] ?? "";
      const rest = block.slice(block.indexOf("\n") + 1);
      out.push(
        `<div class="card"><div class="card-head"><h3 id="${docId}--${slug(h3[1])}">${inline(h3[1])}</h3>${
          status ? `<span class="badge badge-${status}">${status}</span>` : ""
        }</div>${mdToHtml(rest, docId + "-" + slug(h3[1]))}</div>`,
      );
    }
  }
  return out.join("\n");
}

// ---------- page assembly ----------

const chunkByH2 = (html: string) =>
  html
    .split(/(?=<h2 )/)
    .map((c) => `<div class="chunk">${c}</div>`)
    .join("\n");

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let docCount = 0;
let missing: string[] = [];

const sectionsHtml = SECTIONS.map((section) => {
  const docsHtml = section.docs
    .map((doc) => {
      if (!existsSync(doc.path)) {
        missing.push(doc.path);
        return `<article class="doc" id="${doc.id}"><header><h1>${esc(doc.title)}</h1><p class="src muted">missing: <code>${esc(doc.path)}</code></p></header></article>`;
      }
      docCount++;
      const md = readFileSync(doc.path, "utf8");
      const mtime = fmtDate(statSync(doc.path).mtime);
      const body =
        doc.special === "sota"
          ? renderSota(md, doc.id)
          : doc.special === "experiments"
            ? renderExperiments(md, doc.id)
            : chunkByH2(mdToHtml(md, doc.id));
      const shortPath = doc.path.replace(process.env.HOME ?? "", "~");
      return `<article class="doc" id="${doc.id}">
<header><h1>${esc(doc.title)}</h1><p class="src muted">source: <code>${esc(shortPath)}</code> · updated ${mtime}</p></header>
${doc.special ? body : body}
</article>`;
    })
    .join("\n");
  return `<section class="kb-section" id="${section.id}"><div class="section-label">${esc(section.title)}</div>\n${docsHtml}</section>`;
}).join("\n");

const navHtml = SECTIONS.map(
  (s) =>
    `<div class="nav-group"><a class="nav-section" href="#${s.id}">${esc(s.title)}</a>${s.docs
      .map((d) => `<a class="nav-doc" href="#${d.id}">${esc(d.title)}</a>`)
      .join("")}</div>`,
).join("\n");

const builtAt = new Date();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knowledge Base · Current SOTA</title>
<style>
:root {
  --bg: #faf7f1; --surface: #fffdf9; --text: #1c1917; --muted: #6f6759;
  --border: #e5ddcd; --accent: #b03a2e; --accent-ink: #fffdf9; --code-bg: #f1ece1;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171310; --surface: #1e1913; --text: #e9e2d4; --muted: #9a917f;
    --border: #37312a; --accent: #d05a48; --accent-ink: #171310; --code-bg: #2a251d;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.6 -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
}
h1, h2, h3, .section-label, .nav-section { font-family: "Iowan Old Style", "Palatino", Georgia, serif; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code { background: var(--code-bg); padding: 1px 5px; border-radius: 4px; font-size: 0.86em; }
pre { background: var(--code-bg); padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
.layout { display: flex; min-height: 100vh; }
nav {
  width: 270px; flex: none; padding: 24px 18px; border-right: 1px solid var(--border);
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.brand { font-family: "Iowan Old Style", "Palatino", Georgia, serif; font-size: 20px; margin: 0 0 2px; }
.brand-sub { color: var(--muted); font-size: 12.5px; margin: 0 0 16px; }
#search {
  width: 100%; padding: 8px 10px; margin-bottom: 18px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface); color: var(--text); font-size: 14px;
}
#search:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
.nav-group { margin-bottom: 14px; }
.nav-section { display: block; font-size: 15px; font-weight: 600; color: var(--text); padding: 2px 0; }
.nav-doc { display: block; font-size: 13px; color: var(--muted); padding: 1.5px 0 1.5px 14px; }
.nav-doc:hover { color: var(--accent); }
main { flex: 1; min-width: 0; padding: 36px 48px 80px; max-width: 940px; }
.kb-section { margin-bottom: 56px; }
.section-label {
  font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--accent);
  border-bottom: 1px solid var(--border); padding-bottom: 6px; margin-bottom: 20px;
}
article.doc { margin-bottom: 40px; }
article.doc > header h1 { font-size: 27px; margin: 0 0 2px; }
.src { font-size: 12.5px; margin: 0 0 14px; }
.muted { color: var(--muted); }
h2 { font-size: 21px; margin: 30px 0 10px; }
h3 { font-size: 17px; margin: 22px 0 8px; }
ul.kb-list { padding-left: 22px; margin: 8px 0; }
ul.kb-list li { margin: 4px 0; }
blockquote { border-left: 3px solid var(--accent); margin: 12px 0; padding: 2px 14px; color: var(--muted); }
.tablewrap { overflow-x: auto; margin: 12px 0; }
table { border-collapse: collapse; font-size: 14.5px; min-width: 420px; }
th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
th { background: var(--code-bg); }
.verdict {
  display: flex; gap: 12px; align-items: flex-start; background: var(--surface);
  border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; margin: 8px 0;
}
.verdict-retired .verdict-body { color: var(--muted); }
.badge {
  flex: none; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 2px 8px; border-radius: 99px; border: 1px solid var(--border); color: var(--muted); margin-top: 3px;
}
.badge-sota, .badge-shipped, .badge-decided, .badge-fixed { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.badge-decided { opacity: 0.75; }
.badge-directional, .badge-open { border-color: var(--accent); color: var(--accent); }
.badge-retired { text-decoration: line-through; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 6px 18px 12px; margin: 12px 0; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.card-head h3 { margin: 12px 0 4px; }
footer { color: var(--muted); font-size: 12.5px; border-top: 1px solid var(--border); padding-top: 14px; }
.hidden { display: none; }
#noresults { color: var(--muted); font-style: italic; display: none; }
@media (max-width: 900px) {
  .layout { flex-direction: column; }
  nav { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--border); }
  main { padding: 24px 20px 60px; }
}
</style>
</head>
<body>
<div class="layout">
<nav>
  <p class="brand">Knowledge Base</p>
  <p class="brand-sub">onboarding · paywalls · UX · design · growth</p>
  <input id="search" type="search" placeholder="Filter (press /)" autocomplete="off">
  ${navHtml}
</nav>
<main>
<p id="noresults">Nothing matches the filter.</p>
${sectionsHtml}
<footer>Generated ${builtAt.toISOString().slice(0, 16).replace("T", " ")} by <code>kb-site/build.ts</code>. The markdown sources are the truth; edit them and rebuild.</footer>
</main>
</div>
<script>
const input = document.getElementById("search");
const chunks = [...document.querySelectorAll(".chunk, .verdict, .card")];
const docs = [...document.querySelectorAll("article.doc")];
const sections = [...document.querySelectorAll(".kb-section")];
function applyFilter() {
  const q = input.value.trim().toLowerCase();
  for (const c of chunks) c.classList.toggle("hidden", q !== "" && !c.textContent.toLowerCase().includes(q));
  for (const d of docs) {
    const units = [...d.querySelectorAll(".chunk, .verdict, .card")];
    const any = q === "" || units.some((u) => !u.classList.contains("hidden")) ||
      (units.length === 0 && d.textContent.toLowerCase().includes(q));
    d.classList.toggle("hidden", !any);
  }
  for (const s of sections) {
    const any = [...s.querySelectorAll("article.doc")].some((d) => !d.classList.contains("hidden"));
    s.classList.toggle("hidden", !any);
  }
  document.getElementById("noresults").style.display =
    sections.every((s) => s.classList.contains("hidden")) ? "block" : "none";
}
input.addEventListener("input", applyFilter);
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  if (e.key === "Escape" && document.activeElement === input) { input.value = ""; applyFilter(); input.blur(); }
});
</script>
</body>
</html>
`;

const distDir = join(KB_DIR, "dist");
mkdirSync(distDir, { recursive: true });
const outPath = join(distDir, "index.html");
writeFileSync(outPath, html);
console.log(`built ${outPath}`);
console.log(`docs rendered: ${docCount}`);
if (missing.length) console.log(`missing sources (rendered as notes):\n  ${missing.join("\n  ")}`);
if (process.argv.includes("--open")) Bun.spawn(["open", outPath]);
