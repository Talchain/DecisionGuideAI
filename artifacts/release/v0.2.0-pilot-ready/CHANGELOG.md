# Changelog

## v0.2.0-pilot-ready (2025-09-27)

### Release Candidate Features
- **Core Decision Analysis Engine**: Fully operational decision framework with deterministic seed replay (seed 42 consistency validated)
- **Report v1 Schema**: Immutable schema compliance with `"schema":"report.v1"` and meta.seed echo functionality
- **Stream Conformance**: SSE events frozen at: `hello|token|cost|done|cancelled|limited|error` with NDJSON format support
- **Resume Semantics**: Robust resume-once behaviour with state management
- **Performance Baseline**: P95 response times within acceptable thresholds

### "While You're Out" Feature Additions

#### 🎛️ Pilot Controls API
- **GET /ops/flags**: Feature flags listing with real-time status
- **GET /ops/limits**: Effective system limits and quotas
- **GET /ops/queue**: Queue status and processing metrics
- **POST /ops/toggle-flag**: Development-only toggle functionality (environment-gated)
- **Security**: All endpoints properly secured with environment controls

#### 📊 Evidence Auto-Brief Generator
- **Stakeholder Summaries**: Automated executive briefings in Markdown and JSON formats
- **System Metrics Collection**: Comprehensive data aggregation from run registry, UAT results, and telemetry
- **Trend Analysis**: 7-day rolling analysis with performance indicators
- **Output Locations**:
  - Latest: `artifacts/briefs/latest-evidence-brief.{md,json}`
  - Timestamped: `artifacts/briefs/evidence-brief-{timestamp}.{md,json}`

#### ⚡ SLO Guard & Trend System
- **Configurable Thresholds**: Environment-based SLO configuration
  - TTFF: ≤500ms (configurable via `SLO_TTFF_MS`)
  - Cancel Latency: ≤150ms (configurable via `SLO_CANCEL_MS`)
  - P95 Response: ≤600ms (configurable via `SLO_P95_MS`)
- **Historical Tracking**: Trend data storage at `artifacts/reports/slo-trend.json`
- **Automatic Validation**: Pass/fail determination with detailed failure reporting

#### 🔍 CORS Origin Doctor
- **Diagnostic Endpoint**: `GET /_tools/origin-check` for origin validation
- **Interactive Testing**: Static helper at `artifacts/public/origin-check.html`
- **Configurable Origins**: Environment-based CORS configuration with secure defaults
- **Privacy-First**: Closed CORS policy by default

#### 🔐 Signed Snapshot Manifest v1
- **Cryptographic Provenance**: HMAC-SHA256 signing for snapshot integrity
- **Default OFF**: Secure by default, only enabled via `SNAPSHOT_SIGNING_KEY`
- **File Integrity**: SHA-256 checksums for all manifest files
- **Verification**: Built-in signature validation and tamper detection

### Privacy & Security Enhancements
- **Headers**: Security headers configured (X-Content-Type-Options: nosniff, X-Frame-Options: DENY)
- **Logging**: No request body logging to protect sensitive data
- **CORS**: Closed by default with explicit origin allowlisting
- **Cache Control**: No-store directives for sensitive endpoints

### Validation & Quality Assurance
- **Post-Delivery Validation**: Comprehensive 11-point validation suite
- **Test Coverage**: 51 passing tests across all components
- **Contract Compliance**: All endpoint shapes and SSE events remain unchanged
- **Performance**: Cancel latency target ≤150ms validated

### British English Compliance
- All user-facing text updated to British English standards
- Microcopy reviewed for terminology consistency
- Error messages and help text localised

### Breaking Changes
- **None**: This release maintains full backwards compatibility
- **Additive Only**: All new features are opt-in and environment-gated

### Migration Notes
- No migration required for existing installations
- New environment variables optional (secure defaults provided)
- All powerful features disabled by default

### Known Issues
- Live Gateway testing requires manual setup for stream conformance validation
- SLO trend data requires time to accumulate meaningful historical patterns

### Next Steps
- Pilot deployment ready with comprehensive validation
- All go/no-go criteria satisfied
- Evidence brief generation operational for ongoing monitoring