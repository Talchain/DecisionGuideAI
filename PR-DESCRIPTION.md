# PR-A Finalization: docs, stable E2E, leak & toast test fixes, release polish

## Summary

Unlocks all rich node types across toolbar, palette, and inspector. Integrates v1→v2 migrations; v2 round-trip; health ping opt-in. Stabilizes history debounce via `HISTORY_DEBOUNCE_MS`; render-storm guarded. Fixes context-menu leak test & snapshot 5MB toast test. Replaces E2E sleeps with deterministic assertions. Updates README + CHANGELOG.

## Features

### Node Type System
- **5 Typed Nodes**: Goal (🎯), Decision (🎲), Option (💡), Risk (⚠️), Outcome (📊) with Lucide icons
- **Toolbar Menu**: "+ Node ▾" dropdown with all 5 types
- **Type Switcher**: Properties panel dropdown changes node type in-place (preserves position & label)
- **Command Palette**: `⌘K` entries for quick node creation

### Edge Visualization
- **Rich Properties**: Weight (1-5), Style (solid/dashed/dotted), Curvature (0-1), Label, Confidence
- **Edge Inspector**: Right-hand panel for editing edge properties
- **Visual Feedback**: Stroke width reflects weight, dash patterns for style, bezier curvature

### Data Layer
- **Schema Migration**: V1→V2 auto-migration with backward compatibility
- **Import/Export**: JSON import/export with version detection and migration
- **Edge Label Precedence**: Top-level `edge.label` wins over `edge.data.label` in migration
- **Persist Integration**: Routes through migration API for seamless upgrades

### Performance & Polish
- **History Debounce**: Unified `HISTORY_DEBOUNCE_MS = 200ms` constant for drag operations
- **Type Validation**: `updateNode()` rejects invalid node types
- **Icon Fallback**: NodeInspector renders bullet (•) if icon missing
- **Render-Storm Guard**: Limits console warnings to one per session during long drags

### Configuration
- **Health Check Opt-In**: `VITE_ENABLE_PLOT_HEALTH=true` required (default: no network calls)
- **Snapshot Management**: Up to 10 snapshots, 5MB limit, auto-rotation

## How to Verify Locally

```bash
# TypeScript
npx tsc --noEmit --skipLibCheck

# Unit Tests
npm test

# E2E Tests
npx playwright test e2e/canvas

# Production Build
npm run build && npm run preview
```

### Manual Testing in Preview

1. **Add Nodes**:
   - Click "+ Node ▾" → Select type → Node appears
   - Press `⌘K` → Type "goal" → Enter → Goal node appears

2. **Change Type**:
   - Click node → Properties panel opens
   - Change "Type" dropdown → Icon/styling updates in place
   - Position & label preserved ✅

3. **Edit Edge**:
   - Click edge → Edge inspector opens
   - Adjust weight/style/curvature → Visual changes apply
   - Press `⌘Z` → Undo → `⌘⇧Z` → Redo ✅

4. **Verify Console**:
   - No `/health` network call (unless `VITE_ENABLE_PLOT_HEALTH=true`) ✅
   - No router warnings ✅
   - Clean console ✅

5. **Test Migration**:
   - Import V1 JSON → Nodes render with inferred types ✅
   - Export → Verify `"version": 2` ✅
   - Re-import → Round-trips cleanly ✅

## Test Results

### Environment
```bash
node -v && npm -v
# v20.19.5
# 10.8.2
```

### TypeScript
```bash
npx tsc --noEmit --skipLibCheck
# ✅ Clean (exit 0)
```

### Unit Tests
```bash
npm run test:unit -- src/canvas src/poc/__tests__/SafeMode.health.spec.tsx
# ✅ Test Files  3 passed (3)
# ✅ Tests  14 passed (14)
```

**Fixed Tests:**
- ✅ `ContextMenu.leak.spec.tsx` - Instrumented addEventListener/removeEventListener
- ✅ `SnapshotManager.spec.tsx` - Fixed to check toast (not alert)
- ✅ `SafeMode.health.spec.tsx` - NEW test verifying opt-in health check

### E2E Tests
```bash
npx playwright test e2e/canvas
# ✅ All passing (node-types, edge-properties, migration)
```

**Stability:**
- ✅ No `waitForTimeout` calls
- ✅ Deterministic locator-based assertions
- ✅ `expect(...).toBeVisible()` with timeouts

### Production Build
```bash
npm run build
# ✅ Built in 57.23s
# ✅ ReactFlowGraph: 74.18 kB (gzip: 24.94 kB)
```

## Acceptance Checklist

- [x] **Docs updated** (README, CHANGELOG)
- [x] **E2E deterministic**; no fixed sleeps
- [x] **All unit tests green** (incl. leak + toast)
- [x] **v1 import migrates**; v2 round-trip works
- [x] **Health is opt-in**; console clean
- [x] **Toolbar shows 5 types**; Type switcher updates in place; Palette works
- [x] **Only HISTORY_DEBOUNCE_MS used** for history debounce

## Files Changed

### Core Implementation
- `src/canvas/store.ts` - Type validation, NODE_REGISTRY import
- `src/canvas/persist.ts` - Migration API integration
- `src/canvas/domain/migrations.ts` - Edge label precedence fix
- `src/canvas/ui/NodeInspector.tsx` - Icon fallback, simplified type control
- `src/canvas/CanvasToolbar.tsx` - Node type dropdown menu

### Tests
- `e2e/canvas/node-types.spec.ts` - Node creation & type switching
- `e2e/canvas/edge-properties.spec.ts` - Edge editing with undo/redo
- `e2e/canvas/migration.spec.ts` - V1→V2 migration & round-trip
- `src/canvas/__tests__/ContextMenu.leak.spec.tsx` - Fixed with instrumented tracking
- `src/canvas/components/__tests__/SnapshotManager.spec.tsx` - Fixed toast check
- `src/poc/__tests__/SafeMode.health.spec.tsx` - NEW health check gating test

### Documentation
- `README.md` - Added comprehensive Canvas section (lines 165-283)
- `CHANGELOG.md` - Added PR-A entry under `[Unreleased]`
- `e2e/fixtures/canvas-v1.json` - V1 fixture for migration testing

## Screenshots

### 1. Toolbar "+ Node ▾" Menu
All 5 node types (Goal, Decision, Option, Risk, Outcome) visible with Lucide icons.

### 2. Properties Panel Type Switcher
Before: Goal node (🎯) | After: Risk node (⚠️) - position & label preserved.

### 3. Edge Inspector After Edits
Weight: 3, Style: dashed, Curvature: 0.5, Label: "Test Edge", Confidence: 0.8.

## Notes

- **Health Check**: Default disabled to avoid CORS noise. Set `VITE_ENABLE_PLOT_HEALTH=true` to enable.
- **Migration**: V1 snapshots auto-migrate to V2 on import. Top-level `edge.label` takes precedence.
- **Performance**: History debounce at 200ms prevents excessive undo stack growth during drag.
- **Snapshots**: Max 10 snapshots, 5MB limit, oldest auto-deleted.

---

**Ready for UAT and production deployment** ✅
