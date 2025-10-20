# Post-Merge Tasks - PR-A

## 🎯 First Tasks After Merge

### Immediate (< 1 hour)

#### 1. Deployment Verification ✅
```bash
# Check production deployment
curl https://[production-url]/health  # Should work if health enabled
curl https://[production-url]/#/canvas  # Should load Canvas

# Manual verification
# 1. Open production Canvas
# 2. Add node via toolbar
# 3. Change node type
# 4. Edit edge properties
# 5. Verify console clean
```

**Expected:**
- ✅ Canvas loads without errors
- ✅ All 5 node types available
- ✅ Type switcher works
- ✅ Edge inspector functional
- ✅ No /health calls (unless flag enabled)
- ✅ Console clean

#### 2. Monitor Error Tracking
```bash
# Check Sentry/error tracking
# Look for:
# - Canvas-related errors
# - Migration failures
# - Type validation warnings
# - Console errors
```

**Action if errors found:**
- Assess severity
- Create hotfix PR if critical
- Document in issue tracker

#### 3. Quick Smoke Test
- [ ] Create Goal node → Works
- [ ] Switch to Risk → Works
- [ ] Edit edge weight → Works
- [ ] Undo/Redo → Works
- [ ] Import v1 JSON → Migrates correctly

---

### Short-term (< 1 day)

#### 1. Team Communication
**Slack/Email Announcement:**
```
🎉 PR-A (Rich Node Types & Edge Domain) is now live!

New features:
• 5 node types: Goal, Decision, Option, Risk, Outcome
• Type switcher in Properties panel
• Rich edge properties (weight, style, curvature, label, confidence)
• Auto-migration from v1 to v2 format
• Keyboard shortcuts (⌘K for Command Palette)

Try it: [production-url]/#/canvas

Docs: See README.md Canvas section
Questions: #canvas-support
```

#### 2. Update Internal Documentation
- [ ] Update wiki with new features
- [ ] Add Canvas section to onboarding docs
- [ ] Update keyboard shortcuts reference
- [ ] Document migration process

#### 3. User Feedback Collection
- [ ] Set up feedback form/channel
- [ ] Monitor support tickets
- [ ] Track feature usage analytics
- [ ] Identify common questions

---

### Medium-term (< 1 week)

#### 1. User Testing Sessions
**Goals:**
- Validate UX flows
- Identify pain points
- Gather feature requests
- Test edge cases

**Format:**
- 30-min sessions with 5-10 users
- Record sessions (with consent)
- Take notes on friction points
- Collect qualitative feedback

#### 2. Analytics Review
**Metrics to track:**
- Canvas page views
- Node creation rate by type
- Type switcher usage
- Edge editing frequency
- Import/export usage
- Error rates

**Tools:**
- Google Analytics / Mixpanel
- Sentry error tracking
- Custom event logging

#### 3. Documentation Improvements
Based on feedback:
- [ ] Add FAQ section
- [ ] Create video tutorials
- [ ] Write blog post announcement
- [ ] Update screenshots if UI changed

---

## 🔮 Next Phase Planning

### Scheduled Features (Not in PR-A)

#### 1. Auto-Layout
**Status:** Placeholder button exists  
**Priority:** High  
**Scope:**
- Implement ELK.js integration
- Add layout algorithm selection
- Preserve manual positioning option
- Add "Reset Layout" action

**Estimated effort:** 2-3 days

#### 2. Engine Wiring
**Status:** Scheduled for next phase  
**Priority:** Medium  
**Scope:**
- Connect Canvas to decision engine
- Add execution flow visualization
- Show decision outcomes
- Integrate with scenario system

**Estimated effort:** 5-7 days

#### 3. Additional Node Types (If Needed)
**Status:** Backlog  
**Priority:** Low  
**Candidates:**
- Constraint nodes
- Metric nodes
- Stakeholder nodes
- Timeline nodes

**Estimated effort:** 1-2 days per type

---

## 📊 Success Metrics (1 Week Post-Merge)

### Technical Metrics
- [ ] **Zero critical errors** related to Canvas
- [ ] **< 1% error rate** on Canvas operations
- [ ] **< 2s load time** for Canvas page
- [ ] **100% migration success** for v1→v2

### User Metrics
- [ ] **> 50% adoption** of new node types
- [ ] **> 10 imports** using v1→v2 migration
- [ ] **> 100 nodes created** across all types
- [ ] **> 20 edge edits** using inspector

### Quality Metrics
- [ ] **Zero /health CORS errors** in logs
- [ ] **Zero console warnings** in production
- [ ] **Zero test failures** in CI/CD
- [ ] **Zero rollbacks** required

---

## 🐛 Known Issues / Tech Debt

### Minor Issues (Non-blocking)
1. **Large bundle warning** - ELK vendor chunk is 307 kB
   - **Impact:** Low (lazy-loaded)
   - **Fix:** Consider dynamic import optimization
   - **Priority:** Low

2. **Auto-layout placeholder** - Button exists but no-op
   - **Impact:** None (intentional)
   - **Fix:** Implement in next phase
   - **Priority:** Medium

### Tech Debt
1. **Test coverage** - Some edge cases not covered
   - **Action:** Add tests for error scenarios
   - **Priority:** Medium

2. **Performance** - Large graphs (>100 nodes) not tested
   - **Action:** Add performance benchmarks
   - **Priority:** Low

---

## 🎓 Lessons Learned

### What Went Well
- ✅ Comprehensive test coverage prevented regressions
- ✅ Migration API made v1→v2 seamless
- ✅ Deterministic E2E tests are stable
- ✅ Documentation-first approach helped clarity

### What Could Improve
- 🔄 Earlier screenshot capture would save time
- 🔄 More frequent intermediate commits
- 🔄 Parallel test development with features

### Best Practices to Continue
- ✅ Single source of truth for constants
- ✅ Type validation at boundaries
- ✅ Fallback rendering for robustness
- ✅ Opt-in for noisy features

---

## 📞 Support & Escalation

### Support Channels
- **Slack:** #canvas-support
- **Email:** support@[domain]
- **GitHub Issues:** Tag with `canvas` label

### Escalation Path
1. **L1:** Check documentation, known issues
2. **L2:** Review error logs, reproduce locally
3. **L3:** Create GitHub issue with reproduction steps
4. **L4:** Escalate to engineering lead if critical

### On-Call Rotation
- **Primary:** [Engineer 1]
- **Secondary:** [Engineer 2]
- **Escalation:** [Tech Lead]

---

## ✅ Completion Checklist

### Day 1
- [ ] Deployment verified
- [ ] Smoke test passed
- [ ] Team notified
- [ ] Monitoring active

### Week 1
- [ ] User feedback collected
- [ ] Analytics reviewed
- [ ] Documentation updated
- [ ] Success metrics tracked

### Week 2
- [ ] User testing sessions completed
- [ ] Next phase planned
- [ ] Tech debt prioritized
- [ ] Lessons learned documented

---

**Status:** Ready for post-merge execution  
**Owner:** [Assign owner]  
**Timeline:** 2 weeks  
**Success Criteria:** All metrics green, zero critical issues
