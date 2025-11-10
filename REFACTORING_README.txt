================================================================================
SandboxStreamPanel.tsx REFACTORING DOCUMENTATION
================================================================================

QUICK START:
  1. Read REFACTORING_INDEX.md (start here!)
  2. Review REFACTORING_SUMMARY.md for overview
  3. Study REFACTORING_PLAN.md for detailed specs
  4. Use EXTRACTION_MAPPING.md as implementation checklist

TARGET RESULT:
  - 1682 LOC monolithic component
  - Split into 6 focused components + lean root
  - Root reduced to ~320 LOC (81% reduction)
  - Total improved organization: 1320 LOC vs 1682 (362 LOC net reduction)
  - Zero behavioral changes
  - Improved testability and maintainability

COMPONENTS TO CREATE:
  1. StreamFlagsProvider.tsx (70 LOC)
  2. StreamOutputDisplay.tsx (100 LOC)
  3. StreamParametersPanel.tsx (130 LOC)
  4. StreamControlBar.tsx (280 LOC)
  5. StreamDrawersContainer.tsx (200 LOC)
  6. StreamEnhancementsPanel.tsx (220 LOC)
  7. SandboxStreamPanel.tsx REFACTORED (320 LOC)

ESTIMATED TIMELINE:
  - Phase 1 (Foundation): 1-2 hours
  - Phase 2 (Core Features): 2-3 hours
  - Phase 3 (Integration): 3-4 hours
  - Phase 4 (Assembly): 2-3 hours
  - Testing: 4-6 hours
  - TOTAL: 12-18 hours

DOCUMENT DESCRIPTIONS:

REFACTORING_INDEX.md (418 lines) - START HERE
  Master navigation document containing:
  - Overview and status
  - Document guide with descriptions
  - Key findings summary
  - Implementation timeline
  - Component responsibilities table
  - Key dependencies reference
  - Testing strategy
  - Risk mitigation overview
  - Validation checklist
  - File organization before/after

REFACTORING_PLAN.md (1055 lines) - DETAILED REFERENCE
  Complete technical specification including:
  - Section 1: Component breakdowns (line ranges, responsibilities, state)
  - Section 2: State dependencies map
  - Section 3: Extraction order (safest first)
  - Section 4: Step-by-step instructions for each component
  - Section 5: Complete props interfaces
  - Section 6: Migration checklist
  - Section 7: Risk mitigation
  - Section 8: LOC breakdown

REFACTORING_SUMMARY.md (342 lines) - QUICK REFERENCE
  Executive overview with:
  - Current vs target state comparison
  - Component breakdown tree
  - Visual architecture diagrams
  - State flow architecture
  - Key dependencies map
  - Before/after LOC charts
  - Extraction order with risk profiles
  - Props complexity summary
  - Testing strategy
  - Validation checklist

EXTRACTION_MAPPING.md (787 lines) - IMPLEMENTATION GUIDE
  Line-by-line source code mapping:
  - Import statement analysis (what moves where)
  - Original lines → new component locations
  - Detailed line-by-line sections
  - State initialization summary
  - Component props interfaces
  - Testing mapping (lines → tests)

USAGE GUIDE:

For Overview:
  1. Read REFACTORING_INDEX.md completely
  2. Scan REFACTORING_SUMMARY.md for visual reference
  
For Implementation:
  1. Study REFACTORING_PLAN.md Section 4 for current phase
  2. Cross-reference EXTRACTION_MAPPING.md for exact line numbers
  3. Use REFACTORING_PLAN.md Section 5 for props interfaces
  4. Check REFACTORING_INDEX.md for validation checklist

During Development:
  - Keep EXTRACTION_MAPPING.md open as reference
  - Check REFACTORING_PLAN.md Section 4 for step-by-step
  - Validate against REFACTORING_INDEX.md checklist after each phase
  
For Questions:
  - Component location: EXTRACTION_MAPPING.md
  - Props interface: REFACTORING_PLAN.md Section 5
  - Risk assessment: REFACTORING_PLAN.md Section 7
  - Timeline: REFACTORING_INDEX.md

KEY STATISTICS:

Current File:
  - Location: src/components/SandboxStreamPanel.tsx
  - Size: 1682 lines
  - Imports: 35 import statements
  - State variables: 40+ useState calls
  - Feature flags: 13 individual flags
  - UseEffect hooks: 10+ effects
  - Major sections: 8 (Flags, Graph, Stream, Params, Refs, Output, Controls, Enhancements)

Target Organization:
  - Root: 320 LOC (81% reduction from 1682)
  - Component 1: 70 LOC (flags)
  - Component 2: 100 LOC (output)
  - Component 3: 130 LOC (params)
  - Component 4: 280 LOC (controls)
  - Component 5: 200 LOC (drawers)
  - Component 6: 220 LOC (enhancements)
  - Total: 1320 LOC (362 LOC savings through better structure)

PHASE BREAKDOWN:

Phase 1: Foundation (Low Risk)
  - StreamFlagsProvider.tsx
  - StreamOutputDisplay.tsx
  - No new dependencies, pure extraction
  - Time: 1-2 hours

Phase 2: Core Features (Medium Risk)
  - StreamParametersPanel.tsx
  - StreamEnhancementsPanel.tsx
  - Depends on scenario/snapshot libraries
  - Time: 2-3 hours

Phase 3: Integration (Medium-High Risk)
  - StreamDrawersContainer.tsx
  - StreamControlBar.tsx
  - Complex state coordination
  - Time: 3-4 hours

Phase 4: Assembly (Final)
  - Refactor SandboxStreamPanel.tsx
  - Orchestrate all components
  - Time: 2-3 hours

IMPLEMENTATION CHECKLIST:

Before Starting:
  [ ] Read all documentation thoroughly
  [ ] Create feature branch
  [ ] Back up original file
  [ ] Review EXTRACTION_MAPPING.md line-by-line
  [ ] Set up test files

Phase 1:
  [ ] Create StreamFlagsProvider.tsx
  [ ] Test flag initialization
  [ ] Create StreamOutputDisplay.tsx
  [ ] Test output display

Phase 2:
  [ ] Create StreamParametersPanel.tsx
  [ ] Test parameter persistence
  [ ] Create StreamEnhancementsPanel.tsx
  [ ] Test snapshot/compare logic

Phase 3:
  [ ] Create StreamDrawersContainer.tsx
  [ ] Test drawer coordination
  [ ] Create StreamControlBar.tsx
  [ ] Test keyboard shortcuts

Phase 4:
  [ ] Refactor SandboxStreamPanel.tsx
  [ ] Connect all components
  [ ] Verify props interfaces

Final Validation:
  [ ] All 13 flags work correctly
  [ ] All parameters persist
  [ ] All keyboard shortcuts work
  [ ] All drawers open/close
  [ ] Snapshots create/compare
  [ ] Copy buttons work
  [ ] Guided mode works
  [ ] Mobile guardrails work
  [ ] Export functions work
  [ ] No TypeScript errors
  [ ] No linting errors
  [ ] All tests pass
  [ ] Bundle size check

SUPPORT:

For specific questions:
  - Line locations: See EXTRACTION_MAPPING.md
  - Component details: See REFACTORING_PLAN.md Section 1
  - Props interfaces: See REFACTORING_PLAN.md Section 5
  - State dependencies: See REFACTORING_PLAN.md Section 2
  - Risk assessment: See REFACTORING_PLAN.md Section 7
  - Timeline: See REFACTORING_INDEX.md
  - Visual overview: See REFACTORING_SUMMARY.md

IMPORTANT NOTES:

1. No behavior changes - this is pure refactoring
2. All existing tests should continue to pass
3. Props are passed explicitly - no Context for now
4. Follow extraction order strictly for risk mitigation
5. Test each component after creation
6. Keep refs in root component for simplicity
7. Use TypeScript for prop validation

NEXT ACTION:

Ready to begin implementation? Start with:
  1. Read REFACTORING_INDEX.md completely
  2. Review REFACTORING_SUMMARY.md visual diagrams
  3. Study REFACTORING_PLAN.md Section 1 for components
  4. Begin Phase 1 with StreamFlagsProvider.tsx

================================================================================
Last Updated: November 10, 2025
Status: Phase 1 COMPLETE (StreamFlagsProvider extracted)
Next: Continue with Phase 2 (StreamOutputDisplay + StreamEnhancementsPanel)
================================================================================

PHASE 1 COMPLETION SUMMARY:
  ✅ StreamFlagsProvider.tsx created (143 LOC)
  ✅ Integrated into SandboxStreamPanel.tsx
  ✅ Reduced SandboxStreamPanel from 1682 → 1627 LOC (-55 lines)
  ✅ All 13 feature flags centralized
  ✅ Type-check passing
  ✅ Zero behavior changes
  ✅ Committed: cb8989f

REMAINING WORK (Phases 2-4):
  - Phase 2: StreamOutputDisplay + StreamEnhancementsPanel (~6-8 hours)
  - Phase 3: StreamDrawersContainer + StreamControlBar (~8-10 hours)
  - Phase 4: StreamParametersPanel + Final shell (~6-8 hours)
  - Estimated Total: 20-26 hours remaining

================================================================================
