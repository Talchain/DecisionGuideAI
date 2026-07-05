# `/bff/engine` browser-504 — Lane B diagnosis (2026-07-05, afternoon)

**Outcome: the fault no longer reproduces.** The morning's demo-blocking failure (browser
POSTs to `/bff/engine/v1/run` 504 at ~30s, 5/5, while curl succeeded in <1s) cleared before
any code change was made. Per the lane's pivot rule, **no speculative fix was shipped**.
This document records the reproduction attempt, the evidence-backed explanation of the
curl-succeeds/browser-504 asymmetry, the external ownership finding, the recurrence
runbook, and the separate PLoT CORS item.

Everything below is labelled with the environment that proves it:
`[staging-browser]` = deployed staging in real Chrome · `[curl]` = local curl ·
`[headless-h3]` = forced-QUIC headless Chrome probes · `[code]` = code inspection only.

---

## 1. Reproduction attempt — fault absent `[staging-browser]`

Environment: deployed staging (`https://staging--olumi.netlify.app/#/canvas`), real Chrome
(the same browser/profile as the morning audit), same day (2026-07-05 afternoon).

| Probe | Result |
|---|---|
| GET `/bff/engine/version` | 200 in 694ms |
| POST `/v1/run`, tiny `{}` body, minimal headers | 400 in 147ms (fast validation = round-trip works) |
| POST `/v1/run`, tiny body, **full app header set** (`x-olumi-sdk`, `Idempotency-Key`, `x-scm-lite`, `x-olumi-payload-hash`, `x-olumi-client-build`, `X-Request-Id`) | 400 in 99ms |
| POST `/v1/run`, representative body, minimal headers | 200 in 196ms |
| POST `/v1/run`, representative body, full headers ×5 (unique `Idempotency-Key` each) | 200 ×5: 251 / 210 / 167 / 193 ms (+1 in first battery) |
| **App-triggered real run** (canvas ⌘Enter → `useResultsRun` → `httpV1Adapter`) | `/version` 200 (751ms) then POST `/v1/run` **200 in 230ms** (captured via network inspector, `statusCode: 200`) |
| POST through the `/bff/cee/*` redirect (control) | 404 in 248ms (fast — redirect transport healthy) |

- Representative payload: 16 nodes (1 goal, 1 decision, 4 options, 5 factors, 3 risks,
  2 outcomes), 31 edges, thin-path V1 shape, **2,665 bytes** — mirrors the audit scenario
  (16 nodes / 31 edges).
- **6/6 representative-payload browser POSTs succeeded**, plus the real app-triggered run.
- Probes were page-context `fetch()` calls in the staging tab (diagnostic evidence-gathering
  only, nothing installed or shipped; **no reroute wrappers used** — all requests went
  through the intended `/bff/engine` route on the app origin).

**Negotiated protocol: all of today's requests rode HTTP/2** (`nextHopProtocol === 'h2'`
from resource timing). Chrome would not upgrade the staging origin to HTTP/3 — see §2,
this is itself a finding, not an accident.

## 2. Transport finding — HTTP/3 to Netlify's edge is broken from this vantage `[headless-h3]`

Forced-QUIC probes (headless Chrome, `--origin-to-force-quic-on=<host>:443`, scratch
profiles, GET only):

| Target | Forced-h3 result |
|---|---|
| `cloudflare-quic.com` (control) | **OK** — full page over h3 (local QUIC/UDP stack and network path healthy) |
| `staging--olumi.netlify.app/bff/engine/version` | **`ERR_QUIC_PROTOCOL_ERROR`** (reproduced twice) |
| `decision-guide-ai.netlify.app` (production site) | **`ERR_QUIC_PROTOCOL_ERROR`** |
| `www.netlify.com` (Netlify's own site) | **`ERR_QUIC_PROTOCOL_ERROR`** |
| Same staging URL, no force flag (TCP fallback) | **OK** — PLoT `/version` JSON returned |

Netlog capture (`staging-quic-netlog.json`, session scratchpad; hand to Netlify with the
ticket): QUIC handshake failures, `quic_error 25` (network idle timeout) and `70`,
`net_error -109` (`ERR_ADDRESS_UNREACHABLE`) and `-356` (`ERR_QUIC_PROTOCOL_ERROR`),
`QUIC_HANDSHAKE_FAILED` events.

So today, from this machine/network: **HTTP/3 to every Netlify-edge site tested fails at
the QUIC layer, while HTTP/3 to Cloudflare works and HTTP/2 to Netlify works.** This is
why the interactive browser silently stayed on h2 (Chrome races QUIC, marks it broken,
falls back to TCP without surfacing anything) — and why everything works right now.

## 3. The curl-succeeds / browser-504 asymmetry, explained

The morning evidence (audit doc `docs/audits/graph-coaching-experience-audit-v1.md` §2):
five consecutive browser POSTs 504'd at ~30s while curl replays — direct to PLoT *and*
through the same Netlify proxy, with app headers, any combination — returned 200 in <1s.

Constraints any explanation must satisfy:

1. `/bff/engine/*` is a plain Netlify **proxy-rewrite redirect** ([public/_redirects:4](../../public/_redirects),
   duplicated at [netlify.toml:113](../../netlify.toml) — `_redirects` wins, the toml block
   is shadowed) with **no header filtering**: the Netlify→Render leg is server-to-server.
   If the browser's and curl's forwarded requests were byte-identical, outcomes would
   match. They consistently didn't → the difference entered **at the client↔Netlify-edge
   leg**, not in the request content. `[code]` + `[curl]`
2. Headers are exonerated: today's probes sent the full app header set (incl.
   `Idempotency-Key` and `x-olumi-sdk`) and got instant 200s/400s `[staging-browser]`;
   the morning curl replays already succeeded *with* app headers `[curl]`. Idempotency
   lock pileup is also excluded: keys are fresh UUIDs per attempt
   (`src/utils/idempotency.ts:10`). `[code]`
3. The local curl (8.7.1, LibreSSL/nghttp2) **cannot speak HTTP/3** — no curl replay ever
   exercised the browser's transport. `[curl]`
4. Staging advertises `alt-svc: h3=":443"`, so a real browser upgrades to HTTP/3 when its
   QUIC race succeeds. `[curl]`
5. Today, QUIC to Netlify's edge is observably broken from this vantage (§2), in a
   fast-fail mode — and the fault is gone because Chrome falls back to h2. `[headless-h3]`

**Most probable root cause (not conclusively provable post-hoc):** during the morning
session, Chrome's connection to the Netlify edge was on **HTTP/3, in a degraded state
where the QUIC path was established enough to be used but stalled** (request bodies /
streams never completing through the edge's proxy-rewrite pipeline). Every app POST rode
that connection and hung until Netlify's ~26–30s proxy window expired → 504. curl used
TCP (h1.1/h2) and fresh connections → 200 every time, regardless of headers. Later the
QUIC failure mode hardened into immediate protocol errors, Chrome abandoned h3 for these
origins, and the app "healed" on h2. The same-day evolution from
"5/5 stalls (browser only)" to "hard `ERR_QUIC_PROTOCOL_ERROR` on forced h3 + clean h2"
is consistent with an unhealthy QUIC termination at the Netlify POP serving this client
(or a network middlebox mangling UDP/443 to Netlify's range — indistinguishable from
here; both external).

**Alternative (lower probability, also external):** the browser's persistent TCP/h2
connection was pinned to one unhealthy Netlify edge worker while each curl invocation
opened a fresh connection that landed on a healthy one. Post-hoc these cannot be fully
separated; both place the fault **at the Netlify edge / client↔edge network path**, and
both are refuted as repo-code issues.

No public Netlify or Render incident covers this window (status-page APIs checked
2026-07-05; nearest Netlify incidents: 2026-07-01 "Increase in Edge Function Errors",
2026-06-04 edge-function error rates). POP-level faults routinely don't reach status pages.

## 4. Ownership and required change

| Item | Owner | Change |
|---|---|---|
| Browser-504 root cause (QUIC/h3 at the edge, or edge-worker fault) | **Netlify platform** (via support ticket, §5) — with the caveat that a local-network middlebox cannot be excluded from this vantage | None in this repo. **No repo code was at fault; none was changed.** |
| PLoT CORS preflight omits `x-olumi-sdk` (separate fault, still present) | **plot-lite-service** (`src/createServer.ts:333`) | Add `'x-olumi-sdk'` to `allowedHeaders`. Verified missing live via OPTIONS preflight `[curl]`; PLoT never reads the header (grep) but the UI's V1 client always sends it, and the deployed app makes **direct** cross-origin PLoT calls (observed live: `plot-lite-service-staging.onrender.com/v1/cee/graph-readiness` fired by the app `[staging-browser]`), so any direct call adding that header will break preflight. Do **not** remove the UI header (deliberate M1.6 observability). |

Verification for the CORS fix, after PLoT deploys:

```bash
curl -s -X OPTIONS https://plot-lite-service-staging.onrender.com/v1/run \
  -H 'Origin: https://staging--olumi.netlify.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: x-olumi-sdk' -D - -o /dev/null | grep -i allow-headers
# expect x-olumi-sdk echoed in Access-Control-Allow-Headers
```

## 5. Netlify support ticket draft (file if it recurs, or proactively)

> **Site**: staging--olumi.netlify.app (also reproduced against www.netlify.com and
> decision-guide-ai.netlify.app)
> **Symptom A (2026-07-05 ~morning UTC)**: browser POSTs to a proxy-rewrite path
> (`/bff/engine/* → https://plot-lite-service-staging.onrender.com/:splat 200!`)
> consistently 504 after ~30s (5/5), while curl requests to the same URL with identical
> headers/body succeed in <1s. Upstream (Render) responds in ~0.3s when called directly.
> **Symptom B (same day, afternoon)**: HTTP/3 to your edge fails from this client with
> `ERR_QUIC_PROTOCOL_ERROR` for every site tested (including www.netlify.com), while
> HTTP/3 to non-Netlify origins works and HTTP/2 to your edge works. Chrome netlog
> available (QUIC handshake failures / idle timeouts).
> **Ask**: check QUIC/h3 termination health at the POP serving [Paul's location/ISP], and
> whether h3-ingress POSTs to proxy-rewrite paths can stall server-side.
> **Evidence**: netlog JSON, HAR of failing morning requests (from the audit session),
> timings above.

## 6. Recurrence runbook (condensed)

If the browser 504 comes back, run these in order — total ~15 min:

1. **Protocol check** (staging tab console):
   `performance.getEntriesByType('resource').filter(e => e.name.includes('/bff/engine')).map(e => e.nextHopProtocol)`
   — h3 present on failing requests ⇒ transport hypothesis live.
2. **Probe battery** (same console): tiny-body minimal-header POST (expect fast 400),
   representative-body full-header POST, GET `/version`, POST via `/bff/cee/*`.
   Split readings: only-POSTs-fail ⇒ method/transport; full-headers-fail-minimal-passes ⇒
   header-keyed (bisect); `/bff/cee` also fails ⇒ mechanism-wide.
3. **h2 isolation**: relaunch Chrome with `--disable-quic` (or fresh scratch profile) and
   repeat. Success over h2 while h3 fails ⇒ confirmed transport fault → Netlify ticket (§5).
4. **Reach oracle** (did the request reach PLoT?): send the failing browser request with a
   unique `Idempotency-Key`; within 15 min, curl the same key + byte-identical body through
   the proxy. Byte-identical cached replay (same `run_id`) ⇒ request reached PLoT and the
   response was lost on the way back; fresh compute ⇒ it never arrived.
5. **504 attribution**: failing response has `server: Netlify` + `x-nf-request-id`, no
   `cf-ray` ⇒ generated at the Netlify edge (upstream silent). Collect `x-nf-request-id`s
   for the ticket.

**Demo-day insurance (ops note, not a code change):** launch the demo browser with QUIC
disabled — `open -na "Google Chrome" --args --disable-quic` — which pins the app to the
HTTP/2 path that is verified healthy. Remove after the Netlify ticket resolves.

## 7. Failure-state behaviour `[code]`

If the 504 recurs, the user is not left with a silent spinner: 504 maps to
`GATEWAY_TIMEOUT` (`src/adapters/plot/v1/http.ts:271`), is deliberately excluded from
auto-retry (`src/adapters/plot/v1/constants.ts:28`), and renders an error banner with a
retry affordance (`src/canvas/utils/errorTaxonomy.ts:293`). Code-inspection only — the
banner could not be observed live today because no failure occurs.

## 8. Boundaries confirmation

No Graph/UI display files, coaching labels, run-path convergence, PLoT capacity/semantics,
schemas, prompts, migrations, graph mutation/hash/CAS, Apply/Reject, restore/compare/
Journey files were touched. No CORS changes, no security-posture changes, no client
reroute/monkeypatch. The only repo change is this document. No push, no PR.
