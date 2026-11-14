#!/bin/zsh
set -eu
while ! mkdir /tmp/olumi-browser.lock 2>/dev/null; do
  age=$(( $(date +%s) - $(stat -f %m /tmp/olumi-browser.lock) ))
  if (( age > 1200 )); then rmdir /tmp/olumi-browser.lock 2>/dev/null || true; else sleep 30; fi
done
trap 'rmdir /tmp/olumi-browser.lock' EXIT INT TERM
/Users/paulslee/olumi-work/recovery/tools-dl/heavy.sh "$@"
