/** Two people, one bare remote, the real `git` binary, the real merge driver subprocess. */
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { encodeJsonl, TrackingFile } from "../../src/jsonl.ts";
import { JUDGEMENT_FIELD } from "../../src/sync/merge.ts";
import { LONG, withWorld } from "./world.ts";

const TRACK = "tracking/alpha.jsonl";
const REQS = "requirements.jsonl";
const PRIVACY = "setup.privacy";
const SMOKE = "release.smoke@1.0";
const evidence = { kind: "link", ref: "https://alpha.app/privacy", date: "2026-09-10" };

const json = (r: { readonly stdout: string }) => JSON.parse(r.stdout);

describe("sync between two clones", () => {
  it.effect("(i) different records of one tracking file: both syncs succeed, the file holds both, validates", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const [alice, bob] = [yield* w.clone("alice"), yield* w.clone("bob")];
        yield* alice.edit(TRACK, PRIVACY, { owner: "alice", updated_at: "2026-09-10", updated_by: "alice" });
        const first = yield* alice.kb("sync", "--commit", "-m", "alice: owner");
        assert.isTrue(first.ok, first.stderr);
        assert.include(first.stdout, "synced: pushed 1 commit(s) to origin/main");

        yield* bob.edit(TRACK, SMOKE, { notes: "smoke run booked", updated_at: "2026-09-11", updated_by: "bob" });
        const second = json(yield* bob.kb("sync", "--commit", "-m", "bob: notes", "--json"));
        assert.deepStrictEqual([second.ok, second.state, second.pushed, second.behind], [true, "pushed", true, 0]);
        assert.include(second.steps.join("\n"), "rebased onto origin/main");

        const again = yield* alice.kb("sync");
        assert.include(again.stdout, "up to date with origin/main");
        for (const c of [alice, bob]) {
          const byId = Object.fromEntries((yield* c.records(TRACK)).map((r) => [TrackingFile.id(r), r]));
          assert.strictEqual(byId[PRIVACY].owner, "alice");
          assert.strictEqual(byId[SMOKE].notes, "smoke run booked");
          assert.isTrue((yield* c.kb("validate")).ok);
        }
        assert.strictEqual(yield* alice.git("rev-parse", "HEAD"), yield* w.remoteHead);
        assert.strictEqual(yield* alice.git("rev-list", "--merges", "--count", "HEAD"), "0", "history stays linear");
      })), LONG);

  it.effect("(ii) different fields of the same record (owner vs notes + evidence) merge", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const [alice, bob] = [yield* w.clone("alice"), yield* w.clone("bob")];
        yield* alice.edit(TRACK, PRIVACY, { owner: "alice", updated_at: "2026-09-10", updated_by: "alice" });
        assert.isTrue((yield* alice.kb("sync", "--commit", "-m", "owner")).ok);
        yield* bob.edit(TRACK, PRIVACY, { notes: "policy page is live", evidence: [evidence], updated_at: "2026-09-11T08:00:00Z", updated_by: "bob" });
        const synced = yield* bob.kb("sync", "--commit", "-m", "notes + evidence");
        assert.isTrue(synced.ok, synced.stderr);
        const record = (yield* bob.records(TRACK)).find((r) => TrackingFile.id(r) === PRIVACY);
        assert.deepStrictEqual(
          [record.owner, record.notes, record.evidence, record.updated_at, record.updated_by],
          ["alice", "policy page is live", [evidence], "2026-09-11T08:00:00Z", "bob"],
        );
        assert.isTrue((yield* bob.kb("validate")).ok);
        assert.strictEqual(yield* bob.git("rev-parse", "HEAD"), yield* w.remoteHead);
      })), LONG);

  it.effect("(iii) different status on the same record: stop, name record + field, push nothing; resolve + continue, then sync", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const [alice, bob] = [yield* w.clone("alice"), yield* w.clone("bob")];
        yield* alice.edit(TRACK, PRIVACY, { status: "done", evidence: [evidence], updated_at: "2026-09-10", updated_by: "alice" });
        assert.isTrue((yield* alice.kb("sync", "--commit", "-m", "done")).ok);
        const remoteBefore = yield* w.remoteHead;

        yield* bob.edit(TRACK, PRIVACY, { status: "blocked", notes: "legal review pending", updated_at: "2026-09-11", updated_by: "bob" });
        const stopped = yield* bob.kb("sync", "--commit", "-m", "blocked");
        assert.isFalse(stopped.ok);
        assert.include(stopped.stderr, "conflict: 1 file(s) need a decision");
        assert.include(stopped.stderr, "kb-site/data/tracking/alpha.jsonl");
        // sync rebases: ours = the remote (alice), theirs = the local change (bob)
        // status, revision, release, and evidence conflict as one group
        const group = (status: string, ev: ReadonlyArray<unknown>) => JSON.stringify({ status, requirement_revision: 1, release: null, evidence: ev });
        assert.include(stopped.stderr, `record "setup.privacy" field "${JUDGEMENT_FIELD}": ours ${group("done", [evidence])} / theirs ${group("blocked", [])}`);
        assert.include(stopped.stderr, '"ours" = the remote version');
        for (const command of ["git add kb-site/data/tracking/alpha.jsonl", "git -c core.editor=true rebase --continue", "git rebase --abort"]) {
          assert.include(stopped.stderr, command);
        }
        const text = yield* bob.read(TRACK);
        assert.include(text, `<<<<<<< kb-conflict record "setup.privacy" field "${JUDGEMENT_FIELD}"\nours: ${group("done", [evidence])}\n=======\ntheirs: ${group("blocked", [])}\n>>>>>>> kb-conflict\n`);
        const invalid = json(yield* bob.kb("validate", "--json"));
        assert.isFalse(invalid.ok);
        assert.deepStrictEqual(invalid.errors.map((e: { tag: string; file: string }) => [e.tag, e.file]), [["ConflictMarker", TRACK]]);
        assert.strictEqual(yield* w.remoteHead, remoteBefore, "nothing was pushed");

        // sync while the rebase is paused: no auto-resolve, no push
        const paused = json(yield* bob.kb("sync", "--json"));
        assert.deepStrictEqual([paused.ok, paused.state], [false, "in-progress"]);
        assert.strictEqual(yield* w.remoteHead, remoteBefore);

        // a person decides: keep "blocked" with bob's note, keep alice's evidence
        const kept = (yield* bob.records(TRACK)).map((r) => (TrackingFile.id(r) === PRIVACY ? { ...r, status: "blocked" } : r));
        yield* bob.write(TRACK, encodeJsonl(TrackingFile, kept));
        assert.isTrue((yield* bob.kb("validate")).ok);
        yield* bob.git("add", "kb-site/data/tracking/alpha.jsonl");
        yield* bob.git("-c", "core.editor=true", "rebase", "--continue");
        const done = yield* bob.kb("sync");
        assert.isTrue(done.ok, done.stderr);
        assert.include(done.stdout, "synced: pushed 1 commit(s)");
        assert.strictEqual(yield* bob.git("rev-parse", "HEAD"), yield* w.remoteHead);

        assert.isTrue((yield* alice.kb("sync")).ok);
        const final = (yield* alice.records(TRACK)).find((r) => TrackingFile.id(r) === PRIVACY);
        assert.deepStrictEqual([final.status, final.notes, final.evidence], ["blocked", "legal review pending", [evidence]]);
      })), LONG);

  it.effect("(iv) both revise the same requirement text -> conflict; abort returns to the local commit", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const [alice, bob] = [yield* w.clone("alice"), yield* w.clone("bob")];
        const revise = (what: string, by: string) => ({ what, revision: 2, revised_at: "2026-09-12", revision_note: `${by} tightened the rule` });
        yield* alice.edit(REQS, PRIVACY, revise("The policy URL answers 200 in every storefront.", "alice"));
        assert.isTrue((yield* alice.kb("sync", "--commit", "-m", "revise privacy")).ok);
        const remoteBefore = yield* w.remoteHead;

        yield* bob.edit(REQS, PRIVACY, revise("The policy is linked from the paywall.", "bob"));
        const local = yield* bob.git("rev-parse", "HEAD");
        const stopped = json(yield* bob.kb("sync", "--commit", "-m", "revise privacy too", "--json"));
        assert.deepStrictEqual([stopped.ok, stopped.state, stopped.pushed], [false, "conflict", false]);
        assert.deepStrictEqual(stopped.conflicts, ["kb-site/data/requirements.jsonl"]);
        assert.match(stopped.message.join("\n"), /record "setup\.privacy" field "what": ours "The policy URL.*" \/ theirs "The policy is linked.*both sides revised/);
        assert.include(yield* bob.read(REQS), "<<<<<<< kb-conflict");
        assert.strictEqual(yield* w.remoteHead, remoteBefore);

        yield* bob.git("rebase", "--abort");
        assert.notStrictEqual(yield* bob.git("rev-parse", "HEAD"), local, "bob's commit exists");
        assert.strictEqual(yield* bob.git("rev-parse", "HEAD~1"), local);
        assert.notInclude(yield* bob.read(REQS), "<<<<<<<");
      })), LONG);

  it.effect("(v) no remote -> local-only message, exit 1; outside a repository -> says so", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const solo = w.at(path.join(w.tmp, "solo"));
        yield* fs.makeDirectory(solo.dir);
        yield* solo.git("init", "-b", "main");
        yield* w.isolate(solo, "solo");
        const alice = yield* w.clone("alice");
        for (const rel of ["sources.jsonl", "requirements.jsonl", "apps.jsonl", "conflicts.jsonl", TRACK]) yield* solo.write(rel, yield* alice.read(rel));
        yield* solo.git("add", "-A");
        yield* solo.git("commit", "-m", "local store");

        const result = yield* solo.kb("sync");
        assert.isFalse(result.ok);
        assert.include(result.stderr, "no remote configured:");
        assert.include(result.stderr, "this store is local only until the owner picks a remote");
        assert.include(result.stderr, "approve-remote <name> --i-verified-private");
        assert.notInclude(result.stderr, "git push");
        assert.strictEqual((result.error as { reasons?: ReadonlyArray<{ error?: { _tag?: string } }> }).reasons?.[0]?.error?._tag, "Reported");
        assert.strictEqual(json(yield* solo.kb("sync", "--dry-run", "--json")).state, "no-remote");

        // a remote exists but the branch tracks nothing: sync does not guess
        yield* alice.git("checkout", "-b", "side");
        const side = json(yield* alice.kb("sync", "--json"));
        assert.strictEqual(side.state, "no-upstream");
        assert.include(side.message.join("\n"), `origin = ${w.remote} (approved)`);
        assert.notInclude(side.message.join("\n"), "git push");
        const named = json(yield* alice.kb("sync", "--remote", "origin", "--branch", "main", "--dry-run", "--json"));
        assert.deepStrictEqual([named.state, named.remote, named.branch], ["dry-run", "origin", "main"]);
        assert.strictEqual(json(yield* alice.kb("sync", "--remote", "nowhere", "--json")).state, "no-remote");

        const bare = w.at(path.join(w.tmp, "plain"), "data");
        yield* bare.write("sources.jsonl", "");
        assert.strictEqual(json(yield* bare.kb("sync", "--json")).state, "not-a-repo");
      })), LONG);

  it.effect("(vi) a dirty data dir is refused without --commit; --commit commits data-dir paths only", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const alice = yield* w.clone("alice");
        const before = yield* alice.git("rev-parse", "HEAD");
        yield* alice.edit(TRACK, PRIVACY, { owner: "alice" });
        yield* fs.writeFileString(path.join(alice.dir, "README.md"), "my private draft\n");
        yield* fs.writeFileString(path.join(alice.dir, "scratch.txt"), "untracked\n");

        const refused = yield* alice.kb("sync");
        assert.isFalse(refused.ok);
        assert.include(refused.stderr, "the data dir has uncommitted changes (1 file(s))");
        assert.include(refused.stderr, "kb-site/data/tracking/alpha.jsonl");
        assert.include(refused.stderr, 'sync --commit -m "what changed"');
        assert.strictEqual(yield* alice.git("rev-parse", "HEAD"), before);
        assert.strictEqual(json(yield* alice.kb("sync", "--commit", "--json")).state, "usage");

        const plan = json(yield* alice.kb("sync", "--dry-run", "--json"));
        assert.deepStrictEqual([plan.state, plan.ahead, plan.behind, plan.dirty], ["dry-run", 0, 0, ["kb-site/data/tracking/alpha.jsonl"]]);
        assert.strictEqual(yield* alice.git("rev-parse", "HEAD"), before, "dry run commits nothing");

        const kept = json(yield* alice.kb("sync", "--commit", "-m", "owner", "--no-push", "--json"));
        assert.deepStrictEqual([kept.state, kept.ahead], ["validated", 1]);
        assert.strictEqual(yield* w.remoteHead, before, "--no-push pushes nothing");
        assert.strictEqual(yield* alice.git("show", "--name-only", "--format=", "HEAD"), "kb-site/data/tracking/alpha.jsonl");
        assert.strictEqual(yield* alice.git("status", "--porcelain"), "M README.md\n?? scratch.txt");

        // the remote moves; the tracked non-data change blocks the rebase and sync does not stash it
        const bob = yield* w.clone("bob");
        yield* bob.edit(TRACK, SMOKE, { notes: "n" });
        assert.isTrue((yield* bob.kb("sync", "--commit", "-m", "bob")).ok);
        const blocked = json(yield* alice.kb("sync", "--json"));
        assert.strictEqual(blocked.state, "dirty-elsewhere");
        assert.strictEqual(yield* fs.readFileString(path.join(alice.dir, "README.md")), "my private draft\n");
        assert.strictEqual(yield* alice.git("stash", "list"), "");
      })), LONG);

  it.effect("(vii) invalid data is never pushed: not through --commit, not when already committed", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const alice = yield* w.clone("alice");
        const remoteBefore = yield* w.remoteHead;
        // done without evidence on an evidence_required check
        yield* alice.edit(TRACK, PRIVACY, { status: "done" });
        const refused = json(yield* alice.kb("sync", "--commit", "-m", "done", "--json"));
        assert.strictEqual(refused.state, "invalid");
        assert.include(refused.message.join("\n"), "nothing was committed");
        assert.strictEqual(yield* alice.git("rev-parse", "HEAD"), remoteBefore);

        yield* alice.git("commit", "-am", "hand commit of an invalid store");
        const stopped = yield* alice.kb("sync");
        assert.isFalse(stopped.ok);
        assert.include(stopped.stderr, "the store is invalid after the merge; nothing was pushed");
        assert.include(stopped.stderr, "tracking/alpha.jsonl");
        assert.strictEqual(yield* w.remoteHead, remoteBefore);

        yield* alice.edit(TRACK, PRIVACY, { status: "done", evidence: [evidence] });
        assert.isTrue((yield* alice.kb("sync", "--commit", "-m", "add the evidence")).ok);
        assert.strictEqual(yield* alice.git("rev-parse", "HEAD"), yield* w.remoteHead);
      })), LONG);

  it.effect("(viii) an unapproved remote is refused before anything is committed, fetched, or pushed; --dry-run too", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const bob = yield* w.clone("bob");
        const carol = yield* w.clone("carol", { approve: false });
        yield* bob.edit(TRACK, SMOKE, { notes: "pushed by bob" });
        assert.isTrue((yield* bob.kb("sync", "--commit", "-m", "bob")).ok);
        const remoteBefore = yield* w.remoteHead;
        const tracking = yield* carol.git("rev-parse", "refs/remotes/origin/main");
        const head = yield* carol.git("rev-parse", "HEAD");
        assert.notStrictEqual(tracking, remoteBefore, "the remote is ahead of what carol has seen");
        yield* carol.edit(TRACK, PRIVACY, { owner: "carol" });

        for (const argv of [["sync"], ["sync", "--dry-run"], ["sync", "--commit", "-m", "carol"], ["sync", "--remote", "origin", "--branch", "main"]]) {
          const refused = yield* carol.kb(...argv);
          assert.isFalse(refused.ok, argv.join(" "));
          assert.include(refused.stderr, `remote "origin" is not approved for this store: ${w.remote}`);
          assert.include(refused.stderr, "kb cannot verify by itself whether a remote is private or public");
          assert.include(refused.stderr, "bun kb-site/cli.ts approve-remote origin --i-verified-private");
          assert.include(refused.stderr, "nothing was committed, fetched, or pushed");
        }
        const machine = json(yield* carol.kb("sync", "--dry-run", "--json"));
        assert.deepStrictEqual([machine.ok, machine.state, machine.unapproved, machine.ahead], [false, "remote-not-approved", [w.remote], undefined]);
        assert.strictEqual(yield* carol.git("rev-parse", "refs/remotes/origin/main"), tracking, "nothing was fetched");
        assert.strictEqual(yield* carol.git("rev-parse", "HEAD"), head, "nothing was committed");
        assert.strictEqual(yield* w.remoteHead, remoteBefore, "nothing was pushed");
      })), LONG);

  it.effect("(ix) approve-remote: refused without the flag; with it sync works; a changed fetch or push URL needs a new approval", () =>
    withWorld((w) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const carol = yield* w.clone("carol", { approve: false });
        const config = () => Effect.map(carol.tryGit("config", "--local", "--get-all", "kb.approvedRemote"), (r) => r.stdout.trim());

        const bare = yield* carol.kb("approve-remote", "origin");
        assert.isFalse(bare.ok);
        assert.include(bare.stderr, "the store holds private material; confirm the remote is private before approving");
        assert.include(bare.stderr, "--i-verified-private");
        assert.strictEqual(yield* config(), "", "nothing was approved");
        assert.isFalse(json(yield* carol.kb("approve-remote", "origin", "--json")).ok);
        assert.include((yield* carol.kb("approve-remote", "nowhere", "--i-verified-private")).stderr, '"nowhere" is not a remote here');

        const approved = yield* carol.kb("approve-remote", "origin", "--i-verified-private");
        assert.isTrue(approved.ok, approved.stderr);
        assert.include(approved.stdout, w.remote);
        assert.include(approved.stdout, "kb did not check the visibility");
        assert.strictEqual(yield* config(), w.remote);
        assert.include((yield* carol.kb("approve-remote", "origin", "--i-verified-private")).stdout, "already approved");
        assert.strictEqual(yield* config(), w.remote, "no duplicate value");

        yield* carol.edit(TRACK, PRIVACY, { owner: "carol" });
        const synced = yield* carol.kb("sync", "--commit", "-m", "carol: owner");
        assert.isTrue(synced.ok, synced.stderr);
        assert.include(synced.stdout, `remote origin is approved (${w.remote})`);
        assert.strictEqual(yield* carol.git("rev-parse", "HEAD"), yield* w.remoteHead);

        // the approval names the exact URL: point origin somewhere else and sync stops again
        const other = path.join(w.tmp, "public.git");
        yield* fs.makeDirectory(other);
        yield* w.at(other).git("init", "--bare", "-b", "main");
        yield* carol.git("remote", "set-url", "origin", other);
        yield* carol.edit(TRACK, PRIVACY, { owner: "carol again" });
        const moved = yield* carol.kb("sync", "--commit", "-m", "to the other remote");
        assert.isFalse(moved.ok);
        assert.include(moved.stderr, `remote "origin" is not approved for this store: ${other}`);
        assert.include(moved.stderr, `approved here: ${w.remote}`);
        assert.strictEqual((yield* w.at(other).tryGit("rev-parse", "--verify", "-q", "refs/heads/main")).exitCode, 1, "nothing reached the other remote");

        // a push URL that differs from the fetch URL is checked too
        yield* carol.git("remote", "set-url", "origin", w.remote);
        yield* carol.git("remote", "set-url", "--push", "origin", other);
        const split = json(yield* carol.kb("sync", "--commit", "-m", "split", "--json"));
        assert.deepStrictEqual([split.state, split.unapproved], ["remote-not-approved", [other]]);
        assert.strictEqual((yield* w.at(other).tryGit("rev-parse", "--verify", "-q", "refs/heads/main")).exitCode, 1);

        // an exact URL can be approved as well
        assert.isTrue((yield* carol.kb("approve-remote", other, "--i-verified-private")).ok);
        assert.strictEqual(json(yield* carol.kb("sync", "--dry-run", "--json")).state, "dry-run");
      })), LONG);
});
