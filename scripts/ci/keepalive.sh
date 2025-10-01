#!/usr/bin/env bash
set -euo pipefail
# Prints a dot every 25s to keep the shell session alive while a child command runs
( while true; do printf "."; sleep 25; done ) &
KA_PID=$!
# Forward exit code of the wrapped command
bash -lc "$*"
RC=$?
kill $KA_PID >/dev/null 2>&1 || true
echo
exit $RC
