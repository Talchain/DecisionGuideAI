# 60-Second Demo Script

**Goal**: Show DecisionGuide AI analyzing a business decision in real-time

**Setup**: Have terminal ready with commands copied, browser open to localhost

---

## Pre-Demo (30 seconds before)

**SAY**: "I'll show you DecisionGuide AI analyzing a real business decision in 60 seconds."

**COPY THESE COMMANDS** (have ready in terminal):
```bash
export SIMULATION_MODE=true
npm run dev
```

---

## Demo Script (60 seconds)

### 0:00-0:15 | Start & Setup (15s)

**SAY**: "Let's say a startup needs to decide how to enter the European market."

**DO**:
- Paste commands and hit Enter
- Wait for "Local: http://localhost:5173"
- Open browser to localhost:5173

**SAY**: "I'm using simulation mode for safety - no real AI calls."

### 0:15-0:30 | Create Decision (15s)

**SAY**: "I'll enter the decision scenario."

**DO**:
- Click "Create New Decision"
- Type: "European Market Entry"
- Add 3 options quickly:
  1. "Direct Sales"
  2. "Partner Channel"
  3. "Remote-First"

**SAY**: "Three realistic options - direct sales, partnerships, or remote approach."

### 0:30-0:45 | Run Analysis (15s)

**SAY**: "Now watch the AI analyze this live."

**DO**:
- Click "Start Analysis"
- Point to streaming text appearing
- Show confidence percentages

**SAY**: "See it thinking through each option in real-time. The confidence scores help gauge reliability."

### 0:45-0:55 | Show Results (10s)

**SAY**: "It recommends the partner channel approach."

**DO**:
- Highlight the recommendation
- Point to reasoning bullets
- Show final confidence: 87%

**SAY**: "Clear recommendation with reasoning - perfect for business decision-making."

### 0:55-1:00 | Wrap (5s)

**SAY**: "60 seconds - business decision analyzed with AI reasoning."

---

## If Stop Is Pressed (Handle Gracefully)

**IF** someone hits stop or asks you to pause:

**SAY**: "No problem - that shows our instant-cancel feature. Let me show you a completed analysis instead."

**DO**:
- Open: `/artifacts/report-v1-sample.json`
- Or show: `/artifacts/integration-status.html`

**SAY**: "Here's what a full analysis looks like - detailed breakdown, confidence scores, and actionable insights."

---

## Backup Flows

### If Demo Breaks
1. **Say**: "Let me show you our validation dashboard instead"
2. **Open**: `/artifacts/integration-status.html`
3. **Say**: "This shows all our testing - everything's green"

### If Questions About Safety
1. **Say**: "Everything runs in simulation mode by default"
2. **Show**: Simulation mode badge in UI
3. **Say**: "No real AI calls, no costs, completely safe for demos"

### If Asked About Real Usage
1. **Say**: "In production, this same flow works with real AI analysis"
2. **Open**: `/artifacts/flags.html`
3. **Say**: "We control features with flags - powerful ones are OFF by default"

---

## Key Messages (Memorize)

1. **Real-time AI analysis** - not batch processing
2. **Business-focused** - designed for actual decisions
3. **Safe by default** - simulation mode, flags OFF
4. **Instant feedback** - see reasoning as it develops
5. **Production ready** - full testing suite validates everything

---

## Copy-Paste Commands (Keep Ready)

**Start demo**:
```bash
export SIMULATION_MODE=true && npm run dev
```

**Quick health check** (if needed):
```bash
npm run release:poc
```

**Show artifacts** (if demo fails):
```bash
open artifacts/integration-status.html
```

**Check platform status**:
```bash
npm run determinism:check
```

---

## Success Metrics

**You nailed it if**:
- Audience sees real-time streaming
- Clear recommendation appears
- Takes exactly ~60 seconds
- No technical errors mentioned
- Audience asks "Can I try it?"

**Red flags**:
- Technical jargon
- Long pauses waiting for loading
- Mentioning implementation details
- Going over 90 seconds total

---

*Last updated: Demo script v1.0 - Keep it simple, keep it fast*