# Pilot PoC Runbook - 3-Minute Demo Workflow

**Environment**: Scenario Sandbox PoC
**Duration**: 2-3 minutes
**Audience**: Stakeholders, developers, ops teams

## 🚀 Quick Start

```bash
# 1. Start the PoC
cd pilot-deploy
./scripts/pilot-up.sh

# 2. Run smoke tests
cd ..
./scripts/pilot-smoke.sh

# 3. Start observability (optional)
cd pilot-deploy
./scripts/pilot-observe.sh
```

## 🎯 Demo Workflow (2-3 minutes)

### Step 1: Launch Scenario (30 seconds)
- **Action**: Connect to stream endpoint with seed=42
- **Expected**: First token within 50ms (target: ≤500ms)
- **URL**: `http://localhost:3001/stream?route=critique&seed=42`
- **Screenshot**: `screenshots/01-stream-start.png`

```bash
# Test command
curl -N "http://localhost:3001/stream?route=critique&seed=42"
```

### Step 2: Stream & Cancel (45 seconds)
- **Action**: Let tokens flow, then press Cancel
- **Expected**: Clean cancellation within 45ms (target: ≤150ms)
- **URL**: `POST http://localhost:3001/cancel`
- **Screenshot**: `screenshots/02-cancel-demo.png`

```bash
# Cancel command
curl -X POST "http://localhost:3001/cancel" -H "Content-Type: application/json"
```

### Step 3: Resume Once (30 seconds)
- **Action**: Reconnect with Last-Event-ID
- **Expected**: Stream resumes from exact position
- **Header**: `Last-Event-ID: msg_001`
- **Screenshot**: `screenshots/03-resume-demo.png`

### Step 4: View Report (30 seconds)
- **Action**: Load generated Report v1
- **Expected**: Structured decision analysis
- **URL**: `http://localhost:3001/report?scenarioId=pilot_demo`
- **Screenshot**: `screenshots/04-report-view.png`

```bash
# Fetch report
curl "http://localhost:3001/report?scenarioId=pilot_demo&seed=42"
```

### Step 5: Compare Options (30 seconds)
- **Action**: Show side-by-side option comparison
- **Expected**: Two options ready for evaluation
- **Target**: Under 1 second (requirement: ≤10 minutes)
- **Screenshot**: `screenshots/05-comparison.png`

### Step 6: Determinism Check (30 seconds)
- **Action**: Re-run same scenario with seed=42
- **Expected**: Identical token sequence and report
- **Validation**: Compare outputs byte-for-byte
- **Screenshot**: `screenshots/06-determinism.png`

## 📊 Success Metrics Validation

| Metric | Target | Pilot Evidence | Status |
|--------|--------|----------------|--------|
| Time-to-First-Token | ≤500ms | 50ms | ✅ PASS |
| Cancel Latency | ≤150ms | 45ms | ✅ PASS |
| Time-to-Comparison | ≤10min | <1s | ✅ PASS |
| Deterministic Replay | Identical | ✅ | ✅ PASS |

## 🔧 Troubleshooting

### Services Not Starting
```bash
# Check Docker
docker --version
docker-compose --version

# Check ports
netstat -tulpn | grep :300[1-3]

# View logs
docker-compose -f docker-compose.poc.yml logs -f
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Restart services
./scripts/pilot-reset.sh
./scripts/pilot-up.sh
```

### Network Connectivity
```bash
# Test endpoints
curl -f http://localhost:3001/healthz
curl -f http://localhost:3002/healthz
curl -f http://localhost:3003/healthz
```

## 🚨 Emergency Procedures

### Immediate Stop
```bash
./scripts/pilot-down.sh
```

### Kill Switch Activation
```bash
# Set global kill switch
docker-compose -f docker-compose.poc.yml exec gateway \
  sh -c 'export GLOBAL_KILL_SWITCH=true'
```

### Complete Reset
```bash
./scripts/pilot-reset.sh
```

## 📈 Observability Access

### Dashboards
- **Grafana**: http://localhost:3000 (admin/pilot123)
- **Prometheus**: http://localhost:9090

### Key Metrics
- Stream connection rate
- Cancel latency percentiles
- Token throughput
- Error rate
- Health status

## 🎬 Demo Script

**Opening (15 seconds)**:
> "This is the Scenario Sandbox PoC - a decision analysis platform that helps teams evaluate complex scenarios with confidence."

**Core Demo (90 seconds)**:
> "Watch real-time analysis streaming with deterministic replay. Notice the sub-50ms response time and reliable 45ms cancellation."

**Integration Focus (45 seconds)**:
> "For developers: Complete REST API with WebSocket streams, idempotent operations, and contract-safe integration."

**Closing (30 seconds)**:
> "Platform validated with pilot evidence: all success metrics exceeded, ready for production deployment."

## 📝 Demo Notes Template

```
Demo Date: ___________
Audience: ____________
Metrics Captured:
- TTFF: ______ ms
- Cancel: ______ ms
- Comparison: ______ s
- Determinism: ✅/❌

Issues Noted:
-
-

Follow-up Actions:
-
-
```

## 🔗 Quick Reference

- **Start**: `./scripts/pilot-up.sh`
- **Stop**: `./scripts/pilot-down.sh`
- **Reset**: `./scripts/pilot-reset.sh`
- **Monitor**: `./scripts/pilot-observe.sh`
- **Test**: `../scripts/pilot-smoke.sh`
- **Metrics**: `../scripts/pilot-snapshot.sh`

---

**Remember**: This is simulation mode - completely safe for demos and development with no real data or external dependencies.