## Templates on Canvas - Local Preview

### Overview

The Canvas route (`/#/canvas`) provides a React Flow whiteboard with an integrated Templates panel. Templates are **starter flows** that you can insert, customize, and run using the mock adapter.

### Quick Start

```bash
# Install dependencies
npm ci

# Start dev server
npm run dev
```

Navigate to **http://localhost:5173/#/canvas**

### Features

**1. Template Browser**
- 6 production-ready templates (Pricing, Hiring, Marketing, Supply, Feature Tradeoffs, Retention)
- Search and filter by name/description
- One-click insertion to canvas

**2. Canvas Integration**
- Templates insert as editable graph flows
- Nodes positioned relative to viewport center
- Batch insertion (no render storms)
- Undo/redo support

**3. Dev Controls (Optional)**
- Hidden by default (toggle to show)
- Seed input for deterministic runs
- "Adapter: Mock" indicator
- Run/Reset buttons

**4. Answer-First Results**
- Conservative | Likely | Optimistic bands
- Confidence levels
- Top drivers
- Verification hash (copy-able)

**5. Pin to Canvas (Coming Soon)**
- Result badge nodes
- Click to re-open panel with run data

### Smoke Test Checklist

**Initial Load:**
- ✅ Whiteboard visible (React Flow)
- ✅ Templates button (top-right, indigo)
- ✅ Build badge (top-left)
- ✅ Single bottom navigation

**Open Templates Panel:**
1. Click "Templates" button
2. Verify:
   - ✅ Panel slides in from right (desktop) or bottom (mobile)
   - ✅ Search bar visible
   - ✅ 6 template cards displayed
   - ✅ Each card has name, description, Insert button

**Search Templates:**
1. Type "pricing" in search
2. Verify:
   - ✅ Only "Pricing Strategy" visible
   - ✅ Other templates filtered out

**Insert Template:**
1. Click "Insert" on any template
2. Verify:
   - ✅ Toast: "Inserted to canvas."
   - ✅ Nodes appear on canvas (4-5 nodes)
   - ✅ Edges connect nodes
   - ✅ "About" section appears in panel
   - ✅ "Back to templates" link visible

**Dev Controls:**
1. Toggle "Show dev controls" switch
2. Verify:
   - ✅ Yellow dev section appears
   - ✅ "Adapter: Mock" indicator shown
   - ✅ Seed input (prefilled with 1337)
   - ✅ Run/Reset buttons visible

**Run Template:**
1. With dev controls on, click "Run"
2. Verify:
   - ✅ Progress indicator appears
   - ✅ Conservative | Likely | Optimistic bands render
   - ✅ Confidence badge shown
   - ✅ Verification hash pill displayed
   - ✅ "Pin to Canvas" button appears

**Error Handling:**
1. Set seed to `23` → Click "Run"
   - ✅ BAD_INPUT error banner with guidance
2. Set seed to `29` → Click "Run"
   - ✅ RATE_LIMITED banner with countdown
3. Set seed to `31` → Click "Run"
   - ✅ LIMIT_EXCEEDED banner with field/max

**Accessibility:**
- ✅ Tab through all controls (focus rings visible)
- ✅ Press Escape → panel closes
- ✅ Focus returns to "Templates" button
- ✅ Screen reader announces panel state
- ✅ Errors announced via role="alert"
- ✅ Reduced motion: no animations

**Mobile:**
- ✅ Panel becomes bottom sheet
- ✅ Overlay visible
- ✅ Click overlay → panel closes
- ✅ Drag handle (optional)

### Architecture

**Route:** `/#/canvas` (hash-based routing)

**Components:**
```
CanvasMVP
├── Templates Button (top-right)
├── ReactFlowGraph (main surface)
│   └── Blueprint insertion handler
└── TemplatesPanel (lazy-loaded)
    ├── Template Browser
    │   ├── Search input
    │   └── TemplateCard (×6)
    ├── TemplateAbout (after insert)
    ├── Dev Controls (collapsible)
    ├── Progress/Error
    └── Results
        ├── SummaryCard
        ├── WhyPanel
        ├── ReproduceShareCard
        └── Pin to Canvas button
```

**Data Flow:**
```
User clicks "Insert" on template
  ↓
TemplatesPanel → onInsertBlueprint
  ↓
CanvasMVP → blueprintEventBus.emit()
  ↓
ReactFlowGraph → subscription handler
  ↓
Blueprint → Graph conversion
  ↓
Batch update canvas store
  ↓
Nodes/edges appear on canvas
```

**State Management:**
- `useCanvasStore` (Zustand) - Canvas nodes/edges
- `useTemplatesRun` - Run lifecycle
- `blueprintEventBus` - Blueprint insertion events

### Bundle Sizes

```
✅ CanvasMVP: 1.23 KB gzipped
✅ TemplatesPanel: 4.00 KB gzipped
✅ DecisionTemplates: 2.61 KB gzipped (98% under 120 KB budget)
✅ Total templates experience: ~7.84 KB gzipped
```

### Development Commands

```bash
# Run all tests
npm test

# Run templates tests only
npm test -- tests/canvas/panels tests/templates/mapper

# Run with coverage
npm test -- --coverage

# Check bundle sizes
npm run build && npm run size:check

# Lint and format
npm run lint
```

### Troubleshooting

**Port 5173 in use:**
```bash
lsof -ti:5173 | xargs kill -9
npm run dev
```

**HMR not working:**
```bash
rm -rf node_modules/.vite
npm run dev
```

**Templates not inserting:**
- Check browser console for errors
- Verify React Flow is loaded
- Ensure blueprint JSON files exist in `src/templates/blueprints/`

**Panel not opening:**
- Check that TemplatesPanel lazy-loaded successfully
- Verify no JavaScript errors in console
- Try hard refresh (Cmd+Shift+R)

### Test Coverage

```
✅ Mapper tests: 12/12 passing
✅ Component tests: 11/11 passing
✅ A11y tests: 3/3 passing (0 violations)
✅ Total: 26/26 tests passing
```

**Coverage:**
- Mapper functions: 100%
- Components: ≥90% lines
- Branches: ≥85%

### Performance

**Metrics:**
- Template insertion: <100ms
- Panel open/close: <50ms
- Search filtering: <10ms
- Run → Results: ~200ms (mock adapter)

**Optimizations:**
- Lazy-loaded panel (4 KB gz)
- Batch canvas updates
- React.memo on pure components
- useCallback for event handlers
- Debounced search (if needed)

### Accessibility (WCAG 2.1 AA)

**Keyboard Navigation:**
- Tab: Navigate through controls
- Escape: Close panel
- Enter: Activate buttons
- Arrow keys: Navigate lists

**Screen Reader:**
- Panel: role="complementary" with aria-label="Templates"
- Search: Proper label association
- Errors: role="alert" for immediate announcement
- Progress: aria-live="polite" for updates
- Dev toggle: role="switch" with aria-checked

**Visual:**
- Focus indicators on all interactive elements
- Color contrast ≥4.5:1 (text)
- Color contrast ≥3:1 (UI components)
- No information conveyed by color alone

**Motion:**
- Respects `prefers-reduced-motion`
- No auto-playing animations
- Smooth transitions (can be disabled)

### Security

- ✅ No dangerouslySetInnerHTML
- ✅ Sanitized user inputs
- ✅ Clipboard API (async, with fallback)
- ✅ No PII in logs/fixtures
- ✅ Mock adapter only (no real network calls)
- ✅ Seed validation (≥1, numeric)

### Future Enhancements

1. **Pin to Canvas** - Result badge nodes (TODO)
2. **Node Inspector** - Edit probabilities inline
3. **Template Versioning** - Track template versions
4. **Custom Templates** - User-created templates
5. **Template Sharing** - Export/import templates
6. **Keyboard Shortcuts** - Cmd+T to toggle panel
7. **Recent Runs** - History of last 5 runs
8. **Template Categories** - Group by domain

