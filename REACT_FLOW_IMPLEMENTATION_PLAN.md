# React Flow Graph Implementation Plan

## Status: Phase 0 Complete ✅

**Dependencies Installed**:
- ✅ @xyflow/react
- ✅ zustand
- ✅ class-variance-authority
- ✅ framer-motion

---

## 📊 Scope Assessment

This is a **3-4 week feature** requiring ~15-20 hours of focused development.

### Complexity Breakdown
- **High**: Custom nodes/edges, auto-layout, undo/redo (40%)
- **Medium**: State management, persistence, context menu (30%)
- **Low**: Toolbar, minimap, keyboard shortcuts (30%)

---

## 🎯 Phased Approach (Recommended)

### Phase 1: MVP Graph (Week 1)
**Goal**: Replace DecisionGraphLayer with basic React Flow

**Deliverables**:
- `src/components/ReactFlowGraph.tsx` - Basic graph
- `src/components/DecisionNode.tsx` - Simple custom node
- Feature flag: `VITE_FEATURE_REACT_FLOW_GRAPH`
- Smoke test E2E

**Acceptance**:
- Can render nodes and edges
- Drag and zoom work
- No regressions in plot gating

**Estimated Time**: 4-6 hours

---

### Phase 2: Interactions & State (Week 2)
**Goal**: Full editing capabilities

**Deliverables**:
- `src/lib/graphState.ts` - Zustand store
- `src/components/GraphToolbar.tsx` - Add/connect tools
- Keyboard shortcuts (delete, undo/redo)
- LocalStorage persistence

**Acceptance**:
- Can add/delete/move nodes
- Edges connect properly
- State persists across reloads

**Estimated Time**: 6-8 hours

---

### Phase 3: Polish & UX (Week 3)
**Goal**: Production-ready experience

**Deliverables**:
- Custom edge components with confidence
- Context menu
- Minimap
- Auto-layout integration (ELKJS)

**Acceptance**:
- Feels smooth and professional
- All UX affordances present
- Accessibility compliant

**Estimated Time**: 5-7 hours

---

### Phase 4: Testing & Docs (Week 4)
**Goal**: Ship-ready quality

**Deliverables**:
- Comprehensive E2E tests
- Unit tests for state/history
- Performance benchmarks
- `docs/graph-editor.md`

**Acceptance**:
- All tests green
- Bundle size acceptable
- Docs complete

**Estimated Time**: 4-5 hours

---

## 🚦 Decision Point

### Option A: Full Implementation (3-4 weeks)
Build everything as specified in the requirements.

**Pros**: Complete feature, best UX
**Cons**: Long timeline, blocks other work

### Option B: MVP First (1 week)
Ship Phase 1 only, iterate based on feedback.

**Pros**: Fast feedback loop, unblocks testing
**Cons**: Limited functionality initially

### Option C: Hybrid Approach (2 weeks)
Phases 1-2 in first PR, 3-4 in follow-up.

**Pros**: Balanced, functional quickly
**Cons**: Two deployment cycles

---

## 📝 Recommendation

**Start with Phase 1 (MVP)** as a separate PR:

```bash
# This PR
feat(graph): implement React Flow MVP
- Basic ReactFlowGraph component
- Simple DecisionNode
- Feature flag gating
- Smoke test

# Next PR (after feedback)
feat(graph): add interactions & state
- Zustand store
- Toolbar
- Keyboard shortcuts
- Persistence
```

**Benefits**:
1. Can test React Flow integration quickly
2. Validate approach before investing heavily
3. Parallel work on other features possible
4. Easier code review

---

## 🎬 Next Steps

### Immediate (Phase 1 - MVP)
1. Create `src/components/ReactFlowGraph.tsx`
2. Create basic `DecisionNode.tsx`
3. Wire into PlotWorkspace with feature flag
4. Add smoke test
5. Commit & push

### After Phase 1 Ships
1. Gather feedback on MVP
2. Prioritize Phase 2 features
3. Begin Zustand store implementation

---

## 📦 File Structure (Phase 1)

```
src/
├─ components/
│  ├─ ReactFlowGraph.tsx          NEW
│  └─ nodes/
│     └─ DecisionNode.tsx         NEW
├─ routes/
│  └─ PlotWorkspace.tsx           MODIFIED
└─ styles/
   └─ graph.css                   NEW

e2e/
└─ graph.smoke.spec.ts            NEW
```

---

## ⏱️ Time Estimate Summary

| Phase | Hours | Calendar |
|-------|-------|----------|
| 1. MVP | 4-6h | 1 week |
| 2. Interactions | 6-8h | 1 week |
| 3. Polish | 5-7h | 1 week |
| 4. Testing | 4-5h | 1 week |
| **Total** | **19-26h** | **3-4 weeks** |

---

## 🎯 Success Metrics

- [ ] Replace DecisionGraphLayer cleanly
- [ ] 60fps pan/zoom performance
- [ ] < 200ms node add latency
- [ ] All E2E tests pass
- [ ] Bundle size increase < 200KB
- [ ] No accessibility regressions

---

**Status**: Ready to begin Phase 1 (MVP)
**Dependencies**: Installed ✅
**Next**: Create ReactFlowGraph.tsx
