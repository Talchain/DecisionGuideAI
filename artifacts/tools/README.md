# Integration Harness - Zero-Friction Validation Tools

**Purpose**: No-code validation tools for Windsurf live-swap integration and pilot deployment verification.

## 🔍 SSE Viewer (`sse-viewer.html`)

### Quick Start
```bash
# 1. Start pilot services
cd pilot-deploy && ./scripts/pilot-up.sh

# 2. Open SSE viewer locally
open artifacts/tools/sse-viewer.html
# OR serve it locally:
python3 -m http.server 8080
# Then visit: http://localhost:8080/artifacts/tools/sse-viewer.html
```

### Features
- **Real-time SSE Event Streaming**: Live view of Server-Sent Events
- **Resume Capability**: Test Last-Event-ID reconnection
- **Cancel Testing**: Verify idempotent cancellation (202 → 409)
- **Parameter Control**: Seed, budget, route configuration
- **Event Log**: Timestamped log with event type filtering
- **Metadata Display**: Connection state, event count, session tracking

### Usage
1. **Configure Connection**: Set Base URL (default: http://localhost:3001)
2. **Set Parameters**: Scenario route, seed (42), budget (1000)
3. **Connect**: Click "Connect" to start streaming
4. **Test Cancel**: Click "Cancel" to test stopping
5. **Test Resume**: Click "Resume" to test reconnection
6. **View Report**: Click "Test Report" to fetch analysis results

### Screenshots
- Stream connection and token flow
- Cancel behavior and response codes
- Resume with Last-Event-ID handling
- Error states and diagnostics

## 📡 HTTP Collection (`pilot.http`)

### Quick Start with VS Code
```bash
# 1. Install VS Code REST Client extension
# 2. Open pilot.http in VS Code
# 3. Click "Send Request" above any ### block
# 4. View responses in split pane
```

### Quick Start with cURL
```bash
# Copy any request block and convert to cURL:
curl -N "http://localhost:3001/stream?route=critique&seed=42&sessionId=test_123" \
  -H "Accept: text/event-stream"
```

### Included Test Cases

#### Core Functionality
- **Health Check**: Verify gateway status
- **Stream Analysis**: SSE streaming with parameters
- **Cancel Stream**: Idempotent cancellation testing
- **Resume Stream**: Last-Event-ID reconnection
- **Jobs Stream**: Long-running analysis progress
- **Get Report**: Report v1 retrieval

#### Integration Testing
- **CORS Headers**: Cross-origin request validation
- **Security Headers**: Cache-Control verification
- **Deterministic Replay**: Same seed consistency
- **Multiple Routes**: critique, analysis, decision

#### Load & Error Testing
- **Concurrent Sessions**: Multiple simultaneous streams
- **Invalid Parameters**: Error handling verification
- **Missing Parameters**: Validation testing

### Environment Variables
```
@baseUrl = http://localhost:3001     # Default pilot URL
@seed = 42                           # Deterministic seed
@sessionId = pilot_test_{{$timestamp}} # Auto-generated session
@scenarioId = demo                   # Demo scenario
```

## 🎯 Validation Workflow

### 1. Pre-Integration Check
```bash
# Verify pilot services are healthy
curl http://localhost:3001/healthz

# Expected: {"status": "healthy", "version": "...", "timestamp": "..."}
```

### 2. SSE Streaming Validation
1. Open `sse-viewer.html` in browser
2. Click "Connect" with default settings
3. Verify events appear: start → token → token → done
4. Check Last-Event-ID is captured

### 3. Cancel/Resume Testing
1. Connect stream in SSE viewer
2. Click "Cancel" - should see cancel event
3. Click "Resume" - should reconnect from last position
4. Verify HTTP responses: 202 → 409 for duplicate cancels

### 4. Windsurf Integration Prep
```bash
# Test exact URLs Windsurf will use
curl -N "http://localhost:3001/stream?route=critique&seed=42" \
  -H "Accept: text/event-stream" \
  -H "Origin: http://localhost:3000"

# Verify CORS headers present
curl -I "http://localhost:3001/report?scenarioId=demo"
# Expected: Access-Control-Allow-Origin: *
```

### 5. Report v1 Validation
1. In SSE viewer, click "Test Report"
2. Verify JSON structure contains:
   - `decision.title`
   - `decision.options[]`
   - `recommendation.primary`
   - `meta.scenarioId`

## 🔧 Troubleshooting

### SSE Viewer Issues
- **Connection Failed**: Check pilot services running (`./scripts/pilot-up.sh`)
- **No Events**: Verify Base URL is correct (http://localhost:3001)
- **CORS Errors**: Add your domain to CORS_ORIGINS in .env.poc

### HTTP Collection Issues
- **VS Code**: Install "REST Client" extension by Huachao Mao
- **Authentication**: Not needed in pilot mode (all disabled)
- **Variables**: Use {{$timestamp}} for unique IDs

### Common Error Codes
- **404**: Service not running or wrong URL
- **403**: CORS issue - check allowed origins
- **500**: Service error - check logs with `docker-compose logs`

## 📋 Integration Checklist

Use this checklist when validating Windsurf integration:

- [ ] **SSE Viewer**: Stream connects and shows events ✅
- [ ] **Cancel/Resume**: Idempotent behavior working ✅
- [ ] **Report API**: JSON structure matches contract ✅
- [ ] **CORS Headers**: Cross-origin requests allowed ✅
- [ ] **Security Headers**: Cache-Control: no-store present ✅
- [ ] **Determinism**: Same seed produces identical results ✅
- [ ] **Performance**: TTFF < 500ms, cancel < 150ms ✅
- [ ] **Error Handling**: Graceful degradation ✅

## 🔗 Related Resources

- **Windsurf Wiring Guide**: `../windsurf-live-swap.md`
- **Pilot Deployment**: `../pilot-deploy-pack.zip`
- **Smoke Tests**: `../../scripts/pilot-smoke.sh`
- **Pre-flight Checklist**: `../checklists/pilot-preflight.md`

---

**Note**: These tools require no backend changes - they validate the existing pilot deployment as-is.