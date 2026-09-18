/**
 * The prose manifest: sections, order and titles of the knowledge browser.
 * Each doc names a SOURCE ID from `data/sources.jsonl`; the path comes from that record and resolves
 * through `Roots`. No path lives here.
 */
export interface ManifestDoc {
  /** Anchor id in the page. */
  readonly id: string;
  readonly title: string;
  /** `id` of a record in `data/sources.jsonl`. */
  readonly source: string;
  readonly special?: "sota" | "experiments";
}

export interface ManifestSection {
  readonly id: string;
  readonly title: string;
  readonly docs: ReadonlyArray<ManifestDoc>;
}

export const SECTIONS: ReadonlyArray<ManifestSection> = [
  {
    id: "sota",
    title: "Current SOTA",
    docs: [{ id: "sota-doc", title: "Verdicts by domain", source: "kb.sota", special: "sota" }],
  },
  {
    id: "experiments",
    title: "Experiments",
    docs: [{ id: "experiments-doc", title: "Our experiment ledger", source: "kb.experiments", special: "experiments" }],
  },
  {
    id: "ideas",
    title: "Idea Selection",
    docs: [
      { id: "idea-roast", title: "Idea Roast (negative checklist)", source: "kb.idea-roast" },
      { id: "rork-upstream", title: "rork-guide: provenance (third-party)", source: "kb.external.rork-guide.upstream" },
      { id: "rork-guide", title: "rork-guide: the $0 -> $10k/mo consumer-app playbook", source: "kb.external.rork-guide.guide" },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    docs: [
      { id: "onb-patterns", title: "Patterns (P1-P17)", source: "skills.mobile-onboarding-catalog.skill" },
      { id: "onb-catalog", title: "App catalog + benchmarks", source: "skills.mobile-onboarding-catalog.catalog" },
      { id: "onb-screens", title: "Screen wireframes", source: "skills.mobile-onboarding-catalog.screens" },
    ],
  },
  {
    id: "paywalls",
    title: "Paywalls",
    docs: [{ id: "pw-playbook", title: "Paywall experiments playbook", source: "apps.playbook.paywall-experiments" }],
  },
  {
    id: "ux",
    title: "UX Psychology",
    docs: [
      { id: "ux-rules", title: "The twelve rules", source: "skills.ux-psychology.skill" },
      { id: "ux-reference", title: "Reference + evidence", source: "skills.ux-psychology.reference" },
    ],
  },
  {
    id: "design",
    title: "Design",
    docs: [{ id: "design-law", title: "Lock In Chinese DESIGN.md (law)", source: "apps.lockin-chinese.design" }],
  },
  {
    id: "motion",
    title: "Motion",
    docs: [{ id: "motion-skill", title: "Motion principles (the twelve, UI rules)", source: "skills.motion-principles.skill" }],
  },
  {
    id: "aso",
    title: "ASO & Localization",
    docs: [
      { id: "aso-lockin", title: "Lock In Chinese ASO playbook", source: "apps.playbook.aso-lockin-chinese" },
      { id: "aso-vibe-upstream", title: "vibe-aso: provenance (third-party, MIT)", source: "kb.external.vibe-aso.upstream" },
      { id: "aso-vibe-map", title: "vibe-aso: six-phase map + cross-phase laws", source: "kb.external.vibe-aso.skill" },
      { id: "aso-vibe-keywords", title: "vibe-aso: keyword research (phase 1)", source: "kb.external.vibe-aso.keyword-research" },
      { id: "aso-vibe-metadata", title: "vibe-aso: 50-locale metadata (phase 2)", source: "kb.external.vibe-aso.metadata" },
      { id: "aso-vibe-screenshots", title: "vibe-aso: localized screenshots (phase 3)", source: "kb.external.vibe-aso.screenshots" },
      { id: "aso-vibe-pricing", title: "vibe-aso: worldwide pricing (phase 4)", source: "kb.external.vibe-aso.pricing" },
      { id: "aso-vibe-inapp", title: "vibe-aso: in-app localization (phase 5)", source: "kb.external.vibe-aso.app-localization" },
      { id: "asosk-upstream", title: "aso-skills: provenance + what is mirrored (third-party, MIT)", source: "kb.external.aso-skills.upstream" },
      { id: "asosk-cpp", title: "aso-skills: Custom Product Pages (35 variants)", source: "kb.external.aso-skills.custom-product-pages" },
      { id: "asosk-events", title: "aso-skills: In-App Events (Today tab, search cards)", source: "kb.external.aso-skills.in-app-events" },
      { id: "asosk-ppo", title: "aso-skills: PPO A/B testing the product page", source: "kb.external.aso-skills.ab-test-store-listing" },
      { id: "asosk-screens", title: "aso-skills: screenshot optimization", source: "kb.external.aso-skills.screenshot-optimization" },
      { id: "asosk-preview", title: "aso-skills: App Preview video", source: "kb.external.aso-skills.app-preview-video" },
      { id: "asosk-featured", title: "aso-skills: getting featured", source: "kb.external.aso-skills.app-store-featured" },
      { id: "asosk-launch", title: "aso-skills: app launch sequence", source: "kb.external.aso-skills.app-launch" },
    ],
  },
  {
    id: "shipping",
    title: "Shipping",
    docs: [
      { id: "ship-sop", title: "Ship SOP (phases + owner gates)", source: "kb.shipping" },
      { id: "ship-lockin-launch", title: "Lock In Chinese launch checklist", source: "apps.lockin-chinese.launch-checklist" },
      { id: "ship-lockin-state", title: "Lock In Chinese submission state", source: "apps.lockin-chinese.app-store-submission" },
      { id: "ship-lang-readiness", title: "Language-app launch readiness", source: "apps.playbook.lockin-language-launch-readiness" },
      { id: "ship-new-app", title: "New-app playbook (template kit)", source: "apps.playbook.new-app" },
      { id: "ship-asc-bootstrap", title: "ASC bootstrap recipes", source: "apps.playbook.asc-bootstrap" },
    ],
  },
  {
    id: "appreview",
    title: "App Review",
    docs: [
      { id: "rejections", title: "Rejection ledger", source: "kb.rejections", special: "experiments" },
      { id: "submission-gate", title: "Submission playbook (the gate)", source: "apps.playbook.app-store-submission" },
      { id: "rej-family-controls", title: "Evidence: 2.5.1 Family Controls (2026-08-04)", source: "apps.lockin-chinese.review.family-controls-rejection" },
      { id: "rej-skip-trial", title: "Evidence: 3.1.2(c) skip-trial toggle (2026-08-12)", source: "apps.lockin-chinese.review.skip-trial-toggle-rejection" },
      { id: "aso-vibe-submit", title: "vibe-aso: ASC field checklist, API vs manual (third-party)", source: "kb.external.vibe-aso.submission-checklist" },
      { id: "asosk-rejection", title: "aso-skills: rejection recovery by guideline (third-party)", source: "kb.external.aso-skills.app-rejection-recovery" },
    ],
  },
  {
    id: "tooling",
    title: "Tooling",
    docs: [
      { id: "iter-loop", title: "Mobile iteration loop (tests, caches, seeded launch, AXe, merges)", source: "apps.playbook.mobile-iteration-loop" },
      { id: "sim-test", title: "sim-test skill (simulator workflow, AXe via XcodeBuildMCP or CLI)", source: "home-skills.sim-test" },
      { id: "axe-skill", title: "axe skill: CLI contract (third-party, installed by `axe init`)", source: "home-skills.axe" },
      { id: "xcodebuildmcp-skill", title: "xcodebuildmcp skill: MCP session protocol (official, installed by `xcodebuildmcp init`)", source: "home-skills.xcodebuildmcp" },
    ],
  },
  {
    id: "paid-ua",
    title: "Paid UA",
    docs: [
      { id: "scrapecreators", title: "ScrapeCreators: competitor ad downloads", source: "skills.scrapecreators.skill" },
      { id: "scrapecreators-lockin", title: "ScrapeCreators: verified Lock In collection", source: "skills.scrapecreators.lockin-test" },
      { id: "ua-skills-upstream", title: "ua-skills: notes on a third-party paid-growth pack (link only)", source: "kb.external.ua-skills.upstream" },
      // Not in the old manifest: the upstream itself, a linked-only source. Rendered as a link + our notes, never fetched.
      { id: "ua-skills-link", title: "ua-skills: upstream repository (linked only)", source: "url.ua-skills" },
    ],
  },
  {
    id: "growth",
    title: "Growth & Analytics",
    docs: [
      { id: "growth-ops", title: "Growth-ops operating system", source: "apps.playbook.growth-ops" },
      { id: "growth-tricks", title: "Growth tricks", source: "apps.playbook.growth-tricks" },
      { id: "analytics", title: "Analytics per app", source: "apps.playbook.analytics-per-app" },
    ],
  },
];
