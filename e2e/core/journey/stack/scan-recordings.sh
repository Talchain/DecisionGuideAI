#!/usr/bin/env bash
# J1 · gate before committing a frozen LLM set: no credential may be in it.
#
# Scans every recording for provider keys, bearer tokens and JWTs. Two controls run
# first, in the same invocation, so a silent scanner cannot pass:
#   1. a planted canary file of each shape MUST be caught;
#   2. every recording MUST be seen (its "signature" field counted).
# usage: scan-recordings.sh <fixtures dir>      exit 0 clean · 1 credential found · 2 could not measure
set -uo pipefail
DIR="$1"
PATTERN='sk-[A-Za-z0-9_-]{16,}|[Bb]earer [A-Za-z0-9._~+/-]{16,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{10,}'

files=("$DIR"/[0-9]*.json)
[ -e "${files[0]}" ] || { echo "[scan] no recordings in $DIR: could not measure"; exit 2; }

canary="$(mktemp -d)"
printf '{"a":"sk-CANARYcanary0123456789abcd","b":"Bearer CANARYcanary0123456789","c":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcnkifQ.x","d":"sb_secret_CANARYcanary01"}' > "$canary/0000-canary.json"
caught=$(grep -E -o "$PATTERN" "$canary/0000-canary.json" | wc -l | tr -d ' ')
rm -rf "$canary"
[ "$caught" -eq 4 ] || { echo "[scan] control FAILED: the pattern caught $caught of 4 planted shapes"; exit 2; }

seen=$(grep -l '"signature"' "${files[@]}" | wc -l | tr -d ' ')
[ "$seen" -eq "${#files[@]}" ] || { echo "[scan] control FAILED: saw $seen of ${#files[@]} recordings"; exit 2; }

hits=$(grep -E -l "$PATTERN" "${files[@]}" || true)
if [ -n "$hits" ]; then
  echo "[scan] CREDENTIAL SHAPE FOUND in:"; echo "$hits" | sed 's/^/  /'
  echo "[scan] (values not printed)"; exit 1
fi
echo "[scan] clean: ${#files[@]} recordings, 0 credential shapes (controls: 4/4 canaries caught, ${seen}/${#files[@]} files seen)"
