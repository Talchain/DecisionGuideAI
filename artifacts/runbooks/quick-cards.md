# On-Call Quick Cards

Emergency troubleshooting cards for common platform issues. Each card fits on half a page and references exact commands.

---

## 🌊 Stream Stalls (Analysis stops streaming)

### If: Analysis starts but no new tokens appear for >30 seconds

**DO**:
1. **Check AI service status**
   ```bash
   curl -s https://api.openai.com/v1/models
   ```

2. **Verify streaming connection**
   ```bash
   npm run sse:stability
   ```

3. **Check Last-Event-ID**
   - Look in browser dev tools → Network → Headers
   - Should see `Last-Event-ID` in reconnection attempts

4. **Manual reconnection test**
   ```bash
   curl -N -H "Accept: text/event-stream" \
        -H "Last-Event-ID: test_123" \
        http://localhost:3000/api/analysis/stream
   ```

**ESCALATE IF**: All connections fail or AI service is down

**EVIDENCE**: Save browser network logs and `sse:stability` output

---

## ⏸️ Cancel Slow (Stop button takes >1 second)

### If: Users report cancel/stop is unresponsive

**DO**:
1. **Check active connections**
   ```bash
   npm run sse:stability
   ```
   Look for "activeConnectionsAtEnd" > 0

2. **Kill zombie connections**
   ```bash
   # Check for stuck processes
   ps aux | grep node
   # Kill specific PIDs if needed
   kill -TERM [PID]
   ```

3. **Test cancel timing**
   ```bash
   # Start analysis, then immediately cancel
   # Measure response time
   time curl -X POST http://localhost:3000/api/analysis/cancel/[id]
   ```

4. **Check database locks**
   ```bash
   # Look for long-running queries
   npm run db:slow-queries
   ```

**ESCALATE IF**: Cancel takes >5 seconds consistently

**EVIDENCE**: `sse:stability` report and timing measurements

---

## 🚧 Jobs Stuck (Analysis pending forever)

### If: Analysis shows "pending" or "queued" but never starts

**DO**:
1. **Check queue status**
   ```bash
   curl http://localhost:4500/jobs/status
   ```

2. **Look for dead letter queue**
   ```bash
   curl http://localhost:4500/jobs/failed
   ```

3. **Restart job processor**
   ```bash
   docker compose --profile poc restart jobs
   ```

4. **Manual retry**
   ```bash
   curl -X POST http://localhost:4500/jobs/[job-id]/retry
   ```

5. **Check worker health**
   ```bash
   curl http://localhost:4500/health
   ```

**ESCALATE IF**: Jobs service is completely unresponsive

**EVIDENCE**: Job queue status and health check results

---

## 🚫 Contract Wall Fails (API validation errors)

### If: Users get "Invalid request" or 400 errors

**DO**:
1. **Check OpenAPI schema**
   ```bash
   curl http://localhost:3000/api/docs/openapi.json
   ```

2. **Validate specific request**
   ```bash
   # Use Postman collection to test
   npm run api:test
   ```

3. **Check recent schema changes**
   ```bash
   git log --oneline -10 -- "*.yaml" "*.json"
   ```

4. **Test known-good request**
   ```bash
   curl -X POST http://localhost:3000/api/analysis \
        -H "Content-Type: application/json" \
        -d @tools/test-payload.json
   ```

5. **Bypass validation (emergency)**
   ```bash
   # Only for critical issues - re-enable validation ASAP
   docker compose --profile poc down
   # Edit .env.poc: DISABLE_VALIDATION=true
   docker compose --profile poc up -d
   ```

**ESCALATE IF**: All API endpoints return validation errors

**EVIDENCE**: Sample failing requests and OpenAPI schema

---

## 🔐 Secret Guard Trips (Security warnings)

### If: Config lint fails or secrets detected

**DO**:
1. **Run immediate scan**
   ```bash
   npm run config:lint
   ```

2. **Check recent commits**
   ```bash
   git log --oneline -5
   git diff HEAD~1 | grep -i -E "(password|secret|key|token)"
   ```

3. **Scan common locations**
   ```bash
   grep -r "sk-" src/ || echo "No OpenAI keys found"
   grep -r "AKIA" . || echo "No AWS keys found"
   ```

4. **Emergency cleanup**
   ```bash
   # If secrets found, immediate removal
   git reset --hard HEAD~1  # ONLY if last commit
   # Or edit files to remove secrets
   ```

5. **Verify flag status**
   ```bash
   node ./tools/flags-cli.cjs --summary
   ```

**ESCALATE IF**: Secrets confirmed in production code

**EVIDENCE**: `config:lint` output and git commit hashes

---

## 🔧 Emergency Commands Reference

### Quick Health Check
```bash
npm run release:poc
```

### Full System Reset
```bash
docker compose --profile poc down
docker compose --profile poc up -d --force-recreate
```

### Fast Log Collection
```bash
docker compose --profile poc logs --tail=50 > emergency-logs.txt
```

### Service Status Overview
```bash
curl -s http://localhost:3001/health | jq
curl -s http://localhost:4311/health | jq
curl -s http://localhost:4500/health | jq
curl -s http://localhost:4600/health | jq
```

### Get Current Config
```bash
docker compose --profile poc config | head -20
```

---

## 📞 Escalation Contacts

**Level 1**: Platform team lead
**Level 2**: Engineering manager
**Level 3**: CTO/All-hands emergency

### When to Escalate

- **Immediately**: Data breach, secrets in production
- **15 minutes**: Complete system down
- **30 minutes**: >50% of requests failing
- **1 hour**: Performance degraded but functional

### What to Include

1. **Issue**: One-sentence description
2. **Impact**: How many users affected
3. **Evidence**: Relevant logs/screenshots
4. **Attempted**: What you tried from these cards
5. **Urgency**: Business impact level

---

*Last updated: On-call runbook v1.0*
*Next review: Monthly*