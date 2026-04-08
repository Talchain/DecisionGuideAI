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
import { render, screen, fireEvent } from '@testing-library/react'
import { createRef } from 'react'
import { ChatComposer } from '../zones/ChatComposer'
import type { ChatComposerHandle } from '../zones/ChatComposer'

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockStage = 'frame'

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
    mockCanvasState = { nodes: [], edges: [], draftComposerText: null }
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
    mockCanvasState = { nodes: [{ id: 'node-1' }], edges: [], draftComposerText: null }
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
})
