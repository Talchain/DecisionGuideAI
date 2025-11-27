# PR-A Finalization: docs, stable E2E, leak & toast test fixes, and release polish

## Summary

Complete implementation of Rich Node Types & Edge Domain with comprehensive documentation, stable E2E tests, and production-ready polish.

## Features

### Node Type System
- **5 Typed Nodes**: Goal (🎯), Decision (🎲), Option (💡), Risk (⚠️), Outcome (📊) with Lucide icons
- **Type Switcher**: Properties panel dropdown changes node type in-place (preserves position & label)
- **Toolbar Menu**: "+ Node ▾" dropdown with all 5 types
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

## Testing

### E2E Coverage (Playwright)
- ✅ `e2e/canvas/node-types.spec.ts` - Node creation & type switching
- ✅ `e2e/canvas/edge-properties.spec.ts` - Edge editing with undo/redo
- ✅ `e2e/canvas/migration.spec.ts` - V1→V2 migration & round-trip
- **No fixed sleeps** - All assertions use deterministic locator-based expects

### Unit Tests
- ✅ `ContextMenu.leak.spec.tsx` - Event listener cleanup (instrumented tracking)
- ✅ `SnapshotManager.spec.tsx` - 5MB toast notification (fixed to check toast not alert)
- ✅ `SafeMode.health.spec.tsx` - Health check gating (verifies opt-in behavior)

### Test Results

```bash
# Environment
node -v && npm -v
# v20.19.5
# 10.8.2

# TypeScript
npx tsc --noEmit --skipLibCheck
# ✅ Clean (exit 0)

# Unit Tests
npm run test:unit -- src/canvas src/poc/__tests__/SafeMode.health.spec.tsx
# ✅ 14/14 passing (ContextMenu leak, SnapshotManager toast, SafeMode health)

# E2E Tests
npx playwright test e2e/canvas
# ✅ All passing (node-types, edge-properties, migration)
```

## Documentation

### README.md
Added comprehensive Canvas section:
- Quick start instructions
- 5 node types with descriptions
- Keyboard shortcuts
- Creating & editing nodes (toolbar, palette, type switcher)
- Edge editing workflow
- Import/export with auto-migration
- V1 vs V2 format examples
- Configuration (health check opt-in)
- Snapshot management
- Testing commands

### CHANGELOG.md
Added detailed PR-A entry under `[Unreleased]`:
- Node Type System
- Edge Visualization
- Data Layer (migration)
- Performance & Polish
- Configuration
- Tests

## Verification

### Health Check Opt-In
✅ No `/health` network request unless `VITE_ENABLE_PLOT_HEALTH=true`
- Verified via `SafeMode.health.spec.tsx` unit test
- Default: disabled (no CORS noise in development)

### Console Cleanliness
✅ No errors/warnings during tested flows:
- Router v7 futures configured (no deprecation warnings)
- Render-storm guard limits warnings to one per session
- Health check disabled by default (no CORS errors)

### Debounce Constant
✅ Single source of truth: `HISTORY_DEBOUNCE_MS = 200`
- Used in `store.ts` for history push scheduling
- No stray `setTimeout(..., 200)` calls found

### Data Integrity
✅ Type validation in `updateNode()`:
```typescript
if (updates.type && !NODE_REGISTRY[updates.type as NodeType]) {
  console.warn(`[Canvas] Invalid node type: ${updates.type}`)
  return
}
```

✅ Icon fallback in `NodeInspector`:
```typescript
{renderIcon(metadata.icon, 18) ?? <span aria-hidden="true">•</span>}
```

## How to Test Locally

```bash
# 1. Start dev server
npm run dev:sandbox

# 2. Open Canvas
# Navigate to http://localhost:5176/#/canvas

# 3. Test Node Types
# - Click "+ Node ▾" → see all 5 types with icons
# - Add Goal node → appears with Target icon
# - Click node → Properties panel opens
# - Change Type to "Risk" → icon changes to AlertTriangle
# - Press ⌘K → type "option" → Enter → Option node appears

# 4. Test Edge Properties
# - Click edge → Edge inspector opens
# - Adjust weight slider → stroke width changes
# - Change style to "dashed" → edge becomes dashed
# - Edit label → appears on edge
# - Press ⌘Z → undo → ⌘⇧Z → redo

# 5. Test Migration
# - Click "Import" button
# - Paste V1 JSON (see e2e/fixtures/canvas-v1.json)
# - Nodes render with inferred types
# - Edge labels preserved
# - Click "Export" → verify version: 2
# - Re-import exported JSON → round-trips cleanly

# 6. Verify Console
# - Open DevTools Console
# - Should be clean (no /health requests, no router warnings)
# - Drag node for 2+ seconds → at most one render-burst warning
```

## Acceptance Criteria

- [x] README and CHANGELOG updated for PR-A
- [x] Playwright suite passes without fixed sleeps; assertions are deterministic
- [x] All unit tests green (including previously failing context-menu leak and snapshot size toast)
- [x] Importing a v1 snapshot migrates cleanly; exporting and re-importing (v2→v2) round-trips
- [x] Health check is opt-in (no network call unless `VITE_ENABLE_PLOT_HEALTH=true`)
- [x] Toolbar menu shows all 5 node types with icons
- [x] Properties panel Type switcher updates in place
- [x] Command Palette entries work
- [x] No stray hard-coded timeouts for history; only `HISTORY_DEBOUNCE_MS` is used
- [x] No console errors/warnings across documented test flows

## Files Changed

### Core Implementation
- `src/canvas/store.ts` - Type validation, NODE_REGISTRY import
- `src/canvas/persist.ts` - Migration API integration
- `src/canvas/domain/migrations.ts` - Edge label precedence fix
- `src/canvas/ui/NodeInspector.tsx` - Icon fallback, simplified type control
- `src/canvas/CanvasToolbar.tsx` - Node type dropdown menu

### Tests
- `e2e/canvas/node-types.spec.ts` - Node creation & type switching (no fixed sleeps)
- `e2e/canvas/edge-properties.spec.ts` - Edge editing with undo/redo (no fixed sleeps)
- `e2e/canvas/migration.spec.ts` - V1→V2 migration & round-trip (no fixed sleeps)
- `src/canvas/__tests__/ContextMenu.leak.spec.tsx` - Fixed with instrumented addEventListener
- `src/canvas/components/__tests__/SnapshotManager.spec.tsx` - Fixed to check toast not alert
- `src/poc/__tests__/SafeMode.health.spec.tsx` - New test for health check gating

### Documentation
- `README.md` - Added comprehensive Canvas section
- `CHANGELOG.md` - Added PR-A entry
- `e2e/fixtures/canvas-v1.json` - V1 fixture for migration testing

## Screenshots

### 1. Toolbar "+ Node ▾" Menu
![Toolbar Menu](./screenshots/toolbar-menu.png)
*All 5 node types (Goal, Decision, Option, Risk, Outcome) with Lucide icons*

### 2. Properties Panel Type Switcher
![Type Switcher](./screenshots/type-switcher.png)
*Before: Goal node | After: Risk node (position & label preserved)*

### 3. Edge Inspector After Edits
![Edge Inspector](./screenshots/edge-inspector.png)
*Weight: 3, Style: dashed, Curvature: 0.5, Label: "Test Edge", Confidence: 0.8*

## Notes

- **Health Check**: Default disabled to avoid CORS noise in development. Set `VITE_ENABLE_PLOT_HEALTH=true` to enable.
- **Migration**: V1 snapshots auto-migrate to V2 on import. Top-level `edge.label` takes precedence.
- **Performance**: History debounce at 200ms prevents excessive undo stack growth during drag operations.
- **Snapshots**: Max 10 snapshots, 5MB limit per snapshot, oldest auto-deleted.

## Related Issues

Closes #[issue-number] (if applicable)

---

**Ready for UAT and production deployment** ✅
