/**
 * Browser script of the page, shipped inline. No framework, works from file://.
 * Must never contain the character sequence that closes a script element.
 *
 * Filter units: `.chunk, .verdict, .card` (prose) and `.unit` (tracking rows, items, requirements, conflicts).
 * Facets read `data-phase`, `data-cadence`, `data-acceptance`, and either `data-cells` ("app:state app:state")
 * or `data-app` + `data-state`. A unit without an attribute is not touched by that facet.
 */
export const CLIENT_SCRIPT = `
(function () {
  var byId = function (id) { return document.getElementById(id); };
  var all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var UNIT = ".chunk, .verdict, .card, .unit";
  var input = byId("search");
  var units = all(UNIT);
  var docs = all("article.doc");
  var sections = all(".kb-section");
  var folds = all("details.fold");
  var appCols = all("[data-col-app]");
  var rows = all("tr.trk-row");
  var facetIds = { app: "f-app", phase: "f-phase", state: "f-state", cadence: "f-cadence", acceptance: "f-acceptance" };
  var counter = byId("filter-count");

  function facets() {
    var f = {};
    for (var k in facetIds) { var el = byId(facetIds[k]); f[k] = el ? el.value : ""; }
    return f;
  }
  function facetOk(u, f) {
    var d = u.dataset;
    if (f.phase && d.phase !== undefined && d.phase !== f.phase) return false;
    if (f.cadence && d.cadence !== undefined && d.cadence !== f.cadence) return false;
    if (f.acceptance && d.acceptance !== undefined && d.acceptance !== f.acceptance) return false;
    if (d.cells !== undefined) {
      if (d.cells === "") return !f.state;
      if (f.app || f.state) {
        return d.cells.split(" ").some(function (c) {
          var i = c.lastIndexOf(":");
          return (!f.app || c.slice(0, i) === f.app) && (!f.state || c.slice(i + 1) === f.state);
        });
      }
      return true;
    }
    if (f.app && d.app !== undefined && d.app !== f.app) return false;
    if (f.state && d.state !== undefined && d.state !== f.state) return false;
    return true;
  }
  function applyFilter() {
    var q = input.value.trim().toLowerCase();
    var f = facets();
    var active = q !== "" || !!(f.app || f.phase || f.state || f.cadence || f.acceptance);
    units.forEach(function (u) {
      var ok = facetOk(u, f) && (q === "" || u.textContent.toLowerCase().indexOf(q) !== -1);
      u.classList.toggle("hidden", !ok);
    });
    appCols.forEach(function (c) { c.classList.toggle("hidden", !!f.app && c.getAttribute("data-col-app") !== f.app); });
    folds.forEach(function (d) {
      var any = all(UNIT, d).some(function (u) { return !u.classList.contains("hidden"); });
      d.classList.toggle("hidden", active && !any);
      if (active && any && !d.open) { d.open = true; d.setAttribute("data-auto", "1"); }
      if (!active && d.getAttribute("data-auto")) { d.open = false; d.removeAttribute("data-auto"); }
    });
    docs.forEach(function (d) {
      var own = all(UNIT, d);
      var any = own.some(function (u) { return !u.classList.contains("hidden"); }) ||
        (own.length === 0 && (q === "" || d.textContent.toLowerCase().indexOf(q) !== -1));
      d.classList.toggle("hidden", !any);
    });
    sections.forEach(function (s) {
      var any = all("article.doc", s).some(function (d) { return !d.classList.contains("hidden"); });
      s.classList.toggle("hidden", !any);
    });
    byId("noresults").style.display =
      sections.every(function (s) { return s.classList.contains("hidden"); }) ? "block" : "none";
    if (counter) {
      var shown = rows.filter(function (r) { return !r.classList.contains("hidden"); }).length;
      counter.textContent = active ? shown + " of " + rows.length + " checks match" : rows.length + " checks";
    }
  }
  function reveal() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = byId(id);
    if (!el) return;
    for (var p = el; p; p = p.parentElement) if (p.tagName === "DETAILS") p.open = true;
    el.scrollIntoView();
  }
  input.addEventListener("input", applyFilter);
  for (var k in facetIds) { var el = byId(facetIds[k]); if (el) el.addEventListener("change", applyFilter); }
  var reset = byId("f-reset");
  if (reset) reset.addEventListener("click", function () {
    for (var k in facetIds) { var el = byId(facetIds[k]); if (el) el.value = ""; }
    input.value = "";
    applyFilter();
  });
  document.addEventListener("keydown", function (e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (e.key === "/" && document.activeElement !== input && tag !== "SELECT") { e.preventDefault(); input.focus(); }
    if (e.key === "Escape" && document.activeElement === input) { input.value = ""; applyFilter(); input.blur(); }
  });
  window.addEventListener("hashchange", reveal);
  applyFilter();
  reveal();
})();
`;
