# Pilot Validation Checklist

**Date:** _______________
**Tester:** _______________
**Environment:** _______________
**Session ID:** _______________

---

## Core Functionality

### Streaming & Events
- [ ] **First Token Received** - Token appears within 500ms of stream start
- [ ] **SSE Events Valid** - Only these events seen: `hello|token|cost|done|cancelled|limited|error`
- [ ] **Token Sequence** - Tokens arrive in order, no duplicates
- [ ] **Progress Updates** - Progress percentage increases monotonically
- [ ] **Stream Completion** - `done` event received with session ID

### Resume Semantics
- [ ] **Resume Once** - After disconnect, stream resumes from last event
- [ ] **Last-Event-ID** - Header present in resume request
- [ ] **No Duplicate Tokens** - Resumed stream doesn't repeat already-seen content
- [ ] **Single Resume Only** - Second disconnection requires new session
- [ ] **State Preserved** - Analysis context maintained after resume

### Performance Targets
- [ ] **Cancel Latency ≤150ms** - Time from cancel click to confirmation
- [ ] **TTFF ≤500ms** - Time to first token after stream start
- [ ] **P95 Response ≤600ms** - 95% of responses under threshold
- [ ] **Memory Stable** - No memory leaks during extended streaming
- [ ] **CPU Usage Reasonable** - No excessive CPU during analysis

---

## Report Validation

### Schema Compliance
- [ ] **Report v1 Schema** - Response includes `"schema":"report.v1"`
- [ ] **Meta Section Present** - Contains scenarioId, seed, timestamp
- [ ] **Seed Echo Correct** - meta.seed matches input seed value
- [ ] **Decision Structure** - Contains title, options array with scores
- [ ] **Recommendation Present** - Primary recommendation provided

### Export Features
- [ ] **Filename Includes Seed** - Export filename contains seed number
- [ ] **Filename Includes Model** - Model identifier in filename
- [ ] **Timestamp in Filename** - ISO timestamp or readable date
- [ ] **USD Currency Label** - Monetary values labelled with "USD"
- [ ] **CSV Format Valid** - Proper comma separation, escaped quotes

---

## UI/UX Requirements

### Mobile Guardrails
- [ ] **Touch Targets ≥44x44px** - All buttons/links meet minimum
- [ ] **Base Font ≥16px** - Body text readable without zoom
- [ ] **Viewport Meta Present** - Prevents unwanted zoom on mobile
- [ ] **Responsive Layout** - UI adapts to mobile screen width
- [ ] **No Horizontal Scroll** - Content fits viewport width

### Accessibility
- [ ] **Keyboard Navigation** - All interactive elements reachable
- [ ] **Focus Indicators** - Visible focus states on all controls
- [ ] **ARIA Labels** - Screen reader support for key actions
- [ ] **Colour Contrast** - Text meets WCAG AA standards
- [ ] **Error Messages Clear** - User-friendly error descriptions

---

## Security & Privacy

### CORS Configuration
- [ ] **Origins Validated** - Only allowed origins accepted
- [ ] **Preflight Handled** - OPTIONS requests return proper headers
- [ ] **Credentials Excluded** - No cookies or auth headers sent
- [ ] **Methods Restricted** - Only GET, POST, OPTIONS allowed
- [ ] **Headers Limited** - Only necessary headers permitted

### Data Protection
- [ ] **No Request Body Logging** - POST bodies not in logs
- [ ] **No PII in URLs** - Query parameters sanitised
- [ ] **Cache Headers Correct** - `no-store` on sensitive endpoints
- [ ] **HTTPS Redirect Ready** - Prepared for TLS in production
- [ ] **No Secrets Exposed** - API keys/tokens not in responses

---

## Feature Flags

### Environment Controls
- [ ] **USE_MOCK_DATA Toggle** - Switches between fixtures/live
- [ ] **USE_SIMULATION Toggle** - Controls simulation mode
- [ ] **ENABLE_SEED_ECHO** - Seed appears in responses when ON
- [ ] **Ops Console Gated** - Requires OPS_CONSOLE_ENABLE=1
- [ ] **Signing OFF by Default** - Snapshot signing disabled initially

---

## Error Handling

### Graceful Degradation
- [ ] **Network Failure Handled** - Clear message on connection loss
- [ ] **Rate Limit Response** - 429 with retry-after header
- [ ] **Invalid Input Rejected** - 400 with helpful message
- [ ] **Server Error Caught** - 500 errors don't crash UI
- [ ] **Timeout Managed** - Long requests cancelled cleanly

---

## Final Checks

### Integration
- [ ] **Health Endpoint** - Returns 200 with status object
- [ ] **Compare API** - Side-by-side comparison works
- [ ] **Templates Encode/Decode** - Share links functional
- [ ] **Jobs Stream** - Batch processing endpoints work
- [ ] **All Badges Earned** - Health, performance, security badges green

---

## Notes Section

**Issues Encountered:**
_________________________________
_________________________________
_________________________________

**Performance Observations:**
_________________________________
_________________________________
_________________________________

**Suggestions for Improvement:**
_________________________________
_________________________________
_________________________________

---

**Validation Complete:** ☐ YES ☐ NO
**Ready for Production:** ☐ YES ☐ NO ☐ CONDITIONAL

**Sign-off:** _________________ **Date:** _________________