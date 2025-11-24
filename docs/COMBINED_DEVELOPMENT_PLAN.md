# Combined Development Plan: Quality + Parallel Development

**Created:** 2025-01-22
**Status:** Pending Implementation
**Branch Context:** `feature/sandbox-poc-v4.2-phase-1`

---

## Executive Summary

**Current State:** Feature branch with 101 modified files, 44 untracked files, actively implementing Scenario Sandbox PoC while technical debt accumulates.

**Recommendation:** HYBRID APPROACH - Quick wins NOW + Careful parallel development with strict file ownership protocols.

**Timeline:** 10 weeks total
- **Parallel work:** 6 weeks (60%)
- **Coordinated work:** 1 week (10%)
- **Sequential work:** 3 weeks (30%)

**Expected Benefits:**
- 2-3x speedup vs sequential development
- Systematic debt reduction without blocking features
- Maintained team velocity

---

## Critical Findings

### Architecture Issues
- **store.ts**: 1,685 lines - monolithic god object (89 consumers)
- **ReactFlowGraph.tsx**: 1,099 lines - god component (52 hooks)
- **Type safety erosion**: 1,526 `any` usages (6% increase)
- **Dependency debt**: React, Vite, Vitest multiple major versions behind

### Security Concerns
- **localStorage**: 799 occurrences across 199 files with no encryption
- **API keys**: Logged to console in dev mode
- **Input validation**: Missing centralized validation layer
- **dangerouslySetInnerHTML**: 14 instances (most safe with DOMPurify)

### Performance Gaps
- **Bundle size**: 13MB total, main chunk 213KB (target: <200KB)
- **Excessive re-renders**: ReactFlowGraph with 52 hooks
- **Store optimization**: Direct subscriptions instead of selectors
- **No lazy loading**: Heavy routes loaded upfront

---

## Priority Matrix

### P0 - Critical (Do Immediately - Week 1)

**1. Fix Lint Errors** (2 hours)
- **File**: Multiple files with empty blocks, unused variables
- **Action**: `npm run lint --fix` + manual fixes
- **Risk**: None
- **Blocks**: Code quality gates

**2. Add localStorage Encryption** (8 hours)
- **File**: Create `src/lib/secureStorage.ts`
- **Action**: Implement AES-GCM encryption wrapper
- **Migrate**:
  - `src/canvas/store/scenarios.ts` (9 occurrences)
  - `src/canvas/persist.ts` (9 occurrences)
- **Risk**: LOW (wrapper pattern, gradual migration)
- **Impact**: Security compliance

**3. Update Critical Dependencies** (4 hours)
- **Action**:
  ```bash
  npm update @playwright/test @tanstack/react-query autoprefixer marked msw rimraf wait-on
  npm update @supabase/supabase-js@latest
  npm audit fix
  ```
- **Risk**: Medium (test regressions possible)
- **Impact**: Security patches, bug fixes

**4. Document File Ownership** (4 hours)
- **File**: Create `PARALLEL_DEV_PROTOCOL.md`
- **Content**:
  - Feature → file mapping
  - Collision zones (store.ts, ReactFlowGraph.tsx)
  - Lock protocol for shared files
  - Daily sync schedule
- **Risk**: None
- **Impact**: Enables parallel development

**5. Establish Store.ts Freeze Protocol** (2 hours)
- **Action**: Communication system + lock/unlock mechanism
- **Impact**: Prevents merge conflicts on critical bottleneck

**Total P0 Effort:** 20 hours (2.5 days)

---

### P1 - High Priority (Weeks 2-4 - Parallel Safe)

**6. Type Safety Cleanup** (200 hours total, 5 files/day)
- **Gradual reduction**: 1,526 → 1,426 `any` usages
- **Start with**: Test files (lower risk)
- **Target files**: `src/lib/__tests__/*.test.tsx`
- **Parallel safe**: YES - file-by-file approach
- **Timeline**: 10 hours/week for 20 weeks (ongoing)

**7. Bundle Optimization** (20 hours)
- **Week 2**: Add bundle analyzer (`rollup-plugin-visualizer`)
- **Week 3**: Lazy load Canvas route
- **Week 4**: Lazy load Scenarios route
- **Metrics**: Baseline → Track → Optimize
- **Target**: <200KB per route chunk

**8. Test Coverage Expansion** (40 hours)
- **Integration tests**: 10 new files/week
- **Focus areas**:
  - Auth flow end-to-end
  - Parallel feature interactions
  - Error paths in adapters
- **Parallel safe**: YES - new files only

**9. Security Hardening** (30 hours)
- **localStorage migration**: 50 calls/week → secureStorage
  - Week 2: `src/canvas/persist.ts`, `src/canvas/store/scenarios.ts`
  - Week 3: `src/lib/*.ts` (config, session)
  - Week 4: `src/components/*.tsx`
- **Input validation**: Add validation layer for file uploads, user forms
- **Parallel safe**: YES - isolated utilities

**Total P1 Effort:** 290 hours (parallel execution over 4 weeks)

---

### P2 - Coordinated (Weeks 5-6 - Brief Freeze)

**10. Store Modularization** (40 hours)
- **Requires**: 1-week feature freeze
- **Action**: Split `src/canvas/store.ts` (1,685 lines) into:
  ```typescript
  // Separate stores
  useGraphStore()      // nodes, edges, history, selection
  useResultsStore()    // results, runMeta
  useScenarioStore()   // currentScenario, framing, dirty flags
  usePanelsStore()     // showResultsPanel, showInspectorPanel, etc.
  useDocumentsStore()  // documents, citations, provenance
  ```
- **File structure**:
  ```
  src/canvas/stores/
    ├── graphStore.ts
    ├── resultsStore.ts
    ├── scenarioStore.ts
    ├── panelsStore.ts
    └── documentsStore.ts
  ```
- **Migration strategy**:
  1. Create new store files
  2. Move state slices
  3. Update imports across 89 consumers
  4. Test thoroughly
  5. Remove old store.ts

**11. ReactFlowGraph Component Splitting** (60 hours)
- **Extract**:
  - `hooks/useFlowEvents.ts` (event handlers)
  - `components/FlowCanvas.tsx` (rendering)
  - `components/FlowControls.tsx` (zoom, fit view)
  - `hooks/useFlowKeyboard.ts` (keyboard shortcuts)
- **Result**: ReactFlowGraph.tsx → orchestrator only (~300 lines)

**Total P2 Effort:** 100 hours (coordinated, 1 week freeze)

---

### P3 - Sequential (Weeks 7-10 - Feature Freeze Required)

**12. React 19 Migration** (80 hours)
- **Breaking changes**: Component types, hooks API
- **Action**:
  1. Update to React 19
  2. Fix type errors
  3. Test all features
  4. Update documentation
- **Risk**: HIGH - breaking changes
- **Requires**: Complete feature freeze

**13. Vite 7 Upgrade** (40 hours)
- **Major changes**: 2 versions jump (5.x → 7.x)
- **Action**:
  1. Update vite.config.ts
  2. Update plugins
  3. Test build process
  4. Verify dev server
- **Risk**: HIGH - build system changes

**14. Vitest 4 Migration** (40 hours)
- **Major changes**: 3 versions jump (1.x → 4.x)
- **Action**:
  1. Update test configs
  2. Fix breaking test APIs
  3. Re-run entire suite
  4. Update CI/CD
- **Risk**: MEDIUM - test framework changes

**Total P3 Effort:** 160 hours (sequential, 4 weeks)

---

## Detailed Implementation Plan

### Week 1: Foundation (Sequential - NO CONFLICTS)

**Day 1: Quality Gates**
- [ ] Run `npm run lint --fix`
- [ ] Manually fix remaining empty blocks, unused vars
- [ ] Update patch dependencies:
  ```bash
  npm update @playwright/test@1.56.1 @tanstack/react-query@5.90.10 \
    autoprefixer@10.4.22 marked@16.4.2 msw@2.12.2 rimraf@6.1.2 wait-on@9.0.3
  ```
- [ ] Run full test suite, document baseline

**Day 2: Security Foundation**
- [ ] Create `src/lib/secureStorage.ts`:
  ```typescript
  import CryptoJS from 'crypto-js'

  const SECRET_KEY = import.meta.env.VITE_STORAGE_KEY || 'default-dev-key'

  export const secureStorage = {
    setItem: (key: string, value: string) => {
      const encrypted = CryptoJS.AES.encrypt(value, SECRET_KEY).toString()
      localStorage.setItem(key, encrypted)
    },
    getItem: (key: string): string | null => {
      const encrypted = localStorage.getItem(key)
      if (!encrypted) return null
      try {
        return CryptoJS.AES.decrypt(encrypted, SECRET_KEY).toString(CryptoJS.enc.Utf8)
      } catch {
        return null
      }
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key)
    }
  }
  ```
- [ ] Write tests for encryption/decryption
- [ ] Migrate top 10 localStorage calls

**Day 3: Dependency Audit**
- [ ] Run `npm audit` and address critical vulnerabilities
- [ ] Update `@supabase/supabase-js` to latest 2.x:
  ```bash
  npm install @supabase/supabase-js@latest
  ```
- [ ] Test authentication flows
- [ ] Document breaking changes (if any)

**Day 4: Parallel Dev Protocol**
- [ ] Create `PARALLEL_DEV_PROTOCOL.md`:
  ```markdown
  # Parallel Development Protocol

  ## Feature Ownership

  ### Sandbox PoC v4.2 (Agent 1)
  - `src/canvas/components/DraftChat.tsx`
  - `src/canvas/components/DecisionReviewPanel.tsx`
  - `src/canvas/components/ContextBar.tsx`
  - `src/canvas/hooks/useDraftModel.ts`
  - `src/adapters/plot/v1/sdkHelpers.ts`

  ## Collision Zones (Require Daily Sync)
  - `src/canvas/store.ts` - ALL AGENTS
  - `src/canvas/ReactFlowGraph.tsx` - Agents 1, 3, 5
  - `src/flags.ts` - Agents 2, 4
  - `src/adapters/plot/types.ts` - Coordinate type extensions

  ## Daily Sync Meeting
  - Time: 10:00 AM daily
  - Duration: 15 minutes
  - Agenda: store.ts changes, type extensions, conflicts
  ```
- [ ] Map all current store.ts modifications in feature branch
- [ ] Create store.ts change log template

**Day 5: Measurement & Baseline**
- [ ] Run `npm run build`
- [ ] Generate baseline bundle report:
  ```bash
  npm run report:chunks
  ```
- [ ] Document current metrics:
  - Total bundle size
  - Chunk sizes
  - Dependency sizes
  - Build time
- [ ] Set up bundle size tracking in CI

---

### Weeks 2-4: Parallel Development (MANAGED CONFLICTS)

**Quality Stream (10 hours/week - runs in parallel):**

*Week 2:*
- [ ] Type safety: Clean 25 `any` usages in test files
- [ ] Security: Migrate `src/canvas/persist.ts`, `src/canvas/store/scenarios.ts` (50 calls)
- [ ] Tests: Add 10 integration test files
- [ ] Bundle: Lazy load Canvas route

*Week 3:*
- [ ] Type safety: Clean 25 `any` usages in lib files
- [ ] Security: Migrate `src/lib/*.ts` localStorage calls (50 calls)
- [ ] Tests: Add 10 integration test files (auth flow focus)
- [ ] Bundle: Lazy load Scenarios route

*Week 4:*
- [ ] Type safety: Clean 25 `any` usages in component files
- [ ] Security: Migrate `src/components/*.tsx` localStorage calls (50 calls)
- [ ] Tests: Add 10 integration test files (error paths focus)
- [ ] Bundle: Lazy load Templates route

**Feature Stream (30 hours/week - continues):**
- Sandbox PoC v4.2 development continues
- Follow file ownership protocol
- Daily sync on store.ts changes
- Feature PRs reviewed within 4 hours
- Merge conflicts resolved same-day

**Collision Protocol:**
- Daily 15-min standup
- Feature flags for incomplete work
- Pull before commit (every 2-4 hours)
- Conflicts resolved within 2 hours max

---

### Weeks 5-6: Coordinated Refactoring (1-WEEK FREEZE)

**Week 5: Feature Completion**
- [ ] All feature PRs merged to main
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Prepare for store refactoring

**Week 6: Store Modularization**
- [ ] Day 1-2: Create new store files, move state slices
- [ ] Day 3-4: Update imports across 89 consumers
- [ ] Day 5: Integration testing, fix regressions

**ReactFlowGraph Splitting (parallel with store work):**
- [ ] Extract event handlers to `hooks/useFlowEvents.ts`
- [ ] Extract rendering to `components/FlowCanvas.tsx`
- [ ] Extract controls to `components/FlowControls.tsx`
- [ ] Update ReactFlowGraph to orchestrate only

---

### Weeks 7-10: Sequential Upgrades (FEATURE FREEZE)

**Week 7: React 19 Migration**
- [ ] Update React and React DOM to 19.x
- [ ] Fix component type errors
- [ ] Update hooks usage (new APIs)
- [ ] Test all features thoroughly
- [ ] Update documentation

**Week 8: Vite 7 Upgrade**
- [ ] Update Vite to 7.x
- [ ] Update vite.config.ts for new API
- [ ] Update plugins to compatible versions
- [ ] Test build process (dev + production)
- [ ] Verify HMR and dev server

**Week 9: Vitest 4 Migration**
- [ ] Update Vitest to 4.x
- [ ] Update test configuration files
- [ ] Fix breaking test API changes
- [ ] Re-run entire test suite
- [ ] Update CI/CD configuration

**Week 10: Integration & Hardening**
- [ ] Full regression testing
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Documentation updates
- [ ] Deploy to staging

---

## File-Level Specificity

### Critical Files & Line Numbers

**store.ts** (1,685 lines) - HIGHEST COLLISION RISK
- Lines 1-100: Imports and utilities
- Lines 101-400: State interface definitions
- Lines 401-1000: Action handlers
- Lines 1001-1685: Side effects and subscriptions
- **Refactor Strategy**: Extract to `stores/` directory with focused modules

**ReactFlowGraph.tsx** (1,099 lines) - HIGH COLLISION RISK
- Lines 1-200: Imports and hooks setup
- Lines 201-600: Event handlers → extract to `hooks/useFlowEvents.ts`
- Lines 601-800: Rendering logic → extract to `components/FlowCanvas.tsx`
- Lines 801-1099: Side effects → minimize

**CanvasToolbar.tsx** (514 lines)
- Line 178: Minimized state - uses CSS variable ✓
- Line 218: Full toolbar - uses CSS variable ✓
- Line 202: Validation banner - uses CSS variable ✓

**InputsDock.tsx** (610 lines)
- Line 491: Uses explicit height calculation ✓
- Collision risk: LOW (isolated component)

**OutputsDock.tsx** (495 lines)
- Line 257: Uses explicit height calculation ✓
- Collision risk: LOW (isolated component)

---

## Risk Mitigation Strategies

### For High-Risk Files (store.ts, ReactFlowGraph.tsx)

1. **Lock Merge Order**
   - Agent 4 (store owner) merges first
   - Others rebase before merging
   - Use feature flags for incomplete work

2. **Region Locking**
   - Use comment markers to claim code regions:
     ```typescript
     // AGENT-1: START - Draft Chat Integration
     // ...code...
     // AGENT-1: END
     ```

3. **Frequent Syncs**
   - Pull every 2-4 hours
   - Push to feature branches frequently
   - Merge conflicts resolved same-day

4. **Conflict Simulation**
   - Test merges in scratch branches
   - Practice conflict resolution
   - Document resolution patterns

### For Medium-Risk Files (ResultsPanel, adapters)

1. **Feature Flags**
   - Isolate incomplete features:
     ```typescript
     if (flags.isNewFeatureEnabled) {
       // new code
     }
     ```

2. **Extension Over Modification**
   - Add new functions, deprecate old
   - Preserve backward compatibility
   - Use semantic versioning for utilities

3. **Type Safety**
   - TypeScript strict mode catches breaks early
   - Run `npm run typecheck` before commits

---

## Success Metrics

### Week 1 (Quick Wins)
- [ ] 0 lint errors (currently 30)
- [ ] localStorage encryption on 20+ critical calls
- [ ] All patch dependencies updated
- [ ] File ownership documented
- [ ] Store.ts freeze protocol established

### Week 4 (Parallel Progress)
- [ ] Type safety: 1,426 `any` usages (100 reduced)
- [ ] Security: 200 secureStorage migrations completed
- [ ] Tests: 1,150 test files (40 added)
- [ ] Bundle: 3 routes lazy loaded
- [ ] Features: Sandbox PoC 75% complete
- [ ] Zero merge conflict delays >2 hours

### Week 6 (Coordinated Completion)
- [ ] store.ts refactored to <500 lines per module
- [ ] ReactFlowGraph.tsx reduced to <400 lines
- [ ] All store modules tested independently
- [ ] Features merged to main
- [ ] Zero regression bugs

### Week 10 (Sequential Upgrades)
- [ ] React 19 migration complete
- [ ] Vite 7 running stable
- [ ] Vitest 4 passing all tests
- [ ] Bundle size <35KB gzipped (main chunk)
- [ ] All quality gates green
- [ ] Production deployment ready

---

## Rollback Plan

If parallel development creates unmanageable conflicts:

1. **Emergency Merge**
   - Freeze all development
   - Merge all branches to main (accept conflicts)
   - Dedicated 2-day conflict resolution sprint
   - Resume development on clean main

2. **Fallback to Sequential**
   - Complete current sprint
   - Switch to sequential development
   - Adjust timeline (+3 weeks)

3. **Partial Rollback**
   - Identify problematic feature
   - Revert to pre-conflict state
   - Redevelop in isolation
   - Merge when stable

---

## Dependencies & Blockers

### P0 Blockers (Must Complete First)
- [ ] Lint errors fixed (blocks CI)
- [ ] File ownership documented (blocks parallel work)
- [ ] Store.ts freeze protocol (blocks coordination)

### P1 Dependencies
- Type safety cleanup: No blockers (gradual)
- Bundle optimization: Requires baseline measurement (Day 5)
- Security hardening: Requires secureStorage.ts (Day 2)

### P2 Dependencies
- Store modularization: Requires feature freeze
- ReactFlowGraph splitting: Can run parallel with store work

### P3 Dependencies
- React 19: Requires store modularization complete
- Vite 7: Requires React 19 stable
- Vitest 4: Requires Vite 7 stable

---

## Communication Plan

### Daily Standup (15 min)
- **Time**: 10:00 AM
- **Attendees**: All agents/developers
- **Agenda**:
  1. Yesterday's progress
  2. Today's plan
  3. Collision zone updates (store.ts, ReactFlowGraph.tsx)
  4. Blockers

### Weekly Review (1 hour)
- **Time**: Friday 2:00 PM
- **Attendees**: All agents/developers + stakeholders
- **Agenda**:
  1. Week progress vs metrics
  2. Quality gates status
  3. Conflict resolution effectiveness
  4. Next week planning

### Async Communication
- **Slack channel**: `#parallel-dev-sync`
- **store.ts changes**: Post before commit
- **Merge conflicts**: Tag relevant agent immediately
- **Blockers**: Escalate within 1 hour

---

## Tools & Automation

### CI/CD Enhancements
```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run bundle:check
```

### Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh
npm run lint --fix
npm run typecheck
```

### Bundle Budget Enforcement
```javascript
// scripts/verify-bundle-budget.mjs (already exists)
const LIMITS = {
  'main': 35 * 1024, // 35KB gzipped
  'vendor': 200 * 1024, // 200KB gzipped
}
// Fail CI if exceeded
```

---

## Notes & Considerations

### Why This Plan Works

1. **Parallelization Maximized**: 60% of work runs concurrently
2. **Conflicts Minimized**: Clear ownership, daily syncs, feature flags
3. **Risk Managed**: P0 blockers cleared first, gradual migrations
4. **Velocity Maintained**: Features don't wait for refactoring
5. **Quality Improved**: Systematic debt reduction alongside features

### What Could Go Wrong

1. **Store.ts conflicts**: Mitigated by freeze protocol + ownership
2. **Dependency updates break tests**: Mitigated by gradual rollout
3. **Feature scope creep**: Mitigated by strict sprint boundaries
4. **Communication gaps**: Mitigated by daily standups + async channels

### Alternative Approaches Considered

**Sequential Development** (rejected)
- Pros: No conflicts, simpler coordination
- Cons: 5-6 weeks longer, team idle time
- Verdict: Too slow

**Complete Feature Freeze** (rejected)
- Pros: Clean refactoring, no conflicts
- Cons: No feature velocity, business impact
- Verdict: Not acceptable

**No Quality Work** (rejected)
- Pros: Maximum feature velocity
- Cons: Technical debt compounds, future slowdown
- Verdict: Short-sighted

---

## Appendix: Quick Reference

### Key File Paths
```
Critical Collision Zones:
├── src/canvas/store.ts (1,685 lines)
├── src/canvas/ReactFlowGraph.tsx (1,099 lines)
├── src/flags.ts (417 lines)
└── src/adapters/plot/types.ts

New Files (Safe for Parallel):
├── src/canvas/components/ContextBar.tsx
├── src/canvas/components/DecisionReviewPanel.tsx
├── src/canvas/components/DraftChat.tsx
├── src/canvas/hooks/useDraftModel.ts
└── src/canvas/layoutProgressStore.ts

Quality Infrastructure:
├── src/lib/secureStorage.ts (to be created)
├── PARALLEL_DEV_PROTOCOL.md (to be created)
└── docs/COMBINED_DEVELOPMENT_PLAN.md (this file)
```

### Command Reference
```bash
# Quality gates
npm run lint --fix
npm run typecheck
npm test
npm run e2e

# Build & analyze
npm run build
npm run bundle:check
npm run report:chunks

# Dependency management
npm update <package>@latest
npm audit fix

# CI shortcuts
npm run ci:all  # Full pipeline
```

### Contact & Escalation
- **Blockers**: Escalate within 1 hour
- **Store.ts conflicts**: Tag store owner immediately
- **Technical decisions**: Weekly review meeting
- **Emergency**: All-hands sync (30 min)

---

**Last Updated:** 2025-01-22
**Next Review:** After Week 1 completion
**Owner:** Development Team
**Stakeholders:** Product, Engineering, QA
