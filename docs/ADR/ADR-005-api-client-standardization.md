# ADR-005: API Client Standardization

**Status:** Proposed
**Date:** 2025-12-17
**Context:** Enterprise Readiness Review P2 Item

## Context

The codebase has multiple patterns for API communication:
- Direct `fetch()` calls in hooks (e.g., `useRobustness.ts`)
- React Query with custom fetchers
- Dedicated client classes (e.g., `CEEClient`, `AssistantsClient`)

This creates inconsistency in:
- Error handling patterns
- Retry/backoff logic
- Timeout configuration
- Correlation ID generation
- Request/response logging

## Decision

Standardize API client behavior by:

### 1. Unified Fetch Wrapper

Create `src/lib/apiFetch.ts` with:
```typescript
interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
  correlationId?: string
}

async function apiFetch<T>(url: string, options?: FetchOptions): Promise<T>
```

### 2. Standard Behaviors

| Behavior | Implementation |
|----------|----------------|
| Timeout | Default 30s, configurable per-call |
| Retries | 3 retries with exponential backoff for 5xx/network errors |
| Correlation ID | Auto-generate UUID, include in `x-correlation-id` header |
| Error normalization | Map HTTP errors to typed `ApiError` class |
| Dev logging | Log request/response in DEV only |

### 3. Migration Path

1. Add `apiFetch` utility (non-breaking)
2. Update new code to use `apiFetch`
3. Gradually migrate existing direct `fetch` calls
4. React Query fetchers delegate to `apiFetch`

## Consequences

**Positive:**
- Consistent error handling across all API calls
- Easier debugging with correlation IDs
- Unified retry logic reduces edge cases
- Single place to add observability

**Negative:**
- Migration effort for existing code
- Additional abstraction layer

## Implementation Notes

Priority files to migrate first:
- `src/canvas/hooks/useRobustness.ts`
- `src/canvas/hooks/useGraphReadiness.ts`
- `src/hooks/useResultsPanelData.ts`

Existing clients (`CEEClient`, `AssistantsClient`) already have good patterns
that can inform the unified implementation.

## Related: CORS Allowlist Inconsistency (P2)

**Status:** Known issue, to be addressed

The CORS origin allowlists are currently inconsistent across proxies:

| Proxy | Allowed Origins |
|-------|-----------------|
| Netlify `cee-proxy` | decisionguide.ai, app.olumi.app, decision-guide-ai.netlify.app, localhost |
| Supabase `assist-proxy` | olumi.netlify.app (missing Netlify preview domain) |
| Supabase `openai-proxy` | decisionguide.ai, app.olumi.app |

**Recommended Fix:**
1. Centralize allowed origins via environment variable: `ALLOWED_ORIGINS="https://...,https://..."`
2. Parse and use in each proxy function
3. Ensure all deploy domains are covered (prod + staging + preview)
4. Remove dead/legacy domains
