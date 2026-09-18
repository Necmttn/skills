/**
 * The small markdown -> HTML renderer of the knowledge browser, plus the SOTA and ledger renderers.
 * Pure string functions. Input is escaped first; only http/https/mailto and `#anchor` links become anchors.
 */
import { esc, isSafeOrAnchor } from "./escape.ts";

const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

export function inline(raw: string): string {
  let s = esc(raw.replaceAll("\u0000", ""));
  // protect code spans
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  // images -> plain text, links -> anchors
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t: string, u: string) => {
    // `u` is already escaped. Unsafe or relative targets keep the text and drop the link.
    if (!isSafeOrAnchor(u)) return `<span class="deadlink" title="${u}">${t}</span>`;
    const ext = /^https?:/i.test(u);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)] ?? "");
  return s;
}

export const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

const LIST_ITEM = /^(\s*)(?:[-*]|\d+\.)\s+(.*)$/;

export function mdToHtml(source: string, docId: string): string {
  const md = source.replace(FRONTMATTER, "");
  const lines = md.split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  const listStack: number[] = [];

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
    const line = lines[i] ?? "";

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
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1] ?? "")) {
      flushPara();
      closeLists();
      const cells = (l: string) => l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => inline(c.trim()));
      const head = cells(line);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && /^\s*\|/.test(lines[j] ?? "")) {
        rows.push(cells(lines[j] ?? ""));
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
      const lvl = (h[1] ?? "#").length;
      const text = h[2] ?? "";
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
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1] ?? "")) quote.push((lines[++i] ?? "").replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    const li = line.match(LIST_ITEM);
    if (li) {
      flushPara();
      const depth = Math.floor((li[1] ?? "").length / 2) + 1;
      if (depth > listStack.length) {
        out.push('<ul class="kb-list"><li>');
        listStack.push(depth);
      } else {
        closeLists(depth);
        out.push("</li><li>");
      }
      out.push(inline(li[2] ?? ""));
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

/** `- [sota|directional|retired] text` lines become verdict rows; everything else is muted prose. */
export function renderSota(source: string, docId: string): string {
  const md = source.replace(FRONTMATTER, "");
  const out: string[] = [];
  let intro: string[] = [];
  let seenSection = false;
  for (const line of md.split("\n")) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      if (!seenSection && intro.length) {
        out.push(mdToHtml(intro.join("\n"), docId + "-intro"));
        intro = [];
      }
      seenSection = true;
      out.push(`<h2 id="${docId}--${slug(h2[1] ?? "")}">${inline(h2[1] ?? "")}</h2>`);
      continue;
    }
    const v = line.match(/^-\s+\[(sota|directional|retired)\]\s+(.*)$/);
    if (v) {
      const status = v[1] ?? "";
      out.push(
        `<div class="verdict verdict-${status}"><span class="badge badge-${status}">${status}</span><div class="verdict-body">${inline(v[2] ?? "")}</div></div>`,
      );
      continue;
    }
    if (/^#\s/.test(line)) continue; // page h1 comes from the doc header
    if (!seenSection) intro.push(line);
    else if (!/^\s*$/.test(line)) out.push(`<p class="muted">${inline(line.trim())}</p>`);
  }
  if (!seenSection && intro.length) out.push(mdToHtml(intro.join("\n"), docId + "-intro"));
  return out.join("\n");
}

/** `##` groups, one card per `###` entry, with a status badge read from `**Status:** word`. */
export function renderExperiments(source: string, docId: string): string {
  const md = source.replace(FRONTMATTER, "");
  const out: string[] = [];
  for (const part of md.split(/^(?=##\s)/m)) {
    const h2 = part.match(/^##\s+(.*)$/m);
    if (!h2) {
      out.push(mdToHtml(part.replace(/^#\s.*$/m, ""), docId + "-intro"));
      continue;
    }
    out.push(`<h2 id="${docId}--${slug(h2[1] ?? "")}">${inline(h2[1] ?? "")}</h2>`);
    const body = part.slice(part.indexOf("\n") + 1);
    for (const block of body.split(/^(?=###\s)/m)) {
      const h3 = block.match(/^###\s+(.*)$/m);
      if (!h3) {
        if (block.trim()) out.push(mdToHtml(block, docId));
        continue;
      }
      const title = h3[1] ?? "";
      const status = block.match(/\*\*Status:\*\*\s*(\w+)/)?.[1] ?? "";
      const rest = block.slice(block.indexOf("\n") + 1);
      out.push(
        `<div class="card"><div class="card-head"><h3 id="${docId}--${slug(title)}">${inline(title)}</h3>${
          status ? `<span class="badge badge-${status}">${status}</span>` : ""
        }</div>${mdToHtml(rest, docId + "-" + slug(title))}</div>`,
      );
    }
  }
  return out.join("\n");
}

/** Filter units: one chunk per `<h2>`. */
export const chunkByH2 = (html: string): string =>
  html
    .split(/(?=<h2 )/)
    .map((c) => `<div class="chunk">${c}</div>`)
    .join("\n");
