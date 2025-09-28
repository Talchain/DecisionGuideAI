# Pilot Moderator Cue Card

## 3-Minute Narrative Script

### Opening (30 seconds)
**Say:** "Welcome to the DecisionGuide AI pilot. Today we'll demonstrate our decision analysis framework, starting with fixtures for safety, then swapping to live mode. You'll see real-time streaming, deterministic replay, and our Report v1 format."

**Do:**
1. Open browser to `http://localhost:5173`
2. Show demo interface is loaded
3. Point out seed input field (value: 42)

### Fixtures Demo (60 seconds)
**Say:** "First, let's run with fixtures to show the expected behaviour without any network dependencies."

**Do:**
1. Click **"Load Template"** → Select "Pricing Change Analysis"
2. **Say:** "Notice the template loads instantly with all fields populated"
3. Click **"Start Analysis"**
4. **Say:** "Watch the tokens streaming in—this is our SSE implementation with frozen event types"
5. Wait for completion (approximately 15 seconds)
6. **Say:** "Report v1 schema confirmed—see the meta.seed echo showing seed 42"
7. Click **"Export"** → CSV
8. **Say:** "Export includes USD currency labelling and deterministic filename"

### Live Swap (60 seconds)
**Say:** "Now let's switch to live mode using the Gateway at port 3001."

**Do:**
1. Open settings panel (gear icon ⚙️)
2. Toggle **"USE_MOCK_DATA"** to OFF
3. Toggle **"USE_SIMULATION"** to OFF
4. **Say:** "Flags flipped—we're now pointing to the live Gateway"
5. Click **"Start Analysis"** again with seed 42
6. **Say:** "Same seed, same output—demonstrating deterministic replay"
7. During streaming, click **"Cancel"**
8. **Say:** "Cancel latency target is 150ms—watch the immediate response"
9. Note the cancellation time shown

### Resume & Mobile (30 seconds)
**Say:** "Let's test resume semantics and mobile guardrails."

**Do:**
1. Start new analysis, wait 3 seconds
2. Simulate disconnect (refresh page)
3. **Say:** "Resume-once semantics will reconnect with Last-Event-ID"
4. Show mobile view (responsive preview)
5. **Say:** "Touch targets meet 44x44 pixel minimum, text is 16px base"

### Closing (30 seconds)
**Say:** "You've seen our frozen contracts, deterministic behaviour, and performance targets in action. The system maintains backwards compatibility whilst adding new pilot features like the ops console and CORS diagnostics. Questions?"

---

## Badge Criteria Cheatsheet

| Badge | Criteria | Visual Indicator |
|-------|----------|------------------|
| **🟢 HEALTHY** | All checks passing | Green status bar |
| **🟡 DEGRADED** | 1-2 checks failing | Yellow status bar |
| **🔴 CRITICAL** | 3+ checks failing or Gateway down | Red status bar |
| **⚡ PERFORMANCE** | P95 < 600ms, Cancel < 150ms | Lightning badge |
| **🔒 SECURE** | CORS closed, no body logging | Lock badge |
| **📊 COMPLIANT** | Report v1 schema valid | Chart badge |

---

## "If Red, Do This" Troubleshooting Flow

### 🔴 Gateway Unreachable
1. **Check:** `curl http://localhost:3001/healthz`
2. **If timeout:** Gateway not running
3. **Fix:** `npm run poc:start` in pilot deployment
4. **Fallback:** Toggle USE_MOCK_DATA=true, USE_SIMULATION=true

### 🔴 CORS Errors
1. **Check:** Browser console for CORS errors
2. **Open:** `http://localhost:3001/origin-check.html`
3. **Test:** Your origin (shows allow/deny status)
4. **Fix:** Add origin to CORS_ALLOWED_ORIGINS environment
5. **Restart:** Gateway service

### 🔴 Stream Not Starting
1. **Check:** Network tab for SSE connection
2. **Verify:** Content-Type is `text/event-stream`
3. **Test:** `curl -N http://localhost:3001/stream?route=critique&seed=42`
4. **If no events:** Check feature flags are OFF
5. **Fallback:** Return to fixtures mode

### 🔴 Cancel Too Slow (>150ms)
1. **Note:** Current latency shown in UI
2. **Check:** Network latency to Gateway
3. **Verify:** No rate limiting active
4. **Document:** Log as known issue for optimisation
5. **Continue:** Pilot can proceed with caveat

### 🔴 Report Schema Invalid
1. **Check:** Response includes `"schema":"report.v1"`
2. **Verify:** meta.seed echoes input seed
3. **If missing:** Flag as contract violation
4. **Document:** Screenshot the malformed response
5. **Escalate:** Stop pilot, investigate immediately

---

## Quick Commands Reference

```bash
# Health check
curl http://localhost:3001/healthz

# Test CORS
curl -H "Origin: http://localhost:5173" \
     -I http://localhost:3001/healthz

# Manual stream test
curl -N http://localhost:3001/stream?route=critique&seed=42

# Check ops console (if enabled)
curl http://localhost:3001/ops/flags
```

## Emergency Contacts
- **Technical Lead:** Check pilot brief for contact
- **Fallback Mode:** Always available via fixtures
- **Kill Switch:** Set GLOBAL_KILL_SWITCH=true to disable all endpoints