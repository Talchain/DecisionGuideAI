#!/usr/bin/env bash
# Runs the throwaway PR-B vitest files in a CEE worktree with NO provider credentials and NO proxy.
# usage: run-prb-cee.sh <cee-worktree> <vitest file filter...>
set -u
WT="$1"; shift
# The loopback egress proxy port — blocked by the guard even though it is loopback.
PROXY_PORT="$(printf '%s' "${HTTPS_PROXY:-${https_proxy:-}}" | sed -E 's#.*:([0-9]+)/?$#\1#')"
case "$PROXY_PORT" in (''|*[!0-9]*) PROXY_PORT=45543 ;; esac
export PRB_EXTRA_BLOCKED_PORT="$PROXY_PORT"
# Unset EVERY proxy-shaped variable (not just the usual eight), plus the provider base URL.
for v in $(env | cut -d= -f1 | grep -i -E 'proxy$'); do unset "$v"; done
unset ANTHROPIC_BASE_URL NO_PROXY no_proxy GLOBAL_AGENT_NO_PROXY npm_config_noproxy
export OPENAI_API_KEY=
export ANTHROPIC_API_KEY=
cd "$WT" || exit 99
echo "[run-prb] cwd=$(pwd) head=$(git rev-parse HEAD)"
echo "[run-prb] OPENAI_API_KEY='${OPENAI_API_KEY}' ANTHROPIC_API_KEY='${ANTHROPIC_API_KEY}' ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL-<unset>} HTTPS_PROXY=${HTTPS_PROXY-<unset>} blocked-proxy-port=${PRB_EXTRA_BLOCKED_PORT}"
echo "[run-prb] proxy-shaped vars still set: [$(env | cut -d= -f1 | grep -i -E 'proxy$' | tr '\n' ' ')]"
timeout 600 ./node_modules/.bin/vitest run -c vitest.prb.config.ts "$@"
rc=$?
echo "[run-prb] vitest exit code: $rc"
exit $rc
