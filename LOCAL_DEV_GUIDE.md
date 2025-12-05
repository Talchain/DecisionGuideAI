# Local Development Guide - Testing Ghost Suggestions

## Quick Start (3 steps)

### 1. Install Dependencies (if not already done)
```bash
npm install
```

### 2. Start Dev Server
```bash
npm run dev:guide
```

This will:
- Start Vite dev server on port 5175
- Load `.env.local` with `VITE_COPILOT_ENABLED=true`
- Auto-open browser to `http://localhost:5175/#/sandbox/guide`

### 3. Test Ghost Suggestions

**You should immediately see:**
- ✅ **Green diagnostic banner** at top saying "GUIDE VARIANT LOADED!"
- Guide variant interface (not old PoC sandbox)
- Right panel with "Getting Started"

**To test ghost suggestions:**
1. Right-click on canvas → Select "Option"
2. Right-click again → Select "Outcome"
3. Hover over first node for ~500ms
4. You should see: **"✨ Suggested connection"** popup
5. Press `Tab` to accept or `Esc` to dismiss

---

## Console Logs to Watch

Open browser DevTools (F12) and watch for:

```
[DIAGNOSTIC] Guide variant loaded! { envVar: "true", ... }
[GuideCanvas] 🎨 Component MOUNTED
[GhostOverlay] 🚀 Component MOUNTED
[GhostOverlay] 🎣 Setting up event listeners...
[GhostOverlay] 🎨 Canvas element found: true
[GhostOverlay] ✅ Event listeners attached
```

**When you hover over a node:**
```
[GhostOverlay] 🖱️ Mouse enter node: {nodeId}
[GhostOverlay] 🔍 Can show ghosts? { canShow: true, journeyStage: 'building', nodeCount: 2 }
[GhostOverlay] ⏱️ Starting 300ms delay timer...
[GhostOverlay] ⏰ Timer fired! Generating suggestions...
[GhostOverlay] ✨ Generated suggestions: [...]
```

---

## Troubleshooting

### Issue: Still seeing old PoC sandbox

**Check:**
```bash
# Verify .env.local exists and has the flag
cat .env.local | grep VITE_COPILOT_ENABLED

# Should show: VITE_COPILOT_ENABLED=true
```

**Fix:** Restart dev server (Ctrl+C and `npm run dev:guide` again)

### Issue: No green banner appears

**Causes:**
1. Component failed to mount → Check console for React errors
2. Feature flag not set → Check `.env.local`
3. Import error → Check console for 404s

### Issue: Banner appears but no ghost suggestions

**Check console for:**
- `[GhostOverlay] 🚀 Component MOUNTED` - Is overlay loading?
- `[GhostOverlay] 🎨 Canvas element found: false` - Canvas not found
- `[GhostOverlay] 🔍 Can show ghosts? { canShow: false }` - Stage/node gating

**Common causes:**
- Journey stage not 'building'
- Less than 2 nodes on canvas
- Canvas element selector `.react-flow` not found

---

## Environment Variables

All env vars are in `.env.local`:
```bash
VITE_COPILOT_ENABLED=true          # ← CRITICAL for Guide variant
VITE_FEATURE_SSE=1
VITE_AUTH_MODE=guest
VITE_EDGE_GATEWAY_URL=/engine
```

**To check what's loaded:**
Open browser console and type:
```javascript
import.meta.env
```

Should show all `VITE_*` variables.

---

## Port Configuration

- Guide dev server: `http://localhost:5175` (configured in package.json)
- Main dev server: `http://localhost:5173`
- Sandbox dev server: `http://localhost:5174`

**If port 5175 is busy**, Vite will auto-increment to 5176, 5177, etc.
Watch console output for the actual URL.

---

## Hot Module Replacement (HMR)

Changes to these files will auto-reload:
- `GhostSuggestionsOverlay.tsx` ✅
- `CopilotCanvas.tsx` ✅
- `DiagnosticBanner.tsx` ✅

No need to restart server for code changes!

---

## Testing Different Scenarios

### Test 1: Empty State
- Refresh page
- Should see "Getting Started" panel
- No ghost suggestions (need 2+ nodes)

### Test 2: Single Node
- Add 1 node
- Should see "Building" stage
- No ghost suggestions (need 2+ nodes)

### Test 3: Two Nodes (Ghost Trigger)
- Add 2nd node
- Hover over first node
- Should see ghost suggestion after 300ms

### Test 4: Post-Run State
- Add nodes, connect edges
- Click "Run Analysis" (if available)
- Ghost suggestions should NOT appear (post-run stage)

---

## Comparing with Deployed Site

**Local:** `http://localhost:5175/#/sandbox/guide`
**Deployed:** `https://olumi.netlify.app/#/sandbox/guide`

Both should show identical behavior once deployment completes.

**Note:** You can run both servers simultaneously:
- Main UI on port 5173
- Guide variant on port 5175

---

## Need Help?

Check console for errors and look for specific log patterns above.
All debug logs have emoji prefixes for easy scanning.
