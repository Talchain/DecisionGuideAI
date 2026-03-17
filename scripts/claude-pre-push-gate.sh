#!/usr/bin/env bash
# claude-pre-push-gate.sh — Claude Code PreToolUse hook.
# Intercepts `git push` commands and runs pre-push validation first.
# Receives JSON on stdin from Claude Code with tool_input.command.
set -euo pipefail

# Read the hook input from stdin
INPUT="$(cat)"

# Extract the command being executed — try jq first, fall back to grep/sed
if command -v jq >/dev/null 2>&1; then
  COMMAND="$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
else
  # Fallback: extract command value from JSON without jq
  COMMAND="$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/^"command"[[:space:]]*:[[:space:]]*"//; s/"$//')"
fi

# If extraction failed entirely, fail closed — block and explain
if [ -z "$INPUT" ]; then
  exit 0  # No input at all (not a Claude Code hook invocation)
fi

# Only intercept git push commands
if [ -z "$COMMAND" ] || ! echo "$COMMAND" | grep -qE '(^|&&|;|\|)\s*git\s+push'; then
  exit 0  # Allow — not a push command (or could not parse)
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
VALIDATE_SCRIPT="$REPO_ROOT/scripts/validate-prepush.sh"

if [ ! -x "$VALIDATE_SCRIPT" ]; then
  echo "validate-prepush.sh not found or not executable" >&2
  exit 2  # Block
fi

# Run validation
if bash "$VALIDATE_SCRIPT"; then
  exit 0  # Allow — validation passed
else
  echo "Pre-push validation failed. Fix the issues above before pushing." >&2
  exit 2  # Block
fi
