#!/usr/bin/env python3
"""Normalize volatile fleet-pane terminal UI before liveness decisions.

This deliberately recognizes only known Codex terminal chrome: startup elapsed
timers and braille frames on ``Starting MCP servers`` lines, the ``esc to
interrupt`` hint, and anchored context-percentage footers. Commands, logs,
model output, errors, and every other line remain part of the fingerprint.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys


ANSI_ESCAPE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")
STARTING_MCP = re.compile(r"(?i)\bstarting MCP servers:\s*")
LEADING_BRAILLE_SPINNER = re.compile(r"^\s*[⠁-⠿]\s*")
ELAPSED = re.compile(
    r"(?ix)\(?\s*(?:elapsed(?:\s+time)?\s*[:=]?\s*)?"
    r"\d+(?:\.\d+)?\s*(?:ms|s|sec(?:onds?)?|m|min(?:utes?)?|h|hours?)"
    r"(?:\s+\d+(?:\.\d+)?\s*(?:ms|s|sec(?:onds?)?|m|min(?:utes?)?|h|hours?))*\s*\)?"
)
ESC_TO_INTERRUPT = re.compile(r"(?i)\besc\s+to\s+interrupt\b")
CONTEXT_FOOTER = re.compile(
    r"""(?ix)
    ^\s*(?:
        \d{1,3}%\s+context\s+left
        |
        (?:[\w./-]+(?:\s+[\w./-]+){0,2}\s+·\s+)?context\s+\d{1,3}%\s+left
    )(?:\s+·\s+\S.*)?\s*$
    """
)
BARE_DECORATION = re.compile(r"^[\s|·•—─()\[\]<>]+$")
CODEX_ACTIVITY = re.compile(r"^\s*•\s+(?=.*[A-Za-z0-9]).+$")


def normalize_tail(text: str) -> str:
    """Return terminal text with known volatile Codex chrome made stable."""
    normalized_lines: list[str] = []
    for raw_line in ANSI_ESCAPE.sub("", text).replace("\r", "\n").splitlines():
        line = raw_line.rstrip()
        if CONTEXT_FOOTER.search(line):
            continue
        if STARTING_MCP.search(line):
            line = LEADING_BRAILLE_SPINNER.sub("", line)
            line = ELAPSED.sub("<elapsed>", line)
        if ESC_TO_INTERRUPT.search(line):
            line = ESC_TO_INTERRUPT.sub("", line)
            line = ELAPSED.sub("<elapsed>", line)
        if BARE_DECORATION.fullmatch(line):
            continue
        normalized_lines.append(line)
    return "\n".join(normalized_lines)


def command_fingerprint() -> int:
    normalized = normalize_tail(sys.stdin.read())
    print(hashlib.sha256(normalized.encode()).hexdigest())
    return 0


def command_past_boot(status: str, turn_token: str) -> int:
    normalized = normalize_tail(sys.stdin.read())
    if status not in {"working", "idle", "done"}:
        print(f"past-boot: status {status!r} is not an active or completed turn", file=sys.stderr)
        return 1
    lines = normalized.splitlines()
    try:
        prompt_line = next(index for index, line in enumerate(lines) if turn_token in line)
    except StopIteration:
        print("past-boot: argv turn token is absent from normalized pane tail", file=sys.stderr)
        return 1
    if not any(CODEX_ACTIVITY.match(line) for line in lines[prompt_line + 1 :]):
        print("past-boot: no substantive Codex activity follows the argv prompt", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("fingerprint", help="print a SHA-256 of normalized stdin")
    past_boot = subcommands.add_parser("past-boot", help="prove an argv turn made it past startup")
    past_boot.add_argument("--status", required=True)
    past_boot.add_argument("--turn-token", required=True)
    args = parser.parse_args()

    if args.command == "fingerprint":
        return command_fingerprint()
    return command_past_boot(args.status, args.turn_token)


if __name__ == "__main__":
    raise SystemExit(main())
