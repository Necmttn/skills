/** Epic-directory resolution. The only module besides fleet.ts that reads process.env. */
import { hostname } from "node:os";
import { basename, join, resolve } from "node:path";
import { ledgerFileName } from "../ledger/Ledger.ts";

export const slugOf = (): string => process.env.FLEET_SLUG || hostname().split(".")[0] || "local";

/** Legacy form: a single ledger file path. Everything else is an epic directory. */
export const isLedgerFile = (arg: string): boolean => arg.endsWith(".jsonl");

export interface EpicPaths {
  readonly dir: string;
  readonly epic: string;
  readonly graph: string;
  readonly decisions: string;
  readonly ledger: string;
  readonly dagr: string;
}

export const epicPaths = (dir: string, slug: string): EpicPaths => {
  const abs = resolve(dir);
  return {
    dir: abs,
    epic: basename(abs),
    graph: join(abs, "graph.json"),
    decisions: join(abs, "DECISIONS.md"),
    ledger: join(abs, ledgerFileName(slug)),
    dagr: join(abs, ".dagr", "run.json"),
  };
};

/** The workflow.json that ships with the skill, resolved relative to this source tree. */
export const bundledWorkflowPath = (): string => new URL("../../workflow.json", import.meta.url).pathname;
