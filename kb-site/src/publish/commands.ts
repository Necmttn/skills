/** `kb publish --out <dir>`: prepare a bundle; publish nothing. */
import { Console, Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { jsonFlag, Reported } from "../commands.ts";
import * as Render from "../render.ts";
import { Git } from "../sync/git.ts";
import { publish, renderPublish } from "./publish.ts";

export const publishCommand = Command.make(
  "publish",
  {
    out: Flag.string("out").pipe(Flag.withDescription("Empty directory OUTSIDE the repository that receives the bundle")),
    force: Flag.boolean("force").pipe(Flag.withDefault(false), Flag.withDescription("Replace a previous bundle (a directory that holds MANIFEST.json)")),
    json: jsonFlag,
  },
  ({ out, force, json }) =>
    publish({ out, force }).pipe(
      Effect.flatMap((r) =>
        Effect.gen(function* () {
          if (json) yield* Console.log(Render.json({ out: r.out, ...r.manifest }));
          else if (r.manifest.ok) yield* Console.log(renderPublish(r.out, r.manifest));
          else yield* Console.error(renderPublish(r.out, r.manifest));
          if (!r.manifest.ok) return yield* new Reported({ issues: [] });
        })
      ),
      Effect.catchTag("PublishRefused", (e) =>
        (json ? Console.log(Render.json({ ok: false, errors: [{ message: e.message }] })) : Console.error(`error: ${e.message}`)).pipe(
          Effect.andThen(Effect.fail(new Reported({ issues: [] }))),
        )),
    ),
).pipe(
  Command.withDescription("Prepare a shareable bundle (records, tool, publishable source text, MANIFEST.json). Publishes nothing."),
  Command.provide(Git.layer),
);
