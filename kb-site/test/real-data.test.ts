import { BunServices } from "@effect/platform-bun";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Path } from "effect";
import { REAL_DATA_ABSENT } from "./helpers.ts";
import { errorsOf, formatIssue } from "../src/issue.ts";
import { Store } from "../src/store.ts";

/** The real `kb-site/data`. SKIPPED when it is absent: the code may live in a public repository, the store in a private one. */
describe.skipIf(REAL_DATA_ABSENT)("real data", () => {
  it.effect("kb-site/data has zero validation errors", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const dataDir = path.resolve(import.meta.dirname, "..", "data");
      const issues = yield* Store.use((s) => s.validate).pipe(Effect.provide(Store.layer(dataDir)));
      assert.deepStrictEqual(errorsOf(issues).map(formatIssue), []);
    }).pipe(Effect.provide(BunServices.layer)));
});
