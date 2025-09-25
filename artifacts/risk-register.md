# Risk Register - PoC Level

Top risks for the DecisionGuide AI Scenario Sandbox PoC with mitigations and validation checks.

| Risk | Description | Impact | Mitigation | Check That Catches It |
|------|-------------|--------|------------|----------------------|
| **Config Drift** | Environment configs get out of sync between dev/staging/prod | Medium | Use `.env.example` as source of truth; validate on deploy | `npm run config:lint` |
| **Shared Folder Edits** | Multiple people editing same files causing conflicts | Medium | Use isolated worktrees; clear ownership boundaries | Git merge conflict detection |
| **Spec Creep** | Requirements keep growing during PoC phase | High | Fix scope in writing; monthly scope review | Project milestone reviews |
| **Logging Slip** | Sensitive data accidentally logged to console/files | High | Never log payloads; use sanitized error messages | `npm run config:lint` + code review |
| **Secret Leakage** | API keys or secrets committed to repository | High | Use environment variables only; scan on commits | `npm run config:lint` + pre-commit hooks |
| **Flaky Cancel** | Stop/cancel button doesn't work reliably | Medium | Test cancel timing; implement timeout guards | `npm run sse:stability` |
| **Long PRs** | Pull requests become too large to review properly | Medium | Keep PRs small; review within 24h; use feature flags | PR size linting + review checklist |
| **Missing Flags** | New features deployed without feature flag protection | High | Default OFF for all powerful features; flag-first development | `npm run flags:print` + deployment checklist |

## Risk Assessment Matrix

```
HIGH   | Secret Leakage | Logging Slip | Spec Creep | Missing Flags |
       |               |              |            |               |
MEDIUM | Config Drift  | Shared Edits |            | Flaky Cancel  | Long PRs
       |               |              |            |               |
LOW    |               |              |            |               |
       +---------------+--------------+------------+---------------+
       UNLIKELY        POSSIBLE       LIKELY      VERY LIKELY
```

## Risk Details

### 🔴 High Priority Risks

**Secret Leakage**
- *Scenario*: Developer accidentally commits OpenAI API key
- *Detection Time*: Immediate (pre-commit) to 1 day (audit)
- *Recovery*: Rotate keys, clean git history, audit logs
- *Prevention*: `.env.example` templates, security training

**Logging Slip**
- *Scenario*: User input or AI responses logged to files
- *Detection Time*: Code review or security audit
- *Recovery*: Scrub logs, rotate affected user data
- *Prevention*: Sanitize all logging, payload awareness

**Spec Creep**
- *Scenario*: PoC becomes full product without planning
- *Detection Time*: Monthly scope reviews
- *Recovery*: Scope reset, stakeholder alignment
- *Prevention*: Clear PoC boundaries, written scope

**Missing Flags**
- *Scenario*: Powerful feature deployed without toggle
- *Detection Time*: Deployment review or user report
- *Recovery*: Emergency flag addition, rollback if needed
- *Prevention*: Flag-first development, deployment checklist

### 🟡 Medium Priority Risks

**Config Drift**
- *Scenario*: Production uses different settings than tested
- *Detection Time*: Integration testing or user reports
- *Recovery*: Config sync, environment rebuild
- *Prevention*: Single source of truth, validation scripts

**Shared Folder Edits**
- *Scenario*: Two developers edit same file simultaneously
- *Detection Time*: Git merge or build failure
- *Recovery*: Manual merge resolution
- *Prevention*: Clear ownership, isolated workspaces

**Flaky Cancel**
- *Scenario*: Stop button doesn't work, users frustrated
- *Detection Time*: User complaints or stability testing
- *Recovery*: Connection cleanup, timeout implementation
- *Prevention*: Regular stability testing, timeout guards

**Long PRs**
- *Scenario*: 500+ line PR that can't be reviewed properly
- *Detection Time*: PR submission
- *Recovery*: Break into smaller PRs
- *Prevention*: Feature flags, incremental development

## Mitigation Strategies

### Automated Checks
- **Daily**: `npm run config:lint` in CI pipeline
- **On PR**: Size check, security scan, flag validation
- **On Deploy**: Integration test, contract validation
- **Weekly**: Full system validation with `npm run release:poc`

### Human Processes
- **Code Review**: 2-person minimum for production code
- **Deployment Review**: Checklist for all releases
- **Security Training**: Monthly awareness sessions
- **Scope Reviews**: Monthly scope vs reality check

### Emergency Procedures
- **Secret Leak**: Immediate key rotation, git history cleanup
- **Config Drift**: Emergency config sync, rollback plan
- **Spec Creep**: Stakeholder meeting, scope reset
- **System Issues**: On-call runbook, escalation paths

## Risk Monitoring

### Daily Metrics
- Number of failed `config:lint` checks
- PR review time (target: <24h)
- Number of open high-priority issues
- Feature flag coverage percentage

### Weekly Reports
- Risk register review with team
- New risks identified
- Mitigation effectiveness review
- Lessons learned from incidents

### Monthly Assessment
- Risk probability and impact updates
- New risks from environment changes
- Mitigation strategy effectiveness
- Process improvements needed

---

## Risk Ownership

| Risk Category | Primary Owner | Backup Owner | Escalation |
|---------------|---------------|--------------|------------|
| Security | Security Lead | Platform Lead | CTO |
| Process | Project Manager | Team Lead | Director |
| Technical | Platform Lead | Senior Engineer | Engineering Manager |
| Business | Product Owner | Project Manager | VP Product |

---

*Risk register updated: September 2024*
*Next review: October 2024*
*Version: PoC-1.0*