# Implementation Plan Summary

## Quick Reference

**Document:** [Full Implementation Plan](IMPLEMENTATION_PLAN.md)
**Status:** Ready for Development
**Timeline:** 2-3 weeks

---

## Key Decisions

### ✅ Adopted from ChatGPT's Recommendations

1. **Validate Structure, Not Semantics**
   - Validate any node with 2+ outgoing edges (not just "decision" type)
   - Prevents brittleness when users change node types

2. **Run Stays in Templates Panel**
   - Cmd/Ctrl+Enter shortcut only works when panel open + template selected
   - Avoids state management coupling between canvas and panel
   - Shows helpful toast when conditions not met

3. **Goal-First as Pattern, Not Enforcement**
   - Templates initialize with Goal→Decision structure
   - Users remain free to edit/delete after insert
   - Non-blocking "Tip" shown when structure differs

4. **Defer Results Highlighting**
   - API doesn't include node/edge IDs yet
   - Fuzzy label matching is fragile
   - Show textual references in panel instead

### ⚠️ Modified from Original Brief

1. **Probability Modal Lock Behavior**
   - Locked sliders are **disabled** (not auto-unlock on drag)
   - Clearer affordance for users

2. **Expandable Node Persistence**
   - Start with **local state only** (doesn't persist across sessions)
   - Add persistence to node data in P2 if users request it
   - Avoids schema migration complexity for MVP

---

## Priority Breakdown

### P0 - Core UX (Week 1-2)

| Item | Effort | Impact | Status |
|------|--------|--------|--------|
| LayerProvider | 1-2 days | High | Ready |
| ValidationChip + Alt+V | 2-3 days | High | Ready |
| Cmd+Enter shortcut | 1 day | Medium | Ready |
| Brand audit (Olumi tokens) | 1-2 days | Medium | Ready |
| Goal-first initialization | 1 day | Low | Ready |

**Total:** ~7-9 days

### P1 - Advanced Features (Week 2-3)

| Item | Effort | Impact | Status |
|------|--------|--------|--------|
| Probability Modal | 4-5 days | High | Spec complete |
| Expandable Nodes | 2-3 days | Medium | Ready |
| Onboarding + Tooltips | 2-3 days | Medium | Ready |
| Keyboard Map | 1 day | Low | Ready |

**Total:** ~9-12 days

### Deferred (Blocked)

- **Results Highlighting**: Needs API changes (node/edge IDs in response)

---

## Critical Implementation Details

### Validation Logic

```ts
// Validate nodes with 2+ outgoing edges
function getInvalidNodes(state: CanvasState) {
  return state.nodes.filter(node => {
    const outgoingEdges = state.edges.filter(e => e.source === node.id)

    if (outgoingEdges.length < 2) return false // Skip nodes with 0-1 edges

    const sum = outgoingEdges.reduce((acc, e) => acc + (e.data?.confidence ?? 0), 0)
    return Math.abs(sum - 1.0) > 0.01 // ±1% tolerance
  })
}
```

### Keyboard Shortcuts

| Shortcut | Action | Condition |
|----------|--------|-----------|
| **Alt/Option + V** | Jump to next invalid node | Has invalid nodes |
| **Cmd/Ctrl + Enter** | Run template | Panel open + template selected + valid |
| **Cmd/Ctrl + T** | Toggle Templates panel | — |
| **?** or **Cmd/Ctrl + K** | Show keyboard map | — |
| **Esc** | Close topmost layer | Has open panel/modal |

### Probability Modal Equalize Logic

```ts
// When Equalize is clicked:
// 1. Sum all locked percentages: L%
// 2. Remaining: R% = 100% - L%
// 3. Distribute R% equally across unlocked rows
// 4. Last unlocked row gets remainder

Example:
- Row 1: 40% (locked)
- Row 2: 30% (unlocked)
- Row 3: 30% (unlocked)

After Equalize:
- Row 1: 40% (locked, unchanged)
- Row 2: 30% (60% / 2 = 30%)
- Row 3: 30% (60% / 2 = 30%)

With rounding:
- 100 - 40 = 60% remaining
- 60% / 2 = 30% per row
- No remainder in this case
```

### Brand Token Usage

```tsx
// ❌ Before
<button className="bg-blue-600 text-white">Run</button>

// ✅ After
<button
  style={{ backgroundColor: 'var(--olumi-primary)', color: '#fff' }}
  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary-600)'}
>
  Run
</button>
```

---

## Testing Requirements

### Per PR

- [ ] Unit tests (Vitest) for all new components/logic
- [ ] Integration tests for workflows (RTL)
- [ ] Accessibility audit (vitest-axe) - 0 violations
- [ ] TypeScript: no errors/warnings
- [ ] Bundle size: no regressions
- [ ] Keyboard flow demo (GIF/Loom)

### Key Test Cases

**ValidationChip:**
- Appears when node has invalid probabilities (sum ≠ 100%)
- Disappears when fixed
- Alt+V cycles through invalid nodes
- Cmd+Enter runs when valid, focuses invalid when not

**ProbabilityModal:**
- Lock prevents slider changes
- Equalize distributes correctly with rounding
- Validation blocks Apply when sum ≠ 100%
- Apply batches updates (undo/redo = 1 step)

**Expandable Nodes:**
- Double-click toggles view
- Markdown sanitizes dangerous HTML
- Layout updates smoothly (no jitter)

---

## Definition of Done

**Per Feature:**
- All acceptance criteria met
- Tests written and passing
- Axe: 0 violations
- Brand tokens applied (no hardcoded colors)
- Keyboard flows work end-to-end
- Visual QA: matches Olumi design system

**Final Checklist:**
- [ ] ValidationChip: ±1% tolerance, cycles correctly
- [ ] Shortcuts: Cmd+Enter, Alt+V, Esc all work
- [ ] LayerProvider: only one popup at a time
- [ ] Probability modal: Lock + Equalize math correct
- [ ] Expandable nodes: smooth toggle, sanitized markdown
- [ ] Onboarding: dismissible hint, persists in localStorage
- [ ] Tooltips: accessible, helpful copy
- [ ] Keyboard map: complete and accurate
- [ ] Brand audit: all Olumi tokens applied
- [ ] All tests passing (unit + integration + a11y)

---

## Suggested PR Order

1. **LayerProvider + ValidationChip + Shortcuts** (3-4 days)
2. **Probability Modal** (4-5 days)
3. **Expandable Nodes** (2-3 days)
4. **Onboarding + Tooltips + Keyboard Map** (2-3 days)
5. **Brand Audit + A11y Sweep** (2-3 days)

---

## Open Questions

1. **Expandable Node Persistence:** Start with local state (no persistence)?
   - **Recommendation:** Yes, add persistence in P2 if requested

2. **Probability Modal Rounding:** Last row gets remainder?
   - **Recommendation:** Yes, simplest approach

3. **Goal-First Tip:** Show always or only first time?
   - **Recommendation:** Show whenever structure differs (not just first time)

4. **Keyboard Map:** Show on first visit?
   - **Recommendation:** No, only via ? key (less intrusive)

---

## Success Metrics

**Quantitative:**
- ValidationChip reduces invalid runs by >80%
- Probability modal reduces time-to-valid by >50%
- Keyboard shortcuts used in >30% of sessions

**Qualitative:**
- User testing: "easier to fix probabilities"
- User testing: "shortcuts make me faster"
- Zero accessibility violations

---

## References

- [Full Implementation Plan](IMPLEMENTATION_PLAN.md)
- [Original Build Brief](conversation_2025-10-24.md)
- [Claude Code Critical Assessment](conversation_2025-10-24.md)
- [ChatGPT Recommendations](conversation_2025-10-24.md)
- [Olumi Brand Tokens](src/index.css)
