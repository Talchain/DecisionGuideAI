# Operator Handbook
*DecisionGuide AI Platform Operations Guide*

## Emergency Procedures

### 🚨 Emergency: Turn Everything Off in 10 Seconds

**When:** System under load, security incident, or need immediate feature shutdown.

**Action:**
```bash
# Navigate to project root
cd /path/to/DecisionGuideAI-Claude

# Activate panic mode (current session only)
source ./tools/panic-off.sh
```

**What it does:**
- Forces ALL powerful features OFF via environment variables
- Affects current terminal session only
- Does NOT change config files or defaults
- Immediately disables: rate limiting, caching, monitoring, telemetry, data export, webhooks, etc.

**To restore:**
- Restart terminal session (environment variables reset)
- OR manually unset variables
- Config files remain unchanged

### System Status Check

```bash
# Check if features are enabled
npm run flags:print

# Verify configuration
npm run config:lint

# Test basic functionality
npm run integration:check
```

## Feature Flag Management

### Core Safety Principles
1. **Default OFF:** All powerful features start disabled
2. **Explicit Enable:** Require explicit configuration to activate
3. **Session Override:** Emergency disable without config changes
4. **No Persistence:** Panic mode affects current session only

### Critical Feature Flags
- `ENABLE_RATE_LIMITING` - API rate limiting
- `ENABLE_CACHING` - Response caching
- `ENABLE_USAGE_TRACKING` - Usage analytics
- `ENABLE_TELEMETRY` - System telemetry
- `ENABLE_MONITORING` - Health monitoring
- `ENABLE_SECRET_HYGIENE` - Secret validation
- `ENABLE_SSE_EXTRAS` - Extended SSE features
- `ENABLE_DATA_EXPORT` - Data export capabilities

## Incident Response

### High CPU/Memory Usage
1. Run panic-off switch
2. Check active connections: `npm run sse:stability`
3. Monitor resource usage
4. Investigate specific features causing load

### Security Concerns
1. Immediate panic-off activation
2. Review access logs
3. Check for unauthorized API usage
4. Verify secret integrity

### Configuration Issues
1. Compare configs: `npm run config:diff -- .env .env.example`
2. Identify risky differences
3. Reset to known-good state
4. Test incrementally

## Monitoring and Alerting

### Key Metrics
- Active SSE connections
- Token generation rate
- Error rates by endpoint
- Resource utilization

### Alert Thresholds
- SSE connections > 10 (immediate attention)
- Error rate > 5% (investigate)
- Response time > 2s (performance issue)

## Recovery Procedures

### After Panic Mode
1. Identify root cause
2. Fix underlying issue
3. Test in isolation
4. Gradually re-enable features
5. Monitor system health

### Configuration Restoration
1. Verify current config state
2. Compare with known-good baseline
3. Apply changes incrementally
4. Test each change independently

## API Key Management

### How to Rotate Keys Safely

**Before Rotation:**
1. Generate new API key securely
2. Test new key in staging environment
3. Plan overlap window (recommended: 30-60 minutes)

**During Rotation:**
1. Deploy new key alongside old key (both active)
2. Monitor usage patterns - clients adopt new key
3. Wait for 100% adoption of new key
4. Disable old key only after verification

**After Rotation:**
1. Confirm old key is disabled
2. Monitor error rates for authentication issues
3. Document rotation in security log

**Emergency Rollback:**
```bash
# If new key fails, immediately re-enable old key
export API_KEY_PRIMARY="old-key-value"
# Provides instant fallback to working authentication
```

**Demo Script:**
```bash
# Run key rotation simulation
./tools/rotate-key-demo.sh
# Shows complete overlap window process safely
```

## Demo Preparation

### Demo Reset Procedure

**Before demonstrating the platform:**

1. Clean up old artifacts and prepare environment
```bash
./tools/demo-reset.sh
```

2. Verify everything is ready:
   - ✅ Generated files cleaned
   - ✅ Feature flags OFF (safe defaults)
   - ✅ Dependencies installed
   - ✅ TypeScript compilation clean

3. Start demo environment:
```bash
npm run dev
# OR for full PoC setup:
./tools/poc-start.sh
```

**What demo reset does:**
- Removes old timestamped artifacts (performance baselines, release packages)
- Refreshes status files with current timestamps
- Verifies feature flags are OFF (doesn't change them)
- Checks dependencies and compilation
- Provides ready-to-demo checklist

**What it does NOT do:**
- Change any configuration files
- Modify feature flag defaults
- Start or stop services

---

*Last updated: September 2024*
*Review frequency: Monthly or after incidents*