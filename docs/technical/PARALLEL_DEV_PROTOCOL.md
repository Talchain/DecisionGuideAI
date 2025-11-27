# Parallel Development Protocol

**Created:** 2025-11-26
**Status:** Active
**Purpose:** Enable safe parallel development on shared files

---

## Executive Summary

This document establishes protocols for parallel development to prevent merge conflicts and maintain code quality when multiple developers work simultaneously.

---

## Feature Ownership

### Active Feature Branches

| Feature | Owner | Primary Files | Status |
|---------|-------|---------------|--------|
| Trust Signals (Sprint N) | Merged | `src/canvas/components/DecisionReadinessBadge.tsx`, `src/canvas/components/InsightsPanel.tsx` | Complete |
| Request ID Errors | PR #79 | `src/adapters/plot/httpV1Adapter.ts`, `src/adapters/plot/v1/http.ts` | In Review |

### File Ownership Matrix

#### Critical Files (High Collision Risk)

| File | Lines | Consumers | Lock Required |
|------|-------|-----------|---------------|
| `src/canvas/store.ts` | ~1,685 | 89 | YES - Always coordinate |
| `src/canvas/ReactFlowGraph.tsx` | ~1,099 | 52 hooks | YES - Coordinate changes |
| `src/flags.ts` | ~417 | Many | Notify on changes |
| `src/adapters/plot/types.ts` | ~250 | Multiple adapters | Type extensions only |

#### Safe for Parallel Work

These files can be modified independently:

- `src/canvas/components/*.tsx` (non-shared components)
- `src/canvas/hooks/*.ts` (isolated hooks)
- `src/canvas/utils/*.ts` (utility functions)
- `src/__tests__/**` (test files)
- `docs/**` (documentation)

---

## Collision Zones

### Zone 1: Store (Highest Risk)

**File:** `src/canvas/store.ts`

**Protocol:**
1. Announce intent in team channel before modifying
2. Pull latest before starting work
3. Make minimal, focused changes
4. Create PR same day as changes
5. Request immediate review

**Future Plan:** Split into modular stores (see P2 plan)

### Zone 2: ReactFlowGraph (High Risk)

**File:** `src/canvas/ReactFlowGraph.tsx`

**Protocol:**
1. Coordinate with other canvas developers
2. Use region markers for ownership:
   ```typescript
   // FEATURE: [Feature Name] - START
   // ... code ...
   // FEATURE: [Feature Name] - END
   ```
3. Extract new functionality to hooks/components when possible

### Zone 3: Adapters (Medium Risk)

**Files:** `src/adapters/plot/*.ts`

**Protocol:**
1. Type changes require notification
2. New endpoints can be added freely
3. Existing function signatures should not change without coordination

---

## Daily Sync Protocol

### Standup (15 min)

**Schedule:** Daily at 10:00 AM (or team-preferred time)

**Agenda:**
1. What I did yesterday (2 min each)
2. What I'm doing today (2 min each)
3. Collision zone updates:
   - Any `store.ts` changes?
   - Any `ReactFlowGraph.tsx` changes?
   - Any type/interface changes?
4. Blockers (2 min)

### Async Communication

- **Before modifying collision zones:** Post in `#dev-sync` channel
- **Merge conflicts:** Tag relevant developer immediately
- **Blockers:** Escalate within 1 hour

---

## Git Workflow

### Branch Naming

```
feature/<ticket>-<description>    # New features
fix/<ticket>-<description>        # Bug fixes
chore/<description>               # Maintenance
refactor/<area>-<description>     # Refactoring
```

### Commit Protocol

1. **Atomic commits:** One logical change per commit
2. **Conventional commits:** `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
3. **Reference tickets:** Include ticket ID when applicable

### PR Protocol

1. **Same-day PRs:** Changes to collision zones should be PR'd same day
2. **Review within 4 hours:** Collision zone PRs get priority review
3. **No stale PRs:** PRs older than 2 days must be rebased or closed

---

## Conflict Resolution

### Priority Order

When merges conflict:

1. **store.ts owner** merges first
2. **Earlier PR** has priority
3. Others rebase and resolve

### Resolution Steps

1. Pull latest main
2. Attempt rebase
3. If conflicts:
   - Notify affected developers
   - Resolve together if complex
   - Test thoroughly after resolution

### Emergency Protocol

If conflicts cause blocking:

1. Freeze all development (announce)
2. Dedicated resolution session
3. Single person resolves (usually store.ts owner)
4. Others rebase after resolution

---

## Feature Flags

Use feature flags for incomplete work:

```typescript
// src/flags.ts
export const flags = {
  isNewFeatureEnabled: import.meta.env.VITE_FLAG_NEW_FEATURE === '1',
}

// Usage
if (flags.isNewFeatureEnabled) {
  // New incomplete feature code
}
```

**Rules:**
- Wrap incomplete features in flags
- Default flags to `false`
- Remove flags when feature is complete
- Document flags in this file

---

## Quality Gates

### Before PR

- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Tests pass: `npm test -- --run`
- [ ] Build succeeds: `npm run build`
- [ ] No new security issues: `npm audit`

### Before Merge

- [ ] PR approved by at least one reviewer
- [ ] All CI checks pass
- [ ] No merge conflicts
- [ ] Collision zone changes coordinated

---

## Contact & Escalation

### Escalation Path

1. **Minor issues:** Async in `#dev-sync`
2. **Merge conflicts:** Tag affected developers
3. **Blocking issues:** 30-min sync meeting
4. **Emergency:** All-hands (rare)

### Key Contacts

| Role | Responsibility |
|------|----------------|
| Store Owner | Final say on `store.ts` changes |
| Tech Lead | Architecture decisions |
| QA | Test coordination |

---

## Appendix: Quick Reference

### Commands

```bash
# Check for conflicts before starting
git fetch origin && git rebase origin/main

# Update dependencies
npm update

# Run all quality gates
npm run typecheck && npm test -- --run && npm run build
```

### Files to Watch

```
src/canvas/store.ts          # Always coordinate
src/canvas/ReactFlowGraph.tsx # Coordinate major changes
src/flags.ts                  # Notify on changes
src/adapters/plot/types.ts    # Type extensions only
```

---

**Last Updated:** 2025-11-26
**Next Review:** After first week of parallel development
