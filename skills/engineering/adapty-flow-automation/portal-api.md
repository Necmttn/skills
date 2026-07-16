# Adapty portal API - endpoint map

Sniffed 2026-07-15 from app.adapty.io. **Unofficial and fragile.** Base:

```
https://api-admin.adapty.io/api/v1/portal/{app_id}/
```

Auth on every call: `Authorization: Bearer <token>` where token = `localStorage['adapty/token']` (see SKILL.md). Works with `credentials: 'omit'` - no cookies needed.

## Endpoints

Verified 200 with the localStorage bearer (app id used in testing: lockin-chinese `f46ecefd-3708-4e6e-bc4c-ebc5ec33af20`):

| Method | Path (under `portal/{app_id}/`) | Purpose |
|---|---|---|
| GET | `in-apps/flows/` | list flows |
| GET | `in-apps/flows/{flow_id}/` | flow meta |
| GET | `in-apps/flows/{flow_id}/config/` | **entire flow document** (see shape below) |
| PUT | `in-apps/flows/{flow_id}/config/` | overwrite flow document; optimistic-locked |
| POST | `in-apps/flows/{flow_id}/publish/` | **publish** (empty body `{}`) - the hidden step |
| GET | `in-apps/placements/` | list placements; each row has `type: "flow" \| ...` |
| GET | `in-apps/products/` | products |
| GET | `in-apps/paywalls/` | paywalls |
| GET | `in-apps/audiences/` | audiences |
| GET | `in-apps/onboardings/` | onboardings |
| GET | `in-apps/ab-tests/` | A/B tests |

Not found under `portal/{app_id}/`: `placements/`, `segments/`, `products/`, `paywalls/`, `audiences/`, `ab-tests/` (no `in-apps/` prefix) all 404 - the `in-apps/` prefix is load-bearing. Segments live on a different service path, not yet sniffed.

## Flow config document shape

`GET/PUT in-apps/flows/{flow_id}/config/` body:

```json
{
  "remote_configs": [{ "locale": "en", "data": "{}" }],
  "expected_updated_at": 1784100583765,
  "config": {
    "screens": [
      { "id": "scr_MYLvLPYE", "props": { "safeArea": true, "statusBarTheme": "system", "scrollable": true, "padding": "..." }, "...": "elements tree" }
    ]
  }
}
```

- `expected_updated_at` is an **optimistic lock**. Read it from the last GET and echo it on PUT; a stale value is rejected. Elements (product cards, buttons, triggers, product bindings) all live inside `config.screens[].`
- Editing = mutate this JSON and PUT it back. Product bindings and the purchase button's `products.selectedProduct` action are nodes in the elements tree - diff a before/after config to find the exact node paths for the flow you're automating.

## Placement row shape

`GET in-apps/placements/` → `{ "data": [ {row}, ... ] }`, row:

```json
{
  "title": "Activation Offer",
  "developer_id": "activation_offer",
  "placement_id": "ed9d3e39-162c-4253-9c80-8aa0b43b8f0f",
  "type": "flow",
  "is_active": true,
  "is_deleted": false,
  "updated_at": "2026-07-15T04:44:40Z",
  "created_at": "2026-07-15T04:44:40Z"
}
```

`developer_id` is the placement id the SDK fetches by (`getFlow(placementId:)`). Flow-type placement creation is `POST in-apps/placements/` (not yet body-captured - sniff it if you need to script placement creation).

## Re-sniffing when calls break

Paste into DevTools console on a logged-in app.adapty.io tab, then use the dashboard:

```js
window.__sniff = [];
const of = window.fetch;
window.fetch = async (...a) => {
  const u = typeof a[0]==='string'?a[0]:a[0].url;
  const m = (a[1]&&a[1].method) || (typeof a[0]==='object'&&a[0].method) || 'GET';
  let b = a[1]&&a[1].body; if (b && typeof b!=='string') b='[binary]';
  const r = await of(...a);
  if (u.includes('api-admin.adapty.io')) window.__sniff.push({m,u:u.replace('https://api-admin.adapty.io',''),s:r.status,b:typeof b==='string'?b.slice(0,300):null});
  return r;
};
'hooked - now click Save/Publish/etc, then read window.__sniff'
```

Also wrap XHR if a call is missing (the builder uses both). See git history of this repo for the full hook.

## Paywall remote config (sniffed 2026-07-16, dotself run)

`PUT in-apps/paywalls/{paywall_id}/` is **full-replace**: a body with only
`remote_configs` 400s with `title/use_paywall_builder/products: field required`.
GET the paywall document, swap `remote_configs`, PUT the whole thing back:

```json
{ "...": "everything from the GET", "remote_configs": [{ "locale": "en", "data": "<json string>" }] }
```

Paywalls + paywall-type placements + audiences are all creatable via the
official `bunx adapty` CLI (`paywalls create`, `placements create --audiences
'[{"segment_ids":[...],"paywall_id":"...","priority":0}]'`) - priority 0 = top
audience. Product index order in `paywalls create` = SDK display order.

**Segments have no CLI/API create surface** (CLI is list-only; portal path not
found) - create via dashboard UI: Profiles & Segments → Segments → Create, and
"Create custom attribute" inline (name/key/type/enumerated values).

## SDK paywall variations verify (paywall-type placements)

```
GET https://api.adapty.io/api/v1/sdk/in-apps/{pk_prefix}/paywall/variations/{placement_developer_id}/{md5(profile_id)}/
Authorization: Api-Key {full_public_key}
adapty-sdk-version: 3.4.0
adapty-sdk-profile-id: {profile_id}
adapty-profile-segment-hash: {segment_hash}
adapty-paywall-locale: en
adapty-paywall-builder-version: 3
```

- Profile must exist: `POST /api/v1/sdk/analytics/profiles/{profile_id}/` with
  `{"data":{"id":"...","type":"adapty_analytics_profile","attributes":{"store":"app_store","custom_attributes":{...}}}}`
  (Content-Type `application/vnd.api+json`). The response's
  `data.attributes.segment_hash` is the required header value.
- Responses are cached per profile hash: a profile fetched BEFORE a custom
  attribute write can keep serving its old audience's variation long after.
  Verify segment routing with a fresh profile whose attributes are set at
  create time.

## Token extraction vs browser guard

The Chrome extension may block returning the raw `localStorage['adapty/token']`
string to the agent (base64-exfil guard). Don't fight it: run the portal fetch
calls inside the page context (`javascript_tool`), reading the token from
localStorage in-page so it never leaves the browser.
