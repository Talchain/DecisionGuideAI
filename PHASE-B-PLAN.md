# Phase B Implementation Plan

## Status: Ready to Start

### A. Auto-Layout (Priority 1)
**Goal:** Replace placeholder Layout button with working presets

**Files to Create:**
- `src/canvas/layout/types.ts` ✅ DONE
- `src/canvas/layout/engines/grid.ts` - Grid layout
- `src/canvas/layout/engines/hierarchy.ts` - Top-down hierarchy
- `src/canvas/layout/engines/flow.ts` - Left-right flow
- `src/canvas/layout/index.ts` - Engine selector
- `src/canvas/components/LayoutPopover.tsx` - UI popover

**Implementation Steps:**
1. Create layout engines (pure functions)
2. Add store action: `applyLayout(preset, options)`
3. Build LayoutPopover UI with 3 presets
4. Add animation with 200-300ms easing
5. Make undoable (single history entry)
6. Add tests (unit + E2E)

**Acceptance:**
- 3 presets work deterministically
- ≤250ms on 150 nodes/250 edges
- Animated, undoable
- Toast if <2 nodes

### B-F. Remaining Features
- Snapping & Guides
- Edge Routing Polish
- Node Templates
- Snapshots v2
- Onboarding

## Next Action
Implement grid.ts, hierarchy.ts, flow.ts layout engines.
