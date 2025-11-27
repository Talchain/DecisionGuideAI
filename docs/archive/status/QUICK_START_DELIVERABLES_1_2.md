# Quick Start: Deliverables 1-2 Testing Guide

**Target**: Get Command Palette (Deliverable 2) + Observability (Deliverable 1) working locally.

## TL;DR - 3 Steps to Enable Everything

1. **Create `.env` file** (if you don't have one):
   ```bash
   cp .env.example .env
   ```

2. **Add these flags to `.env`**:
   ```bash
   # Enable Command Palette (Deliverable 2)
   VITE_FEATURE_COMMAND_PALETTE=1

   # Enable streaming (optional, better UX)
   VITE_FEATURE_PLOT_STREAM=1

   # Relax determinism check until backend adds response_hash
   VITE_STRICT_DETERMINISM=0
   ```

3. **Restart dev server**:
   ```bash
   npm run dev
   ```

4. **Open Command Palette**:
   - Mac: Press **⌘K**
   - Windows/Linux: Press **CTRL+K**
   - Press **?** for keyboard shortcuts help

---

## What You Should See

### ✅ Command Palette Features (Deliverable 2)

Once enabled with `VITE_FEATURE_COMMAND_PALETTE=1`:

1. **Universal Search** - Press ⌘K/CTRL+K to open:
   - Search nodes, edges, drivers, actions, templates
   - Fuzzy search with smart ranking
   - Keyboard navigation (↑↓ to select, ↵ to execute)

2. **Help Overlay** - Press **?** inside palette:
   - Shows all keyboard shortcuts
   - Global, palette, and canvas shortcuts
   - ESC hierarchy (closes help first, then palette)

3. **Recent Actions** - Tracks your last 5 actions:
   - Automatically added when you execute an item
   - Persisted to sessionStorage
   - Deduplicates (re-executing moves to front)

4. **Ranking Boost** - Smart prioritization:
   - Category priority: Drivers > Actions > Runs > Nodes/Edges
   - Match type priority: Exact > Prefix > Fuzzy
   - Alphabetical tiebreaker

### ✅ Observability Features (Deliverable 1)

**Backend infrastructure** - no visible UI, but check console:

- **Run lifecycle**: `[Metrics] run_started`, `run_completed`, `run_failed`
- **Stream progress**: `[Metrics] stream_progress`, `interim_findings`
- **UI interactions**: `[Metrics] palette_opened`, `palette_action`
- **Errors**: `[Metrics] rate_limited`, `validation_error`, `server_error`

All metrics logged to console in DEV, sent to PostHog in staging/prod.

---

## Known Issues & Workarounds

### ⚠️ Issue: "Something went wrong" when running analysis

**Root Cause**: Backend `/v1/run` doesn't return `response_hash` yet.

**Workaround** (enabled automatically with latest commit):
- Set `VITE_STRICT_DETERMINISM=0` in `.env`
- Adapter will **warn** instead of **throw**
- Generates temporary hash (`dev-{timestamp}-{random}`)
- Run proceeds normally for local testing

**Permanent Fix**: Backend team needs to add `result.response_hash` to `/v1/run` response.

**Production Safety**: Flag defaults to `1` (strict), so production will still hard-fail on missing hash.

---

### ⚠️ Issue: CORS error in console

**What you see**: `Access to fetch at 'https://plot-lite-service.onrender.com/health' from origin 'http://localhost:5173' has been blocked by CORS`

**Root Cause**: Legacy health probe in `index.html` makes direct request (bypasses proxy).

**Impact**: **None** - All adapter traffic uses `/api/plot` proxy (works fine).

**Workaround** (optional, to clean up console):
```typescript
// index.html - comment out the direct probe:
// fetch('https://plot-lite-service.onrender.com/health')
```

---

### ⚠️ Issue: 404 on `/validate` and `/limits` endpoints

**Root Cause**: Backend or proxy not serving these endpoints yet.

**Impact**: **Minimal** - Adapter gracefully falls back:
- `/validate`: Pre-flight validation is optional
- `/limits`: Uses hardcoded `V1_LIMITS` as fallback

**Fix**: Backend team to implement these endpoints (nice-to-have, not blocking).

---

### ⚠️ Issue: Templates too simplistic

**Examples**: Templates don't have:
- Goal nodes (start)
- Outcome nodes (end)
- Probability weights
- Rich metadata

**Root Cause**: Demo templates are placeholders.

**Workaround**: Use local fixtures with richer graphs (coming in Template Gallery v1).

**Permanent Fix**: Backend team to provide richer template blueprints.

---

## Testing Checklist

### Command Palette (Deliverable 2)

- [ ] Press ⌘K/CTRL+K → palette opens
- [ ] Type "run" → see "Run Analysis" action
- [ ] Press ↑↓ → selection moves
- [ ] Press ↵ → executes action and closes palette
- [ ] Press ? → help overlay appears
- [ ] Press ESC → closes help (then closes palette)
- [ ] Execute an action → appears in "Recent Actions" next time

### Observability (Deliverable 1)

- [ ] Open browser console → see `[Metrics]` logs
- [ ] Run analysis → see `run_started`, `run_completed`
- [ ] Open palette → see `palette_opened`
- [ ] Execute action → see `palette_action`
- [ ] (Optional) Check Network tab → no direct backend requests (all via `/api/plot`)

### Backend Coordination

- [ ] Share this doc with backend team
- [ ] Request `response_hash` in `/v1/run` response
- [ ] Request richer demo templates (Goal → Decision/Options → Outcome)
- [ ] Request `/validate` and `/limits` endpoints (nice-to-have)

---

## Architecture Notes

### Why Feature Flags?

Deliverables 1-2 use feature flags for:
- **Gradual rollout** - Enable in DEV, test in staging, promote to prod
- **A/B testing** - Compare with/without Command Palette
- **Safe rollback** - Disable flag if issues arise

### Why DEV-Tolerant Adapter?

- **Unblocks development** - Don't wait for backend team
- **Maintains production safety** - Still fails in staging/prod
- **Clear diagnostics** - Console warnings guide to root cause

### Observability Privacy

- **No PII tracked** - Only closed-set events (run_started, palette_opened, etc.)
- **Best-effort** - Metrics never throw errors (fail silently)
- **Environment-aware** - Console logs in DEV, PostHog in staging/prod
- **Opt-in** - Disabled by default (set `VITE_POSTHOG_API_KEY` to enable)

---

## Next Steps

1. **Enable features locally** - Follow 3-step TL;DR above
2. **Test Command Palette** - Press ⌘K, explore features
3. **Verify metrics** - Check console for `[Metrics]` logs
4. **Coordinate with backend** - Share missing `response_hash` requirement
5. **Report issues** - Open GitHub issue if anything breaks

---

**PR**: [#9 - feat: Observability & Command Palette (Deliverables 1-2)](https://github.com/Talchain/DecisionGuideAI/pull/9)

**Questions?** Check the PR description for detailed technical docs.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
