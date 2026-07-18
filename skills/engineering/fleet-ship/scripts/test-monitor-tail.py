#!/usr/bin/env python3
"""Regression checks for the fleet monitor-tail helper's public CLI."""

from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT = Path(__file__).with_name("monitor-tail.py")
LAUNCH_SCRIPT = Path(__file__).with_name("verify-codex-launch.sh")
TURN_TOKEN = "fleet-turn:chunk-71:1700000000"

BOOT_TAIL_A = """Starting MCP servers: sites-design-picker (12s elapsed)
• 12s elapsed • esc to interrupt
90% context left
"""
BOOT_TAIL_B = """Starting MCP servers: sites-design-picker (1m 12s elapsed)
• 1m 12s elapsed • esc to interrupt
89% context left
"""
ROTATING_SPINNER_A = "⠂ Starting MCP servers: sites-design-picker (1m 12s elapsed)\n"
ROTATING_SPINNER_B = "⠙ Starting MCP servers: sites-design-picker (1m 13s elapsed)\n"
MODEL_BRAILLE_A = "• The model rendered braille ⠋ as meaningful output.\n"
MODEL_BRAILLE_B = "• The model rendered braille ⠙ as meaningful output.\n"
CONTEXT_SENTENCE_A = "• I reduced orchestrator context by 40% with a smaller handoff.\n"
CONTEXT_SENTENCE_B = "• I reduced orchestrator context by 41% with a smaller handoff.\n"
ECHOED_PROMPT_TAIL = f"""Starting MCP servers: sites-design-picker (1m 12s elapsed)
› Read BRIEF.md and execute it fully [{TURN_TOKEN}]
"""
ECHOED_PROMPT_WITH_BOOT_CHROME_TAIL = f"""Starting MCP servers: sites-design-picker (1m 12s elapsed)
› Read BRIEF.md and execute it fully [{TURN_TOKEN}]
• 1m 12s elapsed • esc to interrupt
"""
REAL_OUTPUT_TAIL = f"""Starting MCP servers: sites-design-picker (1m 12s elapsed)
• 1m 12s elapsed • esc to interrupt
89% context left
Read BRIEF.md and execute it fully [{TURN_TOKEN}]
• I’ll inspect the brief and repository guidance first.
"""


def run(*args: str, stdin: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        input=stdin,
        text=True,
        capture_output=True,
        check=False,
    )


def fingerprint(text: str) -> str:
    result = run("fingerprint", stdin=text)
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def past_boot(status: str, tail: str) -> subprocess.CompletedProcess[str]:
    return run("past-boot", "--status", status, "--turn-token", TURN_TOKEN, stdin=tail)


def launch_with_fake_herdr() -> subprocess.CompletedProcess[str]:
    with tempfile.TemporaryDirectory() as temporary_directory:
        temporary_path = Path(temporary_directory)
        argument_log = temporary_path / "herdr-arguments"
        fake_bin = temporary_path / "bin"
        fake_bin.mkdir()
        fake_herdr = fake_bin / "herdr"
        fake_herdr.write_text(
            """#!/usr/bin/env bash
case "$1 $2" in
  "agent start") printf '%s\\n' "$@" > "$HERDR_ARGUMENT_LOG" ;;
  "agent get") printf '%s\\n' '{"result":{"agent":{"pane_id":"pane-71","agent_status":"working"}}}' ;;
  "agent read") token=$(tail -n 1 "$HERDR_ARGUMENT_LOG"); TOKEN="$token" python3 -c 'import json,os; print(json.dumps({"result":{"read":{"text":f"› {os.environ[\"TOKEN\"]}\\n• I am executing the brief.\\n"}}}))' ;;
esac
"""
        )
        fake_herdr.chmod(0o755)
        environment = {
            **os.environ,
            "PATH": f"{fake_bin}:{os.environ['PATH']}",
            "HERDR_ARGUMENT_LOG": str(argument_log),
            "CODEX_BOOT_INITIAL_DELAY_SECONDS": "0",
        }
        return subprocess.run(
            ["bash", str(LAUNCH_SCRIPT), "chunk-71", "/tmp/worktree", "tab-71", "machine/chunk-71", "fleet-71"],
            text=True,
            capture_output=True,
            check=False,
            env=environment,
        )


def main() -> None:
    launch_syntax = subprocess.run(["bash", "-n", str(LAUNCH_SCRIPT)], text=True, capture_output=True, check=False)
    assert launch_syntax.returncode == 0, launch_syntax.stderr
    launch = launch_with_fake_herdr()
    assert launch.returncode == 0, launch.stderr
    assert "BOOT_READY:machine/chunk-71 status=working" in launch.stdout, launch.stdout

    raw_a = hashlib.sha256(BOOT_TAIL_A.encode()).hexdigest()
    raw_b = hashlib.sha256(BOOT_TAIL_B.encode()).hexdigest()
    assert raw_a != raw_b, "fixture must demonstrate the old raw-tail failure"

    boot_a = fingerprint(BOOT_TAIL_A)
    boot_b = fingerprint(BOOT_TAIL_B)
    assert boot_a == boot_b, "volatile spinner elapsed time must not count as progress"
    assert fingerprint(ROTATING_SPINNER_A) == fingerprint(ROTATING_SPINNER_B), "startup braille frames must not count as progress"
    assert fingerprint(MODEL_BRAILLE_A) != fingerprint(MODEL_BRAILLE_B), "model braille must remain meaningful"
    assert fingerprint(CONTEXT_SENTENCE_A) != fingerprint(CONTEXT_SENTENCE_B), "model prose about context must remain meaningful"
    assert fingerprint(REAL_OUTPUT_TAIL) != boot_b, "meaningful agent output must count as progress"

    assert past_boot("working", BOOT_TAIL_B).returncode != 0, "startup UI is not a running argv turn"
    assert past_boot("working", ECHOED_PROMPT_TAIL).returncode != 0, "an echoed argv prompt is not execution evidence"
    assert past_boot("working", ECHOED_PROMPT_WITH_BOOT_CHROME_TAIL).returncode != 0, "trailing boot chrome is not execution evidence"
    assert past_boot("working", REAL_OUTPUT_TAIL).returncode == 0, "substantive post-prompt Codex activity proves the turn began"
    assert past_boot("done", REAL_OUTPUT_TAIL).returncode == 0, "a quickly finished argv turn is past boot"
    assert past_boot("unknown", REAL_OUTPUT_TAIL).returncode != 0, "unknown status is not launch proof"

    print("monitor-tail regression checks: PASS (15 assertions)")


if __name__ == "__main__":
    main()
