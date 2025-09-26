# Pilot Pre-flight Checklist

**Purpose**: Verify Pilot PoC is ready for demo/stakeholder presentation
**Duration**: 5-10 minutes
**Scope**: Health, functionality, performance, and safety validation

## 🚀 Environment Preparation

### [ ] 1. Docker Environment
- [ ] Docker Desktop running
- [ ] Docker version ≥ 20.x
- [ ] Docker Compose version ≥ 2.x
- [ ] Available ports: 3001, 3002, 3003, 9090, 3000

**Verification Commands:**
```bash
docker --version
docker-compose --version
netstat -tulpn | grep :300[1-3]
```

**Expected Output:**
- Docker version 20.x or higher
- Docker Compose version 2.x or higher
- No processes on ports 3001-3003

### [ ] 2. Pilot Deployment Pack
- [ ] Pilot deployment pack extracted to `pilot-deploy/`
- [ ] Environment file `.env.poc` configured
- [ ] Scripts executable and accessible
- [ ] Demo seeds available in `seed/`

**Verification Commands:**
```bash
ls -la pilot-deploy/
ls -la pilot-deploy/.env.poc
ls -la pilot-deploy/scripts/
ls -la pilot-deploy/seed/
```

**Expected Output:**
- All directories present
- Scripts executable (rwxr-xr-x)
- Environment file exists

## 🏗️ Service Startup

### [ ] 3. Core Services Launch
- [ ] Gateway service starts cleanly
- [ ] Engine service starts cleanly
- [ ] Jobs service starts cleanly
- [ ] All health checks passing

**Verification Commands:**
```bash
cd pilot-deploy
./scripts/pilot-up.sh
docker-compose -f docker-compose.poc.yml ps
```

**Expected Output:**
```
SERVICE          STATUS
pilot-gateway    Up (healthy)
pilot-engine     Up (healthy)
pilot-jobs       Up (healthy)
```

### [ ] 4. Health Endpoints
- [ ] Gateway health: `http://localhost:3001/healthz`
- [ ] Engine health: `http://localhost:3002/healthz`
- [ ] Jobs health: `http://localhost:3003/healthz`

**Verification Commands:**
```bash
curl -f http://localhost:3001/healthz
curl -f http://localhost:3002/healthz
curl -f http://localhost:3003/healthz
```

**Expected Output:**
```json
{"status": "healthy", "version": "...", "timestamp": "..."}
```

## 🧪 Smoke Tests

### [ ] 5. Automated Smoke Tests
- [ ] All 8 smoke tests pass
- [ ] No critical failures
- [ ] Performance baselines met

**Verification Commands:**
```bash
./scripts/pilot-smoke.sh
```

**Expected Output:**
```
🏁 Smoke Test Results
====================
Tests Run: 8
Passed: 8
Failed: 0
✅ All critical tests passed!
```

### [ ] 6. Manual Spot Checks

#### [ ] Stream Functionality
```bash
curl -N "http://localhost:3001/stream?route=critique&seed=42"
```
**Expected**: SSE events with start, token events

#### [ ] Cancel Functionality
```bash
curl -X POST "http://localhost:3001/cancel" -H "Content-Type: application/json" -d '{"sessionId": "test"}'
```
**Expected**: HTTP 202 response

#### [ ] Report Functionality
```bash
curl "http://localhost:3001/report?scenarioId=demo&seed=42"
```
**Expected**: JSON with `decision`, `recommendation`, `meta` fields

## 📊 Performance Validation

### [ ] 7. Success Metrics
- [ ] Time-to-First-Token ≤ 500ms
- [ ] Cancel latency ≤ 150ms
- [ ] Time-to-comparison ≤ 10 minutes
- [ ] Deterministic replay working

**Verification Commands:**
```bash
# Check pilot metrics (if available)
cat artifacts/reports/pilot-metrics.json

# Run release dry-run to see Success Checks
npm run release:dry | grep -A 10 "Success Checks"
```

**Expected Output:**
```
✅ Time-to-First-Token: <500ms — PASS
✅ Cancel latency: <150ms — PASS
✅ Time-to-comparison: <600s — PASS
✅ Deterministic replay: PASS
```

## 🔒 Security Validation

### [ ] 8. Safety Controls
- [ ] All powerful features OFF by default
- [ ] No request bodies in logs
- [ ] Security headers present
- [ ] CORS configured correctly

**Verification Commands:**
```bash
# Check flags status
npm run flags:snapshot

# Check security headers
curl -I "http://localhost:3001/report?scenarioId=demo&seed=42"
```

**Expected Output:**
```
✅ All clear - no flag violations detected
Cache-Control: no-store
Access-Control-Allow-Origin: *
```

### [ ] 9. Data Safety
- [ ] No PII in logs
- [ ] No secrets in environment
- [ ] Simulation mode active
- [ ] Mock data only

**Verification Commands:**
```bash
# Check environment flags
grep -E "(USE_MOCK_DATA|USE_SIMULATION)" pilot-deploy/.env.poc

# Check logs don't contain sensitive data
docker-compose -f pilot-deploy/docker-compose.poc.yml logs | grep -i "password\|secret\|key" || echo "No secrets found"
```

**Expected Output:**
```
USE_MOCK_DATA=true
USE_SIMULATION=true
No secrets found
```

## 🎯 Demo Readiness

### [ ] 10. Demo Preparation
- [ ] Demo scenario seeds loaded
- [ ] Runbook accessible
- [ ] Screenshots placeholder ready
- [ ] Backup offline demo available

**Verification Commands:**
```bash
# Check demo materials
ls -la pilot-deploy/seed/demo-scenario.json
ls -la pilot-deploy/RUNBOOK.md
ls -la artifacts/windsurf-handover-bundle/demo-offline.html
```

### [ ] 11. Observability (Optional)
- [ ] Prometheus accessible at http://localhost:9090
- [ ] Grafana accessible at http://localhost:3000
- [ ] Dashboards loading correctly

**Verification Commands:**
```bash
cd pilot-deploy
./scripts/pilot-observe.sh
curl -f http://localhost:9090
curl -f http://localhost:3000
```

## 🚨 Emergency Preparedness

### [ ] 12. Rollback Capability
- [ ] Rollback plan accessible
- [ ] Reset script tested
- [ ] Kill switch functional

**Verification Commands:**
```bash
# Test reset (WARNING: will stop services)
# cd pilot-deploy && ./scripts/pilot-reset.sh

# Check rollback documentation
ls -la artifacts/rollback.md

# Test kill switch (set back to false after)
curl -X POST "http://localhost:3001/admin/kill-switch" -d '{"enabled": true}'
```

## ✅ Final Validation

### [ ] 13. Complete System Check
- [ ] All services responding
- [ ] All tests passing
- [ ] All metrics within targets
- [ ] All safety controls active
- [ ] Demo materials ready

**Final Commands:**
```bash
# Complete validation
./scripts/pilot-smoke.sh && echo "🎯 PILOT READY FOR DEMO"

# Quick status check
docker-compose -f pilot-deploy/docker-compose.poc.yml ps
```

**Final Expected Output:**
```
✅ All critical tests passed!
🎯 Pilot PoC is ready for demo
🎯 PILOT READY FOR DEMO

All services Up (healthy)
```

## 📋 Pre-Demo Checklist

Final verification before stakeholder demo:

- [ ] **Environment**: Docker running, ports available
- [ ] **Services**: All UP and healthy
- [ ] **Tests**: Smoke tests passing
- [ ] **Performance**: All metrics within targets
- [ ] **Security**: All flags safe, no secrets exposed
- [ ] **Demo**: Materials ready, backup available
- [ ] **Emergency**: Rollback plan accessible

**Time Estimate**: 5-10 minutes
**Status**: Ready for pilot deployment ✅

---

**Note**: This checklist ensures the Pilot PoC is safe, functional, and ready for stakeholder demonstrations with all success criteria validated.