#!/usr/bin/env bash
# install-hooks.sh — Installs git hooks for the repository.
# Uses raw .git/hooks/ (no Husky or lefthook in this repo).
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPTS_DIR="$REPO_ROOT/scripts"

# Respect core.hooksPath if configured, otherwise use default .git/hooks
CUSTOM_HOOKS_PATH="$(git config core.hooksPath 2>/dev/null || true)"
if [ -n "$CUSTOM_HOOKS_PATH" ]; then
  # Resolve relative paths against repo root
  case "$CUSTOM_HOOKS_PATH" in
    /*) HOOKS_DIR="$CUSTOM_HOOKS_PATH" ;;
    *)  HOOKS_DIR="$REPO_ROOT/$CUSTOM_HOOKS_PATH" ;;
  esac
else
  HOOKS_DIR="$REPO_ROOT/.git/hooks"
fi

header() { printf '\033[1;34m── %s ──\033[0m\n' "$1"; }
pass()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
fail()   { printf '  \033[31m✗ %s\033[0m\n' "$1"; }
warn()   { printf '  \033[33m⚠ %s\033[0m\n' "$1"; }

header "Installing git hooks"

if [ -n "$CUSTOM_HOOKS_PATH" ]; then
  warn "Using core.hooksPath: $HOOKS_DIR"
fi

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# ─── pre-push hook ─────────────────────────────────────────────────────
PRE_PUSH_HOOK="$HOOKS_DIR/pre-push"
PRE_PUSH_SCRIPT="$SCRIPTS_DIR/validate-prepush.sh"

if [ ! -f "$PRE_PUSH_SCRIPT" ]; then
  fail "scripts/validate-prepush.sh not found"
  exit 1
fi

cat > "$PRE_PUSH_HOOK" << 'HOOK'
#!/usr/bin/env bash
# Git pre-push hook — delegates to scripts/validate-prepush.sh (fast gate).
# The full test suite runs in CI post-push (staging-full-tests.yml).
# Stdin (ref info) is forwarded so the script can parse destination refs.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

exec bash "$REPO_ROOT/scripts/validate-prepush.sh"
HOOK

chmod +x "$PRE_PUSH_HOOK"
pass "pre-push hook installed at .git/hooks/pre-push"

# ─── Verify setup ──────────────────────────────────────────────────────
header "Verifying setup"

ERRORS=0

if [ ! -x "$PRE_PUSH_HOOK" ]; then
  fail ".git/hooks/pre-push is not executable"
  ERRORS=1
else
  pass ".git/hooks/pre-push is executable"
fi

if [ ! -x "$PRE_PUSH_SCRIPT" ]; then
  fail "scripts/validate-prepush.sh is not executable"
  ERRORS=1
else
  pass "scripts/validate-prepush.sh is executable"
fi

# Verify hook content references the fast validation script
if grep -q "validate-prepush.sh" "$PRE_PUSH_HOOK"; then
  pass "Hook delegates to validate-prepush.sh"
else
  fail "Hook does not reference validate-prepush.sh"
  ERRORS=1
fi

if [ "$ERRORS" -eq 0 ]; then
  printf '\n\033[1;32m▸ Hook installation complete\033[0m\n'
else
  printf '\n\033[1;31m▸ Installation completed with errors\033[0m\n'
  exit 1
fi
