---
name: adapty-flow-automation
description: Automate Adapty Flows (v4 Beta) and paywall/placement config that the official CLI and public API can't reach - flow authoring, publishing, flow-type placements - by driving Adapty's internal dashboard "portal" API with a headless-capable bearer token. Use when the user wants to script Adapty flow create/edit/publish, wire flow placements, treat a flow as versioned code, verify a flow actually went live, or asks why an Adapty v4 flow renders the native fallback instead of the remote flow.
---

# Automating Adapty Flows

Adapty has **three** API surfaces plus one undocumented internal one. Flows (v4 Beta) live only in the internal one. Pick the surface by task; don't reach for the browser when a real API covers it.

| Surface | Base / Auth | Covers | Spec |
|---|---|---|---|
| **Server-side v2** | `api.adapty.io` / `Api-Key <secret>` | profiles, **grant access level** (Rescue-Pass leaf), transactions, analytics export | [Postman collection](https://adapty.io/docs/server-side-api-specs) |
| **Developer (CLI)** | `api-admin.adapty.io/api/v1/developer` / oauth bearer | apps, products, paywalls, **paywall-type** placements, access-levels, segments (read-only) | none published; zod schemas in `adapty` npm pkg `dist/lib/api-schemas.js` |
| **SDK read** | `api.adapty.io/api/v1/sdk/...` / `Api-Key <public>` | placement variation fetch - **publish verification** | undocumented, stable |
| **Portal (internal)** | `api-admin.adapty.io/api/v1/portal/{app_id}/` / dashboard bearer | **flows author + publish**, flow-type placements, everything the builder does | none - sniffed, fragile |

Full portal endpoint map + request shapes: [portal-api.md](portal-api.md).
The four gotchas that make a v4 flow silently fall back to native: [flow-gotchas.md](flow-gotchas.md).

## Decision: which surface

- Grant/revoke entitlement, profile ops → **server-side v2** (secret key). Documented, stable, safe for backend.
- Products, paywalls, **paywall-type** placements CRUD → **developer API** via `bunx adapty` CLI (`adapty auth login` once). No flows here.
- Flow create/edit/**publish**, **flow-type** placements → **portal API** (this skill's core). Nothing official reaches these.
- "Did my flow actually go live?" → **SDK read endpoint**, always. See Verify below.

## Portal auth (the unlock)

The dashboard authenticates portal calls with a bearer token in **localStorage**, not a cookie - so once extracted it works fully headless (`credentials: 'omit'` returns 200). The CLI's oauth token is a **different realm** and 401s on portal.

Extract once per session, from a logged-in app.adapty.io tab:

```js
localStorage.getItem('adapty/token')   // 40-char opaque string
```

Then every portal call:

```
Authorization: Bearer <token>
```

Token is session-scoped (a `fox_auth_timestamp` refresh mechanism exists); expect to re-extract when calls start 401ing.

## Flow-as-code pipeline

The entire flow - screens, elements, props, product bindings, triggers - is **one JSON document** at `GET/PUT in-apps/flows/{flow_id}/config/`, guarded by an optimistic-lock field `expected_updated_at`.

1. **Pull** `GET .../config/` → commit the JSON to the repo. The flow is now a versioned artifact.
2. **Edit** locally (copy tweaks, product ids, A/B variants), keep `expected_updated_at` from the last GET.
3. **Push** `PUT .../config/`.
4. **Publish** `POST in-apps/flows/{flow_id}/publish/` (empty body). This is the step the builder hides behind a confirmation modal - miss it and the draft never goes live while the UI reads "Changes saved".
5. **Verify** (below). Never trust the publish response alone.

## Verify a flow is live (do this after EVERY mutation)

Hit the public SDK read endpoint with the app's **public** key:

```
GET https://api.adapty.io/api/v1/sdk/in-apps/{public_key}/flow/variations/{placement_id}/{profile_hash}/
Authorization: Api-Key {public_key}.{public_secret}
adapty-sdk-version: 4.0.0
```

- `flow_version_id` must **change** after a publish.
- `variations` array must be **non-empty**. Empty ⇒ the SDK maps it to zero `flow.paywalls` ⇒ `getPaywallProducts` throws `noProductIDsFound` ⇒ the app silently renders its native fallback. This is the single most common "why isn't my flow showing" cause.

Poll it in a loop after publish; CDN propagation is a few seconds.

## Safety

- Portal API is **unofficial** - Adapty can change request shapes on any dashboard release. Pin exact shapes, re-sniff if calls break (open app.adapty.io, DevTools → Network, filter `api-admin`, or re-run the fetch-hook in [portal-api.md](portal-api.md)).
- Always run the SDK-endpoint verify after a portal mutation. Treat a green publish response as unproven until `variations` is non-empty.
- Flow placements on a **live** SDK key affect real users the moment they publish. On an unreleased app that's harmless; before launch, repoint/delete test placements.
