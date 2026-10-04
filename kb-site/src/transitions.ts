/** `set` transition rules (PLAN section 4). Pure: the clock values come in as arguments. */
import { Result } from "effect";
import { countingEvidence, foreignReleases, isStale } from "./derive.ts";
import { issue, type Issue } from "./issue.ts";
import { APPS_PATH, REQUIREMENTS_PATH, trackingPath } from "./jsonl.ts";
import { type Evidence, type EvidenceKind, type KbData, releaseKey, type Requirement, type Status, type TrackingRecord } from "./schema.ts";

export interface EvidenceInput {
  readonly kind: EvidenceKind;
  readonly ref: string;
  /** Defaults to today. */
  readonly date?: string | undefined;
  /** `every_release` checks only. Defaults to the record's release; evidence for another release never counts. */
  readonly release?: string | undefined;
  readonly note?: string | undefined;
}

export interface TrackingPatch {
  readonly status?: Status | undefined;
  /** `null` or `""` clears the owner. */
  readonly owner?: string | null | undefined;
  /** Replaces `notes`. Required to block, exclude, reopen, or (without new evidence) re-confirm. */
  readonly note?: string | undefined;
  /** Appended; duplicates by `(kind, ref, date)` are dropped. */
  readonly evidence?: ReadonlyArray<EvidenceInput> | undefined;
  /** `every_release` checks only. Defaults to the app's `current_release`. */
  readonly release?: string | undefined;
  /** Re-confirm a `done` record whose requirement was revised since. */
  readonly ackRevision?: boolean | undefined;
  readonly by: string;
}

export interface Stamp {
  /** ISO timestamp for `updated_at`. */
  readonly now: string;
  /** YYYY-MM-DD default for evidence dates. */
  readonly today: string;
}

export interface SetOutcome {
  readonly data: KbData;
  readonly record: TrackingRecord;
  readonly previous: TrackingRecord | undefined;
}

export const applySet = (
  data: KbData,
  appId: string,
  requirementId: string,
  patch: TrackingPatch,
  stamp: Stamp,
): Result.Result<SetOutcome, ReadonlyArray<Issue>> => {
  const file = trackingPath(appId);
  const reject = (message: string, tag: Issue["_tag"] = "InvalidTransition", inFile = file, id = requirementId) =>
    Result.fail<ReadonlyArray<Issue>>([issue(tag, inFile, message, { id })]);

  const app = data.apps.find((a) => a.id === appId);
  if (!app) return reject(`app "${appId}" does not exist; run \`kb apps\` to list apps`, "NotFound", APPS_PATH, appId);
  const r = data.requirements.find((x) => x.id === requirementId);
  if (!r) return reject(`requirement "${requirementId}" does not exist; run \`kb checks\` to list checks`, "NotFound", REQUIREMENTS_PATH);
  if (r.kind === "guideline") return reject(`"${r.id}" is a guideline; only checks are tracked per app`);

  const touched = patch.status !== undefined || patch.owner !== undefined || patch.note !== undefined ||
    (patch.evidence?.length ?? 0) > 0 || patch.ackRevision === true;
  if (!touched) return reject("nothing to change; pass --status, --owner, --note, --evidence, or --ack-revision");

  let release: string | null = null;
  if (r.cadence === "once") {
    if (patch.release !== undefined) return reject(`"${r.id}" has cadence "once"; it is not bound to a release, remove --release`);
  } else {
    release = patch.release ?? releaseKey(app.current_release);
    if (release === null || release.trim() === "") {
      return reject(`"${r.id}" is checked every release, and app "${app.id}" has no current_release; pass --release <version> or run \`kb set-release ${app.id} <version>\``);
    }
  }

  const previous = data.tracking.find((t) => t.app === appId && t.requirement === requirementId && t.release === release);
  const from: Status = previous?.status ?? "todo";
  const to: Status = patch.status ?? from;
  const note = patch.note?.trim();
  const hasNote = note !== undefined && note !== "";
  const added = patch.evidence ?? [];
  const stale = previous !== undefined && isStale(previous, r);

  if (r.acceptance === "retired" && to !== "not_applicable") {
    return reject(`requirement "${r.id}" is retired; the only status allowed is "not_applicable"`);
  }
  if (from === "done" && to !== "done" && !hasNote) {
    return reject(`reopening a done check (done -> ${to}) needs --note with the reason`);
  }
  if ((to === "blocked" || to === "not_applicable") && to !== from && !hasNote) {
    return reject(`status "${to}" needs --note that says ${to === "blocked" ? "what blocks it" : "why it does not apply"}`);
  }
  // De-duplicate FIRST: evidence the record already holds proves nothing new.
  const evidence: Array<Evidence> = [...(previous?.evidence ?? [])];
  let fresh = 0;
  for (const e of added) {
    const date = e.date ?? stamp.today;
    if (evidence.some((x) => x.kind === e.kind && x.ref === e.ref && x.date === date)) continue;
    fresh += 1;
    evidence.push({
      kind: e.kind,
      ref: e.ref,
      date,
      ...(release === null ? {} : { release: e.release ?? release }),
      ...(e.note === undefined || e.note === "" ? {} : { note: e.note }),
    });
  }

  if (patch.ackRevision === true) {
    if (!stale) return reject(`--ack-revision: nothing to acknowledge; "${r.id}" is not a done record on an older revision`);
    if (to !== "done") return reject("--ack-revision re-confirms a done check; do not combine it with another --status");
    if (!hasNote && fresh === 0) {
      return reject(
        `--ack-revision needs --note or new --evidence: say how the check still holds at revision ${r.revision}${added.length > 0 ? " (the evidence given is already on the record)" : ""}`,
      );
    }
  } else if (stale && to === "done") {
    return reject(
      `"${r.id}" changed since this was done (revision ${previous?.requirement_revision} -> ${r.revision}); review it, then pass --ack-revision with --note or --evidence, or reopen it with --status`,
    );
  }

  if (to === "done" && r.evidence_required && countingEvidence({ release, evidence }).length === 0) {
    return reject(
      evidence.length === 0
        ? `"${r.id}" requires evidence; pass --evidence kind=ref (kinds: link, commit, build, command, screenshot, doc, note)`
        : `"${r.id}" requires evidence for release "${release}"; the evidence given belongs to release ${foreignReleases({ release, evidence })}, and old evidence never counts for another release`,
    );
  }

  const owner = patch.owner === undefined ? previous?.owner ?? null : patch.owner === null || patch.owner.trim() === "" ? null : patch.owner;
  const record: TrackingRecord = {
    app: appId,
    requirement: requirementId,
    release,
    status: to,
    requirement_revision: r.revision,
    owner,
    notes: hasNote ? note : previous?.notes ?? "",
    evidence,
    updated_at: stamp.now,
    updated_by: patch.by,
  };
  const tracking = previous ? data.tracking.map((t) => (t === previous ? record : t)) : [...data.tracking, record];
  return Result.succeed({ data: { ...data, tracking }, record, previous });
};

export const applySetRelease = (
  data: KbData,
  appId: string,
  version: string,
  build?: string,
): Result.Result<{ readonly data: KbData; readonly app: KbData["apps"][number] }, ReadonlyArray<Issue>> => {
  const app = data.apps.find((a) => a.id === appId);
  if (!app) return Result.fail([issue("NotFound", APPS_PATH, `app "${appId}" does not exist; run \`kb apps\` to list apps`, { id: appId })]);
  if (version.trim() === "" || /[()\s]/.test(version)) {
    return Result.fail([issue("InvalidTransition", APPS_PATH, `version "${version}" must be non-empty without spaces or parentheses`, { id: appId })]);
  }
  if (build !== undefined && (build.trim() === "" || /[()\s]/.test(build))) {
    return Result.fail([issue("InvalidTransition", APPS_PATH, `build "${build}" must be non-empty without spaces or parentheses`, { id: appId })]);
  }
  const next = { ...app, current_release: build === undefined ? { version } : { version, build } };
  return Result.succeed({ data: { ...data, apps: data.apps.map((a) => (a === app ? next : a)) }, app: next });
};

// ---- revise: a safe rule edit -------------------------------------------------------------------
export interface RevisePatch {
  /** Material: a change bumps `revision` and needs `note`. */
  readonly what?: string | undefined;
  readonly how?: string | undefined;
  readonly evidenceRequired?: boolean | undefined;
  /** Replaces `applies_to`; `{}` = every app. */
  readonly appliesTo?: Requirement["applies_to"] | undefined;
  /** Not material: no bump. */
  readonly title?: string | undefined;
  readonly acceptance?: Requirement["acceptance"] | undefined;
  /** The revision note. Mandatory with a material change, refused without one. */
  readonly note?: string | undefined;
}

export interface ReviseOutcome {
  readonly data: KbData;
  readonly requirement: Requirement;
  readonly previous: Requirement;
  /** Material fields whose value changed. Empty = no bump. */
  readonly material: ReadonlyArray<"what" | "how" | "evidence_required" | "applies_to">;
  /** Tracking records that were current and are stale now. */
  readonly becameStale: ReadonlyArray<{ readonly app: string; readonly release: string | null }>;
}

const sameList = (a: ReadonlyArray<string> | undefined, b: ReadonlyArray<string> | undefined): boolean =>
  JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());

export const applyRevise = (data: KbData, requirementId: string, patch: RevisePatch, today: string): Result.Result<ReviseOutcome, ReadonlyArray<Issue>> => {
  const reject = (message: string, tag: Issue["_tag"] = "InvalidTransition") =>
    Result.fail<ReadonlyArray<Issue>>([issue(tag, REQUIREMENTS_PATH, message, { id: requirementId })]);
  const r = data.requirements.find((x) => x.id === requirementId);
  if (!r) return reject(`requirement "${requirementId}" does not exist; run \`kb checks\` to list checks`, "NotFound");

  const material: Array<ReviseOutcome["material"][number]> = [];
  if (patch.what !== undefined && patch.what !== r.what) material.push("what");
  if (patch.how !== undefined && patch.how !== r.how) material.push("how");
  if (patch.evidenceRequired !== undefined && patch.evidenceRequired !== r.evidence_required) material.push("evidence_required");
  if (patch.appliesTo !== undefined && !(sameList(patch.appliesTo.platforms, r.applies_to.platforms) && sameList(patch.appliesTo.tags, r.applies_to.tags))) material.push("applies_to");
  const other = (patch.title !== undefined && patch.title !== r.title) || (patch.acceptance !== undefined && patch.acceptance !== r.acceptance);
  const note = patch.note?.trim() ?? "";

  if (material.length === 0 && !other) {
    return reject("nothing to change; pass --what, --how, --evidence-required, --platform/--tag/--all-apps, --title, or --acceptance with a new value");
  }
  if (r.acceptance === "retired" && (material.length > 0 || (patch.title !== undefined && patch.title !== r.title))) {
    return reject(`requirement "${r.id}" is retired; only --acceptance may change (the owner un-retires it first)`);
  }
  for (const [name, value] of [["--what", patch.what], ["--how", patch.how], ["--title", patch.title]] as const) {
    if (value !== undefined && value.trim() === "") return reject(`${name} must not be empty`);
  }
  if (material.length > 0 && note === "") {
    return reject(`a change to ${material.join(", ")} is material: it bumps the revision and makes every done record stale; pass --note that says what changed and why`);
  }
  if (material.length === 0 && note !== "") {
    return reject("--note is the revision note; it needs a material change (--what, --how, --evidence-required, --platform/--tag/--all-apps). --title and --acceptance do not bump the revision");
  }

  const next: Requirement = {
    ...r,
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.acceptance === undefined ? {} : { acceptance: patch.acceptance }),
    ...(patch.what === undefined ? {} : { what: patch.what }),
    ...(patch.how === undefined ? {} : { how: patch.how }),
    ...(patch.evidenceRequired === undefined ? {} : { evidence_required: patch.evidenceRequired }),
    ...(material.includes("applies_to") ? { applies_to: patch.appliesTo ?? {} } : {}),
    ...(material.length === 0 ? {} : { revision: r.revision + 1, revised_at: today, revision_note: note }),
  };
  const becameStale = data.tracking
    .filter((t) => t.requirement === r.id && !isStale(t, r) && isStale(t, next))
    .map((t) => ({ app: t.app, release: t.release }));
  return Result.succeed({ data: { ...data, requirements: data.requirements.map((x) => (x === r ? next : x)) }, requirement: next, previous: r, material, becameStale });
};
