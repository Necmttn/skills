# Fleet run: improve-plans (2026-07-17)
Ledger: /tmp/fleet-improve-plans.ledger · signals fallback (board /events endpoint absent)

## 003-teardown (w1P:p1D, codex gpt-5.6 medium)
Merged 51325e4 (squash of c9a1436) · gate: PASS (orchestrator adversarial read + independent re-run of bash -n, dry-run parser test; executor ran shellcheck, live integration w/ scratch tab + --execute + idempotence, zero leftovers).
Report: implemented scripts/fleet-teardown.sh (285 ln) + SKILL/REFERENCE wiring per plans/003.
Concern (filed as follow-up issue): resolve_resource can abort via set -e when a pane RES id references an already-closed workspace from a PREVIOUS partial run (herdr pane list fails -> pipefail -> command-substitution assignment exits the script). Also noted: root-shell panes absent from agent list; script probes pane list by exact id (handled).

## 001-doc-fixes v1 (w1P:p1C, codex) - BLOCKED, correctly
Live send-semantics test (plan STOP condition): herdr agent send APPENDS (AAA then BBB -> AAABBB) on installed herdr - fleet-ship hard rule "REPLACES" (2026-07-10) is WRONG; herdr-agent-orchestration "appends" was right. All provisional edits reverted, no commit, scratch pane torn down. Full tail: archived at teardown. Respawned as v2 (w1P:p1N) with inverted scope: monitor fix + append-semantics rewrite + live-verified clear/submit recipe.
## w1P:p1C (teardown capture)


╭────────────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.144.5)                         │
│                                                    │
│ model:       gpt-5.6-sol medium   /model to change │
│ directory:   ~/Projects/…/.worktrees/001-doc-fixes │
│ permissions: YOLO mode                             │
╰────────────────────────────────────────────────────╯

  Tip: Try the Codex App. Run 'codex app' or visit https://chatgpt.com/codex?app-landing-page=true

• You have 4 usage limit resets available. Run /usage to use one.


› Read BRIEF.md and execute it fully


⚠ loading hooks from both /Users/necmttn/.codex/hooks.json and /Users/necmttn/.codex/config.toml; prefer a single representation for this layer

⚠ Skill descriptions were shortened to fit the 2% skills context budget. Codex can still see every skill, but some descriptions are shorter. Disable unused skills or plugins to leave
  more room for the rest.

• I’ll inspect the brief and repository guidance first, then carry the requested work through implementation and verification.

• Ran pwd && rg --files -g 'BRIEF.md' -g 'AGENTS.md' -g '!node_modules' -g '!vendor' | sort
  └ /Users/necmttn/Projects/necmttn-skills/.worktrees/001-doc-fixes
    BRIEF.md

• Ran sed -n '1,240p' BRIEF.md && git status --short && rg --files -g '!node_modules' -g '!vendor' | sed -n '1,240p'
  └ CLAUDE.md
    skills/deprecated/to-prd/SKILL.md
    … +92 lines (ctrl + t to view transcript)
    docs/invocation.md
    docs/superpowers/plans/2026-07-17-build-28-lifecycle-events.md

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• I’m using the fleet-ship and herdr-agent-orchestration skills because the brief requires editing their operating rules and running a live herdr pane check. I’ll follow the brief’s re-
  scoped instructions where they override the older plan.

• Explored
  └ Read SKILL.md, 001-fleet-ship-doc-fixes.md
    Read herdr-cli.md
    Search agent send|parked-draft|parked draft|REPLACES|Hard rules|FLEET_TAB|agent list --tab in SKILL.md
    Read SKILL.md

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• The repository matches the re-scoped situation: the fleet hard rule still says “REPLACES,” while both low-level docs correctly say “appends.” Before editing, I’m checking the planned
  monitor context and the live server’s JSON shape so every replacement is grounded in this session.

• Ran git diff --stat a4ba253..HEAD -- skills/engineering/fleet-ship/ skills/engineering/herdr-agent-orchestration/ && sed -n '232,290p' skills/engineering/fleet-ship/REFERENCE.md && git
  │ status --short && herdr agent list
  └  skills/engineering/fleet-ship/REFERENCE.md | 176 ++++++++++++----
     skills/engineering/fleet-ship/SKILL.md     | 321 +++++++++++++++++++++++------
    … +86 lines (ctrl + t to view transcript)
    necmttn/Projects/apps","pane_id":"w1V:p1","revision":4,"tab_id":"w1V:t1","terminal_id":"term_656c6e2c8d469bc","terminal_title":"⠂ Check OpenTelemetry Sentry export
    examples","terminal_title_stripped":"Check OpenTelemetry Sentry export examples","workspace_id":"w1V"}],"type":"agent_list"}}

• Edited skills/engineering/fleet-ship/REFERENCE.md (+2 -2)
    243  MACHINE_SLUG="${MACHINE_SLUG:?export the fleetctl join machine slug}"
    244 -# export NAMES="chunk-a chunk-b …" (your fleet's chunk ids) OR FLEET_TAB=<fleet tab id> before running - scoping is mandatory
    244 +# export NAMES="chunk-a chunk-b …" (your fleet's chunk ids) OR export FLEET_TAB=<fleet tab id> (filtered client-side; herdr agent list takes no flags) before running - scoping i
         s mandatory
    245  SIG='out of credits|rate.?limit|429| 403 | 5[0-9][0-9] |ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network error|connection (refused|reset|closed)|socket hang up|fetch failed|panic|Traceb
         ack|FATAL|command not found'
        ⋮
    249    # Set NAMES to your chunk ids ("chunk-a chunk-b …") OR filter agent list by your fleet tab id.
    250 -  NAMES="${NAMES:-$(herdr agent list --tab "$FLEET_TAB" | python3 -c 'import sys,json;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name")]' 2>/d
         ev/null)}"
    250 +  NAMES="${NAMES:-$(herdr agent list | python3 -c 'import sys,json,os;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name") and a.get("tab_id")==o
         s.environ.get("FLEET_TAB")]' 2>/dev/null)}"
    251    for N in $NAMES; do

• Ran FLEET_TAB=nonexistent herdr agent list | python3 -c 'import sys,json,os;[print(a["name"]) for a in json.load(sys.stdin)["result"]["agents"] if a.get("name") and
  │ a.get("tab_id")==os.environ.get("FLEET_TAB")]'
  │ export FLEET_TAB=w1P:t6
  │ … +2 lines
  └ (no output)

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• The monitor fallback now filters herdr agent list client-side. Its nonexistent-tab check exited 0 with no output, and a real tab (w1P:t6) returned only 001-doc-fixes. I’m starting the
  one mandated scratch pane next; I’ll close it by exact pane ID after testing.

• Ran herdr agent start sendtest-002 --cwd /tmp --workspace w1P -- claude --model sonnet
  │ sleep 15
  │ herdr agent get sendtest-002
  │ … +1 lines
  └ {"id":"cli:agent:get","result":{"agent":{"agent":"claude","agent_status":"idle","cwd":"/private/tmp","focused":false,"foreground_cwd":"/private/
    tmp","name":"sendtest-002","pane_id":"w1P:p1S","revision":1,"tab_id":"w1P:t1","terminal_id":"term_656c8da0be0bdc1","terminal_title":"✳ Claude Code","terminal_title_stripped":"Claude
    … +6 lines (ctrl + t to view transcript)
    ● high · /effort\n────────────────────────────────────────────\n❯\n────────────────────────────────────────────\n  M...  |  5h 28% → 17:30 · 7d 6% · mode? …\n  ⏵⏵ auto mode on
    (shift+tab to cycle) · ←…\n","truncated":false,"workspace_id":"w1P"},"type":"pane_read"}}

• Ran herdr agent send sendtest-002 "echo hello"
  │ herdr agent read sendtest-002 --source visible --lines 8
  │ herdr pane send-keys w1P:p1S Enter
  │ … +2 lines
  └ {"id":"cli:agent:send","result":{"type":"ok"}}
    {"id":"cli:agent:read","result":{"read":{"format":"text","pane_id":"w1P:p1S","revision":0,"source":"visible","tab_id":"w1P:t1","text":"\n╭─ Claude Code
    … +14 lines (ctrl + t to view transcript)
    mcp\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n────────────────────────────────────────────\n❯ echo hello\n────────────────────────────────────────────\n
    M...  |  5h 28% → 17:30 · 7d 6% · mode? …\n  ⏵⏵ auto mode on (shift+tab to cycle)\n","truncated":false,"workspace_id":"w1P"},"type":"pane_read"}}

• Ran herdr pane send-keys w1P:p1S Enter
  │ herdr agent get sendtest-002
  │ herdr agent read sendtest-002 --source visible --lines 14
  └ {"id":"cli:agent:read","result":{"read":{"format":"text","pane_id":"w1P:p1S","revision":0,"source":"visible","tab_id":"w1P:t1","text":"\n╭─ Claude Code
    ────────────────────────────╮\n│                                          │\n│            Welcome back Neco!            │\n│                                          │\n│
    … +3 lines (ctrl + t to view transcript)
    6s\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n────────────────────────────────────────────\n❯\n────────────────────────────────────────────\n  M...  |  5h 28% → 17:30 · 7d
    6% · mode? …\n  ⏵⏵ auto mode on (shift+tab to cycle) · ←…\n","truncated":false,"workspace_id":"w1P"},"type":"pane_read"}}

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• The first Enter raced the asynchronous text injection and left echo hello parked; once a fresh read showed the injected text, Enter did submit it and the pane completed with hello. The
  command finished too quickly to observe a working status, so I won’t claim that transition yet. I’m now testing the prescribed clear keys in order.

• Ran herdr agent send sendtest-002 "DRAFT_TO_CLEAR"
  │ sleep 1
  │ herdr agent read sendtest-002 --source visible --lines 8
  │ … +4 lines
  └ {"id":"cli:agent:read","result":{"read":{"format":"text","pane_id":"w1P:p1S","revision":0,"source":"visible","tab_id":"w1P:t1","text":"\n╭─ Claude Code
    ────────────────────────────╮\n│                                          │\n│            Welcome back Neco!            │\n│                                          │\n│
    … +13 lines (ctrl + t to view transcript)
    tmp","name":"sendtest-002","pane_id":"w1P:p1S","revision":2,"tab_id":"w1P:t1","terminal_id":"term_656c8da0be0bdc1","terminal_title":"✳ Echo hello
    test","terminal_title_stripped":"Echo hello test","workspace_id":"w1P"},"type":"agent_info"}}

• Ran herdr pane send-keys w1P:p1S Ctrl+U
  │ sleep 1
  │ herdr agent read sendtest-002 --source visible --lines 8
  └ {"id":"cli:agent:read","result":{"read":{"format":"text","pane_id":"w1P:p1S","revision":0,"source":"visible","tab_id":"w1P:t1","text":"\n╭─ Claude Code
    ────────────────────────────╮\n│                                          │\n│            Welcome back Neco!            │\n│                                          │\n│
    … +4 lines (ctrl + t to view transcript)
    text\n────────────────────────────────────────────\n❯\n────────────────────────────────────────────\n  M...  |  5h 28% → 17:30 · 7d 6% · mode? …\n  ⏵⏵ auto mode on (shift+tab to
    cycle) · ←…\n","truncated":false,"workspace_id":"w1P"},"type":"pane_read"}}

• Ran herdr agent send sendtest-002 "AAA"
  │ sleep 1
  │ herdr agent read sendtest-002 --source visible --lines 6
  │ … +11 lines
  └ {"id":"cli:agent:read","result":{"read":{"format":"text","pane_id":"w1P:p1S","revision":0,"source":"visible","tab_id":"w1P:t1","text":"\n╭─ Claude Code
    ────────────────────────────╮\n│                                          │\n│            Welcome back Neco!            │\n│                                          │\n│
    … +31 lines (ctrl + t to view transcript)
    tmp","name":"sendtest-002","pane_id":"w1P:p1S","revision":2,"tab_id":"w1P:t1","terminal_id":"term_656c8da0be0bdc1","terminal_title":"✳ Echo hello
    test","terminal_title_stripped":"Echo hello test","workspace_id":"w1P"},"type":"agent_info"}}

• Ran sleep 1
  │ herdr agent get sendtest-002
  │ herdr agent read sendtest-002 --source visible --lines 14
  └ {"id":"cli:agent:get","result":{"agent":{"agent":"claude","agent_status":"working","cwd":"/private/tmp","focused":false,"foreground_cwd":"/private/
    tmp","name":"sendtest-002","pane_id":"w1P:p1S","revision":2,"tab_id":"w1P:t1","terminal_id":"term_656c8da0be0bdc1","terminal_title":"⠐ Echo hello
    … +7 lines (ctrl + t to view transcript)
    git worktrees to run multiple\n     Claude sessions in parallel.\n\n────────────────────────────────────────────\n❯\n────────────────────────────────────────────\n  M...  |  5h 28% →
    17:30 · 7d 6% · mode? …\n  ⏵⏵ auto mode on (shift+tab to cycle) · ←…\n","truncated":false,"workspace_id":"w1P"},"type":"pane_read"}}

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Live behavior is now fully pinned down: sequential sends produced AAABBB; Escape did not clear the draft; Ctrl+U did; and after clearing, sending the full prompt plus Enter produced an
  observed working state. I’ll let the scratch turn finish, capture the result, then close that pane before touching the docs.

• Ran sleep 10
  │ herdr agent get sendtest-002
  │ herdr agent read sendtest-002 --source visible --lines 14
  │ … +2 lines
  └ {"id":"cli:agent:get","result":{"agent":{"agent":"claude","agent_status":"done","cwd":"/private/tmp","focused":false,"foreground_cwd":"/private/
    tmp","name":"sendtest-002","pane_id":"w1P:p1S","revision":2,"tab_id":"w1P:t1","terminal_id":"term_656c8da0be0bdc1","terminal_title":"✳ Echo hello
    … +9 lines (ctrl + t to view transcript)
    {"id":"cli:pane:close","result":{"type":"ok"}}
    []

• Edited 3 files (+10 -10)
  └ skills/engineering/fleet-ship/SKILL.md (+8 -8)
    547    before `send`; submit is a separate `send-keys Enter`.
    548 -- **`agent send` REPLACES the prompt line - it does NOT append; and `send-keys Enter` alone CANNOT submit
    549 -  a human-typed parked draft (2026-07-10, bit twice in one session).** A bare Enter on a user-typed draft
    550 -  silently no-ops (pane stays idle, draft stays parked - verify status flipped to `working` after EVERY
    551 -  submit, never assume). And steering a pane that holds a parked draft CLOBBERS the draft (a user's
    552 -  'ping me when A14 lands' was overwritten by a steer). Correct protocol to submit a parked draft:
    553 -  (1) `agent read` to capture the draft text + log it, (2) `agent send <the same text>` (the replace
    554 -  makes it submittable), (3) `send-keys Enter`, (4) confirm status = `working`. Only then send your own
    555 -  steering as the next message.
    548 +- **`agent send` APPENDS to whatever is on the prompt line (verified live 2026-07-17); NEVER send onto a
    549 +  non-empty prompt.** The 2026-07-10 "replaces" reading was wrong: under append, steering a pane that holds
    550 +  a parked draft CORRUPTS it by concatenation, which is what that incident actually showed. A bare
    551 +  `send-keys Enter` on a human-typed parked draft still cannot be trusted to submit it; verify status flips
    552 +  to `working` after EVERY submit, never assume. Correct parked-draft submit protocol: (1) `agent read` to
    553 +  capture + log the draft, (2) `send-keys Ctrl+U`, then fresh-read to confirm an empty prompt, (3) `agent
    554 +  send <full intended text>`, then fresh-read to confirm it arrived intact, (4) `send-keys Enter`, (5)
    555 +  confirm status = `working`. Only then send your own steering as the next message.
    556  - **Name everything locally; qualify everything externally.** `agent start <chunk-id>` — the herdr NAME is

  └ skills/engineering/herdr-agent-orchestration/SKILL.md (+1 -1)
    36
    37 -Before every `send`, clear the prompt line: dismiss rating and approval overlays, and delete any unsent text the user left typed - `send` appends, so stray text corrupts your com
        mand. **Done when: a fresh `read` of the target shows idle with an empty prompt.**
    37 +Before every `send`, clear the prompt line: dismiss rating and approval overlays, and delete any unsent text the user left typed - `send` appends, so stray text corrupts your com
        mand (verified live 2026-07-17). **Done when: a fresh `read` of the target shows idle with an empty prompt.**
    38

  └ skills/engineering/herdr-agent-orchestration/herdr-cli.md (+1 -1)
    26  ## Input hygiene
    27 -Before `send`: `read --source visible` and confirm an empty prompt. Dismiss rating prompts (`0`), trust/hook prompts (select + `Enter`), and clear any user-typed text. `send` app
        ends to whatever is already there.
    27 +Before `send`: `read --source visible` and confirm an empty prompt. Dismiss rating prompts (`0`), trust/hook prompts (select + `Enter`), and clear any user-typed text. `send` app
        ends to whatever is already there (verified live 2026-07-17).

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• The docs now reflect only the observed recipe, including a fresh read after agent send because the live run exposed an asynchronous injection race. I’m running the full textual gates,
  fence checks, and diff review now; no fence edits or plan-index changes are being made.

• Ran set +e
  │ rg -n 'agent list --tab' skills/
  │ printf 'agent-list-tab-exit=%s\n' "$?"
  │ … +15 lines
  └ diff --git a/skills/engineering/fleet-ship/REFERENCE.md b/skills/engineering/fleet-ship/REFERENCE.md
    index 481c1c3..10f457b 100644
    … +68 lines (ctrl + t to view transcript)
    +Before `send`: `read --source visible` and confirm an empty prompt. Dismiss rating prompts (`0`), trust/hook prompts (select + `Enter`), and clear any user-typed text. `send`
    appends to whatever is already there (verified live 2026-07-17).

• Ran awk '/^```/{n++} END{print (n%2==0 ? "balanced" : "UNBALANCED")}' skills/engineering/fleet-ship/REFERENCE.md
  │ awk '/^```/{n++} END{print (n%2==0 ? "balanced" : "UNBALANCED")}' skills/engineering/herdr-agent-orchestration/SKILL.md
  │ awk '/^```/{n++} END{print (n%2==0 ? "balanced" : "UNBALANCED")}' skills/engineering/herdr-agent-orchestration/herdr-cli.md
  │ … +3 lines
  └ (no output)

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• All substantive gates pass: both stale-pattern searches are empty, all three Markdown files are fence-balanced, the archive heading remains visible, git diff --check is clean, and
  sendtest-002 is gone. The older plan’s unparenthesized awk ternary is not accepted by this macOS awk; the equivalent parenthesized check returned balanced. I’m staging exactly the four
  allowed files and making the mandated single commit.

• Ran git add skills/engineering/fleet-ship/REFERENCE.md skills/engineering/fleet-ship/SKILL.md skills/engineering/herdr-agent-orchestration/SKILL.md skills/engineering/
  │ herdr-agent-orchestration/herdr-cli.md
  │ git diff --cached --name-only
  │ … +3 lines
  └ [fix/fleet-ship-doc-fixes 3c24d26] fix(fleet-ship): send semantics are APPEND - rewrite hard rule + monitor tab-scoping
     4 files changed, 12 insertions(+), 12 deletions(-)

• Ran git rev-parse HEAD
  │ git status --short
  │ git show --stat --oneline --decorate --no-renames HEAD
  │ … +8 lines
  └ 3c24d2684670d2bbf0f22fca346a72d0f741d680
    3c24d26 (HEAD -> fix/fleet-ship-doc-fixes) fix(fleet-ship): send semantics are APPEND - rewrite hard rule + monitor tab-scoping
    … +8 lines (ctrl + t to view transcript)
    288:## Archive a pane result before close (housekeeping)
    []

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• The commit is complete and the post-commit worktree is clean. Final checks still show no stale agent list --tab or “REPLACES the prompt” claims, balanced fences, a visible archive
  heading, and no scratch pane. I’m writing the mandatory completion signal now as the last operation.

• Ran printf '%s mbp/001-doc-fixes DONE %s\n' "$(date -Iseconds)" 'committed APPEND semantics, verified Ctrl+U clear+send+Enter working, fixed monitor tab scoping' >> /tmp/
  │ fleet-improve-plans.signals
  └ (no output)

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Implemented and committed the brief fully.

  Commit: 3c24d2684670d2bbf0f22fca346a72d0f741d680

  Verified live:

  - agent send appends: AAA + BBB produced AAABBB.
  - Escape did not clear the prompt.
  - Ctrl+U cleared it.
  - Clear → send → Enter submitted successfully and status became working.
  - Monitor filtering returned the correct agent for a real tab.
  - No stale agent list --tab or REPLACES the prompt claims remain.
  - Markdown fences are balanced.
  - Scratch pane was closed.
  - Worktree was clean after commit.
  - Completion signal was appended.

  Concern: text injection is asynchronous, so the documented protocol includes a fresh read before pressing Enter. The plan’s unparenthesized awk ternary fails on macOS; its equivalent
  parenthesized check passed.

─ Worked for 5m 24s ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────


› Write tests for @filename

  gpt-5.6-sol medium · Context 77% left · ~/Projects/necmttn-skills/.worktrees/001-doc-fixes · gpt-5.6-sol · 001-doc-fixes · 258K window

