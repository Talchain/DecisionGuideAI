import { installCanonicalFixtureState } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'
/**
 * MC P0's disclosure for a KEPT leader on the leader's own card (DL fa027 ruling, e8 next row): the finding rests on a
 * deciding link whose figures Olumi supplied (`GOAL_FIGURES_OLUMI_SUPPLIED_LINK`, severity `info`). Science d5's words,
 * on the leader's card only, in every view mode. Harness: `canvasLeaderAdmission.spec.tsx` (the leader card mounted
 * under each admission; Q2 true on `PERMITTED_REPORT`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { withLicensedOptionChances } from './__helpers__/optionChanceFixture'
import {
  LEADER_ID,
  LEADER_LABEL,
  RUNNER_UP_ID,
  RUNNER_UP_LABEL,
  PERMITTED_REPORT,
  WIN_LEADER,
  WIN_RUNNER_UP,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'
import type { AnalysisAdmissionV1 } from '../../../adapters/cee/types'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const NODES = [
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
  { id: 'fac_outreach', type: 'factor', data: { type: 'factor', label: 'Investment firm outreach' } },
  { id: 'out_meetings', type: 'outcome', data: { type: 'outcome', label: 'Investment firm meetings' } },
]
const SUPPLIED = {
  code: 'GOAL_FIGURES_OLUMI_SUPPLIED_LINK', severity: 'info', message: 'Not shown.',
  node_ids: ['fac_outreach', 'out_meetings'], links: [{ from: 'fac_outreach', to: 'out_meetings' }],
}
const WORDS = 'Olumi supplied the figures for the link from ‘Investment firm outreach’ to ‘Investment firm meetings’. Set your own to see how much it matters.'
const PERMITTED: AnalysisAdmissionV1 = { permitted_analysis_mode: 'comparative_leader', reasons: [] }
const REFUSED: AnalysisAdmissionV1 = { permitted_analysis_mode: 'none', reasons: [{ field: 'estimates', message: 'x' }] }

function withStore(admission: AnalysisAdmissionV1, warnings: unknown[], viewMode: 'standard' | 'expert' = 'standard') {
  const state = {
    hoveredOptionId: null,
    nodes: NODES.map(n => ({ ...n, data: { ...n.data, kind: n.type } })),
    hasCompletedFirstRun: true,
    edges: [],
    ceeAnalysisReady: { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: admission },
    results: { status: 'complete', report: withLicensedOptionChances({ ...(PERMITTED_REPORT as object), inference_warnings: warnings }, { [LEADER_ID]: 41, [RUNNER_UP_ID]: 20 }) },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: 100,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    viewMode,
  }
  const installState = installCanonicalFixtureState(state)
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(installState as never))
}
const metadata = (winRate: number) => ({
  sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false, achievementProbability: null,
  stabilityPercentage: null, winRate, isResultsMode: true, predictedOutcome: null, valueOfInformation: null, voiRank: null,
}) as never
const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}
function renderCard(id: string, label: string, winRate: number) {
  vi.mocked(useNodeDisplayMetadata).mockReturnValue(metadata(winRate))
  return render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode {...(baseProps as any)} id={id} data={{ label, type: 'option' }} /></OptionChanceCellProvider></ReactFlowProvider>)
}
const line = (id: string) => screen.queryByTestId(`option-olumi-supplied-figures-${id}`)

beforeEach(() => { cleanup(); vi.clearAllMocks() })

describe('the leader\'s card says whose figures its finding rests on', () => {
  it.each(['standard', 'expert'] as const)('⭐ fa027-shape (a kept leader resting on an Olumi-supplied link), %s view: on the leader\'s card', (mode) => {
    withStore(PERMITTED, [SUPPLIED], mode)
    renderCard(LEADER_ID, LEADER_LABEL, WIN_LEADER)
    expect(screen.getByTestId(`option-win-readout-${LEADER_ID}`)).toBeTruthy() // PRECONDITION: the leader's licensed chance is on screen
    expect(line(LEADER_ID)?.textContent).toBe(WORDS)
  })
  it('CONTROL — the runner-up\'s card, same Run: absent (only the leader\'s finding rests on it)', () => {
    withStore(PERMITTED, [SUPPLIED])
    renderCard(RUNNER_UP_ID, RUNNER_UP_LABEL, WIN_RUNNER_UP)
    expect(screen.getByTestId(`option-win-readout-${RUNNER_UP_ID}`)).toBeTruthy()
    expect(line(RUNNER_UP_ID)).toBeNull()
  })
  it('CONTROL — no Olumi-supplied deciding link: absent on the leader\'s card', () => {
    withStore(PERMITTED, [{ ...SUPPLIED, code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning' }])
    renderCard(LEADER_ID, LEADER_LABEL, WIN_LEADER)
    expect(screen.getByTestId(`option-win-readout-${LEADER_ID}`)).toBeTruthy()
    expect(line(LEADER_ID)).toBeNull()
  })
  it('CONTROL — the model may not name a leader: absent (no card is the leader)', () => {
    withStore(REFUSED, [SUPPLIED])
    renderCard(LEADER_ID, LEADER_LABEL, WIN_LEADER)
    expect(screen.getByText(LEADER_LABEL)).toBeTruthy() // PRECONDITION: the card rendered
    expect(line(LEADER_ID)).toBeNull()
  })
})
