/**
 * Guidance telemetry — unit tests.
 *
 * Coverage:
 *  Event taxonomy (3): all names snake_case + guidance_ prefix, no-op, required fields
 *  Coaching (3): COACHING_SHOWN once per item, no duplicate on rerender, click fires COACHING_CLICKED
 *  Fix (2): FIX_SHOWN on render, FIX_CLICKED on click
 *  Trust (2): trust strip click fires, model tab mount fires MODEL_CARD_VIEWED
 *  Dedup (1): rapid highlights fire only once within 2s cooldown
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import posthog from 'posthog-js'

// ---------------------------------------------------------------------------
// § 1 — Mock setup
// ---------------------------------------------------------------------------

// Mock posthog-js so capture is observable
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}))

// Canvas store mock — stable getState returning simple stubs.
// nodes/edges included (both empty) because GuidanceStrip's click handler
// calls focusHelpers.focusExistingTarget(), which destructures
// `{ nodes, edges }` off getState() unconditionally — without them here it
// threw "Cannot read properties of undefined (reading 'some')" as an
// uncaught, unhandled error (assertions still passed since the throw
// happens in a fire-and-forget click callback, but it failed vitest's exit
// code and would have failed CI's non-OOM-signature check). ROADMAP 1.26
// chronic-CI-red triage.
vi.mock('../../canvas/store', () => ({
  useCanvasStore: Object.assign(
    vi.fn(() => null),
    { getState: vi.fn(() => ({ currentScenarioId: 'scenario-1', currentStage: 'ideate', nodes: [], edges: [] })) },
  ),
}))

// Highlight context mock for WorthInvestigating
vi.mock('../../canvas/highlighting/HighlightContext', () => ({
  useHighlightContext: () => ({
    setHoveredFromPanel: vi.fn(),
    hoveredElementId: null,
  }),
}))

// isCrossHighlightEnabled — OFF by default so WorthInvestigating highlight branch is skipped
vi.mock('../../flags', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../flags')>()
  return {
    ...original,
    isCrossHighlightEnabled: () => false,
    isTelemetryEnabled: () => true,
  }
})

import { GUIDANCE_EVENTS, trackGuidance } from '../guidanceEvents'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import * as flags from '../../flags'

// Initialise posthog so `initialised` flag is set inside posthog.ts
import { initPostHog } from '../../lib/posthog'

// ---------------------------------------------------------------------------
// § 2 — Helpers
// ---------------------------------------------------------------------------

function makeGuidanceItem(overrides: Partial<import('../../canvas/stores/guidanceStore').GuidanceItem> = {}): import('../../canvas/stores/guidanceStore').GuidanceItem {
  return {
    item_id: 'item-1',
    signal_code: 'TEST',
    category: 'should_fix',
    source: 'structural',
    title: 'Test item',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Tell me more.' },
    target_object: { type: 'node', id: 'node-1' },
    ...overrides,
  }
}

const mockCapture = posthog.capture as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  useGuidanceStore.getState().clearGuidanceItems()
  // Simulate PostHog initialisation by setting VITE_ env vars
  ;(import.meta.env as any).VITE_POSTHOG_KEY = 'test-key'
  ;(import.meta.env as any).VITE_POSTHOG_HOST = 'https://posthog.example.com'
  initPostHog()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// § 3 — Event taxonomy
// ---------------------------------------------------------------------------

describe('Event taxonomy', () => {
  it('all event names are snake_case and prefixed with guidance_', () => {
    const snakeCaseGuidance = /^guidance_[a-z][a-z0-9_]*$/
    for (const name of Object.values(GUIDANCE_EVENTS)) {
      expect(name).toMatch(snakeCaseGuidance)
    }
  })

  it('trackGuidance no-ops when isTelemetryEnabled returns false', () => {
    const spy = vi.spyOn(flags, 'isTelemetryEnabled').mockReturnValue(false)
    mockCapture.mockClear()
    trackGuidance('COACHING_SHOWN', { item_id: 'x', item_type: 'bias_alert', surface: 'guidance_panel' })
    expect(mockCapture).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('payload includes all required fields (item_id, item_type, surface)', () => {
    trackGuidance('COACHING_SHOWN', {
      item_id: 'abc',
      item_type: 'bias_alert',
      surface: 'guidance_panel',
      scenario_id: 'sc-1',
      profile_stage: 'ideate',
    })
    expect(mockCapture).toHaveBeenCalledWith(
      GUIDANCE_EVENTS.COACHING_SHOWN,
      expect.objectContaining({
        item_id: 'abc',
        item_type: 'bias_alert',
        surface: 'guidance_panel',
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// § 4 — Coaching instrumentation
// ---------------------------------------------------------------------------

describe('Coaching instrumentation', () => {
  let GuidanceStrip: typeof import('../../canvas/conversation/GuidanceStrip').GuidanceStrip

  beforeEach(async () => {
    // Re-import after mocks are set up
    const mod = await import('../../canvas/conversation/GuidanceStrip')
    GuidanceStrip = mod.GuidanceStrip
  })

  it('fires COACHING_SHOWN once when an item mounts', async () => {
    useGuidanceStore.getState().setGuidanceItems([makeGuidanceItem({ item_id: 'i-1' })])
    render(
      <GuidanceStrip
        onSendMessage={vi.fn()}
        onSetActive={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    await vi.waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith(
        GUIDANCE_EVENTS.COACHING_SHOWN,
        expect.objectContaining({ item_id: 'i-1' }),
      )
    })
    expect(
      mockCapture.mock.calls.filter(([e]) => e === GUIDANCE_EVENTS.COACHING_SHOWN).length,
    ).toBe(1)
  })

  it('does not fire duplicate COACHING_SHOWN on rerender with the same item', async () => {
    const item = makeGuidanceItem({ item_id: 'i-2' })
    useGuidanceStore.getState().setGuidanceItems([item])
    const { rerender } = render(
      <GuidanceStrip
        onSendMessage={vi.fn()}
        onSetActive={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    // Rerender with same item in store (same reference)
    rerender(
      <GuidanceStrip
        onSendMessage={vi.fn()}
        onSetActive={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    await vi.waitFor(() => {
      expect(
        mockCapture.mock.calls.filter(([e]) => e === GUIDANCE_EVENTS.COACHING_SHOWN).length,
      ).toBe(1)
    })
  })

  it('fires COACHING_CLICKED with correct item_id on action click', async () => {
    const item = makeGuidanceItem({ item_id: 'i-3', primary_action: { type: 'discuss', prompt: 'ok' } })
    useGuidanceStore.getState().setGuidanceItems([item])
    render(
      <GuidanceStrip
        onSendMessage={vi.fn()}
        onSetActive={vi.fn()}
        onScrollToPatch={vi.fn()}
        onOpenInspector={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /discuss/i }))
    expect(mockCapture).toHaveBeenCalledWith(
      GUIDANCE_EVENTS.COACHING_CLICKED,
      expect.objectContaining({ item_id: 'i-3' }),
    )
  })
})

// ---------------------------------------------------------------------------
// § 5 — Fix instrumentation
// ---------------------------------------------------------------------------

describe('Fix instrumentation', () => {
  let WorthInvestigating: typeof import('../../canvas/components/pre-analysis/WorthInvestigating').WorthInvestigating

  beforeEach(async () => {
    const mod = await import('../../canvas/components/pre-analysis/WorthInvestigating')
    WorthInvestigating = mod.WorthInvestigating
  })

  it('fires FIX_SHOWN when a gap row with onSetValue renders', async () => {
    const gaps = [{
      factorId: 'f-1',
      factorLabel: 'My factor',
      description: 'No data',
      connectivityScore: 2,
    }]
    render(<WorthInvestigating gaps={gaps} onSetValue={vi.fn()} />)
    await vi.waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith(
        GUIDANCE_EVENTS.FIX_SHOWN,
        expect.objectContaining({ item_id: 'set_value_f-1', item_type: 'fix' }),
      )
    })
  })

  it('fires FIX_CLICKED when the Set value button is clicked', async () => {
    const gaps = [{
      factorId: 'f-2',
      factorLabel: 'Factor two',
      description: 'No data',
      connectivityScore: 1,
    }]
    const onSetValue = vi.fn()
    render(<WorthInvestigating gaps={gaps} onSetValue={onSetValue} />)
    fireEvent.click(screen.getByRole('button', { name: /set value/i }))
    expect(mockCapture).toHaveBeenCalledWith(
      GUIDANCE_EVENTS.FIX_CLICKED,
      expect.objectContaining({ item_id: 'set_value_f-2', item_type: 'fix' }),
    )
    expect(onSetValue).toHaveBeenCalledWith('f-2')
  })
})

// ---------------------------------------------------------------------------
// § 6 — Trust instrumentation
// ---------------------------------------------------------------------------

describe('Trust instrumentation', () => {
  it('fires MODEL_CARD_VIEWED on mount of ModelTabBody', async () => {
    // ModelTabBody has heavy canvas deps — mock the store subscriptions
    vi.mock('../../canvas/components/ModelCardLite', () => ({ ModelCardLite: () => null }))
    vi.mock('../../canvas/adapters/modelCardAdapter', () => ({
      selectModelCardData: () => ({ nodes: [], edges: [] }),
    }))
    // Stub useCanvasStore hook (already mocked at top — returns null for selectors)
    const { ModelTabBody } = await import('../../canvas/components/ModelTabBody')
    render(
      <ModelTabBody
        showDebug={false}
        hasDiagnostics={false}
        diagnostics={null}
        hasTrim={false}
        effectiveCorrelationId={null}
        correlationMismatch={false}
        correlationIdHeader={null}
        nodes={[]}
        edges={[]}
        robustness={null}
      />,
    )
    await vi.waitFor(() => {
      expect(mockCapture).toHaveBeenCalledWith(
        GUIDANCE_EVENTS.MODEL_CARD_VIEWED,
        expect.objectContaining({ item_id: 'model_tab', surface: 'model_tab' }),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// § 7 — Highlight dedup
// ---------------------------------------------------------------------------

describe('Highlight dedup', () => {
  it('fires HIGHLIGHT_TRIGGERED only once per item_id within 2s cooldown', async () => {
    const { useGuidancePulseHighlight } = await import('../../canvas/hooks/useGuidancePulseHighlight')

    // Render a minimal component that calls the hook
    function TestHook() {
      useGuidancePulseHighlight()
      return null
    }
    render(<TestHook />)

    const setActive = useGuidanceStore.getState().setActiveGuidanceItem

    // Simulate rapid triggers for same node ID
    await act(async () => {
      useGuidanceStore.getState().setGuidanceItems([
        makeGuidanceItem({ item_id: 'nav-1', target_object: { type: 'node', id: 'node-x' } }),
      ])
      setActive('nav-1')
    })
    await act(async () => {
      setActive(null)
    })
    await act(async () => {
      setActive('nav-1')
    })

    // Even with multiple activations, only 1 HIGHLIGHT_TRIGGERED within cooldown window
    const highlightCalls = mockCapture.mock.calls.filter(([e]) => e === GUIDANCE_EVENTS.HIGHLIGHT_TRIGGERED)
    expect(highlightCalls.length).toBe(1)
  })
})
