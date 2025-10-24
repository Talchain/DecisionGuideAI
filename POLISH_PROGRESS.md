# Templates-on-Canvas Polish - Progress Report

## ✅ Completed Tasks (A-C + F)

### Task A: Restore Connectors on Template Insert ✅
**Problem**: Templates inserted nodes but NO edges/connectors visible
**Solution**: Added `type: 'styled'` to all edges created from blueprints

**Changes**:
- `src/canvas/ReactFlowGraph.tsx`: Add type + templateId to edges
- `src/canvas/hooks/useBlueprintInsert.ts`: Add type + templateId to edges

**Tests** (10/10 passing):
- `tests/canvas/templates/insert-connectors.test.tsx` (4 tests)
- `tests/canvas/hooks/useBlueprintInsert.test.tsx` (6 tests)

**Impact**: Edges now render correctly with probability labels ('60%', '40%', etc.)

---

### Task B: Connector Editing (Probabilities) ✅
**Problem**: No way to edit connector probabilities
**Solution**: Added "Outgoing Edges" section to NodeInspector

**Features**:
- List all outgoing edges with target node labels
- Slider (0-100%) for each edge probability
- Real-time label updates
- Validation footer: warns when sum ≠ 100%
- Non-blocking warning (yellow banner)

**Changes**:
- `src/canvas/ui/NodeInspector.tsx`: Added outgoing edges editor

**Tests** (6/6 passing):
- `tests/canvas/edges/edit-probabilities.test.tsx`

**UX**: Select node → see outgoing edges → adjust probabilities → get immediate validation feedback

---

### Task C: One Flow Policy (Confirm Dialog) ✅
**Problem**: Need to enforce single template flow
**Solution**: ConfirmDialog already implemented in ReactFlowGraph

**Features**:
- Detects existing template via `templateId`
- Shows confirm dialog with template name
- Replace: removes old nodes/edges, inserts new
- Cancel: keeps existing flow

**Tests** (5/5 passing):
- `tests/canvas/templates/replace-flow.test.tsx`

**Copy** (matches brief):
- Title: "Replace existing flow?"
- Message: "This will replace the existing '{name}' flow on the canvas."
- Buttons: Replace, Cancel

---

### Task F: Brand System (CSS Variables) ✅
**Solution**: Added Olumi v1.2 brand tokens to `src/index.css`

**Tokens Added**:
- Core colors (primary, accent, bg, surface, border, text)
- Semantic colors (success, warning, danger, info)
- State colors (focus, hover)
- Design tokens (radius, shadow)

**Next**: Apply to TemplatesPanel and components

---

## 🔄 In Progress

### Task D: Templates Panel Polish (Brand + Close)
**Status**: Partially complete
- ✅ Close button exists
- ✅ Escape handler exists
- ⏳ Need to apply brand colors
- ⏳ Need to add Cmd/Ctrl+T shortcut
- ⏳ Dev controls already default OFF

### Task E: Popups Behind Panel & Stacking (LayerProvider)
**Status**: Not started
- Need to create LayerProvider
- Need to implement z-index scale
- Need to portal all overlays

---

## 📊 Test Summary

| Test File | Tests | Status |
|-----------|-------|--------|
| insert-connectors.test.tsx | 4 | ✅ |
| useBlueprintInsert.test.tsx | 6 | ✅ |
| edit-probabilities.test.tsx | 6 | ✅ |
| replace-flow.test.tsx | 5 | ✅ |
| **TOTAL** | **21** | **✅** |

---

## 📁 Files Modified/Created

### New Files (6)
1. `tests/canvas/templates/insert-connectors.test.tsx`
2. `tests/canvas/hooks/useBlueprintInsert.test.tsx` (updated)
3. `tests/canvas/edges/edit-probabilities.test.tsx`
4. `tests/canvas/templates/replace-flow.test.tsx`
5. `POLISH_PROGRESS.md`
6. Brand CSS variables in `src/index.css`

### Modified Files (3)
1. `src/canvas/ReactFlowGraph.tsx`
2. `src/canvas/hooks/useBlueprintInsert.ts`
3. `src/canvas/ui/NodeInspector.tsx`

---

## 🎯 Next Steps

1. **Task D**: Apply brand colors to TemplatesPanel
2. **Task D**: Add Cmd/Ctrl+T keyboard shortcut
3. **Task E**: Create LayerProvider with z-index scale
4. **Task E**: Portal all dialogs/toasts
5. **Task G**: Run full test suite
6. **Task H**: Verify bundle sizes

---

## 📝 Git Commits

```
217c82c feat(canvas): add Olumi brand system CSS variables
b098417 test(canvas): add replace flow policy tests
5fda9d2 feat(canvas): add probability editing to NodeInspector
824d7a0 fix(canvas): restore connectors on template insert
```

---

## ✅ Requirements Met

- [x] A) Connectors restored on template insert
- [x] B) Probability editing with validation
- [x] C) Single flow policy with confirm dialog
- [x] F) Brand system CSS variables
- [ ] D) Templates panel polish (in progress)
- [ ] E) LayerProvider & z-index (pending)
- [ ] G) Comprehensive tests (pending)
- [ ] H) Bundle size verification (pending)

**Progress**: 4/8 tasks complete (50%)
