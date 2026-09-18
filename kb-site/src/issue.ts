/** Problems are values: every one carries a severity, a file, and a plain-English message. */
export type Severity = "error" | "warning";

export type IssueTag =
  | "MalformedJson"
  | "SchemaViolation"
  | "BlankLine"
  | "ConflictMarker"
  | "DuplicateKey"
  | "Unsorted"
  | "NotCanonical"
  | "DanglingReference"
  | "FileNameMismatch"
  | "InvalidPath"
  | "InvalidAccess"
  | "InvalidTracking"
  | "InvalidTransition"
  | "NotFound"
  | "Usage"
  | "ConcurrentEdit"
  | "Io";

export interface Issue {
  readonly _tag: IssueTag;
  readonly severity: Severity;
  readonly file: string;
  readonly line?: number;
  readonly id?: string;
  readonly message: string;
}

export const issue = (
  _tag: IssueTag,
  file: string,
  message: string,
  at: { readonly line?: number | undefined; readonly id?: string | undefined; readonly severity?: Severity } = {},
): Issue => ({
  _tag,
  severity: at.severity ?? "error",
  file,
  ...(at.line === undefined ? {} : { line: at.line }),
  ...(at.id === undefined ? {} : { id: at.id }),
  message,
});

export const isError = (i: Issue): boolean => i.severity === "error";
export const errorsOf = (issues: ReadonlyArray<Issue>): ReadonlyArray<Issue> => issues.filter(isError);
export const warningsOf = (issues: ReadonlyArray<Issue>): ReadonlyArray<Issue> => issues.filter((i) => !isError(i));

/** `error: tracking/demo.jsonl:3 [ship.privacy]: message` - one line per problem. */
export const formatIssue = (i: Issue): string => {
  const where = i.file === "" ? "" : ` ${i.file}${i.line === undefined ? "" : `:${i.line}`}`;
  const id = i.id === undefined ? "" : ` [${i.id}]`;
  return `${i.severity}:${where}${id}${where === "" && id === "" ? "" : ":"} ${i.message}`;
};

const rank = (i: Issue): number => (i.severity === "error" ? 0 : 1);
export const sortIssues = (issues: ReadonlyArray<Issue>): ReadonlyArray<Issue> =>
  [...issues].sort(
    (a, b) =>
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || (a.line ?? 0) - (b.line ?? 0) || rank(a) - rank(b) ||
      (a.message < b.message ? -1 : a.message > b.message ? 1 : 0),
  );
