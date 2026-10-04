/** Escaping for the HTML view. Record text is collaborator-editable: every value goes through `esc`. */

/** Escape for both text content and double- or single-quoted attribute values. */
export const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const SAFE_SCHEME = /^(https?:\/\/|mailto:)/i;

/** Only http, https and mailto become links. Anything else (`javascript:`, `data:`, paths) is shown as text. */
export const isSafeHref = (href: string): boolean => SAFE_SCHEME.test(href.trim());

/** In-page anchors are safe as well; used by the markdown renderer. */
export const isSafeOrAnchor = (href: string): boolean => isSafeHref(href) || /^#[^\s]*$/.test(href.trim());

/** `<a>` for a safe href, `<code>` otherwise. `text` defaults to the href. */
export const linkOrCode = (href: string, text?: string): string =>
  isSafeHref(href)
    ? `<a href="${esc(href.trim())}" target="_blank" rel="noopener noreferrer">${esc(text ?? href)}</a>`
    : `<code>${esc(text ?? href)}</code>`;

/** A value that is safe inside an `id`, a class name, or a `data-*` token list. */
export const token = (s: string): string => s.replace(/[^A-Za-z0-9._-]/g, "_");
