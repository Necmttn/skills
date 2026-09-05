#!/usr/bin/env bun
// session-handoff: render a HANDOFF.md for a pane whose agent can no longer write one
// (usage limit, crash, closed). The transcript on disk is the carrier.
//
//   bun session-handoff.ts <herdr pane id | agent name | session id | transcript path> [--out FILE] [--tail N]
//
// Resolves the transcript (codex rollout jsonl or claude project jsonl), then prints:
// goal (first real user message), every later user message (the steering), files edited,
// commands run, the last assistant message, and the live git state of the cwd.
// Secrets are redacted by pattern; the successor is told where the raw line lives.
import { Cause, Effect, FileSystem } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { BunServices } from "@effect/platform-bun"

type Turn =
  | { kind: "user"; text: string; at?: string }
  | { kind: "assistant"; text: string; at?: string }
  | { kind: "tool"; name: string; detail: string; at?: string }

interface Transcript {
  readonly engine: "codex" | "claude"
  readonly sessionId: string
  readonly cwd: string
  readonly path: string
  readonly turns: ReadonlyArray<Turn>
}

const SECRET = /\b(sk_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|appl_[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g
const redact = (s: string) => s.replace(SECRET, (m) => `${m.slice(0, 4)}…REDACTED`)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s)
const isBoilerplate = (t: string) => t.startsWith("# AGENTS.md instructions") || t.startsWith("<INSTRUCTIONS>") || t.startsWith("<environment_context>") || t.startsWith("<system-reminder>")

// ---------- parsers ----------
const parseCodex = (lines: ReadonlyArray<string>, path: string): Transcript => {
  let sessionId = ""
  let cwd = ""
  const turns: Turn[] = []
  for (const line of lines) {
    let r: any
    try { r = JSON.parse(line) } catch { continue }
    const p = r.payload ?? {}
    if (r.type === "session_meta") { sessionId = p.id ?? ""; cwd = p.cwd ?? cwd; continue }
    if (r.type === "turn_context" && p.cwd) { cwd = p.cwd; continue }
    if (r.type !== "response_item") continue
    const at = r.timestamp
    if (p.type === "message") {
      const text = (p.content ?? []).map((c: any) => c.text ?? c.input_text ?? c.output_text ?? "").join("\n").trim()
      if (!text) continue
      if (p.role === "user") { if (!isBoilerplate(text)) turns.push({ kind: "user", text, at }) }
      else if (p.role === "assistant") turns.push({ kind: "assistant", text, at })
    } else if (p.type === "function_call" || p.type === "custom_tool_call") {
      const raw = p.arguments ?? p.input ?? ""
      let detail = typeof raw === "string" ? raw : JSON.stringify(raw)
      const cmd = /cmd:\s*"((?:[^"\\]|\\.)*)"/.exec(detail) ?? /"command":\s*"((?:[^"\\]|\\.)*)"/.exec(detail)
      if (cmd) detail = cmd[1]!.replace(/\\"/g, '"').replace(/\\n/g, "\n")
      turns.push({ kind: "tool", name: p.name ?? "tool", detail, at })
    }
  }
  return { engine: "codex", sessionId, cwd, path, turns }
}

const parseClaude = (lines: ReadonlyArray<string>, path: string): Transcript => {
  let sessionId = ""
  let cwd = ""
  const turns: Turn[] = []
  for (const line of lines) {
    let r: any
    try { r = JSON.parse(line) } catch { continue }
    if (r.sessionId) sessionId = r.sessionId
    if (r.cwd) cwd = r.cwd
    const at = r.timestamp
    const content = r.message?.content
    if (r.type === "user") {
      if (typeof content === "string") { if (!isBoilerplate(content)) turns.push({ kind: "user", text: content, at }) }
      else if (Array.isArray(content)) {
        const text = content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim()
        if (text && !isBoilerplate(text)) turns.push({ kind: "user", text, at })
      }
    } else if (r.type === "assistant" && Array.isArray(content)) {
      for (const c of content) {
        if (c.type === "text" && c.text?.trim()) turns.push({ kind: "assistant", text: c.text.trim(), at })
        if (c.type === "tool_use") {
          const i = c.input ?? {}
          const detail = i.command ?? i.file_path ?? i.pattern ?? i.prompt ?? JSON.stringify(i)
          turns.push({ kind: "tool", name: c.name ?? "tool", detail: String(detail), at })
        }
      }
    }
  }
  return { engine: "claude", sessionId, cwd, path, turns }
}

// ---------- resolution ----------
const sh = (cmd: string, args: ReadonlyArray<string>, cwd?: string) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const c = ChildProcess.make(cmd, [...args], cwd ? { cwd } : undefined)
    return (yield* spawner.string(c).pipe(Effect.orElseSucceed(() => ""))).trim()
  })

const resolveTranscript = (target: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const home = process.env.HOME ?? ""
    if (yield* fs.exists(target)) return { file: target, cwdHint: "" }
    let sessionId = target
    let cwdHint = ""
    if (!/^[0-9a-f-]{20,}$/i.test(target)) {
      const out = yield* sh("herdr", ["agent", "get", target])
      if (!out) return yield* Effect.fail(new Error(`herdr agent get ${target} returned nothing`))
      const j = JSON.parse(out)
      sessionId = j.result?.agent?.agent_session?.value ?? ""
      cwdHint = j.result?.agent?.cwd ?? ""
      if (!sessionId) return yield* Effect.fail(new Error(`pane ${target} has no agent_session (integration not installed?)`))
    }
    const found = yield* sh("fd", ["--type", "f", "--absolute-path", sessionId, `${home}/.codex/sessions`, `${home}/.claude/projects`])
    const file = found.split("\n").filter(Boolean).find((f) => f.endsWith(".jsonl"))
    if (!file) return yield* Effect.fail(new Error(`no transcript found for session ${sessionId}`))
    return { file, cwdHint }
  })

// ---------- render ----------
const render = (t: Transcript, git: { branch: string; status: string; log: string }, tail: number, source: string) => {
  const users = t.turns.filter((x): x is Extract<Turn, { kind: "user" }> => x.kind === "user")
  const goal = users[0]?.text ?? "(no user message found)"
  const steering = users.slice(1)
  const tools = t.turns.filter((x): x is Extract<Turn, { kind: "tool" }> => x.kind === "tool")
  const edits = [...new Set(tools.filter((x) => /edit|write|apply_patch|multiedit|notebook/i.test(x.name)).map((x) => x.detail.split("\n")[0]!))]
  const cmds = tools.filter((x) => /bash|exec|shell|command/i.test(x.name)).map((x) => x.detail.split("\n")[0]!)
  const lastAssistant = [...t.turns].reverse().find((x) => x.kind === "assistant")
  const recent = t.turns.slice(-tail)
  const started = t.turns[0]?.at ?? "?"
  const ended = t.turns.at(-1)?.at ?? "?"
  const L: string[] = []
  L.push(`# HANDOFF (reconstructed): ${t.engine} session ${t.sessionId}`)
  L.push(``, `The agent that owned this work can no longer write its own handoff. This file was rendered from its transcript on disk. Treat it as the carrier: read it, verify against git, then continue.`)
  L.push(``, `- Transcript: ${t.path}`, `- Source pane/name: ${source}`, `- cwd: ${t.cwd}`, `- Span: ${started} -> ${ended}`, `- Turns: ${t.turns.length} (${users.length} user, ${tools.length} tool calls)`)
  L.push(``, `## Goal (first user message)`, ``, redact(clip(goal, 2500)))
  if (steering.length) {
    L.push(``, `## Steering (every later user message, in order)`)
    for (const u of steering) L.push(``, `- ${u.at ?? ""} ${redact(clip(u.text.replace(/\s+/g, " "), 600))}`)
  }
  L.push(``, `## Git state of cwd (live, not from the transcript)`, ``, `- branch: ${git.branch || "?"}`, ``, "```", git.status || "(clean)", "```", ``, "```", git.log, "```")
  L.push(``, `## Files the agent edited (${edits.length})`)
  for (const e of edits) L.push(`- ${e}`)
  L.push(``, `## Last assistant message (what it believed the state was)`, ``, redact(lastAssistant?.text ?? "(none)"))
  L.push(``, `## Last ${recent.length} turns`)
  for (const r of recent) {
    if (r.kind === "user") L.push(``, `**user** ${r.at ?? ""}: ${redact(clip(r.text.replace(/\s+/g, " "), 400))}`)
    else if (r.kind === "assistant") L.push(``, `**assistant** ${r.at ?? ""}: ${redact(clip(r.text.replace(/\s+/g, " "), 600))}`)
    else L.push(`- tool ${r.name}: ${redact(clip(r.detail.replace(/\s+/g, " "), 200))}`)
  }
  L.push(``, `## Commands run (${cmds.length}, last 40)`)
  for (const c of cmds.slice(-40)) L.push(`- ${redact(clip(c.replace(/\s+/g, " "), 160))}`)
  L.push(``, `## Successor checklist`, `1. Confirm the git state above matches the last assistant message; the transcript is what the agent believed, git is what is true.`, `2. Anything the owner pasted (keys, decisions) sits in the Steering section; secrets are redacted here, the raw line is in the transcript file.`, `3. Do not redo finished work. Start from the first unfinished item in the last assistant message.`, `4. Write your own handoff early (REFERENCE 'Rotation handoff schema') so the next rescue does not need this tool.`)
  return L.join("\n")
}

// ---------- main ----------
const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const argv = process.argv.slice(2)
  const target = argv.find((a) => !a.startsWith("--"))
  if (!target) return yield* Effect.fail(new Error("usage: session-handoff.ts <pane|name|session-id|transcript> [--out FILE] [--tail N]"))
  const out = argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : undefined
  const tail = argv.includes("--tail") ? Number(argv[argv.indexOf("--tail") + 1]) : 30
  const { file, cwdHint } = yield* resolveTranscript(target)
  const lines = (yield* fs.readFileString(file)).split("\n")
  const t = file.includes("/.codex/") ? parseCodex(lines, file) : parseClaude(lines, file)
  const cwd = t.cwd || cwdHint
  const git = {
    branch: yield* sh("git", ["branch", "--show-current"], cwd),
    status: yield* sh("git", ["status", "--short"], cwd),
    log: yield* sh("git", ["log", "--oneline", "-8"], cwd),
  }
  const md = render({ ...t, cwd }, git, tail, target)
  if (out) { yield* fs.writeFileString(out, md); console.log(`wrote ${out}`) } else console.log(md)
})

program.pipe(
  Effect.provide(BunServices.layer),
  Effect.catchCause((c) => Effect.sync(() => { console.error(`session-handoff: ${Cause.pretty(c)}`); process.exitCode = 1 })),
  Effect.runPromise,
)
