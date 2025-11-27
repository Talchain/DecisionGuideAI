# Plot Engine Backend Issues - Integration Report

**Date**: 2025-11-10
**Frontend Version**: v2.0
**Plot Engine**: plot-lite-service.onrender.com
**Environment**: Local Development (localhost:5173)

---

## Executive Summary

The frontend is successfully connecting to the plot engine, but **CORS misconfiguration** is preventing proper communication. Additionally, some expected endpoints return incorrect HTTP methods or are missing entirely.

**Status**: 🟡 Partially Working
- ✅ Health check responding (200 OK)
- ✅ Templates endpoint working (`/v1/templates`)
- 🚨 **CRITICAL**: CORS headers not configured for localhost:5173
- ⚠️ `/v1/run` returns 405 for HEAD requests (should support or ignore)
- ⚠️ `/v1/limits` returns 404 (non-blocking, has fallback)

---

## Issue 1: CORS Configuration (**CRITICAL**)

### Symptoms
```
Access to fetch at 'https://plot-lite-service.onrender.com/health'
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Root Cause
Plot engine is **not sending CORS headers** allowing `http://localhost:5173` as an origin.

### Impact
- Browser blocks all requests from frontend to plot engine
- Health checks fail in browser (but work in network layer)
- Templates may load via proxy but direct calls fail

### Required Fix
Add CORS headers to **all responses** from plot engine:

```http
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

**For production**, update to allow your production domains:
```http
Access-Control-Allow-Origin: https://your-production-domain.com
```

**For development**, consider supporting multiple origins or wildcard:
```http
Access-Control-Allow-Origin: *
```

### Verification
After fix, this request should succeed without CORS errors:
```bash
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://plot-lite-service.onrender.com/health
```

Should return headers including `Access-Control-Allow-Origin`.

---

## Issue 2: `/v1/run` Returns 405 for HEAD Requests

### Symptoms
```
HEAD http://localhost:5173/api/plot/v1/run 405 (Method Not Allowed)
[Probe] v1 sync run available (status: 405)
```

### Root Cause
Frontend **probes endpoint availability** using HEAD requests (lightweight, no body).
Plot engine `/v1/run` only accepts POST, returns 405 for HEAD.

### Impact
- **Non-blocking** - Frontend correctly interprets 405 as "endpoint exists but doesn't support HEAD"
- Logs show `[Probe] v1 sync run available (status: 405)` - this is actually working as intended
- However, better to support HEAD for cleaner probing

### Recommended Fix
Support HEAD method on `/v1/run` endpoint:
- Return 200 with no body
- Or return 204 (No Content)
- Must include CORS headers

### Alternative
Frontend can work around this - no change needed if this is difficult to implement.

---

## Issue 3: `/v1/limits` Endpoint Missing

### Symptoms
```
GET http://localhost:5173/api/plot/v1/limits 404 (Not Found)
[httpV1] /v1/limits failed, using fallback constants: Not Found
[useEngineLimits] Using fallback limits: Live endpoint failed: Not Found
```

### Root Cause
`/v1/limits` endpoint **does not exist** on plot engine.

### Impact
- **Non-blocking** - Frontend has hardcoded fallback limits:
  - Max nodes: 200
  - Max edges: 500
  - Max label length: 80
  - Max body length: 500
- Users see "fallback" indicator in UI (yellow chip top-right)
- If plot engine has different limits, validation will be incorrect

### Expected Response Schema
```json
{
  "nodes": {
    "max": 200
  },
  "edges": {
    "max": 500
  },
  "label_max_length": 80,
  "body_max_length": 500
}
```

### Recommended Fix
Implement GET `/v1/limits` endpoint returning actual system limits.

### Verification
```bash
curl http://localhost:5173/api/plot/v1/limits
# Should return JSON with limits, not 404
```

---

## Working Endpoints ✅

These are working correctly:

### `/health` - Health Check
```
[Probe] Health check passed: {
  status: 'ok',
  api_version: 'v1',
  p95_ms: 3,
  version: '1.0.0',
  uptime_s: 3135
}
```
✅ **Status**: Working (200 OK)
⚠️ **Note**: CORS headers still needed

### `/v1/templates` - List Templates
```
[AutoDetect] Using httpV1 templates
```
✅ **Status**: Working
Frontend successfully loads templates from plot engine.

---

## Frontend Configuration

For reference, here's how the frontend is configured:

### Vite Proxy (`vite.config.ts`)
```typescript
proxy: {
  '/api/plot': {
    target: env.PLOT_API_URL || 'http://localhost:4311',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/api\/plot/, '')
  }
}
```

### Environment Variables (`.env.local`)
```bash
PLOT_API_URL=https://plot-lite-service.onrender.com
VITE_PLOT_ADAPTER=auto
```

### Request Flow
```
Browser → http://localhost:5173/api/plot/v1/health
Vite Proxy → https://plot-lite-service.onrender.com/v1/health
Plot Engine → Response (needs CORS headers)
```

---

## Testing Checklist for Plot Engine Team

After implementing fixes, verify:

- [ ] **CORS Headers**: All endpoints return `Access-Control-Allow-Origin: http://localhost:5173`
- [ ] **OPTIONS Preflight**: All endpoints respond to OPTIONS requests with CORS headers
- [ ] **HEAD Support**: `/v1/run` accepts HEAD requests (returns 200/204 with no body)
- [ ] **`/v1/limits` Endpoint**: Returns JSON with system limits (see schema above)
- [ ] **Browser Test**: Open http://localhost:5173/#/canvas and check console for CORS errors

### Quick Verification Commands

```bash
# Test CORS preflight
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  https://plot-lite-service.onrender.com/v1/run

# Test HEAD support
curl -X HEAD \
  -H "Origin: http://localhost:5173" \
  https://plot-lite-service.onrender.com/v1/run

# Test limits endpoint
curl -H "Origin: http://localhost:5173" \
  https://plot-lite-service.onrender.com/v1/limits
```

All should return proper CORS headers and appropriate status codes.

---

## Priority Assessment

| Issue | Priority | Impact | Blocking? |
|-------|----------|--------|-----------|
| CORS headers missing | 🔴 **CRITICAL** | All browser requests fail | **YES** |
| HEAD support on `/v1/run` | 🟡 Medium | Cleaner probing, better logs | No |
| `/v1/limits` missing | 🟡 Medium | Uses fallback limits | No |

---

## References

- [Backend Integration Requirements](docs/PENG_INTEGRATION_REQUIREMENTS.md)
- [Expected API Schemas](docs/PLOT_V1_HTTP_ADAPTER_TDD.md)
- Frontend Adapter: [src/adapters/plot/v1/httpV1Adapter.ts](src/adapters/plot/v1/httpV1Adapter.ts)
- Probe Logic: [src/adapters/plot/probe.ts](src/adapters/plot/probe.ts)

---

## Contact

If you need clarification on any of these issues or want to discuss implementation details, please reach out to the frontend team.

**Next Steps**:
1. Implement CORS headers (critical)
2. Test with curl commands above
3. Notify frontend team when deployed
4. Frontend team will verify in browser
