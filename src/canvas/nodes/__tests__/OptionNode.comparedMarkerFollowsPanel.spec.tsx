/**
 * ⭐ THE OPTION MARKER SAYS "COMPARED" ONLY WHERE THE PANEL COUNTS THE OPTION AS COMPARED (R3 F5, #85 5930578606;
 * 52f8cd's F1b predicate, 5930666775; DL 5930585164: "fix the source, not the label").
 * Card state = panel state for each option, across: compared + share · compared + share withheld · left out · no Run.
 * Bound by identity: the marker's testid, the exported constant, and the selector the panel's count shares.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { NOT_RANKED_MARKER, selectOptionComparedInRun } from '../../state/winShareGate'
import { isAnalysedOption } from '../../../components/results/utils/notAnalysedOptions'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

import { useCanvasStore } from '../../store'
import { withLicensedOptionChances } from './__helpers__/optionChanceFixture'
import { GOAL_ANCHOR_COPY } from '../../../components/results/utils/goalAnchorCopy'

const NODE_ID = 'option-1'
const SIBLING_ID = 'option-2'

const makeStoreState = (report: unknown) => ({
  hoveredOptionId: null,
  nodes: [
    { id: NODE_ID, type: 'option', data: { type: 'option', kind: 'option' } },
    { id: SIBLING_ID, type: 'option', data: { type: 'option', kind: 'option' } },
  ],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'complete', report },
  hasCompletedFirstRun: true,
  highlightedNodes: new Set<string>(),
  dimmedNodeIds: new Set<string>(),
  optionNumbering: { [NODE_ID]: 1, [SIBLING_ID]: 2 },
  editedSinceRunNodeIds: new Set<string>(),
  olumiAttention: { nodeIds: [] as string[] },
  analysisHighlight: { source: null, edgeIds: new Set<string>(), nodeIds: new Set<string>() },
  lens: { _dimmedNodeIds: new Set<string>(), _hiddenNodeIds: new Set<string>(), active: 'full' },
  goalThreshold: 100,
  goalConstraints: [],
  lodRung: 'full',
  viewMode: 'expert',
  setHoveredOption: vi.fn(),
  selectNodeWithoutHistory: vi.fn(),
})

const baseProps = {
  id: NODE_ID,
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function renderOption(report: unknown) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)(makeStoreState(report)),
  )
  return render(
    <ReactFlowProvider><OptionChanceCellProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire a Tech Lead', type: 'option' }} />
    </OptionChanceCellProvider></ReactFlowProvider>,
  )
}


const WITHHELD = { permitted: false, producer_cause: 'constraint_verdict_withheld' }

beforeEach(() => {
  vi.clearAllMocks()
})

const marker = () => screen.queryByTestId(`option-not-ranked-${NODE_ID}`)

describe('the option marker follows the panel\'s "was it compared?"', () => {
  it('⭐ compared + share withheld → "Compared · share not shown" (the positive control)', () => {
    renderOption({
      option_probabilities: { [NODE_ID]: { win_probability: 0.53 }, [SIBLING_ID]: { win_probability: 0.21 } },
      producer_leader_permission: WITHHELD,
    })
    expect(marker()).not.toBeNull()
    expect(marker()!.getAttribute('aria-label')).toBe(NOT_RANKED_MARKER)
    expect(screen.queryByTestId(`option-win-readout-${NODE_ID}`)).toBeNull()
  })

  it('⭐ a Run that compared NO option never says "Compared", even with the leader withheld', () => {
    // The discriminating row: the left-out branch stands down when the Run analysed no option at all
    // (`runAnalysedAnyOption` false), so before the F1b gate this card read "Compared · share not shown".
    renderOption({ option_probabilities: {}, producer_leader_permission: WITHHELD })
    expect(screen.getByText('Hire a Tech Lead')).toBeInTheDocument()
    expect(marker()).toBeNull()
  })

  it('a left-out option (its sibling was compared) never says "Compared"', () => {
    renderOption({ option_probabilities: { [SIBLING_ID]: { win_probability: 0.6 } }, producer_leader_permission: WITHHELD })
    expect(screen.getByText('Hire a Tech Lead')).toBeInTheDocument()
    expect(marker()).toBeNull()
  })

  it('compared + licensed chance → the chance, never the marker', () => {
    renderOption(withLicensedOptionChances({ option_probabilities: { [NODE_ID]: { win_probability: 0.53 }, [SIBLING_ID]: { win_probability: 0.21 } } }, { [NODE_ID]: 41, [SIBLING_ID]: 29 }))
    expect(screen.getByTestId(`option-win-readout-${NODE_ID}`)).toHaveTextContent(GOAL_ANCHOR_COPY.phrase('41%', false))
    expect(marker()).toBeNull()
  })

  it('the selector IS the panel\'s predicate on a complete Run, and false with no Run', () => {
    const probs = { [NODE_ID]: { win_probability: 0.4 } }
    const complete = { results: { status: 'complete', report: { option_probabilities: probs } } }
    for (const id of [NODE_ID, SIBLING_ID]) {
      expect(selectOptionComparedInRun(complete, id)).toBe(isAnalysedOption(probs, id))
    }
    expect(selectOptionComparedInRun(complete, NODE_ID)).toBe(true)
    expect(selectOptionComparedInRun({ results: { status: 'idle', report: { option_probabilities: probs } } }, NODE_ID)).toBe(false)
    expect(selectOptionComparedInRun({ results: null }, NODE_ID)).toBe(false)
  })
})
