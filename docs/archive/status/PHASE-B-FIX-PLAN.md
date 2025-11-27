# Phase B Fix Plan

## Critical Issues
1. applyGuidedLayout ignores policy (hardcoded preset/spacing)
2. LayoutNode missing 'kind' field
3. No adapter between policy and engine options
4. mergePolicy needs better signature

## Implementation Order
1. ✅ Add kind to LayoutNode
2. ✅ Create adapters.ts
3. Fix mergePolicy signature
4. Update applyGuidedLayout to use adapters
5. Add semantic pre-ordering (goals first, outcomes last)
6. Fix tests and lint

## Files to Modify
- src/canvas/layout/policy.ts (mergePolicy)
- src/canvas/store.ts (applyGuidedLayout)
- src/canvas/layout/engines/hierarchy.ts (use kind)
- src/canvas/layout/engines/flow.ts (use kind)
