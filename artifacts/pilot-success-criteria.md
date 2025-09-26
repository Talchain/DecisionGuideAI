# Pilot Success Criteria

Measurable objectives for DecisionGuide AI pilot deployment with specific metrics and measurement tools.

## Primary Success Metrics

### 1. Time to First Flow (TTFF)
**Target**: < 2 minutes from landing to first analysis result

**Measurement**:
- Start timer when user lands on platform
- Stop when first analysis stream completes
- Measure using built-in telemetry (when enabled)

**Tools**:
```bash
# Enable telemetry for measurement
export TELEMETRY_ENABLED=true

# Analyze completion times
npx tsx tools/pilot-readiness.ts update "time to first flow" completed "Average: 85 seconds"
```

### 2. Time to Compare (TTC)
**Target**: < 5 minutes to generate comparative analysis of 2+ options

**Measurement**:
- Timer from scenario submission to final report
- Track multi-option analysis completion
- Measure via API timing headers

**Tools**:
```bash
# Use seed for reproducible timing tests
curl -X POST /api/analysis \
  -d '{"scenario": "Test", "options": [...], "seed": 12345}' \
  --write-out "Time: %{time_total}s\n"
```

### 3. Reproducibility Score
**Target**: > 95% identical results for same seed

**Measurement**:
- Run same analysis with identical seed
- Compare token-by-token output
- Measure report structure consistency

**Tools**:
```bash
# Determinism check tool
npm run determinism:check

# Manual verification
npx tsx tools/pilot-readiness.ts update "reproducibility" completed "Score: 98.7%"
```

## Secondary Success Metrics

### 4. User Flow Completion Rate
**Target**: > 80% of users complete end-to-end scenario

**Measurement**:
- Track scenario creation → analysis → report viewing
- Measure drop-off points
- Use run history for completion tracking

### 5. Error Rate
**Target**: < 5% of operations result in errors

**Measurement**:
- Monitor 4xx/5xx responses
- Track stream disconnections
- Log client-side errors

### 6. Performance Targets
- **Analysis Start**: < 3 seconds from request to first token
- **Token Rate**: > 20 tokens/second during streaming
- **Cancel Latency**: < 150ms for cancellation
- **Reconnect Time**: < 2 seconds for stream recovery

## Measurement Infrastructure

### Built-in Pilot Tools

#### Readiness Dashboard
```bash
# Check current readiness status
npx tsx tools/pilot-readiness.ts

# Update metrics manually
npx tsx tools/pilot-readiness.ts update "success criteria" completed "All targets defined"
```

#### Determinism Validation
```bash
# Run determinism check
npm run determinism:check

# Expected output: identical results for same seed
```

#### Performance Monitoring
```bash
# Check cancel latency
npx tsx tools/fast-cancel-test.ts

# Stream performance test
npx tsx tools/stream-performance-test.ts
```

### Data Collection Points

#### 1. API Response Headers
- `X-Request-ID`: For request tracing
- `X-Response-Time`: Server processing time
- `X-RateLimit-*`: Rate limiting metrics

#### 2. SSE Stream Events
- `start`: Analysis initiation timestamp
- `data`: Token generation timing
- `complete`: Total analysis duration
- `error`: Error classification and timing

#### 3. Client-Side Metrics
```javascript
// Time to first token
const startTime = Date.now();
events.onmessage = (event) => {
  if (!firstTokenTime) {
    firstTokenTime = Date.now() - startTime;
    console.log(`TTFT: ${firstTokenTime}ms`);
  }
};

// Track completion
events.addEventListener('complete', () => {
  const totalTime = Date.now() - startTime;
  console.log(`Total: ${totalTime}ms`);
});
```

## Success Validation Process

### Week 1: Baseline Establishment
1. **Setup Monitoring**: Enable telemetry and logging
2. **Baseline Tests**: Run standardized scenarios
3. **Tool Verification**: Confirm measurement tools working

```bash
# Week 1 validation script
npm run pilot:baseline-test
npx tsx tools/pilot-readiness.ts auto-detect
```

### Week 2-4: Pilot Execution
1. **Daily Metrics**: Collect TTFF, TTC, reproducibility
2. **User Feedback**: Track completion rates and errors
3. **Performance Monitoring**: Monitor latency and throughput

```bash
# Daily metric collection
npm run pilot:daily-metrics
npx tsx tools/pilot-readiness.ts update "pilot day $(date +%d)" in_progress
```

### Week 4: Success Assessment
1. **Metric Analysis**: Compare against targets
2. **Trend Review**: Identify improvements over time
3. **Gap Assessment**: Document areas needing work

```bash
# Final assessment
npm run pilot:final-assessment
npx tsx tools/pilot-readiness.ts update "pilot success" completed "Metrics achieved"
```

## Data Privacy & Safety

### Measurement Guidelines
- **No PII**: Never log personal data or scenario content
- **Aggregate Only**: Collect timing/performance metrics only
- **Simulation Default**: Use simulation mode for safety

### Safe Telemetry
```javascript
// Good: timing only
telemetry.timing('stream.complete', duration);

// Bad: content logging
telemetry.log('stream.content', scenarioText); // Never do this
```

## Success Thresholds

### Green (Success)
- All primary metrics hit targets
- Error rate < 3%
- User satisfaction > 85%

### Yellow (Partial Success)
- 2/3 primary metrics hit targets
- Error rate < 8%
- Clear improvement path identified

### Red (Needs Work)
- < 2 primary metrics hit targets
- Error rate > 10%
- Fundamental issues requiring redesign

## Reporting Template

### Weekly Status Report
```markdown
## Pilot Week X Status

### Metrics This Week
- TTFF: XX seconds (target: < 120s)
- TTC: XX seconds (target: < 300s)
- Reproducibility: XX% (target: > 95%)
- Error Rate: XX% (target: < 5%)

### Key Findings
- [Finding 1]
- [Finding 2]

### Actions for Next Week
- [Action 1]
- [Action 2]
```

### Tools for Reporting
```bash
# Generate weekly metrics
npx tsx tools/pilot-metrics-weekly.ts

# Update readiness dashboard
npx tsx tools/pilot-readiness.ts auto-detect

# Export metrics
npx tsx tools/pilot-metrics-export.ts --format csv --week 2
```

---

**Note**: These criteria focus on measurable outcomes while maintaining data privacy and system safety.