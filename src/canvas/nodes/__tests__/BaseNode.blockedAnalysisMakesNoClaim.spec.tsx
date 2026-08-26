/**
 * A BLOCKED ANALYSIS MAY NOT MARK THE USER'S OPTIONS INCOMPLETE.
 *
 * `isIncomplete` renders `data-testid="overlay-missing-value"` and a warning
 * dashed border — a factual claim that this option is missing something.
 *
 * ── WHY IT BECAME FALSE (measured, deployed) ──────────────────────────────
 * The licence for that claim was mere PRESENCE of `ceeAnalysisReady`, and that
 * was safe only because `normaliseV5AnalysisReady` rejected any payload with an
 * empty `goal_node_id` or empty `options`. A blocked refusal was exactly that —
 * witnessed on an authenticated journey:
 *
 *   { options: [], goal_node_id: "", status: "blocked",
 *     blocked_reason: "MISSING_OPTION_VALUE" }
 *
 * So the guard WAS the status check; nothing downstream ever saw a blocked
 * payload. CEE now carries model identity on refusals — correctly, since a
 * refusal that cannot name the model is one a user cannot act on — so the
 * composer returns `{ ...refusal, goal_node_id, options }` with each unvalued
 * option carrying `interventions: {}`. The guard ADMITS, and every unvalued
 * option on a blocked run was marked incomplete.
 *
 * ⚠ THE WIRING WAS UNPINNED, WHICH IS WHY THIS FILE EXISTS. Deleting the status
 * gate from `BaseNode` left 842 tests across 46 files GREEN. The predicate had
 * its own unit spec; the LINE THAT USES IT had nothing. A guard that is correct
 * and unreached is not a guard.
 *
 * ── BOTH DIRECTIONS, and the second matters more ─────────────────────────
 * Silencing the TRUE case would be worse than the false one, so the paired case
 * asserts that an option genuinely without interventions on an analysis that
 * DID assess it still renders the marker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

const OPTION_ID = 'opt_rebuild'

/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors the sibling
   OptionNode specs: ReactFlow's NodeProps requires a dozen fields no assertion
   here depends on. */
const baseProps = {
  selected: false,
  dragging: false,
  zIndex: 0,
  isConnectable: false,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  type: 'option',
  deletable: true,
  selectable: true,
  draggable: true,
}

/** An option CEE listed with NO interventions — the shape at issue. */
const UNVALUED_OPTION = { id: OPTION_ID, label: 'Rebuild', interventions: {} }

function withStatus(status: string | undefined) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [{ id: OPTION_ID, type: 'option', data: { type: 'option', label: 'Rebuild' } }],
      edges: [],
      ceeAnalysisReady: { options: [UNVALUED_OPTION], goal_node_id: 'goal_1', status },
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'expert',
    } as never),
  )
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} id={OPTION_ID} data={{ label: 'Rebuild', type: 'option' }} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('a blocked analysis makes no claim about the options', () => {
  it('⛔ BLOCKED — the option is NOT marked incomplete', () => {
    withStatus('blocked')
    expect(screen.queryByTestId('overlay-missing-value')).toBeNull()
  })

  it('⛔ OPPOSITE DIRECTION — an assessed analysis STILL marks it incomplete', () => {
    // The harm this fix must not cause. Same fixture, same empty
    // `interventions`; only the status differs — so a pass here cannot be
    // explained by the option shape, only by the status being consulted.
    withStatus('ready')
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
  })

  it('FAIL-SAFE — an absent status keeps the pre-existing behaviour', () => {
    withStatus(undefined)
    expect(screen.getByTestId('overlay-missing-value')).toBeTruthy()
  })
})
