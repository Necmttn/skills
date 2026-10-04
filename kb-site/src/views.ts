/** View models: the JSON output shapes. `render.ts` turns the same values into text. */
import { Effect } from "effect";
import { type CompareCell, deriveItem, type DerivedItem, sortRequirements } from "./derive.ts";
import { Roots } from "./roots.ts";
import type { App, Conflict, KbData, Requirement } from "./schema.ts";

export interface RefView {
  readonly requirement: string;
  readonly source: string;
  readonly title: string | null;
  readonly kind: string | null;
  readonly root: string | null;
  readonly path: string | null;
  readonly locator?: string;
  readonly upstream_id?: string;
  readonly upstream_status?: string;
  readonly access: string | null;
  readonly license: string | null;
  readonly publishable: boolean | null;
  readonly availability: "available" | "url" | "unavailable";
  /** Absolute path on this machine, or the URL; `null` when unavailable. */
  readonly location: string | null;
  readonly reason?: string;
}

export const refViews = Effect.fn("views.refs")(function* (data: KbData, requirements: ReadonlyArray<Requirement>) {
  const roots = yield* Roots;
  const out: Array<RefView> = [];
  for (const r of sortRequirements(requirements)) {
    for (const ref of r.refs) {
      const source = data.sources.find((s) => s.id === ref.source);
      const base = {
        requirement: r.id,
        source: ref.source,
        title: source?.title ?? null,
        kind: source?.kind ?? null,
        root: source?.root ?? null,
        path: source?.path ?? null,
        ...(ref.locator === undefined ? {} : { locator: ref.locator }),
        ...(ref.upstream_id === undefined ? {} : { upstream_id: ref.upstream_id }),
        ...(ref.upstream_status === undefined ? {} : { upstream_status: ref.upstream_status }),
        access: source?.access ?? null,
        license: source?.license ?? null,
        publishable: source?.publishable ?? null,
      };
      if (!source) {
        out.push({ ...base, availability: "unavailable", location: null, reason: `source "${ref.source}" does not exist` });
        continue;
      }
      const resolved = yield* roots.resolve(source.root, source.path);
      out.push(
        resolved._tag === "url"
          ? { ...base, availability: "url", location: resolved.url }
          : resolved._tag === "available"
          ? { ...base, availability: "available", location: resolved.absolute }
          : { ...base, availability: "unavailable", location: null, reason: resolved.reason },
      );
    }
  }
  return out as ReadonlyArray<RefView>;
});

export interface ShowView {
  readonly requirement: Requirement;
  readonly conflicts: ReadonlyArray<Conflict | { readonly id: string; readonly missing: true }>;
  readonly refs: ReadonlyArray<RefView>;
  /** One cell per app: the derived state of this check. Empty for guidelines. */
  readonly apps: ReadonlyArray<{ readonly app: string } & CompareCell>;
  /** Only with `--app`. */
  readonly tracking?: DerivedItem;
}

export const showView = Effect.fn("views.show")(function* (data: KbData, requirement: Requirement, app?: App) {
  const refs = yield* refViews(data, [requirement]);
  const items = requirement.kind === "check"
    ? data.apps.map((a) => deriveItem(requirement, a, data.tracking.filter((t) => t.app === a.id)))
    : [];
  const view: ShowView = {
    requirement,
    conflicts: (requirement.conflicts ?? []).map((id) => data.conflicts.find((c) => c.id === id) ?? { id, missing: true as const }),
    refs,
    apps: items.map((i) => ({ app: i.app, state: i.state, ...(i.last_done === undefined ? {} : { last_done: i.last_done }) })),
    ...(app && requirement.kind === "check" ? { tracking: items.find((i) => i.app === app.id) as DerivedItem } : {}),
  };
  return view;
});
