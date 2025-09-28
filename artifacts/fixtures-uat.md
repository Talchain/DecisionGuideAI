# Fixtures UAT Script
## User Acceptance Testing for Decision Analysis Sandbox (Fixtures Mode)

**Mode:** Fixtures (Default)
**Primary Seed:** 42
**Duration:** ~8-10 minutes

### Prerequisites
- Application running at `http://localhost:5173/windsurf`
- Feature flag `feature.liveGateway` is OFF (default state)
- Browser window at least 1024px wide for initial testing

---

## Test Flow 1: Template Selection & Canvas Analysis

### Step 1: Initial Load
1. Navigate to `/windsurf`
2. **Verify:** Page displays "Decision Analysis Sandbox"
3. **Verify:** Three template cards visible: "Pricing Change", "Feature Launch", "Build vs Buy"
4. **Verify:** Results Summary shows "No template selected"

### Step 2: Template Selection (Seed 42)
1. Click "Pricing Change" template
2. **Verify:** Canvas view loads with decision nodes
3. **Verify:** Results Summary shows:
   - Seed: **42**
   - Nodes: **3**
   - Template: **Pricing Change**
   - Performance shows "Fixtures" mode
4. **Verify:** ARIA announcement: "Template loaded. Seed 42."

### Step 3: Simplify Toggle Testing
1. Locate "Simplify View" toggle (shows "≥0.3 threshold")
2. Click to enable simplification
3. **Verify:** Toggle shows "Simplified" indicator
4. **Verify:** Canvas nodes hide detailed pros/cons content
5. **Verify:** ARIA announcement: "Reduced visual complexity"
6. Click toggle again to disable
7. **Verify:** Full node details return

### Step 4: Report Drawer
1. In Results Summary, click "Compare Options"
2. **Verify:** Compare drawer opens from bottom
3. **Verify:** Loading state: "Analysing comparison..."
4. **Wait 2-3 seconds**
5. **Verify:** Compare data loads showing:
   - Headline: "Tiered Pricing is 15% more profitable..."
   - Three Key Drivers listed
   - Schema: compare.v1, Seed: 42
6. **Verify:** Focus moves to headline when loaded
7. Click "Close" (X) button
8. **Verify:** Drawer closes cleanly

---

## Test Flow 2: List View Parity

### Step 5: Switch to List View
1. Click "Switch to List View" button
2. **Verify:** List view displays same 3 nodes
3. **Verify:** Nodes sorted consistently (alphabetical by ID)
4. **Verify:** Focus moves to List View heading
5. **Verify:** Toggle button now shows "Switch to Canvas"

### Step 6: List View with Simplify
1. Enable "Simplify View" toggle while in List mode
2. **Verify:** List view respects simplification (hides detailed content)
3. **Verify:** Consistent behaviour with Canvas simplification

### Step 7: Template Persistence
1. Select "Feature Launch" template
2. **Verify:** Seed changes to **101**
3. **Verify:** ARIA announcement: "Template loaded. Seed 101."
4. Refresh the page
5. **Verify:** "Feature Launch" remains selected (localStorage persistence)
6. **Verify:** "Last used" indicator appears

---

## Test Flow 3: Copy Functionality & Microcopy

### Step 8: Copy Helpers
1. In Results Summary, click "Copy Seed"
2. **Verify:** Success message: "Seed copied!"
3. **Verify:** Clipboard contains "101"
4. Click "Copy Model"
5. **Verify:** Success message: "Model copied!"
6. **Verify:** Clipboard contains "claude-3-5-sonnet-20241022"

### Step 9: Export File Names
1. Check "Export Analysis" button text
2. **Verify:** Filename format: `analysis_report_seed101_claude.csv`
3. Check "Download Report" button text
4. **Verify:** Filename format: `analysis_full_seed101_claude.csv`

---

## Test Flow 4: Accessibility & Error States

### Step 10: Keyboard Navigation
1. Use Tab key to navigate through interface
2. **Verify:** All interactive elements reachable
3. **Verify:** Focus indicators visible
4. **Verify:** Logical tab order

### Step 11: Screen Reader Announcements
1. Enable screen reader (or check live region)
2. Trigger various actions (template select, simplify toggle)
3. **Verify:** Live announcements appear in `#live-announcements` region

### Step 12: Currency & Confidence Display
1. Check Performance section
2. **Verify:** Currency shows "USD"
3. **Verify:** Confidence shows "HIGH (87%)"

---

## Expected Results Summary

✅ **Templates load correctly with seed persistence**
✅ **Canvas and List views maintain parity**
✅ **Simplify toggle works consistently**
✅ **Compare drawer loads fixture data**
✅ **Copy helpers work with proper feedback**
✅ **ARIA announcements fire correctly**
✅ **Keyboard navigation complete**
✅ **File naming includes seed and model**
✅ **British English microcopy throughout**

## Known Limitations (Fixtures Mode)
- Streaming controls hidden (fixtures auto-complete)
- Health status not visible (live mode only)
- No real-time performance metrics
- Reconnection features disabled

---

**Test completed:** ____________
**Tested by:** ____________
**Issues found:** ____________