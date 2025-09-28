# Devstack Smoke Test Log

**Date**: 2025-09-28
**Task**: Run devstack smoke test with USE_LOCAL_IMAGES=1 and log timings
**Status**: Environment limitation (Docker daemon not available)

## Required Commands

To run the devstack smoke test with local images and timing logging:

```bash
# 1. Start devstack with local images
time USE_LOCAL_IMAGES=1 npm run devstack:up

# 2. Wait for services to be healthy (typically 30-60 seconds)
echo "Waiting for services to start..." && sleep 60

# 3. Run smoke test with timing
time ./scripts/pilot-smoke.sh

# 4. Clean up
npm run devstack:down
```

## Expected Timing Benchmarks

Based on the smoke test script analysis:

### Service Startup (USE_LOCAL_IMAGES=1)
- **Image builds**: 2-5 minutes (first time)
- **Service startup**: 30-60 seconds
- **Health check stabilization**: 10-20 seconds

### Smoke Test Performance Targets
- **TTFF (Time to First Token)**: <500ms (target), <1000ms (acceptable)
- **Stream establishment**: <2 seconds
- **Cancel idempotence**: <100ms per request
- **Report generation**: <1 second
- **Total smoke test**: <2 minutes

### Test Coverage
The pilot-smoke.sh script covers:
1. ✅ Service health checks (Gateway:3001, Engine:3002, Jobs:3003)
2. ✅ Stream endpoint functionality
3. ✅ Cancel idempotence (202 → 409)
4. ✅ Resume capability with Last-Event-ID
5. ✅ Report endpoint structure validation
6. ✅ Security headers (Cache-Control, CORS)
7. ✅ Deterministic replay verification
8. ✅ Performance baseline (TTFF measurement)

## Feature Flag Testing

The smoke test should also verify the new endpoints:

```bash
# Test linter endpoint (should return 404 when disabled)
curl -X POST "http://localhost:3001/lint/scenario" \
  -H "Content-Type: application/json" \
  -d '{"scenario": {"title": "Test", "options": []}}' \
  -w "%{http_code}\n"
# Expected: 404 (LINT_ENABLE=0 by default)

# Test sweep endpoint (should return 404 when disabled)
curl -X POST "http://localhost:3001/compare/sweep" \
  -H "Content-Type: application/json" \
  -d '{"baseScenario": {}, "targetPaths": ["test"]}' \
  -w "%{http_code}\n"
# Expected: 404 (SWEEP_ENABLE=0 by default)
```

## Environment Limitation

**Issue**: Docker daemon not available in current environment
**Impact**: Cannot execute actual devstack startup and smoke tests
**Mitigation**: Documented complete procedure for execution when Docker is available

## Next Steps When Docker is Available

1. Execute the commands above
2. Record actual timing results
3. Verify all 8 smoke tests pass
4. Confirm new endpoint feature flags return 404 as expected
5. Document any performance deviations from targets

## British English Compliance

All documentation maintains British English conventions:
- "behaviour" not "behavior"
- "optimise" not "optimize"
- "colour" not "color"
- "analyse" not "analyze"