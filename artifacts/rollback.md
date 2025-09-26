# Pilot Rollback Plan

**Purpose**: Quick recovery from pilot deployment issues
**Target Time**: <5 minutes to restore service
**Scope**: Complete rollback to last known-good state

## 🚨 Emergency Rollback (Immediate)

### Step 1: Immediate Traffic Disable (30 seconds)

#### Option A: Kill Switch Activation
```bash
# Stop all incoming requests immediately
curl -X POST "http://localhost:3001/admin/kill-switch" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "reason": "Emergency rollback"}'

# Verify kill switch active
curl "http://localhost:3001/healthz"
# Expected: {"status": "disabled", "reason": "Kill switch active"}
```

#### Option B: Service Shutdown
```bash
# Immediate shutdown if kill switch unavailable
cd pilot-deploy
docker-compose -f docker-compose.poc.yml down
```

### Step 2: Assess Impact (60 seconds)
```bash
# Check current service status
docker-compose -f pilot-deploy/docker-compose.poc.yml ps

# Check for active sessions
curl "http://localhost:3001/admin/sessions" || echo "Service down"

# Check logs for errors
docker-compose -f pilot-deploy/docker-compose.poc.yml logs --tail=50
```

## 🔄 Full Rollback Procedures

### Scenario A: Configuration Rollback

#### Issue: Environment/config changes causing problems

```bash
# 1. Stop current deployment
cd pilot-deploy
./scripts/pilot-down.sh

# 2. Restore last known-good environment
cp .env.poc.backup .env.poc  # If backup exists
# OR
cp .env.poc.example .env.poc  # Reset to defaults

# 3. Restart with restored config
./scripts/pilot-up.sh

# 4. Verify health
../scripts/pilot-smoke.sh
```

**Time Estimate**: 2-3 minutes

### Scenario B: Service Version Rollback

#### Issue: New Docker images causing instability

```bash
# 1. Stop current services
cd pilot-deploy
docker-compose -f docker-compose.poc.yml down

# 2. Remove problematic images
docker rmi scenario-gateway:latest scenario-engine:latest scenario-jobs:latest

# 3. Pull last known-good versions (specify tags)
docker pull scenario-gateway:v1.0.0
docker pull scenario-engine:v1.0.0
docker pull scenario-jobs:v1.0.0

# 4. Update compose file to use specific versions
sed -i '' 's/:latest/:v1.0.0/g' docker-compose.poc.yml

# 5. Restart with stable versions
docker-compose -f docker-compose.poc.yml up -d

# 6. Verify health
../scripts/pilot-smoke.sh
```

**Time Estimate**: 3-5 minutes

### Scenario C: Complete Environment Reset

#### Issue: Corrupted state, data inconsistency

```bash
# 1. Complete teardown
cd pilot-deploy
./scripts/pilot-reset.sh
# This will prompt for confirmation - answer 'y'

# 2. Verify clean state
docker ps | grep pilot
docker volume ls | grep pilot

# 3. Fresh deployment
./scripts/pilot-up.sh

# 4. Load clean demo seeds
curl -X POST "http://localhost:3001/admin/seed" \
  -H "Content-Type: application/json" \
  -d @seed/demo-scenario.json

# 5. Full validation
../scripts/pilot-smoke.sh
```

**Time Estimate**: 4-6 minutes

### Scenario D: Hardware/Infrastructure Issues

#### Issue: Host system problems, resource exhaustion

```bash
# 1. Check system resources
df -h
free -h
docker system df

# 2. Clean up Docker resources
docker system prune -a -f --volumes

# 3. Restart Docker daemon (if needed)
sudo systemctl restart docker  # Linux
# OR restart Docker Desktop (macOS/Windows)

# 4. Redeploy from scratch
cd pilot-deploy
./scripts/pilot-up.sh

# 5. Monitor resource usage
docker stats
```

**Time Estimate**: 5-10 minutes

## 📦 Asset Recovery

### Known-Good State Restore Points

#### Git Commits (Recommended)
```bash
# Restore to last working commit
git checkout 79afc67  # Pilot evidence commit
git checkout 8fe315d  # Final pilot metrics

# Rebuild pilot pack
cd pilot-deploy
./scripts/pilot-up.sh
```

#### Configuration Backups
```bash
# Environment restore points
cp pilot-deploy/.env.poc.example pilot-deploy/.env.poc      # Safe defaults
cp pilot-deploy/.env.poc.backup pilot-deploy/.env.poc      # Previous working

# Seed data restore
cp pilot-deploy/seed/demo-scenario.json.backup pilot-deploy/seed/demo-scenario.json
```

#### Docker Image Tags
```yaml
# Last stable image versions
services:
  gateway:
    image: scenario-gateway:v1.0.0    # Known working
  engine:
    image: scenario-engine:v1.0.0     # Known working
  jobs:
    image: scenario-jobs:v1.0.0       # Known working
```

## 🔍 Diagnostic Commands

### Quick Health Check
```bash
# Service status
docker-compose -f pilot-deploy/docker-compose.poc.yml ps

# Basic connectivity
curl -f http://localhost:3001/healthz
curl -f http://localhost:3002/healthz
curl -f http://localhost:3003/healthz

# Smoke tests
./scripts/pilot-smoke.sh
```

### Deep Diagnostic
```bash
# Resource usage
docker stats --no-stream

# Recent logs
docker-compose -f pilot-deploy/docker-compose.poc.yml logs --tail=100

# Network connectivity
docker network ls
docker network inspect pilot-network

# Volume status
docker volume ls
docker volume inspect pilot-deploy_prometheus_data
docker volume inspect pilot-deploy_grafana_data
```

## 🎯 Rollback Validation

### Verify Restoration
```bash
# 1. All services healthy
docker-compose -f pilot-deploy/docker-compose.poc.yml ps | grep "Up (healthy)"

# 2. Smoke tests pass
./scripts/pilot-smoke.sh

# 3. Performance baseline met
# Check TTFF, cancel latency in smoke test output

# 4. Security controls active
npm run flags:snapshot

# 5. Demo functionality works
curl -N "http://localhost:3001/stream?route=critique&seed=42" | head -n 5
```

### Success Criteria
- [ ] All 3 core services Up (healthy)
- [ ] All smoke tests passing
- [ ] TTFF < 500ms, cancel < 150ms
- [ ] No security violations
- [ ] Demo scenarios functional

## 📞 Escalation Paths

### Level 1: Self-Service (0-5 minutes)
- Use kill switch
- Restart services
- Reset environment
- **Tools**: Scripts in `pilot-deploy/scripts/`

### Level 2: Technical Lead (5-15 minutes)
- Docker system issues
- Network problems
- Performance degradation
- **Tools**: Docker diagnostics, system monitoring

### Level 3: Infrastructure (15+ minutes)
- Host system failure
- Resource exhaustion
- Hardware problems
- **Tools**: System administration, infrastructure team

## 🔒 Safety Measures

### Prevent Data Loss
```bash
# Backup before rollback
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
cp -r pilot-deploy/.env.poc backups/$(date +%Y%m%d_%H%M%S)/
docker-compose -f pilot-deploy/docker-compose.poc.yml logs > backups/$(date +%Y%m%d_%H%M%S)/logs.txt
```

### Preserve Evidence
```bash
# Capture state before rollback
docker-compose -f pilot-deploy/docker-compose.poc.yml ps > rollback-evidence.txt
docker stats --no-stream >> rollback-evidence.txt
curl -s "http://localhost:3001/admin/metrics" >> rollback-evidence.txt
```

## ⚡ Quick Reference

### Emergency Commands
```bash
# KILL SWITCH (immediate)
curl -X POST "http://localhost:3001/admin/kill-switch" -d '{"enabled": true}'

# STOP ALL (30 seconds)
cd pilot-deploy && ./scripts/pilot-down.sh

# RESET ALL (2 minutes)
cd pilot-deploy && ./scripts/pilot-reset.sh

# RESTORE DEFAULTS (1 minute)
cp pilot-deploy/.env.poc.example pilot-deploy/.env.poc
```

### Status Check
```bash
# Health check
curl http://localhost:3001/healthz

# Quick test
./scripts/pilot-smoke.sh

# Service status
docker-compose -f pilot-deploy/docker-compose.poc.yml ps
```

---

**Remember**: In pilot mode, all data is simulated. Rollback is safe and data loss is not a concern. Focus on rapid service restoration.