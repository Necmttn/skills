# Why an Adapty v4 flow renders the native fallback

Four independent blockers, each of which produces the SAME symptom - the app shows its native paywall instead of the remote flow - and none is visible from app logs alone. Check them in this order.

## 1. Placement doesn't exist / wrong type

The SDK fetches by **placement id**, not flow name. Flow placements live in Dashboard → Placements → **Flows tab** - a separate namespace from paywall placements. A paywall-type placement with the same id will 404 on `getFlow`.

- Symptom in SDK log: `GET .../flow/variations/{placement}/... → 404 "Placement Not Found"`.
- Fix: create a **flow-type** placement whose `developer_id` matches what the app requests. Portal: `POST in-apps/placements/`. CLI cannot create flow placements.

## 2. Flow published as draft only (the publish-modal trap)

"Publish to Live" in the builder opens a **confirmation modal** ("Publish changes?"). Clicking the top-bar button alone only saves a draft, while the UI shows "Changes saved" / "Draft saved - live version remains unchanged". The live flow stays empty.

- Symptom: SDK fetch 200s but `variations: []` → `getPaywallProducts` throws `noProductIDsFound` → native fallback.
- Fix: complete the modal (`POST in-apps/flows/{id}/publish/` when scripting). **Verify** with the SDK read endpoint: `flow_version_id` changed AND `variations` non-empty. See SKILL.md → Verify.

## 3. Template price rows are decorative

Flow templates (e.g. the FORGE fitness template) ship product **rows that are not product cards** - plain text, no product binding. `getPaywallProducts` returns nothing.

- Fix in builder: insert `+ → Products → <preset>` (Vertical List is standard). Each product card gets a real Adapty product via the **Design tab** dropdown. Set one as default. Point the purchase button's On-Tap → Purchase action at `products.selectedProduct`. When scripting, these are nodes in the flow config JSON (see portal-api.md).
- The Products panel (bag icon) should list your products once bound; "No products in this flow yet" means the cards are still decorative.

## 4. App code deliberately forces native for that placement

Independent of Adapty: the app may guard a placement to always render native. In lockin-chinese, `PaywallCoordinator.load()` has `placementId != activationOfferPlacement` in its remote-render condition - a truthfulness decision (trial copy must come from StoreKit metadata, not dashboard-authored strings that can drift). `main`/`onboarding` are the sanctioned remote placements there.

- Symptom: SDK fetch succeeds, `variations` non-empty, but still native. It's the client, not Adapty.
- Fix: temporary local bypass to eyeball a flow; the guard is intentional for shipping.

## Other traps

- **Offer shown once per install** (durable flag). Retest requires `simctl uninstall` + reinstall, not just relaunch.
- **Font not bundled**: flow uses IBMPlexSans by default; if the app doesn't ship it, the flow renders in a fallback system font. Publish modal warns about this.
- **Product parity**: a product bound in the flow but absent from the app's local `.storekit` config fails to purchase in the simulator.
- **CDN propagation**: after publish, the SDK variation endpoint takes a few seconds to reflect the new `flow_version_id`. Poll, don't single-shot.
