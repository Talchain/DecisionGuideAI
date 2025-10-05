# Deployment Verification

Verify which commit is deployed and that routes are bundled.

## 1. Check Version Fingerprint

```bash
curl https://olumi.netlify.app/version.json
```

**Expected Response:**
```json
{
  "commit": "cc6e4bd1234567890abcdef...",
  "short": "cc6e4bd",
  "branch": "main",
  "timestamp": "2025-01-05T10:30:00Z"
}
```

## 2. Check Route Guard

```bash
curl https://olumi.netlify.app/sandbox-v1-ok.txt
```

**Expected Response:** `OK`

## 3. Verify Rich UI Route

Open: https://olumi.netlify.app/#/sandbox-v1

### Expected Behaviour:

**Header:**
- Shows commit hash inline (e.g., `Scenario Sandbox (Preview) @cc6e4bd`)
- Shows deployed timestamp in British format

**Diagnostics Bar:**
```
Diagnostics  edge: /engine  template: pricing_change  seed: 101  sections: all
```

**Request Line (under controls):**
```
Request: /engine/draft-flows?template=pricing_change&seed=101 • status 200
```

**Results:**
- Three cards auto-populate: Conservative (yellow), Most Likely (blue), Optimistic (green)
- Each shows `cost_delta` or falls back to `value`
- Thresholds render with "(crossed)" indicators

**Graph:**
- Decision graph renders with nodes/edges
- Text fallback panel shows nodes/edges as numbered lists
- Interactive controls: Add, Rename, Connect, Undo, Redo

**Debug Panel (on failure):**
- Red error banner with message
- Raw JSON response displayed

**Console Beacon:**
```javascript
UI_POC_SANDBOX_V1_ENHANCED {
  edge: "/engine",
  template: "pricing_change",
  seed: 101,
  hardcoded: { sandbox: true, sse: true },
  sections: "all"
}
```

## 4. Compare with GitHub

The `short` commit in `/version.json` should match the "Latest commit" shown on:
https://github.com/Talchain/DecisionGuideAI

## Troubleshooting

### Version.json returns 404
- Netlify build may have failed
- Check build command includes version.json generation
- Verify `netlify.toml` has correct build command

### Route shows 404 or blank page
- Check `src/App.tsx` has `<Route path="/sandbox-v1" element={<SandboxV1 />} />`
- Verify import statement exists
- Check build logs for bundling errors

### Commit hash doesn't match GitHub
- Deployment may be from older commit
- Check Netlify deploy log for actual commit SHA
- May need to trigger new deployment

### Results don't populate
- Check browser console for errors
- Verify `/engine/draft-flows` endpoint is accessible
- Check Network tab for request/response
- Debug panel should show raw JSON if fetch succeeds but parsing fails
