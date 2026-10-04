# Durable task delivery

Apply this contract to assigned implementation, research, exploration, design, review, and coordination work.
An ordinary chat answer does not require a branch. A repository task with saved work does.

## Ownership and start

1. Record the task ID, repository, branch, worktree, owner, acceptance, and next action.
2. Inspect existing panes and worktrees. Give each writer one isolated checkout.
3. Record the loaded skill path and revision. Identify local skill changes in the run record.
4. Commit a task plan or first useful artifact on a task branch.
5. Push with `git push -u origin HEAD`. Verify that the upstream names this task branch.
6. Open a draft PR for that artifact. Record its URL before assigning unattended work.

The coordinator owns preparation for a worker. A single agent owns preparation for its own task.
Use the repository's documented worktree and bootstrap procedures. Add task files explicitly.
An inherited upstream of `origin/main` does not satisfy step 5 for a task branch.
Reuse an existing task PR. For a stacked branch, name the intended PR base explicitly.
Publication follows the owner's repository and confidentiality instructions.

## Worker delivery

Workers own commits, branch publication, the draft PR, and the recovery record for their assigned task.
The coordinator owns independent review, ready status, merge claims, and merge.
An absent coordinator does not prevent a worker from preserving its result in the draft PR.

Push at each completed plan step and before an idle handoff, human decision, rotation, or provider stop.
For a long step, make a recoverable checkpoint at least every 30 minutes when no command is running.
Mark incomplete checkpoints as WIP. Never report unrun checks as passing.
Keep implementation gates proportional to the change. Research uses source and artifact checks.
A draft PR preserves progress; it does not authorize release, deployment, or merge.

Commit a recovery record at a repository path, such as `docs/handoffs/<task>.md`.
The record contains:

- Goal and acceptance, including later owner instructions.
- Branch, PR URL, artifact paths, and the checkpoint commit being handed over.
- Check commands, actual results, remaining work, and known limits.
- Hold decisions, dependencies, and one exact next action.
- Owner and successor responsibility when the task pauses.

The checkpoint SHA identifies the work described by the record. Record the final publication SHA separately.
Avoid a self-reference: a committed record cannot contain its own future commit SHA.
Keep secrets, raw terminal history, and unrelated user files out of the record and PR.
Scratch `REPORT.md` is temporary input; the committed recovery record carries the accepted result.

## Delivery receipt

Before accepting `BUILT`, returning a final task report, or closing an owned pane, verify:

1. Task artifacts and the recovery record exist in the commit.
2. `git rev-parse HEAD` gives the final publication SHA.
3. `git ls-remote --heads origin refs/heads/<branch>` gives the same SHA.
4. `gh pr view <url> --json headRefName,headRefOid,isDraft,state,url` identifies that branch and SHA.
5. The PR contains current check results, holds, remaining work, and the recovery record path.
6. Task work has no uncommitted residue. Inventory any unrelated files without committing them.

Record `branch`, `commit`, `ref`, `pr`, `report`, owner, and next action in the run ledger.
Use the exact PR URL in the final report. A local commit or a compare URL alone is insufficient.
Existing ledger fields are observations; they do not independently prove remote publication.
The coordinator runs these checks before accepting a worker's completion event.

If publication fails, preserve a local checkpoint and record the error as a publication blocker.
Keep the checkout and pane. Report the last verified remote SHA and the work that remains local.
When approved shared storage exists, preserve a Git bundle and record its location as a temporary recovery copy.
A bundle does not satisfy the requested remote branch and PR receipt.
Honor repository hooks. A failed push remains blocked until the required check or access problem is resolved.

## Research and decisions

Research and exploration deliver committed notes, evidence, options, and unresolved decisions in a draft PR.
Publish these artifacts before waiting for a decision. Human holds stop integration, not preservation.
For a rejected idea, record the reason and close the PR with its recovery links intact.
For a result with no code change, publish the useful conclusion and source evidence.
Mark a task handed over only when its PR names the owner and the exact remaining action.

## Recovery without a live pane

Treat GitHub and the pushed recovery record as the recovery source. A pane is an execution resource.
At resume, inspect the task PR, remote SHA, recovery record, and ledger before using a local transcript.
Inspect a surviving checkout for later unpushed work before replacing or removing it.
Confirm the previous writer stops before a successor uses that checkout.
Create a replacement pane only when it is needed to continue the recorded action.
Local session transcripts are supplementary evidence; they are not the only recovery carrier.

Before each unattended wave and after coordinator rotation, verify the supervisor's actual parent and task scope.
A configured pane ID must resolve to the current parent. A configured tab must contain the intended workers.
An enabled plugin does not prove that its supervisor process runs or that its parent receives events.
When the parent is unavailable, preserve completed worker receipts and record coordinator loss on the run PR.
Do not start another wave until a responsible coordinator owns the remaining actions.

A monitor that runs only inside Herdr cannot recover after its own server or host stops.
Host restart recovery requires an external service that reads the durable run record and reconciles owned resources.
Skills specify the recovery procedure; they do not install that service or guarantee automatic recovery.

## Resource closure

Archive the accepted result and verify the delivery receipt before closing an owned idle pane.
Automatic closure based only on `idle`, `done`, or a reported turn is insufficient.
Keep a checkout while local work remains, review continues, or no durable recovery copy exists.
Remove it only under the repository's ownership and cleanup rules.
Release claims with a recorded disposition: merged, handed over, rejected, or publication-blocked.
Stop monitors last, after every owned task has a durable result or an explicit unresolved blocker.
