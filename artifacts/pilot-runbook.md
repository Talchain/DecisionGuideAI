# Pilot Runbook v1

**One-page guide for demonstrating DecisionGuide AI platform** (60-90 seconds)

## ✅ Pre-Flight Checks

Before starting your demo:

1. **Open the Platform**: Navigate to `/artifacts/start-here.html` in your browser
2. **Run Demo Reset**: Click the command to copy, paste in terminal: `./tools/demo-reset.sh`
3. **Verify Green Status**: All lights should be green on the start page
4. **Have Backup Ready**: Keep offline demo page open: `/artifacts/windsurf-handover-bundle/demo-offline.html`

**Red Flags** (stop and fix):
- ❌ Any error messages on start page
- ❌ Missing artifacts or broken links
- ❌ System health not "Operational"

## 🎯 Demo Flow (60-90 seconds)

### Opening (10 seconds)
"This is DecisionGuide AI - a scenario analysis platform that helps teams make complex decisions with confidence."

### Core Demo (45 seconds)
1. **Show Stream**: Click "Stream Simulation" → "Start Stream"
   - *"Watch real-time analysis as tokens flow in"*
   - Point out the cancellation capability

2. **Show Jobs**: Click "Start Job"
   - *"Long-running analysis with progress tracking"*
   - Demonstrate cancel if needed

3. **Show Report**: Click "Load Report"
   - *"Complete analysis with scenarios, risks, and recommendations"*
   - Highlight structured output

### Integration Message (20 seconds)
"For developers: We have a complete integration pack"
- Show Windsurf Drop-In Note
- *"30 lines of code for full Stream, Jobs, and Report components"*
- *"Works completely offline for safe development"*

### Closing (15 seconds)
"Platform is pilot-ready with 95% completeness score and comprehensive safety safeguards."

## 🚨 What Can Go Wrong + Fixes

| Problem | Quick Fix |
|---------|-----------|
| **Stream won't start** | Refresh page, try offline demo |
| **Broken links** | Use Evidence Pack Index as backup |
| **Performance slow** | Close other browser tabs |
| **Demo freezes** | Have offline demo ready as backup |
| **Questions about live data** | "This is simulation mode - completely safe" |
| **Technical deep dive** | "Full API docs and troubleshooting guide available" |

### Emergency Backup
If anything breaks: **Switch to offline demo page**
- Located at: `artifacts/windsurf-handover-bundle/demo-offline.html`
- Works without any server or network
- Has same Stream/Jobs/Report functionality

## 📝 Capture Notes (No Personal Data)

During or after the demo:

```bash
# Quick note capture (terminal)
npm run pilot:note "Great response to stream cancellation demo"
npm run pilot:note "Questions about integration complexity"

# Generate summary after demo
npm run pilot:notes:summary
```

**Safe to capture:**
- ✅ Feature feedback ("loved the real-time aspect")
- ✅ Questions asked ("how does cancellation work?")
- ✅ Performance observations ("stream was fast")

**Never capture:**
- ❌ Names or personal info
- ❌ Company-specific scenarios
- ❌ Actual business data

## 🏁 Wrap-Up Checklist

After demo:

- [ ] **Success Metrics**: Note if demo completed under 90 seconds
- [ ] **Feedback Captured**: Used `npm run pilot:note` for key points
- [ ] **Materials Shared**: Send link to Pilot Pack if requested
- [ ] **Follow-up**: Note any technical questions for later response
- [ ] **Reset Complete**: Run `./tools/demo-reset.sh` to clean up

### Key Takeaway Messages

1. **For Executives**: "Platform ready for pilot with complete safety controls"
2. **For Developers**: "30-line integration with full offline simulation"
3. **For Operations**: "95% readiness score with rollback plans"

## 📦 Resources for Follow-up

**Immediate Handoffs:**
- Pilot Pack: `artifacts/pilot-pack.zip` (complete offline bundle)
- Integration Guide: `artifacts/windsurf-dropin-note.md`
- Success Criteria: `artifacts/pilot-success-criteria.md`

**Technical Deep Dive:**
- API Documentation: `artifacts/api-quickstart.md`
- Troubleshooting: `artifacts/troubleshooting.md`
- Rollback Plan: `artifacts/pilot-rollback-plan.md`

---

**Remember**: This is a simulation-safe environment. All powerful features are OFF by default. Perfect for demos and development.