# Operator Handbook v1.1
## DecisionGuide AI - Scenario Sandbox PoC

**For new team members joining the platform operations**

---

## What This System Does

DecisionGuide AI helps people make better business decisions by analyzing different options and scenarios. Think of it like having a super-smart consultant that can quickly evaluate multiple paths forward and show you the pros, cons, and likely outcomes of each choice.

**Example**: A company wants to enter a new market. They could: (1) build slowly, (2) buy a competitor, or (3) partner with someone local. Our system analyzes all three options and shows which might work best based on their specific situation.

## How It Works (Simple Version)

1. **User enters a decision** they need to make
2. **System analyzes** all the options using AI
3. **Results stream back** in real-time (like ChatGPT)
4. **User gets a report** with recommendations

That's it. Everything else is plumbing to make this happen safely and reliably.

---

## Your Role as Platform Operator

### Daily Responsibilities

**🌅 Morning Checklist (5 minutes)**
- Check system health: `npm run release:poc`
- Review overnight error logs
- Verify all services are green in monitoring dashboard

**🏗️ Feature Deployments**
- New features are **OFF by default** (safety first)
- Use feature flags to gradually roll out changes
- Test in simulation mode before touching real AI services
- For UI development, use deterministic fixtures in `artifacts/ui-fixtures/` (see UI Fixture Packs v3)

**🚨 Incident Response**
- If users report issues: check recent deployments first
- Use the troubleshooting runbook (see "When Things Break")
- Escalate to engineering if it's not in the runbook

**📊 Weekly Tasks**
- Review usage metrics and cost analysis
- Update documentation if processes changed
- Run full system validation: `npm run integration:check`

### Safety Rules (Non-Negotiable)

1. **Never deploy on Friday afternoons** (unless emergency)
2. **Always test in simulation mode first** (`X-Simulation-Mode: true`)
3. **Keep powerful features OFF by default** (use feature flags)
4. **Don't touch the production database directly** (use admin tools)
5. **When in doubt, ask** (better safe than sorry)

---

## System Architecture (What You Need to Know)

### The Main Components

```
[User Interface] → [API Server] → [AI Analysis Engine] → [Database]
                      ↓
                [Streaming Results]
```

**User Interface**: React web app where users create decisions
**API Server**: Handles requests, authentication, data validation
**AI Analysis Engine**: The smart part that analyzes scenarios
**Database**: Stores decisions, results, user data
**Streaming**: Real-time results delivery (like live chat)

### Environments

**Development (`dev`)**
- Your local machine
- Safe to break things
- Uses simulation mode by default

**Staging (`staging`)**
- Pre-production testing
- Real AI calls but test data
- Where we catch issues before users see them

**Production (`prod`)**
- Live system with real users
- Handle with extreme care
- Changes need approval

---

## Common Operations

### Starting Your Day

```bash
# Navigate to the project
cd /path/to/DecisionGuideAI-Claude

# Check everything is healthy
npm run release:poc

# If green: you're good to go
# If red: investigate the failed checks
```

### Deploying Features

```bash
# 1. Test locally first
npm run test
npm run typecheck

# 2. Deploy to staging
git push origin staging

# 3. Run integration tests
npm run integration:check

# 4. If all green, deploy to production
git push origin main
```

### Checking System Health

```bash
# Quick health check
curl https://api.decisionguide.ai/health

# Detailed system status
npm run release:poc

# Database connection test
npm run test:connection
```

### Feature Flags

Features are controlled by flags in `src/flags.ts`:

```javascript
export const FLAGS = {
  ADVANCED_ANALYTICS: false,  // New feature - keep OFF
  PDF_EXPORT: true,          // Stable feature - OK to enable
  EXPERIMENTAL_UI: false     // Don't turn this on yet
};
```

**To enable a feature:**
1. Change flag to `true` in staging
2. Test thoroughly
3. If stable, enable in production
4. Monitor for issues

---

## When Things Break

### User Reports "Analysis Not Working"

1. **Check system status**: `npm run release:poc`
2. **Look at recent deployments**: Any changes in the last hour?
3. **Test with simulation mode**: Does a test analysis work?
4. **Check AI service status**: Are our AI providers having issues?
5. **Look at error logs**: What do the server logs show?

### "Site is Down" / "Can't Load Page"

1. **Check if it's really down**: Try from different browser/location
2. **Verify server is running**: Check hosting provider status
3. **Look at CDN status**: Are static assets loading?
4. **Check database**: Is the connection working?
5. **Review recent changes**: Rollback if needed

### "Analysis Taking Forever"

1. **Check AI service status**: Third-party issue?
2. **Look at server resources**: CPU/memory usage high?
3. **Check for stuck jobs**: Any analyses running too long?
4. **Verify streaming connection**: WebSocket/SSE issues?

### Performance Issues

1. **Check system resources**: CPU, memory, database
2. **Look at slow query logs**: Database bottlenecks?
3. **Review recent traffic**: Unusual usage patterns?
4. **Monitor AI service response times**: Third-party delays?

### Emergency Procedures

**If the system is completely broken:**
1. **Don't panic** - most issues aren't as bad as they seem
2. **Put up maintenance page** (if needed)
3. **Gather information** before changing anything
4. **Contact engineering team** with details
5. **Document what happened** for post-mortem

---

## Monitoring and Alerts

### What to Watch

**System Health**
- API response times (should be < 2 seconds)
- Error rates (should be < 1%)
- Database connections (watch for leaks)
- AI service costs (unexpected spikes?)

**User Experience**
- Analysis completion rates (should be > 95%)
- Streaming connection drops (should be < 5%)
- User complaints/support tickets

**Business Metrics**
- Daily active users
- Analyses completed
- Feature adoption rates
- Revenue impact

### Alert Thresholds

**Immediate Action Required:**
- API error rate > 5%
- Analysis failures > 10%
- System completely down

**Investigate Soon:**
- Response times > 5 seconds
- Streaming errors > 10%
- Unusual cost spikes

**Monitor Trends:**
- Slow growth in error rates
- Gradual performance degradation
- Feature flag usage patterns

---

## When Something Looks Off - Quick Flowchart

```
🚨 Something doesn't look right?
                ↓
┌─────────────────────────────────────┐
│          What's the symptom?        │
└─────────────┬───────────────────────┘
              ↓
    ┌─────────┴─────────┐
    │ Stream stalled?   │
    │ (no new tokens)   │
    └─────┬─────────────┘
          ↓ YES
    ┌─────────────────────┐
    │ 1. Check AI service │ → If down: Wait/retry
    │ 2. Look at Last-ID  │ → If missing: Reconnect
    │ 3. Check user limit │ → If hit: Show friendly msg
    └─────────────────────┘
          ↓ NO
    ┌─────────────────────┐
    │ Cancellation slow?  │
    │ (>1s to respond)    │
    └─────┬───────────────┘
          ↓ YES
    ┌─────────────────────┐
    │ 1. Check connections│ → Kill zombie streams
    │ 2. Memory leaks?    │ → Run sse:stability
    │ 3. DB locks?        │ → Check slow queries
    └─────────────────────┘
          ↓ NO
    ┌─────────────────────┐
    │ Jobs stuck/queued?  │
    │ (analysis pending)  │
    └─────┬───────────────┘
          ↓ YES
    ┌─────────────────────┐
    │ 1. Queue backlog?   │ → Scale workers
    │ 2. Dead letter?     │ → Manual retry
    │ 3. Config error?    │ → Check flags
    └─────────────────────┘
          ↓ NO
    ┌─────────────────────┐
    │ Still unclear?      │
    │                     │
    └─────┬───────────────┘
          ↓ YES
    ┌─────────────────────┐
    │ 1. Run release:poc  │
    │ 2. Check recent PRs │
    │ 3. Ask engineering  │
    └─────────────────────┘

📋 Quick Commands:
• npm run release:poc     (overall health)
• npm run sse:stability   (connection issues)
• npm run integration:check (end-to-end test)
```

---

## Demo Checklist

### 📋 Before Demo
- [ ] Run `npm run release:poc` → All green?
- [ ] Check [Integration Status](../artifacts/integration-status.html) → Operational?
- [ ] Load [Evidence Pack](../artifacts/index.html) → Files available?
- [ ] Test one analysis in sim mode → Streams properly?
- [ ] Prepare fallback: "Let me show you our test results instead"

### 📋 During Demo
- [ ] Start with health check: "Let's see system status first"
- [ ] Use simulation mode initially: "I'll run this safely first"
- [ ] Show streaming in real-time: "Watch the analysis build up"
- [ ] If issues arise: "Let me switch to our validated test case"
- [ ] End with evidence pack: "Here's how we validate everything"

### 📋 After Demo
- [ ] Check for any errors in logs
- [ ] Reset any demo flags/data
- [ ] Note any questions you couldn't answer
- [ ] Update demo scenarios if needed
- [ ] Send follow-up with Evidence Pack link

---

## Useful Commands

### System Operations
```bash
# Check everything
npm run release:poc

# Run tests
npm test

# Type checking
npm run typecheck

# Integration tests
npm run integration:check

# Determinism validation
npm run determinism:check

# SSE connection stability
npm run sse:stability
```

### Development
```bash
# Start local server
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

### API Testing
```bash
# Quick API health check
curl https://api.decisionguide.ai/health

# Test with simulation mode
curl -X POST https://api.decisionguide.ai/simulate/analysis \
  -H "X-Simulation-Mode: true" \
  -H "Content-Type: application/json" \
  -d '{"scenario": "test"}'
```

---

## Getting Help

### Internal Team
- **Engineering Lead**: For architecture questions
- **Product Owner**: For feature prioritization
- **DevOps Team**: For infrastructure issues
- **Support Team**: For user-facing problems

### External Resources
- **AI Service Docs**: Provider documentation
- **Cloud Provider**: Infrastructure support
- **Third-party Tools**: Monitoring, logging, etc.

### Escalation Path
1. **Level 1**: Try the runbook solutions
2. **Level 2**: Contact engineering team
3. **Level 3**: Wake up the on-call person
4. **Level 4**: All-hands emergency

---

## Tips for New Operators

### First Week
- **Shadow an experienced operator** for a few deployments
- **Break things in dev environment** to understand failure modes
- **Read through recent incident reports** to learn patterns
- **Set up your monitoring dashboards** and get familiar with them

### Building Confidence
- **Start with small changes** and observe the results
- **Use simulation mode liberally** - it's there for your safety
- **Document what you learn** for the next person
- **Ask questions** - everyone was new once

### Common Mistakes to Avoid
- **Deploying without testing** - always verify changes work
- **Ignoring warnings** - small problems become big ones
- **Changing multiple things at once** - makes debugging harder
- **Forgetting to monitor after changes** - problems may appear later

---

## Appendices

### A. Glossary

**Analysis**: The AI-powered evaluation of decision scenarios
**Streaming**: Real-time delivery of results as they're generated
**Feature Flag**: On/off switch for new functionality
**Simulation Mode**: Testing mode that doesn't use real AI services
**SSE**: Server-Sent Events - how we stream results to users

### B. Contact Information

**Emergency Hotline**: [Your emergency contact]
**Engineering Team**: [Team contact info]
**Product Owner**: [Product contact]
**DevOps Team**: [Infrastructure contact]

### C. Important URLs

**Production**: https://decisionguide.ai
**Staging**: https://staging.decisionguide.ai
**Admin Panel**: https://admin.decisionguide.ai
**Monitoring**: https://monitoring.decisionguide.ai
**Documentation**: https://docs.decisionguide.ai

---

*Last updated: September 2024 | Version 1.0*
*Next review: October 2024*