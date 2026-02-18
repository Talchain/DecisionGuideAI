#!/usr/bin/env bash
# claude-pre-push-gate.sh — Claude Code PreToolUse hook.
# Intercepts `git push` commands and runs pre-push validation first.
# Receives JSON on stdin from Claude Code with tool_input.command.
set -euo pipefail

# Read the hook input from stdin
INPUT="$(cat)"

# Extract the command being executed
COMMAND="$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"

# Only intercept git push commands
if ! echo "$COMMAND" | grep -qE '^\s*git\s+push'; then
  exit 0  # Allow — not a push command
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
VALIDATE_SCRIPT="$REPO_ROOT/scripts/pre-push-validate.sh"

if [ ! -x "$VALIDATE_SCRIPT" ]; then
  echo "pre-push-validate.sh not found or not executable" >&2
  exit 2  # Block
fi

# Run validation
if bash "$VALIDATE_SCRIPT"; then
  exit 0  # Allow — validation passed
else
  echo "Pre-push validation failed. Fix the issues above before pushing." >&2
  exit 2  # Block
fi
