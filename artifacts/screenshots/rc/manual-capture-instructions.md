# RC Screenshots - Manual Capture Instructions
Generated: 2025-09-27T15:06:22.709Z

## Prerequisites
1. Ensure development server is running: `npm run dev`
2. Open http://localhost:5173/windsurf in your browser
3. Use browser dev tools to set viewport to 1280x800 for consistency

## Screenshot Capture Steps

### 1. Canvas View - Decision Tree

**Filename:** `canvas-view.png`
**Description:** Main canvas showing Pricing Change template with decision nodes

**Setup Steps:**
- Select "Pricing Change" template (seed 42)
- Ensure Canvas view is active (not List view)
- Wait for template to load completely
- Verify Results Summary shows seed 42

**Capture Instructions:**
1. Navigate to: http://localhost:5173/windsurf
2. Set browser viewport to 1280x800
3. Follow setup steps above
4. Take screenshot and save as: `artifacts/screenshots/rc/canvas-view.png`
5. **Full page capture recommended**

---
### 2. List View - Same Data Different Format

**Filename:** `list-view.png`
**Description:** List view showing identical information in list format

**Setup Steps:**
- Start from Canvas view with Pricing Change loaded
- Click "Switch to List View" button
- Verify all 3 nodes appear in list format
- Confirm "Switch to Canvas" button visible

**Capture Instructions:**
1. Navigate to: http://localhost:5173/windsurf
2. Set browser viewport to 1280x800
3. Follow setup steps above
4. Take screenshot and save as: `artifacts/screenshots/rc/list-view.png`
5. **Full page capture recommended**

---
### 3. Results Summary Panel

**Filename:** `report-summary.png`
**Description:** Results Summary showing performance metrics and key drivers

**Setup Steps:**
- Load any template (Pricing Change recommended)
- Focus on right panel "Results Summary"
- Verify seed number, node count, template name visible
- Check Performance section shows mode and metrics

**Capture Instructions:**
1. Navigate to: http://localhost:5173/windsurf
2. Set browser viewport to 1280x800
3. Follow setup steps above
4. Take screenshot and save as: `artifacts/screenshots/rc/report-summary.png`
5. **Crop to:** Focus on the Results Summary panel (right side)

---
### 4. Compare Analysis Modal

**Filename:** `compare-drawer.png`
**Description:** Compare drawer showing side-by-side analysis with fixtures

**Setup Steps:**
- Load Pricing Change template
- Click "Compare Options" in Results Summary
- Wait for drawer to open from bottom
- Wait for loading to complete (~2-3 seconds)
- Verify Key Finding and drivers are visible

**Capture Instructions:**
1. Navigate to: http://localhost:5173/windsurf
2. Set browser viewport to 1280x800
3. Follow setup steps above
4. Take screenshot and save as: `artifacts/screenshots/rc/compare-drawer.png`
5. **Full page capture recommended**

---

## Post-Capture Checklist

After capturing all screenshots:

✅ All 4 screenshots saved in `artifacts/screenshots/rc/`
✅ Canvas view shows decision nodes clearly
✅ List view shows same data in list format
✅ Report summary shows seed 42 and metrics
✅ Compare drawer shows modal with analysis

## Automation Setup (Optional)

To enable automated capture in future:

```bash
npm install playwright
# or
npm install puppeteer
```

Then run this script again for automated capture.
