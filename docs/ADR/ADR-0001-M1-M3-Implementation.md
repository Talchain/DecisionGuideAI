# ADR-0001: M1-M3 PLoT Engine Integration & Assistants Implementation

**Status:** M1-M3 Skeletons Complete
**Date:** 2025-11-11
**Last Updated:** 2025-11-12
**Authors:** Claude Code

## Context

Implementing comprehensive integration with PLoT Engine (M1), Assistants API (M2), and Clarifier feature (M3) as specified in the delivery brief. This ADR documents architectural decisions, assumptions, and implementation approach.

## Decisions

### M1: PLoT Engine Integration

**Completed:**
1. ✅ Health probe via HEAD /v1/run (204 = healthy)
2. ✅ Live limits fetching with 1h cache (GET /v1/limits)
3. ✅ 429 rate limit handling with Retry-After countdown
4. ✅ Request ID tracking (X-Request-Id header + Debug tray)
5. ✅ SCM-Lite toggle (x-scm-lite header takes precedence)
6. ✅ Client hardening (96KB payload guard with Blob size measurement)

**Implementation Notes:**
- Health probe uses 1→3→10s backoff schedule
- Limits cached in sessionStorage (1hr TTL)
- 429 errors include X-RateLimit-Reason in details
- Request IDs generated client-side via crypto.randomUUID()
- SCM-lite header sent when developer toggle enabled

**Assumptions:**
- PLoT base URL: `https://plot-lite-service.onrender.com` (overridable via VITE_PLOT_PROXY_BASE)
- All calls go through BFF proxy for auth (no client-side API keys)
- 96KB payload limit enforced client-side before transmission

### M2: Assistants Draft Feature

**Architecture:**
```
Client (DraftForm)
  ↓ POST /bff/assist/draft-graph/stream
BFF Proxy (Supabase Edge Function)
  ↓ Adds ASSIST_API_KEY, forwards x-correlation-id
Assistants API (/assist/draft-graph/stream)
  ↓ SSE stream: DRAFTING → COMPLETE
Client (DraftStreamPanel)
  → Renders patch diff → Apply/Undo
```

**Implementation Plan:**

**Server (BFF):**
- File: `supabase/functions/assist-proxy/index.ts`
- Auth: Server-side ASSIST_API_KEY from env
- CORS: Allowlist `http://localhost:5173`, `https://olumi.netlify.app`
- Timeout: 65s
- Headers: Forward x-correlation-id, strip sensitive headers

**Client:**
- `src/assist/api.ts`: Client wrapper to BFF
- `src/assist/components/DraftForm.tsx`: Brief + file attachments (PDF/TXT/MD/CSV)
- `src/assist/components/DraftStreamPanel.tsx`: Streaming UI with 2.5s fixture
- `src/assist/components/DiffViewer.tsx`: Patch-first adds/updates
- `src/assist/components/ProvenanceChip.tsx`: Redacted hover (≤100 chars)

**Streaming Protocol:**
- Event: `: heartbeat` every 10s
- Event: `DRAFTING` → show spinner
- Event: `COMPLETE` → finalize patch
- Event: `ERROR` → show retry
- Fixture: If no substantial tokens by 2.5s, show skeleton

**Patch-First:**
- Stable edge IDs: `${from}::${to}::${index}`
- Use meta.suggested_positions for layout
- Apply/Undo stack (session-scoped)

### M3: Guided Clarifier

**Flow:**
1. Draft stream yields `questions` + `clarifier_status`
2. Show ClarifierPanel (right-hand or modal)
3. Up to 3 rounds: MCQ-first, one short text
4. Show "why we ask" + impact hint
5. Short-circuit at confidence ≥ 0.8
6. Re-issue draft with answers (same correlation ID)
7. Timeout fallback: "Drafting without extra questions..."

**Feature Flag:**
- Check `/healthz.feature_flags.clarifier_enabled`

## Security

1. ✅ No API keys in client bundle
2. ✅ BFF enforces CORS allowlist
3. ✅ Redaction ON by default for provenance
4. ✅ File upload preview: filename/size/first lines only
5. ✅ Request/correlation IDs logged server-side only

## Performance

1. ✅ Limits cached 1h (sessionStorage)
2. ✅ Health probe with exponential backoff
3. ⚠️  96KB payload guard (client + server)
4. ⚠️  Streaming UI updates via RAF for token bursts
5. ⚠️  Code-split DiffViewer, ClarifierPanel

## Testing Strategy

**M1 Tests:**
- `plot.health.spec.ts`: 204 = healthy, backoff schedule
- `plot.limits.spec.ts`: parse limits.v1, cache TTL, 96KB guard
- `run.429.spec.tsx`: countdown, auto-retry, reason header
- `run.request-id.spec.ts`: header passthrough, debug display
- `scm-lite.header.spec.ts`: header precedence over query

**M2 Tests:**
- `assist.bff.proxy.spec.ts`: auth, CORS, timeouts
- `assist.stream.spec.tsx`: heartbeats, fixture at 2.5s, COMPLETE/ERROR
- `assist.patch.apply-undo.spec.ts`: atomic apply, undo stack, stable IDs
- `assist.provenance.spec.tsx`: chips render, hover redaction

**M3 Tests:**
- `assist.clarifier.flow.spec.tsx`: 0-3 rounds, confidence short-circuit
- `assist.clarifier.timeout.spec.tsx`: fallback copy

## Open Questions

1. **BFF Location:** Supabase Edge Functions vs. separate server?
   - **Decision:** Supabase Edge Functions (existing pattern)

2. **Streaming Backpressure:** How to handle slow clients?
   - **Decision:** Use SSE with heartbeats; client buffers events

3. **Clarifier State:** Persist across navigation?
   - **Decision:** Session-scoped only (clear on refresh)

4. **96KB Enforcement:** Client-side only or server validation?
   - **Decision:** Both (client pre-flight, server hard limit)

## Status

**Implemented:**
- ✅ M1.1-M1.6 (Health, Limits, 429, Request ID, SCM-lite, 96KB guard)
- ✅ M1 Tests (health, limits, payloadGuard - all passing)
- ✅ M2 Skeleton Components (DraftForm, DraftStreamPanel, DiffViewer, ProvenanceChip)
- ✅ M2 BFF Proxy (assist-proxy Edge Function)
- ✅ M2 Client Adapters (types, HTTP client with SSE streaming)
- ✅ M3 Skeleton (ClarifierPanel with MCQ support)
- ✅ Supporting infrastructure (stores, components)

**Remaining:**
- Integration with existing Canvas UI (wire components into main app)
- End-to-end tests for M2/M3 workflows
- Backend integration testing (real API endpoints)
- QA checklist and manual smoke testing

## Next Steps

1. ✅ ~~Implement 96KB payload guard~~ (Complete)
2. ✅ ~~Create BFF proxy in Supabase Edge Functions~~ (Complete)
3. ✅ ~~Build DraftForm + DraftStreamPanel~~ (Complete)
4. ✅ ~~Implement patch-first diff + Apply/Undo~~ (Complete)
5. ✅ ~~Build ClarifierPanel with MCQ support~~ (Complete)
6. ✅ ~~Update CHANGELOG.md~~ (Complete)
7. Wire M1-M3 components into existing Canvas UI
8. Write comprehensive test suite for M2/M3 workflows
9. Create QA checklist
10. Manual smoke testing with real API endpoints
11. Create PR with ACCEPT validation

## References

- M1-M3 Delivery Brief (2025-11-11)
- PLoT API Spec v1.2
- Assistants API Spec v1.3.1
