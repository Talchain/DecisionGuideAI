# Pilot Rollback Plan

Step-by-step procedures for safely backing out pilot changes and restoring baseline state.

## Rollback Triggers

Execute rollback if any of these conditions occur:
- **High Error Rate**: > 15% API failures for > 30 minutes
- **Performance Degradation**: TTFF > 5 minutes consistently
- **Security Incident**: Data exposure or unauthorized access
- **Critical Bug**: System-breaking issues affecting core flows
- **User Impact**: > 50% negative feedback or inability to complete flows

## Rollback Phases

### Phase 1: Immediate Safety (0-5 minutes)
**Goal**: Stop impact, ensure system safety

#### 1.1 Disable Pilot Features
```bash
# Turn off all powerful features immediately
export REAL_REPORTS_ENABLED=false
export USAGE_TRACKING_ENABLED=false
export RATE_LIMITING_ENABLED=false
export CACHE_ENABLED=false
export MONITORING_ENABLED=false
export SECRET_HYGIENE_BLOCKING=false
export SLO_ENFORCEMENT=false

# Restart in safe simulation mode
systemctl restart decisionguide-api
```

#### 1.2 Switch to Simulation Mode
```bash
# Ensure all endpoints use simulation
export SIMULATION_MODE=true
export WARP_ENDPOINT_OVERRIDE="simulation"

# Verify simulation active
curl -X GET /api/health | jq '.mode' # Should return "simulation"
```

#### 1.3 Emergency Communication
```bash
# Post status update
echo "⚠️ Pilot rollback in progress - System operating in safe simulation mode" \
  > artifacts/pilot-status.txt

# Notify stakeholders (if configured)
./tools/notify-rollback.sh "immediate-safety"
```

### Phase 2: Feature Rollback (5-15 minutes)
**Goal**: Restore known-good feature set

#### 2.1 Reset Feature Flags
```bash
# Restore safe defaults from charter
grep "defaults OFF" artifacts/claude-standing-permissions.md

# Apply baseline configuration
cp config/baseline.env config/current.env
source config/current.env
```

#### 2.2 Restore UI Fixtures
```bash
# Switch to known-good UI fixtures
cd artifacts/ui-fixtures
git checkout HEAD~1 -- .
npm run fixtures:validate

# Verify fixture integrity
npx tsx tools/fixtures-validate.ts
```

#### 2.3 Reset Warp Endpoints
```bash
# Restore simulation endpoints
export WARP_BASE_URL="http://localhost:3001/simulation"
export WARP_STREAM_ENDPOINT="/v1/stream/simulate"
export WARP_JOBS_ENDPOINT="/v1/jobs/simulate"

# Test endpoint connectivity
curl -X GET $WARP_BASE_URL/health
```

### Phase 3: Data Safety (15-30 minutes)
**Goal**: Secure data, clean artifacts

#### 3.1 Artifact Cleanup
```bash
# Remove any pilot-generated sensitive data
find artifacts/ -name "*.log" -delete
find artifacts/ -name "*pilot*" -type f -not -name "*.md" -delete

# Clean temporary files
rm -rf artifacts/runs/*pilot*
rm -rf artifacts/diffs/*pilot*

# Verify no sensitive data remains
npm run artefacts:scan:strict
```

#### 3.2 Reset Demo Environment
```bash
# Run demo reset to clean state
./tools/demo-reset.sh

# Verify clean state
ls artifacts/ | grep -v -E "(index|start-here|README)" | wc -l # Should be minimal
```

#### 3.3 Database Cleanup (if applicable)
```bash
# Clear any pilot session data
# NOTE: Only if using persistent storage
# psql -c "DELETE FROM sessions WHERE created_at > '2025-09-26';"

# For simulation mode, just restart
systemctl restart decisionguide-api
```

### Phase 4: Configuration Restore (30-45 minutes)
**Goal**: Return to pre-pilot baseline

#### 4.1 Git State Restoration
```bash
# Identify baseline commit
BASELINE_COMMIT=$(git log --oneline --grep="baseline" -n 1 | cut -d' ' -f1)

# Create rollback branch
git checkout -b rollback/pilot-$(date +%Y%m%d-%H%M)

# Reset to baseline (keeping safety improvements)
git revert --no-edit HEAD...$BASELINE_COMMIT

# Keep safety/security improvements
git cherry-pick $(git log --oneline --grep="security\|safety" --since="1 week ago" | cut -d' ' -f1)
```

#### 4.2 Dependency Restoration
```bash
# Restore known-good package versions
git checkout $BASELINE_COMMIT -- package.json package-lock.json

# Clean install
rm -rf node_modules
npm ci

# Verify functionality
npm run typecheck && npm test
```

#### 4.3 Environment Reset
```bash
# Copy baseline environment
cp .env.baseline .env.production
cp config/baseline.yaml config/production.yaml

# Apply configuration
systemctl reload decisionguide-api

# Verify startup
curl -X GET /api/health | jq
```

### Phase 5: Verification (45-60 minutes)
**Goal**: Confirm stable baseline operation

#### 5.1 System Health Check
```bash
# Full health verification
npm run integration:check
npm run contract:coverage
npm run determinism:check

# Performance baseline
time curl -X GET /api/health # Should be < 1s
```

#### 5.2 Core Flow Testing
```bash
# Test basic scenario flow
curl -X POST /api/analysis \
  -H "Content-Type: application/json" \
  -d '{"scenario": "Test rollback", "options": [{"name": "A"}, {"name": "B"}], "seed": 12345}'

# Verify simulation mode
curl -X GET /api/analysis/test-123/events | grep -q "simulation"
```

#### 5.3 Documentation Update
```bash
# Update rollback status
echo "✅ Rollback completed $(date)" >> artifacts/pilot-rollback-log.md

# Reset readiness metrics
npx tsx tools/pilot-readiness.ts reset
npx tsx tools/pilot-readiness.ts auto-detect
```

## Rollback Validation Checklist

### ✅ Safety Verification
- [ ] All powerful features OFF (rate limiting, cache, usage tracking, etc.)
- [ ] Simulation mode active and verified
- [ ] No sensitive data in artifacts
- [ ] Error rate < 1%
- [ ] Performance within baseline targets

### ✅ Functionality Verification
- [ ] Health endpoint responding
- [ ] Stream endpoints working in simulation
- [ ] Job processing functional
- [ ] Report generation working
- [ ] UI fixtures loading correctly

### ✅ Configuration Verification
- [ ] Environment variables reset
- [ ] Feature flags at safe defaults
- [ ] Dependencies restored
- [ ] Tests passing
- [ ] TypeScript compilation clean

## Post-Rollback Actions

### Immediate (0-24 hours)
1. **Monitor System**: Watch for any lingering issues
2. **Document Lessons**: Record what caused rollback
3. **Stakeholder Update**: Communicate status and next steps

### Short-term (1-7 days)
1. **Root Cause Analysis**: Investigate rollback trigger
2. **Fix Development**: Address underlying issues
3. **Test Plan**: Develop improved testing strategy

### Medium-term (1-4 weeks)
1. **Enhanced Safety**: Implement additional safeguards
2. **Gradual Re-enable**: Carefully restore features one-by-one
3. **Monitoring Improvement**: Better early warning systems

## Emergency Contacts

```bash
# System status
curl -X GET /api/health

# Get help
echo "Check docs/OPERATOR_HANDBOOK.md for detailed procedures"
echo "Review artifacts/troubleshooting.md for common issues"

# Critical escalation
# [Contact information would go here in production]
```

## Rollback Automation

### Quick Rollback Script
```bash
#!/bin/bash
# tools/emergency-rollback.sh

set -e

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# Phase 1: Immediate safety
export SIMULATION_MODE=true
source config/baseline.env
systemctl restart decisionguide-api

# Phase 2: Feature reset
./tools/demo-reset.sh

# Phase 3: Verify health
sleep 10
curl -f -X GET /api/health || exit 1

echo "✅ Emergency rollback completed"
echo "📋 Review artifacts/pilot-rollback-log.md for details"
```

### Rollback Testing
```bash
# Test rollback procedure (safe)
npm run test:rollback-simulation

# Verify rollback scripts work
npm run verify:rollback-tools
```

## Prevention

### Pre-emptive Monitoring
- Set up alerts for error rate > 10%
- Monitor TTFF > 3 minutes
- Watch for authentication failures
- Track stream disconnection rates

### Circuit Breakers
- Auto-disable features if error rate spikes
- Automatic fallback to simulation mode
- Rate limiting bypass for critical operations

### Rollback Testing
- Weekly rollback drills
- Automated rollback verification
- Pre-staging environment rollback tests

---

**Remember**: When in doubt, err on the side of safety. It's better to rollback early than to risk data or system integrity.