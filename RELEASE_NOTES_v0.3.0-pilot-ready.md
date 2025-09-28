# Release Notes - v0.3.0-pilot-ready

**Release Date:** 2025-09-28
**Tag:** v0.3.0-pilot-ready
**Status:** Pilot Ready

## Overview

This release marks pilot readiness with comprehensive contract wall validation, reliability guardrails, and operational hardening. All frozen contracts (SSE events, report.v1, error taxonomy) remain unchanged while adding essential pilot capabilities.

## Key Features

### ✅ Contract Wall Implementation
- **OpenAPI v1 Specification**: Complete API documentation for all 6 core endpoints
- **Frozen SSE Events**: Enforced event types (hello, token, cost, done, cancelled, limited, error)
- **Report.v1 Schema**: Deterministic reporting with meta.seed validation
- **Error Taxonomy**: Comprehensive mapping (TIMEOUT→408, RETRYABLE→503, INTERNAL→500, BAD_INPUT→400, RATE_LIMIT→429, BREAKER_OPEN→503)
- **Health Endpoint**: Required keys (status, p95_ms, replay.{lastStatus, refusals, retries, lastTs}, test_routes_enabled)

### ✅ Validation Suite
- **Parity Tests**: All passing with p95_ms=4 (well under 600ms budget)
- **Edge Cases**: Resume-limit, event guard, share cap, node cap, jobs idempotency, filename rules
- **Privacy Posture**: No request body logging, XSS detection, CORS configuration
- **Performance**: Cancel operations ≤150ms, health checks <10ms

### ✅ Feature Flag Compliance
- Import API: Gated with IMPORT_ENABLE (default OFF)
- Insights API: Gated with INSIGHTS_ENABLE (default OFF)
- SCM-lite: Gated with SCM_ENABLE (default OFF)
- All features disabled by default for CI parity

### ✅ Pilot Pack Resources
- OpenAPI HTML documentation
- Postman collection
- cURL recipe collection
- Comprehensive test artifacts
- Evidence packs with full validation results

## Breaking Changes

None - all changes are additive only. Frozen contracts remain unchanged.

## Configuration

### Environment Variables
```bash
# Feature flags (all OFF by default)
IMPORT_ENABLE=false
INSIGHTS_ENABLE=false
SCM_ENABLE=false

# Performance budget
BUDGET_P95_MS=600

# Test routes (production should be false)
NODE_ENV=production  # Disables test routes
```

## Testing

### Run Validation Suite
```bash
# Parity smoke tests
npm test tests/smoke/contract-wall-parity.test.ts

# Edge case tests
npm test tests/edge/

# Privacy posture
npm test tests/privacy/
```

### Verify Contract Compliance
```bash
# Lint OpenAPI
npx @redocly/cli lint artifacts/contracts/openapi-v1.yml

# Check type safety
npm run typecheck
```

## Artifacts

- **OpenAPI Spec**: `artifacts/contracts/openapi-v1.yml`
- **HTML Docs**: `artifacts/contracts/openapi.html`
- **Postman Collection**: `artifacts/pilot-pack/contract-wall-postman.json`
- **cURL Recipes**: `artifacts/pilot-pack/contract-wall-curl-collection.md`
- **Validation Reports**: `artifacts/reports/`
- **Evidence Pack**: `artifacts/evidence-pack-*.zip`

## Known Issues

- XSS reflection in mock gateway (for testing purposes only)
- No hard limits on node counts or URL sizes (configurable)

## Next Steps

1. Deploy with feature flags OFF for pilot
2. Monitor health endpoint and p95 metrics
3. Enable features progressively based on pilot feedback
4. Add CORS allow-list for production domains

## Contributors

- Engineering Team
- Claude Assistant

---

*Generated for pilot release v0.3.0*