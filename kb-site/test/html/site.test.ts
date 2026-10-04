import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestConsole } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { DERIVED_STATES } from "../../src/derive.ts";
import { makeBuildCommand } from "../../src/html/command.ts";
import type { ManifestSection } from "../../src/html/manifest.ts";
import { buildSite } from "../../src/html/site.ts";
import { app, baseFiles, conflict, lines, requirement, source, tracking, withStore } from "../helpers.ts";

const PRIVATE_PHRASE = "PRIVATE-BODY-7f3a-do-not-leak";
const LINKED_PHRASE = "LINKED-BODY-91c2-never-inline";
const PUBLIC_PHRASE = "PUBLIC-BODY-55aa-shown";

const sections: ReadonlyArray<ManifestSection> = [
  {
    id: "prose",
    title: "Prose",
    docs: [
      { id: "doc-public", title: "Public playbook", source: "playbook" },
      { id: "doc-private", title: "Private playbook", source: "private-doc" },
      { id: "doc-apps", title: "Apps repo doc", source: "apps-doc" },
      { id: "doc-linked", title: "Linked only", source: "linked" },
      { id: "doc-linked-local", title: "Linked only, file present", source: "linked-local" },
      { id: "doc-ghost", title: "No record", source: "ghost" },
    ],
  },
];

const evidence = [{ kind: "doc" as const, ref: "playbook#privacy", date: "2026-09-02" }];

/** One app, one check per derived state (8), hostile text in a note and in an evidence ref. */
const files = () =>
  baseFiles({
    "sources.jsonl": lines([
      source({ id: "apps-doc", root: "apps", path: "docs/x.md", access: "private-repo", publishable: false }),
      source({ id: "linked", kind: "url", root: "url", path: "https://example.com/pack", access: "linked-only", publishable: false, notes: "Our own notes <b>bold</b>." }),
      source({ id: "linked-local", path: "LINKED.md", access: "linked-only", publishable: false, notes: "Link only." }),
      source(),
      source({ id: "private-doc", path: "PRIVATE.md", access: "private-repo", publishable: false }),
    ]),
    "requirements.jsonl": lines([
      requirement({ id: "s.blocked", title: "Blocked check" }),
      requirement({ id: "s.complete", title: "Complete check", conflicts: ["c1"], refs: [{ source: "playbook", locator: "#privacy" }, { source: "apps-doc" }] }),
      requirement({ id: "s.excluded", title: "Excluded check", applies_to: { tags: ["subscriptions"] } }),
      requirement({ id: "s.guide", kind: "guideline", title: "A guideline", acceptance: "candidate", evidence_required: false }),
      requirement({ id: "s.progress", title: "Progress check", owner_gate: true }),
      requirement({ id: "s.release", title: "Release check", phase: "release", cadence: "every_release" }),
      requirement({ id: "s.retired", title: "Retired check", acceptance: "retired" }),
      requirement({ id: "s.stale", title: "Stale check", revision: 3, acceptance: "verified" }),
      requirement({ id: "s.unverified", title: "Unverified check" }),
    ]),
    "apps.jsonl": lines([app()]),
    "conflicts.jsonl": lines([conflict({ requirements: ["s.complete"], sides: [{ source: "playbook", locator: "#a", claim: "Claim <i>A</i>" }] })]),
    "tracking/alpha.jsonl": lines([
      tracking({ requirement: "s.blocked", status: "blocked", notes: "waiting <script>alert(1)</script>", owner: "neco" }),
      tracking({ requirement: "s.complete", status: "done", evidence: [...evidence, { kind: "link", ref: "javascript:alert(1)", date: "2026-09-02" }, { kind: "link", ref: "https://example.com/proof", date: "2026-09-03", release: "1.0" }] }),
      tracking({ requirement: "s.progress", status: "in_progress" }),
      tracking({ requirement: "s.release", release: "0.9", status: "done", evidence }),
      tracking({ requirement: "s.stale", status: "done", requirement_revision: 1, evidence }),
      tracking({ requirement: "s.unverified", status: "done" }),
    ]),
    "../PLAYBOOK.md": `# Playbook\n\n## Privacy\n${PUBLIC_PHRASE}\n`,
    "../PRIVATE.md": `# Private\n\n${PRIVATE_PHRASE}\n`,
    "../LINKED.md": `# Linked\n\n${LINKED_PHRASE}\n`,
  });

const build = (options: { readonly publicOnly?: boolean; readonly stamp?: string } = {}) =>
  withStore(files(), () => buildSite({ sections, stamp: "FIXED", ...options }));

const itemOf = (html: string, id: string): string => {
  const start = html.indexOf(`id="item-alpha--${id}"`);
  assert.isAbove(start, -1, `item ${id} is rendered`);
  const end = html.indexOf('<div class="unit trk-item"', start);
  return html.slice(start, end === -1 ? undefined : end);
};

describe("html view", () => {
  it.effect("every derived state shows with its own text label", () =>
    Effect.gen(function* () {
      const { html } = yield* build();
      const expected: Record<string, string> = {
        "s.blocked": "blocked",
        "s.complete": "complete",
        "s.excluded": "excluded",
        "s.progress": "in_progress",
        "s.release": "todo",
        "s.retired": "retired",
        "s.stale": "stale",
        "s.unverified": "unverified",
      };
      assert.deepStrictEqual([...new Set(Object.values(expected))].sort(), [...DERIVED_STATES].sort());
      for (const [id, state] of Object.entries(expected)) {
        const item = itemOf(html, id);
        assert.include(item, `data-state="${state}"`, id);
        assert.match(item, new RegExp(`<span class="chip st-${state}"[^>]*>${state}[ <]`), id);
      }
      // old evidence never counts for the new release
      assert.include(itemOf(html, "s.release"), "todo <small>(last done 0.9)</small>");
      assert.include(itemOf(html, "s.release"), "release: <code>1.0</code>");
      assert.include(itemOf(html, "s.stale"), "needs review: done at revision 1, requirement now revision 3");
      assert.include(itemOf(html, "s.progress"), "owner gate");
      assert.include(itemOf(html, "s.blocked"), "owner: neco");
      assert.include(itemOf(html, "s.complete"), "evidence required");
      // the matrix row carries the same states for the client filter
      assert.include(html, 'data-cells="alpha:todo"');
      assert.include(html, 'data-cells="alpha:stale"');
    }));

  it.effect("rule acceptance is a different mark from app completion", () =>
    Effect.gen(function* () {
      const { html } = yield* build();
      const req = html.slice(html.indexOf('id="req-s.stale"'));
      assert.include(req.slice(0, 600), '<span class="acc acc-verified"');
      assert.notInclude(html, 'class="chip st-verified"');
      assert.notInclude(html, 'class="chip st-decided"');
      assert.include(html, 'id="req-s.guide"');
      assert.include(html, 'id="conflict-c1"');
      assert.include(html, '<a href="#req-s.complete">s.complete</a>');
      // a reference to a rendered doc links inside the page; an unrendered one shows root:path
      assert.include(html, '<a href="#doc-public">Playbook</a>');
      assert.include(html, "<code>apps:docs/x.md</code>");
    }));

  it.effect("record text is escaped; javascript: refs never become links", () =>
    Effect.gen(function* () {
      const { html } = yield* build();
      assert.notInclude(html, "<script>alert(1)");
      assert.include(html, "waiting &lt;script&gt;alert(1)&lt;/script&gt;");
      assert.notMatch(html, /href\s*=\s*["']?\s*javascript:/i);
      assert.include(html, "<code>javascript:alert(1)</code>");
      assert.include(html, '<a href="https://example.com/proof" target="_blank" rel="noopener noreferrer">');
      assert.notInclude(html, "<b>bold</b>");
      assert.notInclude(html, "<i>A</i>");
      assert.strictEqual(html.match(/<script>/g)?.length, 1, "only the page's own script");
    }));

  it.effect("an unmapped private root renders a citation card; the build succeeds", () =>
    Effect.gen(function* () {
      const result = yield* build();
      const card = result.html.slice(result.html.indexOf('<article class="doc" id="doc-apps"'));
      assert.include(card.slice(0, 900), "unavailable here: private root &quot;apps&quot;; map it in kb.roots.json");
      assert.include(card.slice(0, 900), "private-repo");
      assert.deepStrictEqual(result.docs.find((d) => d.doc === "doc-apps")?.kind, "cited");
      assert.deepStrictEqual(result.unmapped, ["doc-ghost -> ghost"]);
      assert.include(result.html, "no source record &quot;ghost&quot;");
      assert.include(result.html, PUBLIC_PHRASE);
      assert.include(result.html, PRIVATE_PHRASE, "a local build shows private text that is available");
    }));

  it.effect("--public leaves private body text out", () =>
    Effect.gen(function* () {
      const result = yield* build({ publicOnly: true });
      assert.notInclude(result.html, PRIVATE_PHRASE);
      assert.include(result.html, PUBLIC_PHRASE);
      assert.include(result.html, "not publishable (access private-repo is private)");
      assert.include(result.html, 'id="public-banner"');
      assert.deepStrictEqual(result.docs.filter((d) => d.kind === "rendered").map((d) => d.doc), ["doc-public"]);
    }));

  it.effect("--public never renders a private root, whatever the record claims; no build reads through a symlink that leaves the root", () =>
    withStore(
      {
        ...files(),
        "sources.jsonl": lines([
          source({ id: "leak", path: "LEAK.md" }),
          source(),
          source({ id: "wiki-doc", kind: "wiki", root: "wiki", path: "note.md", access: "private-wiki", publishable: true }),
        ]),
        "../kb.roots.json": JSON.stringify({ wiki: "./my-wiki" }),
        "../my-wiki/note.md": `# Wiki\n\n${PRIVATE_PHRASE}\n`,
      },
      ({ dir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const outside = yield* fs.makeTempDirectoryScoped({ prefix: "kb-outside-" });
          yield* fs.writeFileString(path.join(outside, "secret.md"), `# Outside\n\n${LINKED_PHRASE}\n`);
          yield* fs.symlink(path.join(outside, "secret.md"), path.join(path.dirname(dir), "LEAK.md"));
          const docs: ReadonlyArray<ManifestSection> = [{ id: "p", title: "P", docs: [{ id: "doc-wiki", title: "Wiki", source: "wiki-doc" }, { id: "doc-leak", title: "Leak", source: "leak" }] }];

          const pub = yield* buildSite({ sections: docs, stamp: "FIXED", publicOnly: true });
          assert.notInclude(pub.html, PRIVATE_PHRASE);
          assert.notInclude(pub.html, LINKED_PHRASE);
          assert.deepStrictEqual(pub.docs.map((d) => [d.doc, d.kind]), [["doc-wiki", "cited"], ["doc-leak", "cited"]]);
          assert.include(pub.docs[0]?.reason, "not publishable");

          const local = yield* buildSite({ sections: docs, stamp: "FIXED" });
          assert.include(local.html, PRIVATE_PHRASE, "a local build shows a mapped private root");
          assert.notInclude(local.html, LINKED_PHRASE, "but never a file outside the root");
          assert.include(local.docs[1]?.reason, 'leaves root "kb"');
        }),
    ));

  it.effect("a linked-only source is a link and our notes, never inlined", () =>
    Effect.gen(function* () {
      for (const publicOnly of [false, true]) {
        const result = yield* build({ publicOnly });
        assert.notInclude(result.html, LINKED_PHRASE);
        assert.include(result.html, '<a href="https://example.com/pack"');
        assert.include(result.html, "Our notes: Our own notes &lt;b&gt;bold&lt;/b&gt;.");
        assert.deepStrictEqual(result.docs.filter((d) => d.kind === "linked").map((d) => d.doc), ["doc-linked", "doc-linked-local"]);
      }
    }));

  it.effect("byte-identical with a fixed stamp; the Clock is read without one", () =>
    Effect.gen(function* () {
      const a = yield* build();
      const b = yield* build();
      assert.strictEqual(a.html, b.html);
      assert.include(a.html, "Generated FIXED by");
      const clock = yield* withStore(files(), () => buildSite({ sections }));
      assert.include(clock.html, "Generated 1970-01-01 00:00 UTC by"); // TestClock starts at 0
      assert.strictEqual(clock.html.replace("1970-01-01 00:00 UTC", "FIXED"), a.html);
    }));

  it.effect("validation errors: banner, footer counts, still a full page", () =>
    Effect.gen(function* () {
      const result = yield* build();
      assert.isAbove(result.errors.length, 0); // s.unverified is `done` without the required evidence
      assert.include(result.html, 'id="validation-banner"');
      assert.include(result.html, "s.unverified");
      assert.include(result.html, "Records: 5 sources, 9 requirements (8 checks, 1 guidelines), 1 apps, 6 tracking records, 1 conflicts (1 open)");
      const clean = yield* withStore(baseFiles(), () => buildSite({ sections: [], stamp: "FIXED" }));
      assert.strictEqual(clean.errors.length, 0);
      assert.notInclude(clean.html, 'id="validation-banner"');
      assert.include(clean.html, "Validation: ok");
    }));

  it.effect("the command writes the file, prints a summary, and exits 1 on validation errors", () =>
    withStore(files(), ({ dir }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const out = path.join(dir, "..", "out", "page.html");
        const command = makeBuildCommand({ dataDir: "/nonexistent/data", out: "/nonexistent/out.html" });
        const run = Command.runWith(command, { version: "0.0.0" });
        const error = yield* Effect.flip(run(["--data", dir, "--out", out, "--public", "--stamp", "FIXED"]));
        assert.strictEqual((error as { _tag?: string })._tag, "InvalidStore");
        const html = yield* fs.readFileString(out);
        assert.include(html, "Generated FIXED by");
        assert.notInclude(html, PRIVATE_PHRASE);
        assert.deepStrictEqual(yield* fs.readDirectory(path.dirname(out)), ["page.html"]);
        const printed = (yield* TestConsole.logLines).map(String).join("\n");
        // the command always uses the real manifest; none of its source ids exist in this fixture
        assert.include(printed, `built ${out} (public, `);
        assert.include(printed, "docs: 0 rendered, 0 linked only,");
        assert.include(printed, "no source record: sota-doc -> kb.sota");
        assert.match(printed, /validation: [1-9]\d* error\(s\)/);
      })));
});
