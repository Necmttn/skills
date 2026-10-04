/** Small labelled marks. Every mark carries its meaning as text; color and shape only reinforce it. */
import type { CompareCell, DerivedState } from "../derive.ts";
import { cellText } from "../render.ts";
import { esc, token } from "./escape.ts";

/** Completion of a check for one app. Round chip, label = the derived state word the CLI prints. */
export const stateChip = (cell: CompareCell): string =>
  cell.last_done === undefined
    ? `<span class="chip st-${cell.state}">${cell.state}</span>`
    : `<span class="chip st-${cell.state}" title="${esc(cellText(cell))}">${cell.state} <small>(last done ${esc(cell.last_done)})</small></span>`;

export const stateLabelChip = (state: DerivedState): string => `<span class="chip st-${state}">${state}</span>`;

/** Acceptance of the RULE. Square tag with a "rule:" prefix so it is never read as app completion. */
export const acceptanceBadge = (acceptance: string): string =>
  `<span class="acc acc-${token(acceptance)}" title="rule acceptance: ${esc(acceptance)} (says nothing about any app)">${esc(acceptance)}</span>`;

export const accessLabel = (access: string | null, license: string | null): string => {
  if (access === null) return "unknown source";
  if (access === "vendored") return license === null ? "vendored, no license" : `vendored ${license}`;
  return access;
};

const OPEN_ACCESS = ["repo", "vendored", "public-url"];

/** Access / license boundary of a source, shown on every doc header and reference. */
export const accessBadge = (access: string | null, license: string | null, publishable: boolean | null): string => {
  const openKind = access !== null && OPEN_ACCESS.includes(access);
  const open = openKind && publishable === true;
  const title = `access: ${access ?? "unknown"}; license: ${license ?? "none"}; ${publishable === true ? "publishable" : "not publishable"}`;
  const label = accessLabel(access, license) + (openKind && publishable !== true ? " · not publishable" : "");
  return `<span class="access ${open ? "access-open" : "access-private"}" title="${esc(title)}">${esc(label)}</span>`;
};

export const marker = (text: string, kind = ""): string => `<span class="marker${kind === "" ? "" : ` marker-${token(kind)}`}">${esc(text)}</span>`;
