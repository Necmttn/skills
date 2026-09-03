import { describe, expect, test } from "bun:test";
import { Cause, Effect, Exit } from "effect";

const failure = (exit: Exit.Exit<unknown, unknown>): any => (Exit.isFailure(exit) ? Cause.squash(exit.cause) : null);
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Herdr } from "./Herdr.ts";
import { layer } from "./HerdrCli.ts";

/** A fake `herdr` binary on PATH: records argv, answers list/read/close, errors on unknown ids. */
const FAKE = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FAKE_HERDR_LOG"
args=("$@"); if [[ "\${args[0]}" == "--session" ]]; then args=("\${args[@]:2}"); fi
case "\${args[0]} \${args[1]}" in
  "agent list") echo '{"id":"cli:agent:list","result":{"type":"agent_list","agents":[{"name":"w0","pane_id":"w1:p7","agent_status":"idle"}]}}' ;;
  "agent read") printf 'tail for %s\\n' "\${args[2]}" ;;
  "pane list") [[ "\${args[3]}" == "w1" ]] && echo '{"result":{"panes":[{"pane_id":"w1:p7"}]}}' || { echo '{"error":{"code":"workspace_not_found","message":"workspace not found"},"id":"cli:pane:list"}'; exit 1; } ;;
  "pane close") [[ "\${args[2]}" == "w1:p7" ]] && echo '{"result":{"ok":true}}' || { echo '{"error":{"code":"pane_not_found","message":"no such pane"}}'; exit 1; } ;;
  "session stop") echo "stopped session \${args[2]}" ;;
  "tab close") echo '{"error":{"code":"tab_not_found","message":"tab not found"},"id":"cli:tab:close"}' >&2; exit 1 ;;
  *) echo "boom" >&2; exit 7 ;;
esac
`;

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "fleet-herdr-cli-"));
  const bin = join(dir, "herdr");
  writeFileSync(bin, FAKE);
  chmodSync(bin, 0o755);
  const log = join(dir, "calls.log");
  writeFileSync(log, "");
  process.env.PATH = `${dir}:${process.env.PATH}`;
  process.env.FAKE_HERDR_LOG = log;
  return { calls: () => readFileSync(log, "utf8").trimEnd().split("\n").filter(Boolean) };
};

const run = <A, E>(body: Effect.Effect<A, E, Herdr>) =>
  Effect.runPromiseExit(body.pipe(Effect.provide(layer("fleet-demo"))));

describe("HerdrCli", () => {
  test("prefixes every call with --session and parses the JSON envelope", async () => {
    const t = setup();
    const exit = await run(Effect.gen(function* () {
      const h = yield* Herdr;
      const agents = yield* h.agents.list;
      const panes = yield* h.panes.list("w1");
      const text = yield* h.agents.read("w0", 40);
      return { agents, panes, text };
    }));
    if (!Exit.isSuccess(exit)) throw new Error(JSON.stringify(failure(exit)));
    expect(exit.value.agents[0]?.pane_id).toBe("w1:p7");
    expect(exit.value.panes.map((p) => p.pane_id)).toEqual(["w1:p7"]);
    expect(exit.value.text).toContain("tail for w0");
    expect(t.calls()[0]).toBe("--session fleet-demo agent list");
    expect(t.calls()[2]).toBe("--session fleet-demo agent read w0 --source recent --lines 40");
  });

  test("a not-found error object becomes HerdrNotFound", async () => {
    setup();
    const exit = await run(Effect.gen(function* () {
      const h = yield* Herdr;
      return yield* h.panes.list("w9");
    }));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(failure(exit)?._tag).toBe("HerdrNotFound");
  });

  test("a not-found envelope printed on stderr (real herdr) is HerdrNotFound too", async () => {
    setup();
    const exit = await run(Effect.gen(function* () {
      const h = yield* Herdr;
      return yield* h.tabs.close("w1:t2");
    }));
    expect(failure(exit)?._tag).toBe("HerdrNotFound");
  });

  test("any other non-zero exit becomes HerdrCommandFailed with the output", async () => {
    setup();
    const exit = await run(Effect.gen(function* () {
      const h = yield* Herdr;
      return yield* h.workspaces.close("w1");
    }));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(failure(exit)?._tag).toBe("HerdrCommandFailed");
    expect(failure(exit)?.output).toContain("boom");
  });
});
