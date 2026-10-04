import { assert, describe, it } from "@effect/vitest";
import { esc, isSafeHref, linkOrCode } from "../../src/html/escape.ts";
import { chunkByH2, inline, mdToHtml, renderExperiments, renderSota, slug } from "../../src/html/markdown.ts";

describe("markdown renderer (constructs the old build.ts renderer supported)", () => {
  it("headings get doc-scoped ids", () => {
    const html = mdToHtml("# Title One\n\n## Second: part (b)\n", "doc");
    assert.include(html, '<h1 id="doc--title-one">Title One</h1>');
    assert.include(html, '<h2 id="doc--second-part-b">Second: part (b)</h2>');
    assert.strictEqual(slug("中文 Heading!"), "中文-heading");
  });

  it("strips yaml frontmatter", () => {
    const html = mdToHtml("---\nname: x\n---\n# Body\n", "d");
    assert.notInclude(html, "name: x");
    assert.include(html, "Body");
  });

  it("nested lists, ordered items and continuation lines", () => {
    const html = mdToHtml("- one\n  - nested\n    continued\n- two\n\n1. first\n\npara\n", "d");
    assert.strictEqual(
      html,
      [
        '<ul class="kb-list"><li>',
        "one",
        '<ul class="kb-list"><li>',
        "nested",
        " continued",
        "</li></ul>",
        "</li><li>",
        "two",
        "</li><li>",
        "first",
        "</li></ul>",
        "<p>para</p>",
      ].join("\n"),
    );
  });

  it("tables", () => {
    const html = mdToHtml("| a | b |\n|---|:--|\n| 1 | `x` |\n| 2 | **y** |\n", "d");
    assert.include(html, '<div class="tablewrap"><table><thead><tr>');
    assert.include(html, "<th>a</th>\n<th>b</th>");
    assert.include(html, "<tr><td>1</td><td><code>x</code></td></tr>");
    assert.include(html, "<tr><td>2</td><td><strong>y</strong></td></tr>");
  });

  it("code fences are escaped verbatim, closed or not", () => {
    assert.include(mdToHtml("```ts\nconst a = <b>&\"c\";\n**not bold**\n```\n", "d"), "<pre><code>const a = &lt;b&gt;&amp;&quot;c&quot;;\n**not bold**</code></pre>");
    assert.include(mdToHtml("```\nopen", "d"), "<pre><code>open</code></pre>");
  });

  it("blockquotes join their lines; hr", () => {
    const html = mdToHtml("> one\n> two\n\n---\n", "d");
    assert.include(html, "<blockquote><p>one two</p></blockquote>");
    assert.include(html, "<hr>");
  });

  it("inline: code, bold, emphasis, images to text", () => {
    assert.strictEqual(inline("a `b*c*` **d** *e* ![alt](http://x/y.png)"), "a <code>b*c*</code> <strong>d</strong> <em>e</em> alt");
  });

  it("links: http(s) opens a new tab, #anchor stays, everything else loses the link", () => {
    assert.strictEqual(inline("[t](https://example.com/a?b=1&c=2)"), '<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener">t</a>');
    assert.strictEqual(inline("[t](#doc--x)"), '<a href="#doc--x">t</a>');
    const js = inline("[click](javascript:alert(1))");
    assert.notInclude(js, "<a ");
    assert.notInclude(js, "href=");
    assert.include(js, "click");
    assert.notInclude(inline("[rel](../other.md)"), "<a ");
    assert.notInclude(inline('[q](https://x/"onmouseover="alert(1))'), '"onmouseover="');
  });

  it("raw html in markdown is escaped", () => {
    const html = mdToHtml("<script>alert(1)</script>\n\n# <img src=x onerror=alert(1)>\n", "d");
    assert.notInclude(html, "<script>");
    assert.notInclude(html, "<img");
    assert.include(html, "&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("[sota] verdict lines", () => {
    const html = renderSota(
      "# SOTA\n\nIntro text.\n\n## Paywalls\n- [sota] Hard paywall wins. [src](https://e.com)\n- [directional] Maybe\n- [retired] Old\nloose note\n",
      "sota-doc",
    );
    assert.include(html, "<p>Intro text.</p>");
    assert.notInclude(html, "<h1");
    assert.include(html, '<h2 id="sota-doc--paywalls">Paywalls</h2>');
    assert.include(html, '<div class="verdict verdict-sota"><span class="badge badge-sota">sota</span><div class="verdict-body">Hard paywall wins. <a href="https://e.com"');
    assert.include(html, '<span class="badge badge-directional">directional</span>');
    assert.include(html, '<div class="verdict verdict-retired">');
    assert.include(html, '<p class="muted">loose note</p>');
  });

  it("experiment cards with a status badge", () => {
    const html = renderExperiments(
      "# Ledger\n\nIntro.\n\n## Lock In\n\nGroup note.\n\n### E1: skip trial\n**Status:** shipped\n\n- result\n\n### E2: no status\nBody\n",
      "exp",
    );
    assert.include(html, "<p>Intro.</p>");
    assert.include(html, '<h2 id="exp--lock-in">Lock In</h2>');
    assert.include(html, "<p>Group note.</p>");
    assert.include(html, '<div class="card"><div class="card-head"><h3 id="exp--e1-skip-trial">E1: skip trial</h3><span class="badge badge-shipped">shipped</span></div>');
    assert.include(html, '<h3 id="exp--e2-no-status">E2: no status</h3></div>');
    assert.strictEqual(html.match(/class="card"/g)?.length, 2);
  });

  it("chunkByH2 makes one filter unit per h2", () => {
    const html = chunkByH2(mdToHtml("intro\n\n## A\ntext\n\n## B\ntext\n", "d"));
    assert.strictEqual(html.match(/<div class="chunk">/g)?.length, 3);
  });
});

describe("escape", () => {
  it("escapes the five characters", () => {
    assert.strictEqual(esc(`<a href="x" on='y'>&`), "&lt;a href=&quot;x&quot; on=&#39;y&#39;&gt;&amp;");
  });
  it("only http, https, mailto are links", () => {
    assert.isTrue(isSafeHref("https://a.b"));
    assert.isTrue(isSafeHref("mailto:a@b.c"));
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "/etc/passwd", "file:///x", "//evil.com"]) {
      assert.isFalse(isSafeHref(bad), bad);
      assert.notInclude(linkOrCode(bad), "<a ");
    }
  });
});
