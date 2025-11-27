# Templates-on-Canvas: P0 & P1 Implementation Plan

**Status:** Ready for Implementation
**Last Updated:** 2025-10-24
**Reviewers:** Claude Code, ChatGPT, Human PM

---

## Executive Summary

This plan implements UX polish for the Templates panel and canvas workflow based on:
1. Original build brief from PM
2. Critical assessment by Claude Code (identified architectural issues)
3. Revised recommendations by ChatGPT (pragmatic solutions)

**Key Decisions:**
- ✅ Keep Run in Templates panel (avoid state coupling)
- ✅ Validate structure, not semantics (any node with 2+ outgoing edges)
- ✅ Goal-first as pattern, not enforcement (preserve user freedom)
- ✅ Defer results highlighting until API provides node/edge IDs

---

## Priority 0 - Core UX (Week 1-2)

### P0.1 - LayerProvider & Z-Index Management

**Goal:** Single source of truth for popup/modal/panel state

**Implementation:**
```tsx
// src/canvas/components/LayerProvider.tsx
interface Layer {
  id: string
  type: 'panel' | 'modal' | 'dialog' | 'toast'
  zIndex: number
  onClose: () => void
}

const LayerContext = createContext<{
  layers: Layer[]
  pushLayer: (layer: Omit<Layer, 'zIndex'>) => void
  popLayer: (id: string) => void
  closeTopmost: () => void
}>()

// Usage: Only one high-order layer at a time
// Esc always closes topmost layer
```

**Z-Index Hierarchy:**
- 9999: Fatal error boundary
- 9000: Toasts
- 5000: Confirm dialogs / Probability modal
- 2000: Bottom sheets/panels
- 1000: Canvas toolbar
- 50: Templates button / build badge

**Acceptance:**
- [ ] Only one panel/modal open at a time
- [ ] Esc closes topmost layer
- [ ] Focus returns to invoker after close
- [ ] Tab order follows visual hierarchy
- [ ] Axe: 0 violations

**Tests:**
- Mutual exclusivity (opening modal closes panel)
- Keyboard navigation (Esc, Tab)
- Focus management (return to invoker)

---

### P0.2 - Validation Chip + Keyboard Navigation

**Goal:** Surfacing probability validation errors with clear affordances

**Trigger Logic:**
```ts
// src/canvas/store.ts
export const getInvalidNodes = (state: CanvasState) => {
  const invalidNodes: Array<{ nodeId: string; sum: number; expected: number }> = []

  state.nodes.forEach(node => {
    const outgoingEdges = state.edges.filter(e => e.source === node.id)

    // Only validate nodes with 2+ outgoing edges
    if (outgoingEdges.length >= 2) {
      const sum = outgoingEdges.reduce((acc, e) => acc + (e.data?.confidence ?? 0), 0)
      const tolerance = 0.01 // ±1%

      if (Math.abs(sum - 1.0) > tolerance) {
        invalidNodes.push({ nodeId: node.id, sum, expected: 1.0 })
      }
    }
  })

  return invalidNodes
}
```

**UI Component:**
```tsx
// src/canvas/components/ValidationChip.tsx
export function ValidationChip() {
  const invalidNodes = useCanvasStore(getInvalidNodes)
  const focusNode = useCanvasStore(s => s.focusNode)

  if (invalidNodes.length === 0) return null

  return (
    <button
      className="fixed bottom-4 right-4 z-[1000] px-4 py-2 rounded-lg shadow-lg"
      style={{
        backgroundColor: 'var(--olumi-warning)',
        color: '#000'
      }}
      onClick={() => focusNode(invalidNodes[0].nodeId)}
      aria-label={`Fix ${invalidNodes.length} probability ${invalidNodes.length === 1 ? 'issue' : 'issues'}`}
    >
      ⚠︎ Fix probabilities ({invalidNodes.length})
    </button>
  )
}
```

**Keyboard Shortcuts:**
- **Alt/Option + V**: Jump to next invalid node
- **Cmd/Ctrl + Enter**: Run (only if valid + panel open + template selected)

**Behavior Matrix:**

| Condition | Alt+V Action | Cmd+Enter Action |
|-----------|--------------|------------------|
| No invalid nodes | No-op (toast: "All valid") | Run template |
| Has invalid nodes | Focus first invalid → open inspector → focus slider | Focus first invalid (don't run) |
| Panel closed | (same as above) | Toast: "Open Templates to choose a template" |
| No template selected | (same as above) | Toast: "Select a template first" |

**Acceptance:**
- [ ] Chip appears when any node has outgoing edges summing ≠ 100% ±1%
- [ ] Chip disappears when all nodes valid
- [ ] Click/Enter on chip focuses first invalid node
- [ ] Alt+V cycles through invalid nodes
- [ ] Cmd+Enter runs only when valid (or focuses first invalid)
- [ ] Axe: 0 violations, ARIA roles correct

**Tests:**
```ts
describe('ValidationChip', () => {
  it('shows when node has invalid probabilities', () => {
    const { container } = render(<CanvasMVP />)

    // Add node with 2 outgoing edges at 40% + 50% = 90%
    addNode('decision', { x: 0, y: 0 })
    addEdge({ source: 'n1', target: 'n2', confidence: 0.4 })
    addEdge({ source: 'n1', target: 'n3', confidence: 0.5 })

    expect(screen.getByText(/Fix probabilities \(1\)/)).toBeInTheDocument()
  })

  it('hides when probabilities fixed', () => {
    // ... (same setup)
    updateEdge('e2', { confidence: 0.6 }) // Now 40% + 60% = 100%

    expect(screen.queryByText(/Fix probabilities/)).not.toBeInTheDocument()
  })

  it('Alt+V focuses invalid node', () => {
    // ... (setup with invalid node)
    fireEvent.keyDown(window, { key: 'v', altKey: true })

    expect(document.activeElement).toHaveAttribute('data-node-id', 'n1')
  })
})
```

---

### P0.3 - Run Shortcut (Scoped)

**Goal:** Fast keyboard-driven workflow without breaking architecture

**Implementation:**
```tsx
// src/routes/CanvasMVP.tsx
useEffect(() => {
  const handleGlobalShortcut = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()

      const invalidNodes = getInvalidNodes(useCanvasStore.getState())

      if (!isPanelOpen) {
        showToast('Open Templates to choose a template, then press ⌘/Ctrl+Enter.')
      } else if (!selectedTemplateId) {
        showToast('Select a template first.')
      } else if (invalidNodes.length > 0) {
        // Focus first invalid node instead of running
        focusNode(invalidNodes[0].nodeId)
        showToast(`Fix probabilities before running. Press Alt+V to jump to issues.`)
      } else {
        // All conditions met - trigger run
        triggerRun()
      }
    }
  }

  window.addEventListener('keydown', handleGlobalShortcut)
  return () => window.removeEventListener('keydown', handleGlobalShortcut)
}, [isPanelOpen, selectedTemplateId])
```

**Acceptance:**
- [ ] Cmd+Enter runs when: panel open + template selected + graph valid
- [ ] Shows appropriate toast for each failure condition
- [ ] Doesn't run when invalid (focuses first issue instead)
- [ ] Works from any focus context (canvas, panel, inspector)

---

### P0.4 - Brand Audit (Olumi Tokens)

**Goal:** Visual consistency across all UI surfaces

**Scope:** Replace hardcoded Tailwind colors in:
- Templates panel (buttons, headers, backgrounds)
- Node/Edge inspectors (sliders, warnings, labels)
- Confirm dialogs (danger/warning states)
- Toasts/chips (info/warn/error)
- Edge labels (background/text)

**Token Reference:**
```css
/* Core */
--olumi-primary: #5B6CFF;
--olumi-primary-600: #4256F6;
--olumi-info: #3E8EED;
--olumi-success: #20C997;
--olumi-warning: #F7C948;
--olumi-danger: #FF6B6B;
--olumi-text: #E8ECF5;
--olumi-bg: #0E1116;

/* Nodes */
--node-goal-bg: #1A1E28;
--node-goal-border: #F7C948;
--node-decision-bg: #121A2A;
--node-decision-border: #5B6CFF;
--node-option-bg: #0F1F1B;
--node-option-border: #20C997;
--node-risk-bg: #241214;
--node-risk-border: #FF6B6B;
--node-outcome-bg: #171329;
--node-outcome-border: #7B46FF;

/* Edges */
--edge-stroke: #5B6CFF;
--edge-label-bg: #0E1116;
--edge-label-text: #E8ECF5;
```

**Before/After Example:**
```tsx
// ❌ Before
<button className="bg-blue-600 text-white hover:bg-blue-700">
  Run
</button>

// ✅ After
<button
  className="text-white"
  style={{ backgroundColor: 'var(--olumi-primary)' }}
  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary-600)'}
>
  Run
</button>
```

**Acceptance:**
- [ ] No hardcoded Tailwind color classes in changed files
- [ ] All interactive elements use Olumi tokens
- [ ] Hover/active states use token variants
- [ ] Visual sweep confirms consistency

**Audit Checklist:**
- [ ] TemplatesPanel.tsx
- [ ] NodeInspector.tsx
- [ ] EdgeInspector.tsx
- [ ] ValidationChip.tsx
- [ ] ConfirmDialog.tsx
- [ ] StyledEdge.tsx
- [ ] ToastContext.tsx (if exists)

---

### P0.5 - Goal-First Initialization (Non-Enforced)

**Goal:** Templates start with clear structure, but users remain free to edit

**Initialization:**
```ts
// src/templates/blueprints/types.ts
export interface Blueprint {
  id: string
  name: string
  description: string
  nodes: Array<{ id: string; kind: 'goal' | 'decision' | 'option' | 'outcome'; label: string; position?: { x: number; y: number } }>
  edges: Array<{ id: string; from: string; to: string; probability?: number; weight?: number }>
}

// Validation at insert time
export function validateBlueprintStructure(blueprint: Blueprint): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  // Find goal nodes
  const goalNodes = blueprint.nodes.filter(n => n.kind === 'goal')
  if (goalNodes.length === 0) {
    issues.push('Template should have at least one Goal node')
  }

  // Find decisions
  const decisionNodes = blueprint.nodes.filter(n => n.kind === 'decision')
  if (decisionNodes.length === 0) {
    issues.push('Template should have at least one Decision node')
  }

  // Check for goal → decision edge
  if (goalNodes.length > 0 && decisionNodes.length > 0) {
    const hasGoalToDecision = blueprint.edges.some(e =>
      goalNodes.some(g => g.id === e.from) &&
      decisionNodes.some(d => d.id === e.to)
    )

    if (!hasGoalToDecision) {
      issues.push('Template should connect Goal to Decision')
    }
  }

  return { valid: issues.length === 0, issues }
}
```

**Panel UI (Informational):**
```tsx
// Show in Templates panel when structure is non-standard
{hasStructureIssues && (
  <div className="mb-4 p-3 rounded" style={{
    backgroundColor: 'rgba(62, 142, 237, 0.1)',
    borderLeft: '3px solid var(--olumi-info)'
  }}>
    <div className="flex items-start gap-2">
      <Info className="w-4 h-4 mt-0.5" style={{ color: 'var(--olumi-info)' }} />
      <div className="text-sm text-gray-700">
        <strong>Tip:</strong> Templates work best with a Goal feeding the first Decision.
      </div>
    </div>
  </div>
)}
```

**Acceptance:**
- [ ] All built-in blueprints initialize with Goal → Decision (100%)
- [ ] Users can delete/modify structure after insert (no blocking)
- [ ] Panel shows non-blocking tip when structure differs
- [ ] Tip doesn't prevent running template

---

## Priority 1 - Advanced Features (Week 2-3)

### P1.1 - Probability Modal (Batch Editor)

**Goal:** Edit all probabilities from a decision node in one place

**Trigger:** Button in NodeInspector when node has 2+ outgoing edges

```tsx
// src/canvas/ui/NodeInspector.tsx
{outgoingEdges.length >= 2 && (
  <button
    onClick={() => openProbabilityModal(nodeId)}
    className="w-full px-3 py-2 text-sm rounded"
    style={{ backgroundColor: 'var(--olumi-primary)', color: '#fff' }}
  >
    Edit Probabilities…
  </button>
)}
```

**Modal State:**
```ts
interface ModalRow {
  edgeId: string
  targetLabel: string
  percent: number  // 0-100
  locked: boolean  // ephemeral UI state
}

interface ModalState {
  rows: ModalRow[]
  originalRows: ModalRow[]  // for Reset button
}
```

**Lock + Equalize Logic:**
```ts
function handleEqualize(rows: ModalRow[]): ModalRow[] {
  const lockedRows = rows.filter(r => r.locked)
  const unlockedRows = rows.filter(r => !r.locked)

  // If all locked, do nothing (button should be disabled)
  if (unlockedRows.length === 0) return rows

  // Calculate remaining percentage after locked rows
  const lockedTotal = lockedRows.reduce((sum, r) => sum + r.percent, 0)
  const remaining = 100 - lockedTotal

  // Distribute equally with rounding
  const perRow = Math.floor(remaining / unlockedRows.length)
  const remainder = remaining - (perRow * unlockedRows.length)

  return rows.map((r, i) => {
    if (r.locked) return r

    const isLast = i === rows.length - 1
    return {
      ...r,
      percent: perRow + (isLast ? remainder : 0)
    }
  })
}
```

**Validation:**
```ts
function validateRows(rows: ModalRow[]): { valid: boolean; sum: number } {
  const sum = rows.reduce((acc, r) => acc + r.percent, 0)
  const tolerance = 1 // ±1%

  return {
    valid: Math.abs(sum - 100) <= tolerance,
    sum
  }
}
```

**Apply (Batched Update):**
```tsx
const handleApply = () => {
  const validation = validateRows(rows)
  if (!validation.valid) {
    showToast(`Probabilities sum to ${validation.sum}%, must be 100% ±1%`)
    return
  }

  // Batch update all edges at once (single undo/redo step)
  const updates = rows.map(row => ({
    edgeId: row.edgeId,
    data: {
      confidence: row.percent / 100,
      label: `${row.percent}%`
    }
  }))

  batchUpdateEdges(updates)
  closeModal()
  showToast('Probabilities updated')
}
```

**UI:**
```tsx
<Modal onClose={closeModal} zIndex={5000}>
  <h2>Edit Probabilities</h2>

  <div className="space-y-3">
    {rows.map((row, i) => (
      <div key={row.edgeId} className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={row.locked}
            onChange={() => toggleLock(row.edgeId)}
          />
          Lock
        </label>

        <span className="flex-1 text-sm">{row.targetLabel}</span>

        <input
          type="range"
          min="0"
          max="100"
          value={row.percent}
          disabled={row.locked}
          onChange={(e) => updatePercent(row.edgeId, parseInt(e.target.value))}
          className="flex-1"
        />

        <span className="w-12 text-right text-sm">{row.percent}%</span>
      </div>
    ))}
  </div>

  {/* Validation Feedback */}
  {!validateRows(rows).valid && (
    <div className="mt-3 p-2 rounded" style={{ backgroundColor: 'rgba(247,201,72,0.1)' }}>
      <p className="text-sm" style={{ color: '#9a6e00' }}>
        Total: {validateRows(rows).sum}% (must be 100% ±1%)
      </p>
    </div>
  )}

  {/* Actions */}
  <div className="mt-4 flex gap-2">
    <button
      onClick={() => setRows(handleEqualize(rows))}
      disabled={rows.every(r => r.locked)}
      title={rows.every(r => r.locked) ? "Unlock at least one row to equalize" : undefined}
    >
      Equalize
    </button>

    <button onClick={() => setRows(originalRows)}>
      Reset
    </button>

    <button
      onClick={handleApply}
      disabled={!validateRows(rows).valid}
      style={{ backgroundColor: 'var(--olumi-primary)' }}
    >
      Apply
    </button>
  </div>
</Modal>
```

**Acceptance:**
- [ ] Opens from NodeInspector when node has 2+ outgoing edges
- [ ] Lock toggles work correctly
- [ ] Equalize distributes remaining % across unlocked rows
- [ ] Rounding gives remainder to last unlocked row
- [ ] Locked sliders are disabled (can't drag)
- [ ] Validation blocks Apply when sum ≠ 100% ±1%
- [ ] Apply updates all edges in single batch (undo/redo = 1 step)
- [ ] Reset restores original values
- [ ] Axe: 0 violations

**Tests:**
```ts
describe('ProbabilityModal', () => {
  it('equalizes across unlocked rows', () => {
    const rows = [
      { edgeId: 'e1', percent: 40, locked: true },
      { edgeId: 'e2', percent: 30, locked: false },
      { edgeId: 'e3', percent: 30, locked: false }
    ]

    const result = handleEqualize(rows)

    expect(result[0].percent).toBe(40) // locked, unchanged
    expect(result[1].percent).toBe(30) // (100-40)/2 = 30
    expect(result[2].percent).toBe(30) // (100-40)/2 = 30
  })

  it('handles rounding remainder', () => {
    const rows = [
      { edgeId: 'e1', percent: 0, locked: false },
      { edgeId: 'e2', percent: 0, locked: false },
      { edgeId: 'e3', percent: 0, locked: false }
    ]

    const result = handleEqualize(rows)

    // 100/3 = 33.33... → 33, 33, 34
    expect(result[0].percent).toBe(33)
    expect(result[1].percent).toBe(33)
    expect(result[2].percent).toBe(34) // gets remainder
  })

  it('disables Equalize when all locked', () => {
    render(<ProbabilityModal nodeId="n1" />)

    // Lock all rows
    fireEvent.click(screen.getByLabelText('Lock row 1'))
    fireEvent.click(screen.getByLabelText('Lock row 2'))

    expect(screen.getByText('Equalize')).toBeDisabled()
  })

  it('blocks Apply when sum invalid', () => {
    render(<ProbabilityModal nodeId="n1" />)

    // Set to 90% total
    fireEvent.change(screen.getByLabelText('Row 1 percent'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Row 2 percent'), { target: { value: '40' } })

    expect(screen.getByText('Apply')).toBeDisabled()
    expect(screen.getByText(/Total: 90%/)).toBeInTheDocument()
  })

  it('batches updates for undo/redo', () => {
    const { undo } = useCanvasStore.getState()

    render(<ProbabilityModal nodeId="n1" />)

    // Change multiple rows
    fireEvent.change(screen.getByLabelText('Row 1'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Row 2'), { target: { value: '40' } })
    fireEvent.click(screen.getByText('Apply'))

    // Undo once should revert all changes
    undo()

    const edges = useCanvasStore.getState().edges
    expect(edges.find(e => e.id === 'e1')?.data?.confidence).toBe(0.5) // original
    expect(edges.find(e => e.id === 'e2')?.data?.confidence).toBe(0.5) // original
  })
})
```

---

### P1.2 - Expandable Nodes

**Goal:** Richer node content without cluttering canvas

**Trigger:** Double-click node to toggle compact ↔ details

**State Management:**
```ts
// Option A: Local component state (simpler, no persistence)
const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set())

// Option B: Node data (persists across sessions)
// Add to NodeDataSchema:
expanded: z.boolean().optional().default(false)
```

**Recommendation:** Start with Option A (local state), add persistence in P2 if requested.

**Layout:**
```tsx
// src/canvas/nodes/BaseNode.tsx
export const BaseNode = memo(({ id, data, nodeType }: BaseNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const updateNodeInternals = useUpdateNodeInternals()

  const handleDoubleClick = useCallback(() => {
    setIsExpanded(prev => !prev)

    // Debounce layout update to avoid thrash
    setTimeout(() => updateNodeInternals(id), 100)
  }, [id, updateNodeInternals])

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`node ${nodeType}`}
      style={{
        width: isExpanded ? '300px' : '180px',
        minHeight: isExpanded ? '120px' : '60px'
      }}
    >
      <Handle type="target" position={Position.Top} />

      {/* Compact View */}
      {!isExpanded && (
        <div className="p-3">
          <div className="font-medium text-sm">{data.label}</div>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-3 space-y-2">
          <div className="font-medium text-sm">{data.label}</div>

          {data.description && (
            <div
              className="text-xs text-gray-600"
              dangerouslySetInnerHTML={{
                __html: sanitizeMarkdown(data.description)
              }}
            />
          )}

          {data.tags && (
            <div className="flex flex-wrap gap-1">
              {data.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded"
                  style={{ backgroundColor: 'var(--olumi-primary)', color: '#fff' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})
```

**Markdown Sanitization:**
```ts
// src/canvas/utils/markdown.ts
import DOMPurify from 'dompurify'
import { marked } from 'marked'

export function sanitizeMarkdown(markdown: string): string {
  const html = marked.parse(markdown, {
    breaks: true,
    gfm: true
  })

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code'],
    ALLOWED_ATTR: []
  })
}
```

**Acceptance:**
- [ ] Double-click toggles compact ↔ details
- [ ] Expanded nodes show description (sanitized markdown)
- [ ] Layout updates without jitter
- [ ] No XSS vulnerabilities (DOMPurify sanitization)
- [ ] Axe: 0 violations

**Tests:**
```ts
describe('Expandable Nodes', () => {
  it('toggles on double-click', () => {
    render(<BaseNode id="n1" data={{ label: 'Test' }} nodeType="decision" />)

    const node = screen.getByText('Test').closest('.node')

    expect(node).toHaveStyle({ width: '180px' })

    fireEvent.doubleClick(node)

    expect(node).toHaveStyle({ width: '300px' })
  })

  it('sanitizes markdown description', () => {
    const maliciousMarkdown = '**Bold** <script>alert("xss")</script>'

    render(<BaseNode
      id="n1"
      data={{
        label: 'Test',
        description: maliciousMarkdown
      }}
      nodeType="decision"
    />)

    fireEvent.doubleClick(screen.getByText('Test'))

    expect(screen.queryByText(/alert/)).not.toBeInTheDocument()
    expect(screen.getByText('Bold')).toBeInTheDocument()
  })
})
```

---

### P1.3 - Onboarding + Tooltips + Keyboard Map

**Goal:** Help users discover features and keyboard shortcuts

#### First-Run Hint

```tsx
// src/canvas/components/OnboardingHint.tsx
export function OnboardingHint() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('canvas-onboarding-dismissed') === 'true'
  )

  if (dismissed) return null

  const handleDismiss = () => {
    localStorage.setItem('canvas-onboarding-dismissed', 'true')
    setDismissed(true)
  }

  return (
    <div
      className="fixed top-20 right-4 z-[1000] max-w-sm p-4 rounded-lg shadow-lg"
      style={{ backgroundColor: 'var(--olumi-bg)', borderLeft: '3px solid var(--olumi-primary)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="font-medium text-sm" style={{ color: 'var(--olumi-text)' }}>
            Welcome to Templates
          </h3>
          <ol className="text-xs space-y-1" style={{ color: 'var(--olumi-text)' }}>
            <li>1. Insert a template from the panel</li>
            <li>2. Tweak probabilities on connectors</li>
            <li>3. Press <kbd>⌘/Ctrl+Enter</kbd> to run</li>
          </ol>
        </div>

        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white"
          aria-label="Dismiss hint"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

#### Tooltips

```tsx
// src/canvas/components/Tooltip.tsx
interface TooltipProps {
  content: string
  children: React.ReactElement
}

export function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative inline-block">
      {cloneElement(children, {
        onMouseEnter: () => setShow(true),
        onMouseLeave: () => setShow(false),
        'aria-label': content
      })}

      {show && (
        <div
          role="tooltip"
          className="absolute z-[9000] px-2 py-1 text-xs rounded whitespace-nowrap"
          style={{
            backgroundColor: 'var(--olumi-bg)',
            color: 'var(--olumi-text)',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px'
          }}
        >
          {content}
          <div
            className="absolute w-2 h-2"
            style={{
              backgroundColor: 'var(--olumi-bg)',
              bottom: '-4px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)'
            }}
          />
        </div>
      )}
    </div>
  )
}

// Usage in EdgeInspector.tsx
<Tooltip content="The link from this step to the next">
  <label>Connector</label>
</Tooltip>

<Tooltip content="How likely this connector is taken (must sum to 100%)">
  <label>Probability (%)</label>
</Tooltip>

<Tooltip content="Importance of this connector (also affects line thickness)">
  <label>Weight</label>
</Tooltip>
```

#### Keyboard Shortcuts Map

```tsx
// src/canvas/components/KeyboardShortcutsDialog.tsx
export function KeyboardShortcutsDialog({ isOpen, onClose }: DialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} zIndex={5000}>
      <h2>Keyboard Shortcuts</h2>

      <div className="space-y-3">
        <ShortcutRow
          keys={['⌘/Ctrl', 'Enter']}
          description="Run selected template"
        />
        <ShortcutRow
          keys={['Alt/Option', 'V']}
          description="Jump to next invalid node"
        />
        <ShortcutRow
          keys={['⌘/Ctrl', 'T']}
          description="Toggle Templates panel"
        />
        <ShortcutRow
          keys={['Esc']}
          description="Close current panel/modal"
        />
        <ShortcutRow
          keys={['⌘/Ctrl', 'Z']}
          description="Undo"
        />
        <ShortcutRow
          keys={['⌘/Ctrl', 'Shift', 'Z']}
          description="Redo"
        />
        <ShortcutRow
          keys={['⌘/Ctrl', 'A']}
          description="Select all"
        />
        <ShortcutRow
          keys={['Delete']}
          description="Delete selected"
        />
      </div>
    </Modal>
  )
}

// Trigger via ? key or Cmd/Ctrl+K
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === '?' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
      e.preventDefault()
      setShowShortcuts(true)
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

**Acceptance:**
- [ ] First-run hint shows on first visit
- [ ] Dismissed state persists in localStorage
- [ ] Tooltips show on hover with ARIA labels
- [ ] Keyboard map opens via ? or Cmd/Ctrl+K
- [ ] All shortcuts listed are functional
- [ ] Axe: 0 violations

---

## Deferred (Blocked)

### Results Highlighting

**Why Deferred:** API response doesn't include node/edge IDs. Fuzzy matching by label is fragile.

**Requires:**
1. Backend adds `node_id` and `edge_id` to `drivers[]` array in response
2. OR: Canvas stores a mapping of { label → nodeId } when Run is triggered
3. OR: Use stable IDs in template definitions that persist to API

**Alternative (ship now):** Show textual references in results panel:
```tsx
<div className="space-y-2">
  <h3>Key Drivers</h3>
  {result.drivers.map(driver => (
    <div key={driver.label} className="flex items-center gap-2">
      <span className="text-sm">{driver.label}</span>
      <span className="text-xs text-gray-500">
        {driver.polarity === 'up' ? '↑' : '↓'} {driver.strength}
      </span>
    </div>
  ))}
</div>
```

Users can visually match labels to canvas nodes without interactive highlighting.

---

## Testing Strategy

### Unit Tests (Vitest)

**Per Component:**
- ValidationChip: appearance, Alt+V navigation, validation logic
- ProbabilityModal: Lock logic, Equalize math, validation, undo/redo
- Expandable nodes: toggle, sanitization
- Tooltips: show/hide, ARIA

**Store Tests:**
- `getInvalidNodes()` selector
- Batch edge updates (undo/redo as single step)

### Integration Tests (React Testing Library)

**Workflows:**
1. Insert template → validation chip appears → Alt+V focuses node → fix → chip disappears
2. Open probability modal → lock row → equalize → apply → verify edges updated
3. Double-click node → expanded → shows description → sanitized
4. First visit → onboarding hint → dismiss → persists

### Accessibility Tests (vitest-axe)

```ts
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)

describe('Accessibility', () => {
  it('ValidationChip has no violations', async () => {
    const { container } = render(<ValidationChip />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  // Repeat for all new components
})
```

---

## Definition of Done

**Per PR:**
- [ ] All acceptance criteria met
- [ ] Unit tests written, passing
- [ ] Integration tests for workflows
- [ ] Axe audit: 0 violations
- [ ] TypeScript: no errors/warnings
- [ ] Bundle size: no regressions
- [ ] Visual QA: brand tokens applied
- [ ] Keyboard flows demonstrated (GIF/Loom in PR)
- [ ] Docs: keyboard shortcuts listed in README

**Final Checklist:**
- [ ] LayerProvider: mutual exclusivity works
- [ ] ValidationChip: appears/disappears correctly
- [ ] Alt+V: cycles through invalid nodes
- [ ] Cmd+Enter: runs when valid (or shows tooltip)
- [ ] Brand audit: no hardcoded colors remain
- [ ] Probability modal: Lock + Equalize math correct
- [ ] Expandable nodes: toggle smooth, markdown sanitized
- [ ] Onboarding: hint dismissible, persists
- [ ] Tooltips: accessible, helpful
- [ ] Keyboard map: accurate, complete
- [ ] All tests passing
- [ ] Axe: 0 violations across all surfaces

---

## Suggested PR Order

### PR #1: Foundation (LayerProvider + ValidationChip + Shortcuts)
**Scope:**
- LayerProvider component
- ValidationChip component
- getInvalidNodes selector
- Alt+V and Cmd+Enter shortcuts
- Tests

**Estimated:** 3-4 days

---

### PR #2: Probability Modal
**Scope:**
- ProbabilityModal component
- Lock/Equalize/Reset/Apply logic
- Batch edge updates
- Undo/redo integration
- Tests

**Estimated:** 4-5 days

---

### PR #3: Expandable Nodes
**Scope:**
- BaseNode expand/collapse
- Markdown sanitization
- Layout debouncing
- Tests

**Estimated:** 2-3 days

---

### PR #4: Onboarding + Tooltips + Keyboard Map
**Scope:**
- OnboardingHint component
- Tooltip component
- KeyboardShortcutsDialog
- First-run persistence
- Tests

**Estimated:** 2-3 days

---

### PR #5: Brand Audit + Accessibility Sweep
**Scope:**
- Apply Olumi tokens to all changed files
- Axe audit all new components
- Fix any violations
- Visual QA pass

**Estimated:** 2-3 days

---

### PR #6 (Future): Results Highlighting
**Blocked on:** API changes or ID mapping strategy

---

## Open Questions

1. **Expandable Node Persistence:** Local state or node data? (Recommendation: start with local state)
2. **Probability Modal Rounding:** Always give remainder to last row, or distribute +1 to multiple rows? (Recommendation: last row gets remainder, simpler)
3. **Goal-First Validation:** Show tip always, or only on first insert? (Recommendation: show whenever structure differs)
4. **Keyboard Shortcuts Dialog:** Show on first visit, or only via ? key? (Recommendation: only via ? key, less intrusive)

---

## Success Metrics

**Quantitative:**
- ValidationChip reduces invalid runs by >80%
- Probability modal reduces time-to-valid by >50%
- Keyboard shortcut usage >30% of sessions (track via telemetry)

**Qualitative:**
- User testing: "probabilities are easier to fix"
- User testing: "shortcuts make me faster"
- Zero accessibility violations

---

## References

- [Original Build Brief](IMPLEMENTATION_PLAN.md)
- [Claude Code Critical Assessment](conversation_2025-10-24.md)
- [ChatGPT Revised Recommendations](conversation_2025-10-24.md)
- [Olumi Brand Tokens](src/index.css)
- [React Flow Documentation](https://reactflow.dev/)
- [Vitest Axe Plugin](https://github.com/chaance/vitest-axe)
