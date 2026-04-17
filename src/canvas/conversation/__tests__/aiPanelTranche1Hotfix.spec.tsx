/**
 * Tranche 1 hotfix regression suite.
 *
 * Direct coverage for the five items landed in the hotfix brief, plus the
 * ChatGPT-review-driven hardening: handler-level guard, in-flight tooltip,
 * sentinel-deletion regression, item 3 rendered-DOM assertion, double-click
 * button-disable check, and a safeRichText join-logic matrix.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createRef } from 'react'
import { safeRichText } from '../../utils/safeRichText'
import { describeOperation, RAW_ID_PATTERN } from '../friendlyOperation'
import type { PatchOperation } from '../types'

// ── Mocks for ChatComposer rendering (mirrors ChatComposer.spec.tsx) ─────────

let mockStage = 'ideate'
vi.mock('../../hooks/useStagePill', () => ({
  useStagePill: () => ({ stage: mockStage }),
}))

let mockCanvasState: { nodes: Array<{ id: string }>; edges: Array<{ id: string }>; draftComposerText: string | null } = {
  nodes: [],
  edges: [],
  draftComposerText: null,
}
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: any) => any) => selector(mockCanvasState),
    {
      getState: () => mockCanvasState,
      setState: (partial: Partial<typeof mockCanvasState>) => {
        mockCanvasState = { ...mockCanvasState, ...partial }
      },
    },
  ),
}))

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: (selector: (s: any) => any) => {
    const state = { guidanceItems: [], setActiveGuidanceItem: vi.fn() }
    return selector(state)
  },
}))

vi.mock('../hooks/useBriefSignals', () => ({
  useBriefSignals: () => null,
}))

vi.mock('../GuidanceStrip', () => ({
  GuidanceStrip: function MockGuidanceStrip() { return <div data-testid="guidance-strip" /> },
}))
vi.mock('../zones/BriefGuidanceStrip', () => ({
  BriefGuidanceStrip: function MockBriefGuidanceStrip() { return <div /> },
}))
vi.mock('../zones/BriefReadinessPill', () => ({
  BriefReadinessPill: function MockBriefReadinessPill() { return <div /> },
}))
vi.mock('../zones/CoachingTip', () => ({
  CoachingTip: function MockCoachingTip() { return <div /> },
}))

vi.mock('../../../flags', () => ({
  isBilPreviewEnabled: () => false,
}))
vi.mock('../../brief-intelligence/extract', () => ({
  extractLocalBIL: () => null,
}))
vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (v: string) => v,
}))

// Import after mocks are installed.
import { ChatComposer } from '../zones/ChatComposer'
import type { ChatComposerHandle } from '../zones/ChatComposer'

function makeConversation(overrides: Record<string, any> = {}) {
  return {
    sendMessage: vi.fn(),
    isThinking: false,
    messages: [],
    longRunningHint: null,
    nodeCount: 0,
    cancelTurn: vi.fn(),
    ...overrides,
  } as any
}

function renderComposer(props: Partial<Parameters<typeof ChatComposer>[0]> = {}) {
  const ref = createRef<ChatComposerHandle>()
  const defaults = {
    conversation: makeConversation(),
    onCollapse: vi.fn(),
    onScrollToPatch: vi.fn(),
    onOpenInspector: vi.fn(),
    onGenerateModel: vi.fn(),
    onInsertText: vi.fn(),
    onAttach: vi.fn(),
    onRunAnalysis: vi.fn(),
    canRunAnalysis: true,
    runBlockedReason: undefined as string | undefined,
  }
  return {
    ref,
    ...render(<ChatComposer ref={ref} {...defaults} {...props} />),
    onRunAnalysis: (props.onRunAnalysis ?? defaults.onRunAnalysis) as ReturnType<typeof vi.fn>,
  }
}

// ---------------------------------------------------------------------------
// Item 3 — Run analysis is icon-only
// ---------------------------------------------------------------------------

describe('Hotfix item 3 — Run analysis is icon-only', () => {
  it('ChatComposer source no longer renders a "Run analysis" span label', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.resolve(__dirname, '../zones/ChatComposer.tsx'),
      'utf8',
    )
    // The icon + testid still exist…
    expect(src).toMatch(/data-testid="run-analysis-chip"/)
    expect(src).toMatch(/<Play /)
    // …but no <span>Run analysis</span> label inside the button.
    expect(src).not.toMatch(/<span>Run analysis<\/span>/)
    // aria-label still announces the affordance for screen readers.
    expect(src).toMatch(/aria-label=\{.*'Run analysis'/)
  })

  it('renders the run-analysis chip with no visible text, only the icon + aria-label', () => {
    mockStage = 'ideate'
    renderComposer()
    const chip = screen.getByTestId('run-analysis-chip')
    // No visible text inside the button — icon-only.
    expect((chip.textContent ?? '').trim()).toBe('')
    // Icon still present (svg).
    expect(chip.querySelector('svg')).not.toBeNull()
    // Screen-reader name still resolves to "Run analysis".
    expect(chip.getAttribute('aria-label')).toBe('Run analysis')
  })
})

// ---------------------------------------------------------------------------
// Item 4 — Run analysis disables while in-flight
// ---------------------------------------------------------------------------

describe('Hotfix item 4 — Run analysis gate combines readiness + in-flight', () => {
  it('ConversationPanel threads useV2Run isRunning into canRunAnalysis', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.resolve(__dirname, '../ConversationPanel.tsx'),
      'utf8',
    )
    // useV2Run exposes isRunning, aliased to isV2RunInFlight.
    expect(src).toMatch(/isRunning:\s*isV2RunInFlight/)
    // The button gate combines structural readiness with the in-flight flag,
    // closing the click-to-statusFlip gap that could allow a double-fire.
    expect(src).toMatch(/canRunAnalysis=\{runGateResult\.allowed\s*&&\s*!isV2RunInFlight\}/)
  })

  it('handleRunAnalysis guards all trigger paths with structural AND in-flight check', async () => {
    // The button's disabled prop already blocks UI-path clicks. But the
    // guidance store's _runAnalysis callback references handleRunAnalysis
    // directly and can bypass the button. The handler itself must guard.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.resolve(__dirname, '../ConversationPanel.tsx'),
      'utf8',
    )
    // Guard asserts both structural readiness AND in-flight.
    expect(src).toMatch(/if \(!runGateResult\.allowed \|\| isV2RunInFlight\) return/)
    // Dep array includes isV2RunInFlight so the callback is current.
    expect(src).toMatch(/\[messages\.length, runGateResult\.allowed, isV2RunInFlight, runV2Analysis\]/)
  })

  it('in-flight tooltip surfaces "Analysis in progress"', async () => {
    // ConversationPanel computes runBlockedReason with in-flight priority.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.resolve(__dirname, '../ConversationPanel.tsx'),
      'utf8',
    )
    expect(src).toMatch(/isV2RunInFlight\s*\?\s*'Analysis in progress'/)
  })

  it('disabled button exposes runBlockedReason via title + aria-label', () => {
    mockStage = 'ideate'
    renderComposer({ canRunAnalysis: false, runBlockedReason: 'Analysis in progress' })
    const chip = screen.getByTestId('run-analysis-chip') as HTMLButtonElement
    expect(chip).toBeDisabled()
    expect(chip.getAttribute('title')).toBe('Analysis in progress')
    expect(chip.getAttribute('aria-label')).toBe('Run analysis (blocked: Analysis in progress)')
  })

  it('double-click on the run-analysis chip while in-flight disables + fires onRunAnalysis at most once', () => {
    // Simulates the real disable pattern: first click transitions the panel
    // to in-flight state; the re-render marks canRunAnalysis=false, which
    // disables the button. A browser double-click that arrives during the
    // flip-gap is blocked by the disabled attribute on the second click.
    mockStage = 'ideate'
    const onRunAnalysis = vi.fn()
    const { rerender } = render(
      <ChatComposer
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
        onInsertText={vi.fn()}
        onAttach={vi.fn()}
        onRunAnalysis={onRunAnalysis}
        canRunAnalysis={true}
      />,
    )
    const chip = screen.getByTestId('run-analysis-chip') as HTMLButtonElement
    expect(chip).not.toBeDisabled()
    fireEvent.click(chip)
    expect(onRunAnalysis).toHaveBeenCalledTimes(1)
    // Simulate the parent flipping the gate to false (mirrors ConversationPanel's
    // runGateResult.allowed && !isV2RunInFlight re-render).
    act(() => {
      rerender(
        <ChatComposer
          conversation={makeConversation()}
          onCollapse={vi.fn()}
          onScrollToPatch={vi.fn()}
          onOpenInspector={vi.fn()}
          onGenerateModel={vi.fn()}
          onInsertText={vi.fn()}
          onAttach={vi.fn()}
          onRunAnalysis={onRunAnalysis}
          canRunAnalysis={false}
          runBlockedReason="Analysis in progress"
        />,
      )
    })
    expect(chip).toBeDisabled()
    fireEvent.click(chip)
    // Disabled button swallows the click — handler is not called again.
    expect(onRunAnalysis).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Item 6 — generic Thinking… sentinel removed
// ---------------------------------------------------------------------------

describe('Hotfix item 6 — generic "Thinking…" toolLoadingState sentinel removed', () => {
  it('useConversation source no longer writes the generic Thinking sentinel', async () => {
    // The deleted timer wrote `toolLoadingState: 'Thinking\u2026'` after 3s
    // of stream silence. Its removal is the regression barrier; this
    // tripwire prevents reintroduction.
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const src = await fs.readFile(
      path.resolve(__dirname, '../useConversation.ts'),
      'utf8',
    )
    // The literal Unicode sentinel must not appear as a toolLoadingState value.
    expect(src).not.toMatch(/toolLoadingState:\s*['"]Thinking\\u2026['"]/)
    // Dead clearTimeout references were also removed.
    expect(src).not.toContain('clearTimeout(thinkingTimerId)')
    expect(src).not.toMatch(/const thinkingTimerId\s*=\s*setTimeout/)
    // Inline comment documents the removal condition for future work.
    expect(src).toMatch(/DO NOT reintroduce a generic "Thinking…" sentinel/)
  })
})

// ---------------------------------------------------------------------------
// Item 7 — safeRichText bold-lead vertical rhythm
// ---------------------------------------------------------------------------

describe('Hotfix item 7 — safeRichText join-logic transition matrix', () => {
  // The join loop in safeRichText decides between <br> and <br class="md-gap">
  // based on transitions between four part kinds: body, bold-lead, list, and
  // explicit blank-line. This matrix locks the intended rhythm so any change
  // to the predicate surfaces as a concrete assertion rather than a visual
  // drift caught only in manual review.

  type Transition = {
    label: string
    input: string
    expectation: RegExp
  }

  const matrix: Transition[] = [
    {
      label: 'body → body (no blank)',
      input: 'First sentence.\nSecond sentence.',
      expectation: /First sentence\.<br>Second sentence\./,
    },
    {
      label: 'body → bold-lead',
      input: 'Context sentence.\n**Next section**',
      expectation: /Context sentence\.<br class="md-gap"><strong>Next section<\/strong>/,
    },
    {
      label: 'bold-lead → body (the bug hotfix item 7 fixes)',
      input: '**Section header**\nBody paragraph follows.',
      expectation: /<strong>Section header<\/strong><br class="md-gap">Body paragraph follows\./,
    },
    {
      label: 'bold-lead → bold-lead (preserved behaviour)',
      input: '**Header A**\n**Header B**',
      expectation: /<strong>Header A<\/strong><br class="md-gap"><strong>Header B<\/strong>/,
    },
    {
      label: 'body → list (list tag is its own block — no <br> joiner)',
      input: 'Intro line.\n- Item one\n- Item two',
      expectation: /Intro line\.<ul><li>Item one<\/li><li>Item two<\/li><\/ul>/,
    },
    {
      label: 'list → body (plain <br> joins list tail to following body)',
      input: '- Item one\n- Item two\nClosing line.',
      expectation: /<\/ul><br>Closing line\./,
    },
    {
      label: 'blank-line break always emits md-gap regardless of side kinds',
      input: 'Paragraph one.\n\nParagraph two.',
      expectation: /Paragraph one\.<br class="md-gap">Paragraph two\./,
    },
    {
      label: 'consecutive blank lines still collapse to a single md-gap',
      input: 'Paragraph one.\n\n\n\nParagraph two.',
      expectation: /Paragraph one\.<br class="md-gap">Paragraph two\./,
    },
  ]

  it.each(matrix)('$label', ({ input, expectation }) => {
    expect(safeRichText(input)).toMatch(expectation)
  })

  it('body → body emits no md-gap (negative assertion — bounds over-spacing)', () => {
    // Complements the matrix: verifies that the bold-lead widening did NOT
    // accidentally make every <br> a gap. Two plain body lines stay tight.
    const html = safeRichText('First.\nSecond.')
    expect(html).not.toContain('<br class="md-gap">')
    expect(html).toContain('<br>')
  })
})

// ---------------------------------------------------------------------------
// Item 9 — GraphPatchBlock label fallback uses element-type word
// ---------------------------------------------------------------------------

describe('Hotfix item 9 — describeOperation fallback uses element type from id prefix', () => {
  const emptyDeps = { nodeLabels: new Map(), edgeEndpoints: new Map() }

  it('update_node on an option id returns "Update option"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'opt_expand_market', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update option')
  })

  it('remove_node on a goal id returns "Remove goal"', () => {
    const op: PatchOperation = { op: 'remove_node', target_id: 'goal_reach_20k_mrr', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Remove goal')
  })

  it('update_node on a decision id returns "Update decision"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'decision_rebuild_checkout', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update decision')
  })

  it('add_node on an outcome id returns "Add outcome"', () => {
    const op: PatchOperation = { op: 'add_node', target_id: 'outcome_churn_below_4pct', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Add outcome')
  })

  it('update_node on a constraint id returns "Update constraint"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'con_budget_cap', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update constraint')
  })

  it('update_node on a factor id returns "Update factor"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'fac_team_morale', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update factor')
  })

  it('update_node on an unrecognised id falls back to "Update factor"', () => {
    const op: PatchOperation = { op: 'update_node', target_id: 'weird_xyz', data: {} }
    const result = describeOperation(op, emptyDeps)
    expect(result).toBe('Update factor')
  })

  it('edge operations still return "… connection" regardless of id shape', () => {
    const ops: Array<[PatchOperation['op'], string]> = [
      ['add_edge', 'Add connection'],
      ['update_edge', 'Update connection'],
      ['remove_edge', 'Remove connection'],
    ]
    for (const [opName, expected] of ops) {
      const op: PatchOperation = { op: opName, target_id: 'edge_ghost_1', data: {} }
      expect(describeOperation(op, emptyDeps)).toBe(expected)
    }
  })

  it('security invariant: fallback never contains the raw target_id', () => {
    const ids = [
      'opt_expand_market',
      'goal_reach_20k_mrr',
      'factor_team_morale',
      'option_hire_tech_lead',
      'decision_rebuild_checkout',
      'outcome_happy_user',
      'constraint_budget_cap',
    ]
    for (const id of ids) {
      const op: PatchOperation = { op: 'update_node', target_id: id, data: {} }
      const result = describeOperation(op, emptyDeps)
      expect(result).not.toMatch(RAW_ID_PATTERN)
      expect(result).not.toContain(id)
    }
  })
})
