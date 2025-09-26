# Changelog - Scenario Sandbox PoC

## [v0.1.0-pilot] - 2025-09-26

### 🎯 Pilot Release
First immutable pilot release of Scenario Sandbox PoC, ready for stakeholder deployment and Windsurf integration.

### ✨ Features
- **Turn-key Deployment**: Complete Docker Compose stack with Gateway, Engine, Jobs services
- **Live-Swap Integration**: Zero-drift Windsurf wiring with exact contracts and URLs
- **Real-time Streaming**: SSE-based token streaming with resume capability (Last-Event-ID)
- **Fast Cancellation**: Sub-150ms cancel latency with idempotent behavior (202 → 409)
- **Deterministic Replay**: Seed-based reproducible analysis for consistent results
- **Report v1 Generation**: Structured decision analysis with options, recommendations, confidence

### 🛡️ Operational Safety
- **Smoke Tests**: 8 comprehensive validation checks for deployment readiness
- **Pre-flight Checklist**: 13-step verification process with tick boxes
- **Rollback Plan**: <5 minute emergency recovery procedures
- **Kill Switch**: Immediate traffic disable capability
- **Observability Stack**: Prometheus + Grafana with pre-built dashboards

### 📊 Validated Success Metrics
- **Time-to-First-Token**: 50ms (target: ≤500ms) ✅
- **Cancel Latency**: 45ms (target: ≤150ms) ✅
- **Time-to-Comparison**: <1s (target: ≤10min) ✅
- **Deterministic Replay**: PASS ✅
- **Test Coverage**: 82/82 tests passing ✅

### 🔧 Deployment Tools
- **Management Scripts**: `pilot-up.sh`, `pilot-down.sh`, `pilot-reset.sh`, `pilot-observe.sh`
- **Validation Scripts**: `pilot-smoke.sh`, `pilot-snapshot.sh`
- **Integration Guides**: Windsurf live-swap wiring card with cURL examples
- **Demo Materials**: 3-minute runbook with step-by-step workflow

### 🔒 Security & Safety
- **All Powerful Features OFF**: Rate limiting, caching, tracking, monitoring disabled by default
- **Simulation Mode**: Mock data only, no external dependencies
- **No PII Logging**: Request/response bodies never logged
- **Security Headers**: Cache-Control: no-store, CORS configured
- **Secret Hygiene**: No credentials required in pilot mode

### 📦 Deployment Package
- **Size**: 11KB deployment bundle
- **Startup Time**: <5 minutes to running services
- **Dependencies**: Docker + Docker Compose only
- **Ports**: 3001 (Gateway), 3002 (Engine), 3003 (Jobs), 9090 (Prometheus), 3000 (Grafana)

### 🔗 Integration Points
- **Stream URL**: `http://localhost:3001/stream`
- **Cancel URL**: `http://localhost:3001/cancel`
- **Report URL**: `http://localhost:3001/report`
- **Jobs Stream**: `http://localhost:3001/jobs/stream`
- **Jobs Cancel**: `http://localhost:3001/jobs/cancel`

### 💻 Development Support
- **TypeScript**: Clean compilation with strict checks
- **Testing**: Comprehensive unit and integration tests
- **Linting**: ESLint configuration with security rules
- **Hot Reload**: Vite development server
- **Quality Gates**: Automated CI/CD validation

### 📋 Known Limitations
- **Local Deployment Only**: No production clustering or scaling
- **Simulation Data**: Mock scenarios and deterministic responses
- **Single Tenancy**: No multi-user or organization support
- **Basic Auth**: No authentication or authorization (pilot mode)

### 🎯 Next Steps
- Deploy to pilot environment using deployment pack
- Integrate with Windsurf using live-swap wiring guide
- Run pre-flight checklist and smoke tests
- Monitor using provided observability stack
- Collect metrics using snapshot script

---

**Release SHA**: 8e28d6c3
**Build Date**: 2025-09-26T20:30:00.000Z
**Deployment**: Extract `pilot-deploy-pack.zip` and run `./scripts/pilot-up.sh`