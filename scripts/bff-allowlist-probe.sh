#!/usr/bin/env bash
#
# POST-DEPLOY PROBE — BFF service-key path allowlist (disposition item 13).
#
# This is the deploy-verify for the change that added a per-proxy upstream PATH
# allowlist + traversal guard + ISL method gate to the four credential-injecting
# Netlify edge functions. Run it against the deployed host AFTER the deploy goes
# live; a green run is the witness that the bound is real and that no live UI call
# was false-404'd by it.
#
#   bash scripts/bff-allowlist-probe.sh [BASE_URL]
#
# Default BASE_URL is https://staging--olumi.netlify.app.
#
# ── WHAT IT ASSERTS, AND WHY THE BODY MATTERS ──────────────────────────────────
# MATRIX A — on-list routes MUST NOT be blocked by the edge. These are the paths
#   the deployed UI genuinely calls. Any status is acceptable EXCEPT an edge block
#   (a 404 whose body is exactly the edge's `{"error":"Not found"}`, or a 405).
#   Upstream 401/404/422/500 are all fine here: the point is that the request
#   REACHED the upstream. ⚠ Asserting only the status could not tell an edge block
#   from an upstream 404 — hence the body check.
# MATRIX B — off-list routes MUST be blocked BY THE EDGE: HTTP 404 with body
#   exactly {"error":"Not found"}. An upstream 404 would have a different body and
#   would mean the credential was forwarded — a FAIL, not a pass.
# MATRIX C — the four defects the #685 review witnessed pre-fix. Each MUST now be
#   edge-blocked. If any of these forwards, the fix has regressed.
#
# Every probe sends an allow-listed Origin, because the proxies reject an unknown
# origin at 403 before any of this logic runs — without it the whole matrix would
# "pass" for the wrong reason.
#
# NO CREDENTIALS are sent or printed. The proxies inject the service key
# server-side; this script never sees it.

set -euo pipefail

BASE="${1:-https://staging--olumi.netlify.app}"
ORIGIN="https://staging--olumi.netlify.app"
EDGE_BLOCK_BODY='{"error":"Not found"}'

pass=0; fail=0
FAILURES=()

# probe <method> <path> -> sets REPLY_STATUS / REPLY_BODY
probe() {
  local method="$1" path="$2" out
  if [ "$method" = "GET" ] || [ "$method" = "HEAD" ]; then
    out="$(curl -sS -X "$method" -H "Origin: $ORIGIN" -w $'\n%{http_code}' --max-time 30 "$BASE$path" 2>/dev/null || true)"
  else
    out="$(curl -sS -X "$method" -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
             --data '{}' -w $'\n%{http_code}' --max-time 30 "$BASE$path" 2>/dev/null || true)"
  fi
  REPLY_STATUS="$(printf '%s' "$out" | tail -n1)"
  REPLY_BODY="$(printf '%s' "$out" | sed '$d' | tr -d '\r\n')"
}

is_edge_block() {
  # An edge block is 405, or a 404 whose body is exactly the edge's sentinel.
  [ "$REPLY_STATUS" = "405" ] && return 0
  [ "$REPLY_STATUS" = "404" ] && [ "$REPLY_BODY" = "$EDGE_BLOCK_BODY" ] && return 0
  return 1
}

ok()   { pass=$((pass+1)); printf '  PASS  %-6s %-58s -> %s\n' "$1" "$2" "$3"; }
bad()  { fail=$((fail+1)); FAILURES+=("$1 $2 :: $3"); printf '  FAIL  %-6s %-58s -> %s\n' "$1" "$2" "$3"; }

must_not_be_edge_blocked() {
  probe "$1" "$2"
  if is_edge_block; then
    bad "$1" "$2" "EDGE-BLOCKED ($REPLY_STATUS $REPLY_BODY) — a real UI call was false-blocked"
  else
    ok "$1" "$2" "reached upstream ($REPLY_STATUS)"
  fi
}

must_be_edge_blocked() {
  probe "$1" "$2"
  if [ "$REPLY_STATUS" = "404" ] && [ "$REPLY_BODY" = "$EDGE_BLOCK_BODY" ]; then
    ok "$1" "$2" "404 edge-blocked, body verified"
  elif [ "$REPLY_STATUS" = "404" ]; then
    bad "$1" "$2" "404 but body=[$REPLY_BODY] — looks like an UPSTREAM 404, i.e. the key was forwarded"
  else
    bad "$1" "$2" "NOT blocked ($REPLY_STATUS) — credential forwarded off-list"
  fi
}

must_be_method_blocked() {
  probe "$1" "$2"
  if [ "$REPLY_STATUS" = "405" ]; then
    ok "$1" "$2" "405 method-blocked at the edge"
  else
    bad "$1" "$2" "NOT method-blocked ($REPLY_STATUS) — authenticated verb reached upstream"
  fi
}

echo "BFF allowlist probe — base: $BASE"
echo

echo "── MATRIX A: on-list routes MUST NOT be edge-blocked (real UI calls) ──"
# cee (13)
must_not_be_edge_blocked GET  /bff/cee/health
must_not_be_edge_blocked POST /bff/cee/graph-readiness
must_not_be_edge_blocked POST /bff/cee/ask
must_not_be_edge_blocked POST /bff/cee/bias-check
must_not_be_edge_blocked POST /bff/cee/sensitivity-coach
must_not_be_edge_blocked POST /bff/cee/elicit-belief
must_not_be_edge_blocked POST /bff/cee/suggest-edge-function
must_not_be_edge_blocked POST /bff/cee/prompts/warm
must_not_be_edge_blocked POST /bff/cee/draft-graph
must_not_be_edge_blocked POST /bff/cee/scenarios/00000000-0000-0000-0000-000000000000/graph
must_not_be_edge_blocked POST /bff/cee/scenarios/00000000-0000-0000-0000-000000000000/graph/register
must_not_be_edge_blocked POST /bff/cee/decision-records/commit
must_not_be_edge_blocked POST /bff/cee/decision-records/00000000-0000-0000-0000-000000000000/outcome
# orchestrate (6) — BOTH version families; v1 is live in turnService.ts
must_not_be_edge_blocked POST /bff/orchestrate/v1/turn
must_not_be_edge_blocked POST /bff/orchestrate/v1/turn/stream
must_not_be_edge_blocked POST /bff/orchestrate/v1/turn/stop
must_not_be_edge_blocked POST /bff/orchestrate/v2/turn
must_not_be_edge_blocked POST /bff/orchestrate/v2/turn/stream
must_not_be_edge_blocked POST /bff/orchestrate/v2/turn/stop
# collab (6)
must_not_be_edge_blocked POST /bff/collab/rounds
must_not_be_edge_blocked POST /bff/collab/rounds/00000000-0000-0000-0000-000000000000/close
must_not_be_edge_blocked GET  /bff/collab/rounds/00000000-0000-0000-0000-000000000000/reveal
must_not_be_edge_blocked GET  /bff/collab/packet/00000000-0000-0000-0000-000000000000
must_not_be_edge_blocked POST /bff/collab/packet/00000000-0000-0000-0000-000000000000/events
must_not_be_edge_blocked GET  /bff/collab/packet/00000000-0000-0000-0000-000000000000/reveal
# isl (7)
must_not_be_edge_blocked GET  /bff/isl/health
must_not_be_edge_blocked POST /bff/isl/validate
must_not_be_edge_blocked POST /bff/isl/conformal
must_not_be_edge_blocked POST /bff/isl/compare
must_not_be_edge_blocked POST /bff/isl/explain/contrastive
must_not_be_edge_blocked POST /bff/isl/api/v1/robustness/analyze
must_not_be_edge_blocked POST /bff/isl/api/v1/causal/counterfactual/conformal
echo

echo "── MATRIX B: off-list routes MUST be edge-blocked (404 + exact body) ──"
must_be_edge_blocked POST /bff/cee/decision-review
must_be_edge_blocked POST /bff/cee/review
must_be_edge_blocked POST /bff/cee/options
must_be_edge_blocked POST /bff/cee/isl-synthesis
must_be_edge_blocked POST /bff/orchestrate/v2/turn/replay
must_be_edge_blocked POST /bff/orchestrate/admin
must_be_edge_blocked POST /bff/collab/admin
must_be_edge_blocked GET  /bff/isl/admin/secrets
must_be_edge_blocked POST /bff/cee/scenarios/abc%2f..%2fsecret/graph
must_be_edge_blocked POST /bff/cee/%2e%2e/assist/v1/decision-review
echo

echo "── MATRIX C: the four #685-review defects — MUST now be blocked ──"
must_be_edge_blocked   GET    /bff/isl/api/v1/admin/secrets    # D1: was 200 FORWARDED with bearer
must_be_edge_blocked   GET    /bff/isl/explain/anything/at/all # D1: was 200 FORWARDED
must_be_method_blocked PUT    /bff/isl/validate                # D2: was forwarded with bearer
must_be_method_blocked DELETE /bff/isl/validate                # D2: was forwarded with bearer
echo

echo "── D3 regression: an on-list route with an encoded slash in the QUERY ──"
must_not_be_edge_blocked POST '/bff/cee/ask?q=a%2Fb'
echo

echo "════════════════════════════════════════════"
echo "PASS: $pass    FAIL: $fail"
if [ "$fail" -ne 0 ]; then
  echo
  echo "FAILURES:"
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  exit 1
fi
echo "ALL PROBES GREEN"
