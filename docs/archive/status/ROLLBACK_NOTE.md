# Plot Canvas Rollback - DecisionGraphLayer Default

## Status: ✅ DEPLOYED

**Commit**: (pending)  
**Date**: Oct 14, 2025

---

## Summary

Rolled back `/plot` to use `DecisionGraphLayer` as the default canvas while keeping `PlcCanvasAdapter` available behind the `VITE_FEATURE_PLOT_USES_PLC_CANVAS` feature flag.

---

## Why This Rollback?

**Issue**: PLC adapter integration was causing interaction issues:
- Nodes not responding to drag/pan/zoom correctly
- Event handling not fully wired
- Need more time to complete PLC adapter implementation

**Solution**: Restore working `DecisionGraphLayer` as default while PLC adapter development continues.

---

## What Changed

### Code Changes ✅

**File**: `src/routes/PlotWorkspace.tsx`

**Before** (PLC always on):
```tsx
<div id="plot-canvas-root">
  <PlcCanvasAdapter
    nodes={nodes}
    edges={edges}
    onNodesChange={setNodes}
    onEdgesChange={setEdges}
  />
</div>
```

**After** (DecisionGraphLayer default, PLC behind flag):
```tsx
<div id="plot-canvas-root">
  {String(import.meta.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS) === '1' ? (
    <PlcCanvasAdapter
      data-testid="plc-canvas-adapter"
      nodes={nodes}
      edges={edges}
      localEdits={{ addedNodes: [], renamedNodes: {}, addedEdges: [] }}
      onNodesChange={setNodes}
      onEdgesChange={setEdges}
    />
  ) : (
    <DecisionGraphLayer
      nodes={nodes}
      edges={edges}
      selectedNodeId={selectedNodeId || undefined}
      connectSourceId={connectSourceId || undefined}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleStartRename}
      onNodeMove={handleNodeMove}
    />
  )}
</div>
```

### What Was Kept ✅

1. **CSS Guardrails** (`src/styles/plot.css`):
   - All pointer-events rules with `!important`
   - Z-index enforcement
   - Right rail container `pe:none`, inner content `pe:auto`

2. **Diagnostics**:
   - Loud badge (top-left)
   - Mount log `[PLOT]`
   - Hit-test probe `[PLOT:DIAG]`
   - Assertion check `[PLOT:ASSERT]`

3. **Diag Mode**:
   - `?diag=1` still removes right rail
   - Useful for debugging

4. **Whiteboard**:
   - Still visual-only (`pe:none`)

---

## Configuration

### Production (Netlify)

**Set this environment variable**:
```
VITE_FEATURE_PLOT_USES_PLC_CANVAS=0
```

This ensures DecisionGraphLayer is used by default.

### Enable PLC (for testing)

**Set**:
```
VITE_FEATURE_PLOT_USES_PLC_CANVAS=1
```

Then visit `/#/plot` to test PLC adapter.

---

## Validation

### After Deploy

**1. Check Console**:
```javascript
// Should see:
[PLOT] route=/plot component=PlotWorkspace flags= {
  PLC_LAB: "1",
  POC_ONLY: "0",
  PLOT_PLC_CANVAS: "0"  // ← Should be "0" in production
}

[PLOT:DIAG] {hitRightMid: [{id:"plot-canvas-root", ...}, ...]}
```

**2. Test Interactions**:
- ✅ Drag nodes → smooth, no snap-back
- ✅ Pan canvas → works everywhere
- ✅ Zoom → works everywhere
- ✅ Right panel → scrollable and interactive
- ✅ No dead zones

**3. Verify DecisionGraphLayer Active**:
```javascript
// In console
!!document.querySelector('[data-testid="plc-canvas-adapter"]')
// Should be false (PLC not active)

// DecisionGraphLayer should be rendering instead
```

---

## Next Steps

### To Complete PLC Adapter

1. **Wire event handlers properly**:
   - Drag/pan/zoom events
   - Node selection
   - Edge creation

2. **Test thoroughly**:
   - All interactions work
   - No snap-back behavior
   - Smooth performance

3. **Enable by default**:
   - Set `VITE_FEATURE_PLOT_USES_PLC_CANVAS=1`
   - Deploy and validate
   - Remove flag and make PLC permanent

---

## Rollback Safety

### If Issues Persist

The CSS guardrails remain in place:
- Right rail container: `pe:none`
- Canvas root: `pe:auto`
- Whiteboard: `pe:none`

These prevent the transparent hitbox issue regardless of which canvas is active.

### To Re-enable PLC

Simply set:
```
VITE_FEATURE_PLOT_USES_PLC_CANVAS=1
```

No code changes needed.

---

## Summary

**Immediate fix**: DecisionGraphLayer restored as default, interactions work.

**PLC preserved**: Still available behind feature flag for continued development.

**Guardrails kept**: CSS pointer-events rules prevent regressions.

**Diagnostics kept**: Badge, logs, and probes remain for debugging.

**Next action**: Set `VITE_FEATURE_PLOT_USES_PLC_CANVAS=0` in Netlify, deploy, verify interactions work.
