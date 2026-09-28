/**
 * ⭐ AN OPTION CARD TELLS THE TRUTH WHEN `analysis_ready` IS GONE
 * (canvas audit 27 Sep 2026, paul-models POM-3 + POM-2; Paul's own boards).
 *
 * `analysis_ready` lives in session storage; the board restores from the
 * autosave without it (a second tab, the gate's LANDING state, any
 * `setCeeAnalysisReady(null)`). Both findings are that path:
 *
 * POM-3 — 90b8: "£59 for new Pro customers; grandfather existing customers"
 *   read "Baseline option" with no change row, because the label heuristic
 *   matched `existing` — beside "Keep current £49 price", which carries
 *   `is_baseline: true`. Two baselines on one board.
 *
 * POM-2 — 3f89: "Add £99 premium tier" read "£0 / month → 0.495 GBP per month":
 *   the option's internal 0–1 value printed with a real money unit, because no
 *   scale was recoverable (observed value 0, raw 0, no cap).
 *
 * ⚠ IDENTITY: every assertion is bound to a test id carrying the option id and
 * factor id; each absence sits beside a positive control in the same render.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { OptionNode } from '../OptionNode'

/* eslint-disable @typescript-eslint/no-explicit-any -- ReactFlow's NodeProps needs fields no assertion reads. */
const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, type: 'option', deletable: true, selectable: true, draggable: true,
}

function mount(nodes: any[], optionId: string) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes,
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'standard',
    } as never),
  )
  const opt = nodes.find((n) => n.id === optionId)
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} id={optionId} data={opt.data} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => cleanup())

// ── POM-3 (board 90b8f080) ───────────────────────────────────────────────
const PRICE = {
  id: 'fac_pro_plan_price', type: 'factor', position: { x: 0, y: 0 },
  data: { type: 'factor', label: 'Pro plan price', observedState: { value: 0.49, raw_value: 49, unit: 'GBP per month', cap: 100 } },
}
const KEEP = {
  id: 'keep_current_49_price', type: 'option', position: { x: 0, y: 0 },
  data: { type: 'option', label: 'Keep current £49 price', is_baseline: true, interventions: {} },
}
const GRANDFATHER_LABEL = '£59 for new Pro customers; grandfather existing customers'
const grandfather = (extra: Record<string, unknown> = {}) => ({
  id: '146aa89d', type: 'option', position: { x: 0, y: 0 },
  data: { type: 'option', label: GRANDFATHER_LABEL, interventions: { fac_pro_plan_price: { value: 0.59, source: 'user_specified' } }, ...extra },
})

describe('POM-3 · a keyword may not mint a second baseline on a board that declares one', () => {
  it('90b8 with analysis_ready gone: the grandfather option keeps its change row and is not "Baseline option"', () => {
    mount([PRICE, KEEP, grandfather()], '146aa89d')
    // Positive control: the card mounted, and its change row is the one bound to this option + factor.
    expect(screen.getByText(GRANDFATHER_LABEL)).toBeTruthy()
    expect(screen.getByTestId('option-change-row-146aa89d-fac_pro_plan_price')).toBeTruthy()
    expect(screen.queryByTestId('option-baseline-meta-146aa89d')).toBeNull()
  })

  it('MUTANT PAIR — the same label on a board that declares NO baseline still reaches the heuristic', () => {
    const undeclaredKeep = { ...KEEP, data: { ...KEEP.data, is_baseline: undefined } }
    mount([PRICE, undeclaredKeep, grandfather()], '146aa89d')
    expect(screen.getByText(GRANDFATHER_LABEL)).toBeTruthy()
    expect(screen.getByTestId('option-baseline-meta-146aa89d')).toBeTruthy()
  })

  it('a typed false on the node (what the backfill now stamps) also keeps it a real option', () => {
    const undeclaredKeep = { ...KEEP, data: { ...KEEP.data, is_baseline: undefined } }
    mount([PRICE, undeclaredKeep, grandfather({ is_baseline: false })], '146aa89d')
    expect(screen.getByTestId('option-change-row-146aa89d-fac_pro_plan_price')).toBeTruthy()
    expect(screen.queryByTestId('option-baseline-meta-146aa89d')).toBeNull()
  })

  it('CONTRAST — the declared baseline itself is still the baseline', () => {
    mount([PRICE, KEEP, grandfather()], 'keep_current_49_price')
    expect(screen.getByTestId('option-baseline-meta-keep_current_49_price')).toBeTruthy()
  })
})

// ── POM-2 (board 3f89249e) ───────────────────────────────────────────────
const PREMIUM = {
  id: 'fac_premium_monthly_price', type: 'factor', position: { x: 0, y: 0 },
  // CEE put the frame only in node-level `scale_frame` (200); observed_state has no cap.
  data: { type: 'factor', label: 'Premium monthly price', scale_frame: 200, observedState: { value: 0, raw_value: 0, unit: 'GBP per month' } },
}
const SHARE = {
  id: 'fac_premium_subscriber_share', type: 'factor', position: { x: 0, y: 0 },
  data: { type: 'factor', label: 'Premium subscriber share', scale_frame: 100, observedState: { value: 0, raw_value: 0, unit: '% of paying subscribers' } },
}
const STATUS_QUO = {
  id: 'keep_49', type: 'option', position: { x: 0, y: 0 },
  data: { type: 'option', label: 'Keep £49 price', is_baseline: true, interventions: {} },
}
const ADD_PREMIUM = {
  id: 'add_99_premium_tier', type: 'option', position: { x: 0, y: 0 },
  data: {
    type: 'option', label: 'Add £99 premium tier',
    interventions: {
      fac_premium_monthly_price: { value: 0.495, source: 'cee_hypothesis' },
      fac_premium_subscriber_share: { value: 0.1, source: 'cee_hypothesis' },
    },
  },
}

describe('POM-2 · an internal 0–1 value never prints beside a real unit', () => {
  it('3f89 with analysis_ready gone: the price row does not read "0.495 GBP per month"', () => {
    const { container } = mount([PREMIUM, SHARE, STATUS_QUO, ADD_PREMIUM], 'add_99_premium_tier')
    // Positive control: the row for THIS option + factor is on the card.
    const row = screen.getByTestId('option-change-row-add_99_premium_tier-fac_premium_monthly_price')
    // It says what the option DOES — the estate's directional fallback — rather
    // than an arrow pointing at a number in a unit it is not measured in.
    expect(row.textContent).toContain('Increases')
    expect(row.textContent ?? '').not.toMatch(/0\.495/)
    expect(row.textContent ?? '').not.toMatch(/GBP/)
    expect(container.textContent ?? '').not.toMatch(/0\.495/)
  })
})
