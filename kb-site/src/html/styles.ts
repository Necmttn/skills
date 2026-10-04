/** Page CSS. The first block is the original design; the Tracking block extends it with the same tokens. */
export const CSS = `
:root {
  --bg: #faf7f1; --surface: #fffdf9; --text: #1c1917; --muted: #6f6759;
  --border: #e5ddcd; --accent: #b03a2e; --accent-ink: #fffdf9; --code-bg: #f1ece1;
  --ok: #2f6b3c; --ok-ink: #fffdf9; --warn: #8a5a00; --bad: #8c1d18; --bad-ink: #fffdf9; --info: #1f5a86;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171310; --surface: #1e1913; --text: #e9e2d4; --muted: #9a917f;
    --border: #37312a; --accent: #d05a48; --accent-ink: #171310; --code-bg: #2a251d;
    --ok: #7fbf8c; --ok-ink: #171310; --warn: #d9a441; --bad: #e0776f; --bad-ink: #171310; --info: #7db4dc;
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
.hidden { display: none !important; }
#noresults { color: var(--muted); font-style: italic; display: none; }
.deadlink { border-bottom: 1px dotted var(--muted); }

/* ---- access boundary ---- */
.access {
  display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; padding: 1px 7px;
  border: 1px solid var(--border); border-radius: 4px; color: var(--muted); background: var(--surface);
  vertical-align: 1px; white-space: nowrap;
}
.access-private { border-color: var(--bad); color: var(--bad); }
.access-open { border-color: var(--ok); color: var(--ok); }
.citation {
  background: var(--surface); border: 1px dashed var(--border); border-radius: 10px; padding: 12px 16px; margin: 8px 0;
  font-size: 14.5px;
}
.citation p { margin: 4px 0; }
.banner {
  border: 2px solid var(--bad); background: var(--surface); color: var(--text); border-radius: 10px;
  padding: 12px 16px; margin: 0 0 28px; font-size: 14.5px;
}
.banner strong { color: var(--bad); }
.banner ul { margin: 6px 0 0; padding-left: 20px; }
.banner-public { border-color: var(--info); }
.banner-public strong { color: var(--info); }

/* ---- tracking ---- */
#tracking { font-size: 14.5px; }
.filters { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: end; margin: 0 0 24px; }
.filters label { display: flex; flex-direction: column; font-size: 11.5px; color: var(--muted); letter-spacing: 0.04em; }
.filters select, .filters button {
  font: inherit; font-size: 13.5px; padding: 5px 8px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface); color: var(--text);
}
.filters button { cursor: pointer; }
#filter-count { font-size: 12.5px; color: var(--muted); align-self: center; }
.chip {
  display: inline-block; font-size: 11.5px; font-weight: 600; line-height: 1.5; padding: 0 7px; border-radius: 99px;
  border: 1px solid var(--border); white-space: nowrap; color: var(--muted); background: transparent;
}
.chip::before { margin-right: 4px; font-weight: 700; }
.st-complete { background: var(--ok); border-color: var(--ok); color: var(--ok-ink); }
.st-complete::before { content: "\\2713"; }
.st-stale { border: 1px dashed var(--warn); color: var(--warn); }
.st-stale::before { content: "\\21BB"; }
.st-blocked { background: var(--bad); border-color: var(--bad); color: var(--bad-ink); border-radius: 3px; }
.st-blocked::before { content: "\\25A0"; }
.st-unverified { border: 1px solid var(--warn); color: var(--warn); border-radius: 3px; }
.st-unverified::before { content: "?"; }
.st-in_progress { border-color: var(--info); color: var(--info); }
.st-in_progress::before { content: "\\25D0"; }
.st-todo { color: var(--text); }
.st-todo::before { content: "\\25CB"; }
.st-excluded { border-style: dotted; color: var(--muted); font-weight: 400; }
.st-excluded::before { content: "\\2013"; }
.st-retired { text-decoration: line-through; color: var(--muted); font-weight: 400; border-color: transparent; }
.chip small { font-weight: 400; font-size: 10.5px; }
/* rule acceptance: square tag with a "rule" prefix, never a round chip */
.acc {
  display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0 6px; border-radius: 2px; border: 1px solid var(--text); color: var(--text); white-space: nowrap;
}
.acc::before { content: "rule: "; font-weight: 400; opacity: 0.7; }
.acc-candidate { border-style: dashed; color: var(--muted); border-color: var(--muted); }
.acc-decided { }
.acc-verified { background: var(--text); color: var(--bg); }
.acc-retired { text-decoration: line-through; color: var(--muted); border-color: var(--border); }
.marker {
  display: inline-block; font-size: 10.5px; letter-spacing: 0.04em; padding: 0 5px; border-radius: 2px;
  background: var(--code-bg); color: var(--muted); white-space: nowrap;
}
.marker-gate { color: var(--accent); }
table.trk { width: 100%; font-size: 13px; table-layout: auto; min-width: 640px; }
table.trk th, table.trk td { padding: 4px 8px; }
table.trk th.app-col, table.trk td.cell { text-align: center; min-width: 96px; }
table.trk td.req-cell a { color: var(--text); font-weight: 600; }
table.trk td.req-cell code { font-size: 11px; background: none; padding: 0; color: var(--muted); }
table.trk td code { white-space: nowrap; }
table.trk td.req-cell { min-width: 260px; }
table.trk tr.trk-app-row td:nth-child(-n+2) { white-space: nowrap; }
table.trk td.num { text-align: right; font-variant-numeric: tabular-nums; }
.bar { display: flex; width: 140px; height: 9px; border: 1px solid var(--border); border-radius: 99px; overflow: hidden; background: var(--code-bg); }
.bar span { display: block; height: 100%; }
.bar .b-complete { background: var(--ok); }
.bar .b-stale, .bar .b-unverified { background: var(--warn); }
.bar .b-blocked { background: var(--bad); }
.bar .b-in_progress { background: var(--info); }
.bar-label { font-size: 11.5px; color: var(--muted); }
details.fold { border: 1px solid var(--border); border-radius: 10px; margin: 10px 0; background: var(--surface); }
details.fold > summary {
  cursor: pointer; padding: 8px 14px; font-weight: 600; list-style-position: inside;
  font-family: "Iowan Old Style", "Palatino", Georgia, serif; font-size: 16px;
}
details.fold > summary .muted { font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; font-size: 12.5px; font-weight: 400; }
details.fold > .fold-body { padding: 0 14px 10px; }
details.fold details.fold { background: transparent; }
.trk-item { border-top: 1px solid var(--border); padding: 8px 0; }
.trk-item:first-child { border-top: none; }
.trk-item .head { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: baseline; }
.trk-item .head a.title { color: var(--text); font-weight: 600; }
.trk-item .meta, .req .meta { font-size: 12.5px; color: var(--muted); margin: 2px 0; }
.trk-item .notes { margin: 4px 0; white-space: pre-wrap; }
.trk-item .review { margin: 4px 0; color: var(--warn); font-weight: 600; }
.trk-item ul.evidence, .req ul.refs, .conflict ul.sides { margin: 4px 0; padding-left: 20px; font-size: 13.5px; }
.req { border-top: 1px solid var(--border); padding: 12px 0; }
.req:first-child { border-top: none; }
.req h3 { margin: 0 0 4px; font-size: 16px; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: baseline; }
.req h3 code { font-size: 12px; }
.req dl { margin: 6px 0; display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; }
.req dt { color: var(--muted); font-size: 12.5px; }
.req dd { margin: 0; white-space: pre-wrap; }
.req .states { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 12px; color: var(--muted); }
.conflict { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; margin: 10px 0; }
.conflict h3 { margin: 2px 0 4px; font-size: 15.5px; display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: baseline; }
.conflict-open { border-left: 3px solid var(--warn); }
:target { scroll-margin-top: 12px; }
.req:target, .conflict:target, .trk-item:target { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
@media (max-width: 900px) {
  .layout { flex-direction: column; }
  nav { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid var(--border); }
  main { padding: 24px 20px 60px; }
}
`;
