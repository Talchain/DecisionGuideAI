# SandboxStreamPanel.tsx Refactoring - Complete Documentation Index

## Overview

This refactoring splits the 1682-line `SandboxStreamPanel.tsx` into 6 focused components plus a lean root component (~320 LOC), improving maintainability, testability, and developer experience.

**Status:** Detailed analysis and extraction plan complete. Ready for implementation.

---

## Document Guide

### 1. REFACTORING_PLAN.md (34 KB)
**Start here for comprehensive details**

Complete technical specification including:
- Section 1: Detailed breakdown of each component with line ranges and responsibilities
- Section 2: State dependencies map and data flow
- Section 3: Extraction order by risk level
- Section 4: Step-by-step extraction instructions for each component
- Section 5: Complete props interfaces for all components
- Section 6: Migration checklist and validation
- Section 7: Risk mitigation strategies
- Section 8: LOC breakdown and estimates

Use this document as your primary reference during implementation.

---

### 2. REFACTORING_SUMMARY.md (13 KB)
**Quick reference and visual overview**

Contains:
- Executive summary of current vs. target state
- Visual architecture diagrams (ASCII art)
- State flow architecture
- Before/after LOC comparison charts
- Extraction order with risk profiles
- Props interface complexity summary
- Testing strategy overview
- Validation checklist

Great for onboarding and quick lookups.

---

### 3. EXTRACTION_MAPPING.md (27 KB)
**Line-by-line source code mapping**

Detailed mapping of:
- Import statements (what moves where)
- Original line numbers → new component locations
- State initialization summary
- Component props interfaces with detailed fields
- Testing mapping (lines → test areas)

Use this as a checklist while extracting code from the original file.

---

## Key Findings

### Current State Analysis
- **Total Lines:** 1682 LOC
- **Main Component:** 1 monolithic component
- **Major Issues:**
  - Mixed concerns (flags, parameters, output, controls, drawers, enhancements)
  - Complex keyboard shortcut handling
  - Difficult to test individual features
  - Hard to navigate and maintain
  - Heavy props interface

### Target State
- **Total Lines:** 1320 LOC (362 LOC reduction through better structure)
- **Root Component:** 320 LOC (81% smaller)
- **6 New Components:**
  1. StreamFlagsProvider (70 LOC) - All feature flags
  2. StreamOutputDisplay (100 LOC) - Output + markdown preview
  3. StreamParametersPanel (130 LOC) - Seed/budget/model + scenarios
  4. StreamControlBar (280 LOC) - Buttons, shortcuts, guided mode
  5. StreamDrawersContainer (200 LOC) - 5 drawer management
  6. StreamEnhancementsPanel (220 LOC) - Snapshots, diagnostics, chips, etc.

### Benefits
- Each component has single responsibility
- Easier to test individual features
- Clearer data flow with explicit props
- Reduced cognitive load for developers
- Better code organization for future features

---

## Implementation Timeline

### Phase 1: Foundation (Low Risk)
1. Create StreamFlagsProvider.tsx
2. Create StreamOutputDisplay.tsx
- Estimated: 1-2 hours

### Phase 2: Core Features (Medium Risk)
3. Create StreamParametersPanel.tsx
4. Create StreamEnhancementsPanel.tsx
- Estimated: 2-3 hours

### Phase 3: Integration (Higher Risk)
5. Create StreamDrawersContainer.tsx
6. Create StreamControlBar.tsx
- Estimated: 3-4 hours

### Phase 4: Assembly (Final)
7. Refactor SandboxStreamPanel.tsx root
- Estimated: 2-3 hours

**Total Estimated Time:** 8-12 hours of development + 4-6 hours of testing

---

## Component Responsibilities at a Glance

| Component | Lines | Purpose | Key Files |
|-----------|-------|---------|-----------|
| StreamFlagsProvider | 70 | All 13 feature flags + re-evaluation | src/components/StreamFlagsProvider.tsx |
| StreamOutputDisplay | 100 | Text output + markdown + copy buttons | src/components/StreamOutputDisplay.tsx |
| StreamParametersPanel | 130 | Params (seed/budget/model) + scenarios | src/components/StreamParametersPanel.tsx |
| StreamControlBar | 280 | Buttons, shortcuts, guided mode | src/components/StreamControlBar.tsx |
| StreamDrawersContainer | 200 | Config, Canvas, Scenario, Report, History | src/components/StreamDrawersContainer.tsx |
| StreamEnhancementsPanel | 220 | Snapshots, diagnostics, chips, error banner | src/components/StreamEnhancementsPanel.tsx |
| SandboxStreamPanel (root) | 320 | Orchestration + lifted state | src/components/SandboxStreamPanel.tsx |

---

## Key Dependencies

### Shared State (Lifted to Root)
```
From useStreamConnection hook:
- status, output, cost, reconnecting, started, reportData, etc.

From useStreamFlags hook:
- All 13 feature flags (simplifyFlag, listViewFlag, etc.)

Graph data:
- graph, filteredEdges, nHidden, bands, T (simplify threshold)

Parameters:
- seed, budget, model (with persistParams function)

Refs:
- statusRef, mdPreviewRef, textRef, tokensRef, etc.

Other state:
- Drawer states (reportOpen, cfgOpen, canvasOpen, etc.)
- Enhancement states (snapshots, readOnlySnap, selA, selB, etc.)
- Comments (commentTarget, commentLabel, commentText, etc.)
```

### Critical Props Interfaces
- **StreamControlBar:** 50+ props (most complex)
- **StreamDrawersContainer:** 40+ props
- **StreamEnhancementsPanel:** 35+ props
- **StreamOutputDisplay:** 15 props (simplest)

---

## Testing Strategy

### Unit Tests (Per Component)
- Flag initialization and updates
- Parameter persistence
- Overlay positioning and copy handler
- Snapshot creation and comparison
- Keyboard shortcuts
- Drawer state management

### Integration Tests
- Flag propagation to components
- Parameter changes persist across app
- Drawer coordination
- Snapshot updates trigger comparison
- All keyboard shortcuts work together

### E2E Tests
- Full user workflows (Start → Configure → Simplify → Export)
- Mobile guardrails on narrow viewports
- Canvas-first alternate rendering
- All drawer interactions

---

## Risk Mitigation

### High-Risk Areas
1. **Keyboard shortcuts** (complex nested conditions)
   - Mitigation: Extract effect, unit test thoroughly
2. **Parameter persistence** (called from multiple places)
   - Mitigation: Centralize in StreamParametersPanel
3. **Drawer coordination** (5 interdependent drawers)
   - Mitigation: Test each drawer independently first
4. **State flow** (complex lifted state)
   - Mitigation: Use TypeScript for prop validation

### Pre-Implementation Checklist
- [ ] Backup original SandboxStreamPanel.tsx
- [ ] Create feature branch
- [ ] Set up unit test files
- [ ] Review all line mappings in EXTRACTION_MAPPING.md
- [ ] Verify import statements for each component

---

## Extraction Order Rationale

### Why This Order?
1. **StreamFlagsProvider first** - No dependencies on other extractions
2. **StreamOutputDisplay second** - Pure display, no complex state
3. **StreamParametersPanel third** - Depends on flags, prepares for control bar
4. **StreamEnhancementsPanel fourth** - Depends on parameters and flags
5. **StreamDrawersContainer fifth** - Depends on parameters
6. **StreamControlBar last** - Most complex, depends on all others
7. **Root refactor final** - Assembly after all components ready

This order ensures:
- Low-risk changes build confidence
- Each phase prepares for the next
- Earlier components can be tested in isolation
- Easier to debug if issues arise

---

## File Organization

### Before
```
src/components/
└── SandboxStreamPanel.tsx (1682 LOC)
```

### After
```
src/components/
├── SandboxStreamPanel.tsx (320 LOC) - Root orchestrator
├── StreamFlagsProvider.tsx (70 LOC)
├── StreamOutputDisplay.tsx (100 LOC)
├── StreamParametersPanel.tsx (130 LOC)
├── StreamControlBar.tsx (280 LOC)
├── StreamDrawersContainer.tsx (200 LOC)
├── StreamEnhancementsPanel.tsx (220 LOC)
└── [Existing drawer/UI components unchanged]
```

---

## Validation Points

### After Each Component Creation
- [ ] Component renders without errors
- [ ] All props passed correctly from parent
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] Basic functionality works in isolation

### After Root Refactoring
- [ ] All 13 flags initialize correctly
- [ ] All parameters persist to localStorage
- [ ] All keyboard shortcuts work
- [ ] All drawers open/close independently
- [ ] Snapshots create/compare correctly
- [ ] Copy code buttons work
- [ ] Guided suggestions apply correctly
- [ ] Mobile guardrails activate properly
- [ ] Canvas-first path renders
- [ ] Export functions work
- [ ] E2E tests pass

---

## Performance Considerations

### Memoization Strategy
- Graph computation: `useMemo`
- Edge filtering: `useMemo` (depends on graph, simplifyOn, flag, T)
- Band computation: `useMemo` (depends on filteredEdges)
- Mobile caps: `useMemo` (depends on flag, node count)
- Guided suggestions: `useMemo` (depends on params, simplify flag)
- Diffs (changelog, compare): `useMemo` (depends on snapshots, selection)

### Props Optimization
Consider `useCallback` for frequently passed handlers:
- onStart, onStop
- onSeedChange, onBudgetChange, onModelChange
- Copy handler
- Guided apply/undo

### Bundle Size
- No new dependencies introduced
- Better tree-shaking with separated components
- Potential code-splitting opportunity for drawer components

---

## Post-Refactoring Future Work

### Quick Wins (After Main Refactoring)
- Extract ListViewSection as separate component
- Extract CommentsPanel as separate component
- Extract KeyboardShortcutsSheet sub-component

### Potential Optimizations
- Create custom hooks for snapshot logic
- Create custom hooks for parameter persistence
- Extract CanvasFirstPath as alternate component
- Create micro-components for Chips, DiagnosticsPanel

### Testing Improvements
- Add unit tests for all components
- Add integration tests for state flow
- Add E2E tests for critical paths
- Improve test coverage above 80%

---

## Questions & Decisions

### Open Questions
1. Should CanvasFirstPath be extracted? (Currently kept in root)
2. Should we use Context for deeply nested props?
3. Should we create a custom hook for parameter persistence?
4. Should we code-split drawer components?

### Design Decisions Made
1. **Props over Context** - Explicit data flow, easier to trace
2. **Lifted state to root** - Centralized state management
3. **Keep refs in root** - Avoid ref drilling complexity
4. **Sequential extraction** - Risk mitigation through incremental progress

---

## Quick Reference Commands

### Development
```bash
# Create new component file
touch src/components/StreamFlagsProvider.tsx

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint

# Build and verify bundle size
npm run build
```

### Git Workflow
```bash
# Create feature branch
git checkout -b refactor/sandbox-stream-panel-split

# Commit after each component
git commit -m "refactor: extract StreamFlagsProvider component"

# Final PR
git push origin refactor/sandbox-stream-panel-split
```

---

## Document Maintenance

**Last Updated:** November 10, 2025
**Status:** Complete analysis and ready for implementation
**Next Step:** Begin Phase 1 (StreamFlagsProvider extraction)

### How to Use These Documents
1. Start with REFACTORING_SUMMARY.md for overview
2. Refer to REFACTORING_PLAN.md for detailed specifications
3. Use EXTRACTION_MAPPING.md as checklist during implementation
4. Cross-reference line numbers between documents

### Contributing Changes
If you modify the plan:
1. Update all three documents for consistency
2. Note changes in "Document Maintenance" section
3. Keep line number references accurate
4. Update estimations based on actual progress

---

## Contact & Support

For questions during implementation:
- Refer to EXTRACTION_MAPPING.md for specific line locations
- Check REFACTORING_PLAN.md Section 4 for step-by-step instructions
- Review test strategy in REFACTORING_SUMMARY.md

For implementation issues:
1. Verify props interfaces match documented specs
2. Check state dependencies are satisfied
3. Ensure imports are correctly placed
4. Validate against test checklist

---

## Summary

This refactoring transforms a 1682-line monolithic component into 6 focused components plus a lean orchestrator, improving:
- Maintainability (clearer separation of concerns)
- Testability (components can be tested in isolation)
- Scalability (easier to add new features)
- Developer experience (simpler to navigate codebase)

With comprehensive documentation and a phased approach, this refactoring can be completed safely and efficiently.

**Ready to begin implementation!**
