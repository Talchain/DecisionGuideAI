/**
 * Tests for ChatComposer.
 *
 * Verifies:
 * - Input renders with placeholder
 * - Send button states (disabled when empty, enabled when content)
 * - BriefGuidanceStrip and GuidanceStrip never render simultaneously
 *   (BriefGuidanceStrip only in framing stage; GuidanceStrip only outside framing)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { ChatComposer } from '../zones/ChatComposer'
import type { ChatComposerHandle } from '../zones/ChatComposer'

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockStage = 'frame'

const mockRefreshEdgeStrengthAuthority = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const mockOpenEdgeStrengthRecoveryRelationship = vi.hoisted(() => vi.fn(() => true))

vi.mock('../../edge-strength/edgeStrengthCoordinator', () => ({
  refreshEdgeStrengthAuthority: mockRefreshEdgeStrengthAuthority,
  openEdgeStrengthRecoveryRelationship: mockOpenEdgeStrengthRecoveryRelationship,
}))

vi.mock('../../hooks/useStagePill', () => ({
  useStagePill: () => ({ stage: mockStage }),
}))

type MockCanvasState = {
  nodes: Array<{ id: string }>
  edges: Array<{ id: string }>
  draftComposerText: string | null
  currentBriefText?: string | null
  currentScenarioId: string | null
  unconfirmedEmittedEdits: number
  edgeStrengthSync: {
    hydration: 'settled' | 'unconfirmed'
    issue: string | null
    recoverySummary: {
      items: Array<{
        from: string
        to: string
        label: string
        kind: string
        relationshipExists: boolean
      }>
      total: number
      remaining: number
    }
  }
}

function cleanCanvasState(overrides: Partial<MockCanvasState> = {}): MockCanvasState {
  return {
    nodes: [],
    edges: [],
    draftComposerText: null,
    currentScenarioId: null,
    unconfirmedEmittedEdits: 0,
    edgeStrengthSync: {
      hydration: 'settled',
      issue: null,
      recoverySummary: { items: [], total: 0, remaining: 0 },
    },
    ...overrides,
  }
}

let mockCanvasState: MockCanvasState = cleanCanvasState()

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
    const state = {
      guidanceItems: [],
      setActiveGuidanceItem: vi.fn(),
    }
    return selector(state)
  },
}))

// Mock useBriefSignals to control when elements are detected
let mockBriefSignals: any = null

vi.mock('../hooks/useBriefSignals', () => ({
  useBriefSignals: () => mockBriefSignals,
}))

// Mock GuidanceStrip to detect render
vi.mock('../GuidanceStrip', () => ({
  GuidanceStrip: function MockGuidanceStrip() {
    return <div data-testid="guidance-strip">GuidanceStrip</div>
  },
}))

// Mock BriefGuidanceStrip to detect render
vi.mock('../zones/BriefGuidanceStrip', () => ({
  BriefGuidanceStrip: function MockBriefGuidanceStrip() {
    return <div data-testid="brief-guidance-strip">BriefGuidanceStrip</div>
  },
}))

// Mock BriefReadinessPill
vi.mock('../zones/BriefReadinessPill', () => ({
  BriefReadinessPill: function MockBriefReadinessPill() {
    return <div data-testid="brief-readiness-pill">BriefReadinessPill</div>
  },
}))

// Mock CoachingTip
vi.mock('../zones/CoachingTip', () => ({
  CoachingTip: function MockCoachingTip() {
    return <div data-testid="coaching-tip">CoachingTip</div>
  },
}))

// BIL flag + extraction mocks — default off, overridden per test
let mockBilEnabled = false
vi.mock('../../../flags', () => ({
  isBilPreviewEnabled: () => mockBilEnabled,
}))

let mockBilResult: any = null
vi.mock('../../brief-intelligence/extract', () => ({
  extractLocalBIL: () => mockBilResult,
}))

// useDebounce passthrough (no delay in tests)
vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (v: string) => v,
}))

function makeConversation(overrides: Record<string, any> = {}) {
  return {
    sendMessage: vi.fn(),
    isThinking: false,
    messages: [],
    longRunningHint: null,
    nodeCount: 0,
    ...overrides,
  } as any
}

const PLACEHOLDER = 'Describe your decision, the options you\'re weighing, and what a good outcome looks like.'

describe('ChatComposer', () => {
  beforeEach(() => {
    mockStage = 'frame'
    mockBriefSignals = null
    mockBilEnabled = false
    mockBilResult = null
    mockRefreshEdgeStrengthAuthority.mockReset()
    mockRefreshEdgeStrengthAuthority.mockResolvedValue(true)
    mockOpenEdgeStrengthRecoveryRelationship.mockReset()
    mockOpenEdgeStrengthRecoveryRelationship.mockReturnValue(true)
    mockCanvasState = cleanCanvasState()
  })

  it('renders textarea with placeholder', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Message input')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(PLACEHOLDER)).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('send-button')).toBeDisabled()
  })

  // ── Exclusivity test: BriefGuidanceStrip vs GuidanceStrip ──────────────

  it('shows BriefGuidanceStrip (not GuidanceStrip) during framing stage with detected elements', () => {
    mockStage = 'frame'
    mockBriefSignals = {
      elements: [
        { kind: 'goal', detected: true, label: 'Goal', coachingTip: 'State your goal.' },
        { kind: 'options', detected: false, label: 'Options', coachingTip: 'List options.' },
        { kind: 'metric', detected: false, label: 'Metric', coachingTip: 'Add a metric.' },
        { kind: 'constraints', detected: false, label: 'Constraints', coachingTip: 'Note constraints.' },
        { kind: 'risks', detected: false, label: 'Risks', coachingTip: 'Note risks.' },
      ],
      readiness: 'low',
      bias: null,
    }

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.getByTestId('brief-guidance-strip')).toBeInTheDocument()
    expect(screen.getByTestId('brief-readiness-pill')).toBeInTheDocument()
    expect(screen.queryByTestId('guidance-strip')).not.toBeInTheDocument()
  })

  it('shows GuidanceStrip (not BriefGuidanceStrip) outside framing stage', () => {
    mockStage = 'ideate'
    mockBriefSignals = null // useBriefSignals returns null outside framing

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.getByTestId('guidance-strip')).toBeInTheDocument()
    expect(screen.queryByTestId('brief-guidance-strip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('brief-readiness-pill')).not.toBeInTheDocument()
  })

  it('shows neither strip during framing stage with no detected elements', () => {
    mockStage = 'frame'
    mockBriefSignals = {
      elements: [
        { kind: 'goal', detected: false, label: 'Goal', coachingTip: 'State your goal.' },
        { kind: 'options', detected: false, label: 'Options', coachingTip: 'List options.' },
        { kind: 'metric', detected: false, label: 'Metric', coachingTip: 'Add a metric.' },
        { kind: 'constraints', detected: false, label: 'Constraints', coachingTip: 'Note constraints.' },
        { kind: 'risks', detected: false, label: 'Risks', coachingTip: 'Note risks.' },
      ],
      readiness: 'low',
      bias: null,
    }

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    // Framing stage → no GuidanceStrip
    expect(screen.queryByTestId('guidance-strip')).not.toBeInTheDocument()
    // No detected elements → no BriefGuidanceStrip
    expect(screen.queryByTestId('brief-guidance-strip')).not.toBeInTheDocument()
  })

  it('never shows both strips simultaneously in evaluate stage', () => {
    mockStage = 'evaluate'
    mockBriefSignals = null

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    // evaluate is not framing → GuidanceStrip renders, BriefGuidanceStrip does not
    expect(screen.getByTestId('guidance-strip')).toBeInTheDocument()
    expect(screen.queryByTestId('brief-guidance-strip')).not.toBeInTheDocument()
  })

  // ── Generate model gate ────────────────────────────────────────────────

  it('shows inline generate button when brief strip is visible', () => {
    mockStage = 'frame'
    mockBriefSignals = {
      elements: [
        { kind: 'goal', detected: true, label: 'Goal', coachingTip: 'State your goal.' },
        { kind: 'options', detected: false, label: 'Options', coachingTip: 'List options.' },
        { kind: 'metric', detected: false, label: 'Metric', coachingTip: 'Add a metric.' },
        { kind: 'constraints', detected: false, label: 'Constraints', coachingTip: 'Note constraints.' },
        { kind: 'risks', detected: false, label: 'Risks', coachingTip: 'Note risks.' },
      ],
      readiness: 'low',
      bias: null,
    }

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.getByTestId('inline-generate-btn')).toBeInTheDocument()
    // Button is always clickable (handler guards internally); visual state indicates disabled
    expect(screen.getByTestId('inline-generate-btn')).not.toBeDisabled()
  })

  it('hides first-draft guidance and generate controls once a graph exists', () => {
    mockStage = 'frame'
    mockCanvasState = cleanCanvasState({ nodes: [{ id: 'node-1' }] })
    mockBriefSignals = {
      elements: [
        { kind: 'goal', detected: true, label: 'Goal', coachingTip: 'State your goal.' },
        { kind: 'options', detected: true, label: 'Options', coachingTip: 'List options.' },
        { kind: 'metric', detected: false, label: 'Metric', coachingTip: 'Add a metric.' },
        { kind: 'constraints', detected: false, label: 'Constraints', coachingTip: 'Note constraints.' },
        { kind: 'risks', detected: false, label: 'Risks', coachingTip: 'Note risks.' },
      ],
      readiness: 'high',
      bias: null,
    }

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('brief-guidance-strip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('brief-readiness-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('inline-generate-btn')).not.toBeInTheDocument()
  })

  it('clicking generate button with ≥50 chars calls onGenerateModel exactly once', () => {
    mockStage = 'frame'
    mockBriefSignals = {
      elements: [
        { kind: 'goal', detected: true, label: 'Goal', coachingTip: 'State your goal.' },
        { kind: 'options', detected: true, label: 'Options', coachingTip: 'List options.' },
        { kind: 'metric', detected: true, label: 'Metric', coachingTip: 'Add a metric.' },
        { kind: 'constraints', detected: false, label: 'Constraints', coachingTip: 'Note constraints.' },
        { kind: 'risks', detected: false, label: 'Risks', coachingTip: 'Note risks.' },
      ],
      readiness: 'high',
      bias: null,
    }

    const onGenerateModel = vi.fn()
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={onGenerateModel}
      />,
    )

    // Type ≥50 chars, then click once — should fire immediately without a second click
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'A'.repeat(51) } })
    fireEvent.click(screen.getByTestId('inline-generate-btn'))

    expect(onGenerateModel).toHaveBeenCalledTimes(1)
  })

  it('clicking generate button with <50 chars still calls onGenerateModel (handler guards internally)', () => {
    mockStage = 'frame'
    mockBriefSignals = {
      elements: [
        { kind: 'goal', detected: true, label: 'Goal', coachingTip: 'State your goal.' },
        { kind: 'options', detected: false, label: 'Options', coachingTip: 'List options.' },
        { kind: 'metric', detected: false, label: 'Metric', coachingTip: 'Add a metric.' },
        { kind: 'constraints', detected: false, label: 'Constraints', coachingTip: 'Note constraints.' },
        { kind: 'risks', detected: false, label: 'Risks', coachingTip: 'Note risks.' },
      ],
      readiness: 'low',
      bias: null,
    }

    const onGenerateModel = vi.fn()
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={onGenerateModel}
      />,
    )

    // Button is always clickable — handler guards internally based on brief length
    expect(screen.getByTestId('inline-generate-btn')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('inline-generate-btn'))

    expect(onGenerateModel).toHaveBeenCalledTimes(1)
  })

  // ── consumeBrief contract ──────────────────────────────────────────────

  it('consumeBrief returns null when composer is empty', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(ref.current?.consumeBrief()).toBeNull()
  })

  // ── BIL causal framing coaching tip ──────────────────────────────────

  it('shows causal framing tip when weak + >50 chars + bil flag on', () => {
    mockStage = 'frame'
    mockBilEnabled = true
    mockBilResult = {
      goal: null, options: [], constraints: [], factors: [],
      completeness_band: 'low', ambiguity_flags: [], missing_elements: [],
      causal_framing_score: 'weak', specificity_score: 'vague', dsk_cues: [],
    }

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    // Type >50 chars into the textarea so debouncedValue.length > 50
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'A'.repeat(51) } })

    expect(screen.getByTestId('bil-causal-tip')).toBeInTheDocument()
    expect(screen.getByTestId('bil-causal-tip').textContent).toContain(
      'Tip: describe how factors cause outcomes',
    )
  })

  it('hides causal framing tip when brief is short (<= 50 chars)', () => {
    mockStage = 'frame'
    mockBilEnabled = true
    mockBilResult = {
      goal: null, options: [], constraints: [], factors: [],
      completeness_band: 'low', ambiguity_flags: [], missing_elements: [],
      causal_framing_score: 'weak', specificity_score: 'vague', dsk_cues: [],
    }

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    // Type exactly 50 chars — should NOT show tip
    const textarea = screen.getByLabelText('Message input')
    fireEvent.change(textarea, { target: { value: 'A'.repeat(50) } })

    expect(screen.queryByTestId('bil-causal-tip')).not.toBeInTheDocument()
  })

  it('hides causal framing tip when causal_framing_score is strong', () => {
    mockStage = 'frame'
    mockBilEnabled = true
    mockBilResult = {
      goal: null, options: [], constraints: [], factors: [],
      completeness_band: 'low', ambiguity_flags: [], missing_elements: [],
      causal_framing_score: 'strong', specificity_score: 'vague', dsk_cues: [],
    }

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('bil-causal-tip')).not.toBeInTheDocument()
  })

  it('hides causal framing tip when bil flag is off', () => {
    mockStage = 'frame'
    mockBilEnabled = false
    mockBilResult = null // flag off → bilResult is null

    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('bil-causal-tip')).not.toBeInTheDocument()
  })

  it('makes a canonical Run blocker visible and exposes explicit shared-model recovery', async () => {
    mockStage = 'evaluate'
    mockCanvasState = cleanCanvasState({
      nodes: [{ id: 'n1' }],
      currentScenarioId: 'scenario-1',
      edgeStrengthSync: {
        hydration: 'unconfirmed',
        issue: 'unconfirmed',
        recoverySummary: {
          items: [{
            from: 'fac_demand',
            to: 'goal_profit',
            label: 'Demand → Sustainable profit',
            kind: 'unconfirmed',
            relationshipExists: true,
          }],
          total: 1,
          remaining: 0,
        },
      },
    })
    const reason = 'We could not verify that this relationship change was saved. Check the shared model before running analysis.'

    render(
      <ChatComposer
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
        onInsertText={vi.fn()}
        onAttach={vi.fn()}
        onRunAnalysis={vi.fn()}
        canRunAnalysis={false}
        runBlockedReason={reason}
      />,
    )

    const run = screen.getByTestId('run-analysis-chip')
    expect(run).toBeDisabled()
    expect(run).toHaveAttribute('aria-describedby', 'composer-run-blocked-reason')
    expect(screen.getByText(reason)).toBeVisible()
    expect(screen.getByRole('list', { name: 'Relationships affecting analysis' })).toBeVisible()
    const review = screen.getByRole('button', {
      name: 'Review relationship Demand → Sustainable profit',
    })
    expect(review.tagName).toBe('BUTTON')
    review.focus()
    expect(review).toHaveFocus()
    fireEvent.click(review)
    expect(mockOpenEdgeStrengthRecoveryRelationship).toHaveBeenCalledWith(
      'scenario-1',
      'fac_demand',
      'goal_profit',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Check shared model' }))
    await waitFor(() => expect(mockRefreshEdgeStrengthAuthority).toHaveBeenCalledWith('scenario-1'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore shared model' })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: 'Restore shared model' }))
    await waitFor(() => expect(mockRefreshEdgeStrengthAuthority).toHaveBeenCalledWith(
      'scenario-1',
      { replaceLocalGraph: true },
    ))
  })

  it('keeps an inspector-closed conflict keyboard-navigable by its human relationship label', () => {
    mockStage = 'evaluate'
    mockCanvasState = cleanCanvasState({
      currentScenarioId: 'scenario-1',
      edgeStrengthSync: {
        hydration: 'settled',
        issue: 'conflict',
        recoverySummary: {
          items: [{
            from: 'fac_cost',
            to: 'goal_margin',
            label: 'Operating cost → Sustainable margin',
            kind: 'conflict',
            relationshipExists: true,
          }],
          total: 1,
          remaining: 0,
        },
      },
    })

    render(
      <ChatComposer
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
        onInsertText={vi.fn()}
        onAttach={vi.fn()}
        onRunAnalysis={vi.fn()}
        canRunAnalysis={false}
        runBlockedReason="Operating cost → Sustainable margin changed elsewhere. Review the latest shared value before running analysis."
      />,
    )

    const review = screen.getByRole('button', {
      name: 'Review relationship Operating cost → Sustainable margin',
    })
    expect(review).toBeVisible()
    fireEvent.click(review)
    expect(mockOpenEdgeStrengthRecoveryRelationship).toHaveBeenCalledWith(
      'scenario-1',
      'fac_cost',
      'goal_margin',
    )
  })

  it('offers shared-model check/restore when the affected relationship is structurally absent', () => {
    mockStage = 'evaluate'
    mockCanvasState = cleanCanvasState({
      currentScenarioId: 'scenario-1',
      edgeStrengthSync: {
        hydration: 'settled',
        issue: 'unconfirmed_structure',
        recoverySummary: {
          items: [{
            from: 'fac_removed',
            to: 'goal_profit',
            label: 'Former supplier → Sustainable profit',
            kind: 'unconfirmed_structure',
            relationshipExists: false,
          }],
          total: 1,
          remaining: 0,
        },
      },
    })

    render(
      <ChatComposer
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
        onInsertText={vi.fn()}
        onAttach={vi.fn()}
        onRunAnalysis={vi.fn()}
        canRunAnalysis={false}
        runBlockedReason="Former supplier → Sustainable profit was removed only on this device. Check the shared model before running analysis."
      />,
    )

    expect(screen.getByText('Former supplier → Sustainable profit')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Review relationship/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check shared model' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Restore shared model' })).toBeVisible()
  })

  it('renders only the coordinator-bounded relationship list and discloses the remainder', () => {
    mockStage = 'evaluate'
    mockCanvasState = cleanCanvasState({
      currentScenarioId: 'scenario-1',
      edgeStrengthSync: {
        hydration: 'settled',
        issue: 'unsupported_fields',
        recoverySummary: {
          items: [
            { from: 'a', to: 'g', label: 'Demand → Goal', kind: 'unsupported_fields', relationshipExists: true },
            { from: 'b', to: 'g', label: 'Cost → Goal', kind: 'unsupported_fields', relationshipExists: true },
            { from: 'c', to: 'g', label: 'Capability → Goal', kind: 'unsupported_fields', relationshipExists: false },
          ],
          total: 5,
          remaining: 2,
        },
      },
    })

    render(
      <ChatComposer
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
        onInsertText={vi.fn()}
        onAttach={vi.fn()}
        onRunAnalysis={vi.fn()}
        canRunAnalysis={false}
        runBlockedReason="Relationships need attention before running analysis."
      />,
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('And 2 more relationships need attention.')).toBeVisible()
    expect(screen.queryByText('Hidden fourth relationship')).not.toBeInTheDocument()
  })

  it('exposes the same authoritative recovery for an unconfirmed factor-value write', () => {
    mockStage = 'evaluate'
    mockCanvasState = cleanCanvasState({
      nodes: [{ id: 'n1' }],
      currentScenarioId: 'scenario-1',
      unconfirmedEmittedEdits: 1,
    })

    render(
      <ChatComposer
        conversation={makeConversation()}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
        onInsertText={vi.fn()}
        onAttach={vi.fn()}
        onRunAnalysis={vi.fn()}
        canRunAnalysis={false}
        runBlockedReason="We could not confirm whether a model value change was saved. Check the shared model before running analysis."
      />,
    )

    expect(screen.getByRole('button', { name: 'Check shared model' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Restore shared model' })).toBeVisible()
  })
})

// ============================================================================
// T6 — Stop button (canonical isStreaming signal)
// ============================================================================

describe('ChatComposer — Stop button (T6)', () => {
  beforeEach(() => {
    mockStage = 'ideate'
    mockBriefSignals = null
    mockBilEnabled = false
    mockBilResult = null
    mockCanvasState = cleanCanvasState({ nodes: [{ id: 'n1' }] })
  })

  it('shows the send button (not the stop button) when isThinking is false', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation({ isThinking: false, cancelTurn: vi.fn() })}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('send-button')).toBeInTheDocument()
    expect(screen.queryByTestId('stop-button')).not.toBeInTheDocument()
  })

  it('shows the stop button (not the send button) when isThinking is true', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation({ isThinking: true, cancelTurn: vi.fn() })}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )
    expect(screen.getByTestId('stop-button')).toBeInTheDocument()
    expect(screen.queryByTestId('send-button')).not.toBeInTheDocument()
  })

  it('clicking the stop button calls cancelTurn exactly once', () => {
    const cancelTurn = vi.fn()
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation({ isThinking: true, cancelTurn })}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('stop-button'))
    expect(cancelTurn).toHaveBeenCalledTimes(1)
  })

  it('stop button has the correct aria-label for accessibility', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation({ isThinking: true, cancelTurn: vi.fn() })}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Stop response')).toBeInTheDocument()
  })

  it('uses isThinking as the SOLE source of truth — no toolLoadingState fallback', () => {
    // Even if a toolLoadingState-like signal exists on the conversation, the
    // stop button should ONLY appear when isThinking is true. The composer
    // never looks at message-level toolLoadingState — only the canonical
    // hook-level isThinking flag.
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation({ isThinking: false, toolLoadingState: 'Running...', cancelTurn: vi.fn() })}
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('stop-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('send-button')).toBeInTheDocument()
  })
})
