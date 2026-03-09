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

const PLACEHOLDER = 'Describe your decision, the options you\u2019re weighing, and what a good outcome looks like.'

describe('ChatComposer', () => {
  beforeEach(() => {
    mockStage = 'frame'
    mockBriefSignals = null
    mockBilEnabled = false
    mockBilResult = null
  })

  it('renders textarea with placeholder', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        generateState="disabled"
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
        generateState="disabled"
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
        generateState="disabled"
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
        generateState="disabled"
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
        generateState="disabled"
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
        generateState="disabled"
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
        generateState="disabled"
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.getByTestId('inline-generate-btn')).toBeInTheDocument()
    expect(screen.getByTestId('inline-generate-btn')).toBeDisabled()
  })

  it('inline generate button is active when generateState is active', () => {
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
        generateState="active"
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={onGenerateModel}
      />,
    )

    const btn = screen.getByTestId('inline-generate-btn')
    expect(btn).not.toBeDisabled()
  })

  // ── consumeBrief contract ──────────────────────────────────────────────

  it('consumeBrief returns null when composer is empty', () => {
    const ref = createRef<ChatComposerHandle>()
    render(
      <ChatComposer
        ref={ref}
        conversation={makeConversation()}
        generateState="disabled"
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
        generateState="disabled"
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
      'Tip: try describing how factors cause outcomes',
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
        generateState="disabled"
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
        generateState="disabled"
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
        generateState="disabled"
        onCollapse={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
        onGenerateModel={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('bil-causal-tip')).not.toBeInTheDocument()
  })
})
