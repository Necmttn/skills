import { BunServices } from "@effect/platform-bun";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import { SECTIONS } from "../../src/html/manifest.ts";
import { buildSite } from "../../src/html/site.ts";
import { Roots } from "../../src/roots.ts";
import { Store } from "../../src/store.ts";
import { REAL_DATA_ABSENT } from "../helpers.ts";

/** The real `kb-site/data` and the real manifest. SKIPPED while the data dir is absent (the store is private and may live elsewhere). */
describe.skipIf(REAL_DATA_ABSENT)("html view on the real data", () => {
  it.effect("builds, shows lockin-chinese, and every manifest doc has a source record", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dataDir = path.resolve(import.meta.dirname, "..", "..", "data");
      const layer = Layer.mergeAll(Store.layer(dataDir), Roots.layer(dataDir));
      const local = yield* buildSite({ stamp: "FIXED" }).pipe(Effect.provide(layer));
      assert.deepStrictEqual(local.unmapped, []);
      assert.strictEqual(local.docs.length, SECTIONS.flatMap((s) => s.docs).length);
      assert.include(local.html, 'id="trk-app-lockin-chinese"');
      assert.include(local.html, "lockin-chinese");
      assert.include(local.html, 'id="tracking"');

      // the public page never renders an unpublishable source, whatever roots this machine maps
      const pub = yield* buildSite({ stamp: "FIXED", publicOnly: true }).pipe(Effect.provide(layer));
      const loaded = yield* Store.use((s) => s.load).pipe(Effect.provide(layer));
      const publishable = new Set(loaded.data.sources.filter((s) => s.publishable).map((s) => s.id));
      for (const doc of pub.docs) if (doc.kind === "rendered") assert.isTrue(publishable.has(doc.source), doc.source);
    }).pipe(Effect.provide(BunServices.layer)), 60_000);
});
