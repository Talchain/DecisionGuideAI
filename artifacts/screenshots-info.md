# Screenshots Documentation

Due to limitations in the CLI environment, actual screenshots cannot be captured automatically.

## Required Screenshots for RC Pack

### 1. Canvas View (`canvas-view.png`)
**Capture at:** `/windsurf` with Pricing Change template selected
**Features to show:**
- Split layout with canvas on left, results summary on right
- Three decision nodes with scores and details
- Health status icon (if live mode)
- Status banner with template loaded message
- Simplify toggle in off state

### 2. List View (`list-view.png`)
**Capture at:** Same state but with "Switch to List View" clicked
**Features to show:**
- Same data as canvas but in list format
- "Switch to Canvas" toggle button
- Identical information displayed differently
- Mobile-friendly layout

### 3. Compare Drawer (`compare-drawer.png`)
**Capture with:** Compare drawer opened from Results Summary
**Features to show:**
- Modal drawer from bottom
- Key finding headline
- Score comparison (left vs right)
- Three key drivers list
- Confidence badge (HIGH)
- Analysis details with schema and seed

### 4. Mobile View (`mobile-view.png`)
**Capture at:** Browser width ≤480px
**Features to show:**
- List view as default on mobile
- "Switch to Canvas" button accessible
- Status banners responsive
- Touch-friendly controls (≥44px tap targets)
- Health status remains functional

### 5. Status Banner Examples (`status-banners.png`)
**Capture showing:** Different status banner types
- Success: "Template loaded successfully"
- Loading: "Analysing your scenario"
- Warning: "Connection lost. We're attempting to reconnect"
- Error: "Processing error occurred"

### 6. Live Mode Features (`live-mode.png`)
**Capture with:** `localStorage.setItem('feature.liveGateway', 'true')`
**Features to show:**
- Health status tooltip with P95 timing
- Streaming controls (Analyse, Cancel, Blip)
- Performance metrics showing "Live Gateway"
- Connection status indicators

## How to Capture

1. Run `npm run dev`
2. Navigate to `http://localhost:5173/windsurf`
3. Follow the capture requirements above
4. Save as PNG files in the artifacts directory
5. Use browser dev tools to simulate mobile viewport for mobile-view.png

## Screenshot Specifications

- **Format:** PNG
- **Quality:** High resolution for clarity
- **Mobile viewport:** 480px width for mobile shots
- **Desktop viewport:** 1024px+ width for desktop shots
- **Browser:** Chrome/Safari/Firefox (modern browser)

These screenshots are essential for stakeholder review and demonstrate the complete feature set delivered.