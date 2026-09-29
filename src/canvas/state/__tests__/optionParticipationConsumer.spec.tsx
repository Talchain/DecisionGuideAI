/**
 * The UI consumer of the Run's option-participation fact (carrier CONFIRMED by Runtime, #72 5888341208; DL 5887489508 /
 * 5887510885: "Canvas builds from its typed carrier, with no provenance guess in UI").
 *
 * An option Olumi proposed is either LEFT OUT of the Run (`excluded_olumi_proposed`) or KEPT in a provisional comparison
 * (`kept_olumi_provisional`, naming the user's options that could not be analysed). Before this, an excluded Olumi
 * option has interventions, so the card and the panel read `not_returned` — "The analysis returned no result for this
 * option" — which blames the engine for an option the Run left out on purpose.
 *
 * Canonical's parity rows (5888351928): one contract-validating reader on both legs; a refused array is ABSENT on both;
 * a recorded `[]` stays `[]`; the same Run through the turn and the cold read yields the same report fact.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { AnalysisStateV1, OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'
import { optionParticipationFromResponse, readOptionParticipation } from '../storedOptionParticipation'
import { deriveNotAnalysedReason } from '../../../components/results/utils/notAnalysedOptions'
import {
  OLUMI_PROPOSED_EXCLUDED_COPY,
  notAnalysedActionLabel,
  notAnalysedReasonCopy,
  olumiProposedKeptCopy,
} from '../../../components/results/utils/notAnalysedCopy'
import { OptionNode } from '../../nodes/OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const EXCLUDED = { option_id: 'olumi_bundle', state: 'excluded_olumi_proposed' }
const KEPT = { option_id: 'olumi_bundle', state: 'kept_olumi_provisional', unanalysable_user_option_ids: ['keep_49_price'] }
const KEPT_NO_IDS = { option_id: 'olumi_bundle', state: 'kept_olumi_provisional' }

describe('readOptionParticipation — one contract-validating reader, both legs', () => {
  it('absent → null (not recorded); [] → recorded, none outside the ordinary comparison', () => {
    expect(readOptionParticipation(undefined)).toBeNull()
    expect(readOptionParticipation({})).toBeNull()
    expect(readOptionParticipation([])).toEqual([])
  })
  it('reads both states; the unanalysable list defaults to empty', () => {
    expect(readOptionParticipation([EXCLUDED, KEPT])).toEqual([
      { optionId: 'olumi_bundle', state: 'excluded_olumi_proposed', unanalysableUserOptionIds: [] },
      { optionId: 'olumi_bundle', state: 'kept_olumi_provisional', unanalysableUserOptionIds: ['keep_49_price'] },
    ])
  })
  it('CONTRACT REFUSED → absent: any entry outside the published schema refuses the WHOLE array', () => {
    expect(readOptionParticipation([EXCLUDED, { option_id: 'x', state: 'olumi_maybe' }])).toBeNull()
    expect(readOptionParticipation([{ state: 'excluded_olumi_proposed' }])).toBeNull()
    expect(readOptionParticipation([{ ...KEPT, unanalysable_user_option_ids: [7] }])).toBeNull()
    // DL CHANGES_REQUIRED @ ddf47006: present-empty ids, an exclusion naming ids, an undeclared key
    expect(readOptionParticipation([{ ...KEPT, unanalysable_user_option_ids: [] }])).toBeNull()
    expect(readOptionParticipation([{ ...EXCLUDED, unanalysable_user_option_ids: ['keep_49_price'] }])).toBeNull()
    expect(readOptionParticipation([{ ...EXCLUDED, reason: 'olumi' }])).toBeNull()
  })
  it('a keep WITHOUT ids is valid (the user named fewer than two options): read with an empty list', () => {
    expect(readOptionParticipation([KEPT_NO_IDS])).toEqual([{ optionId: 'olumi_bundle', state: 'kept_olumi_provisional', unanalysableUserOptionIds: [] }])
  })
  it('the turn key is read top level first, then the additive sidecar', () => {
    expect(optionParticipationFromResponse({ option_participation: [EXCLUDED] })).toEqual([EXCLUDED])
    expect(optionParticipationFromResponse({ __additive__: { option_participation: [KEPT] } })).toEqual([KEPT])
  })
})

const BLOCK = {
  type: 'analysis_result' as const,
  summary: 's',
  leading_option_id: 'raise_to_59',
  enrichment: {
    option_comparison: [
      { id: 'keep_49_price', option_id: 'keep_49_price', label: 'Keep £49 price', option_label: 'Keep £49 price', status: 'computed', win_probability: 0.2 },
      { id: 'raise_to_59', option_id: 'raise_to_59', label: 'Raise to £59', option_label: 'Raise to £59', status: 'computed', win_probability: 0.8 },
    ],
  },
}

function turnReport(extra: Record<string, unknown>) {
  const resultsComplete = vi.fn()
  const store = {
    setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
    setAnalysisFreshness: vi.fn(), resultsComplete, nodes: [], edges: [], currentResultsHash: null,
  } as unknown as V5ApplicatorStore
  const response = { response_version: 2, assistant_text: '', blocks: [BLOCK], suggested_actions: [], insights: [], stage_indicator: 'frame', ...extra } as unknown as OlumiResponse
  applyV5State(response, store)
  expect(resultsComplete, 'the turn leg must hydrate the report').toHaveBeenCalledTimes(1)
  return resultsComplete.mock.calls[0][0].report as Record<string, unknown>
}

const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-09-29T10:00:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1

function readReport(optionParticipation: unknown) {
  const resultsComplete = vi.fn()
  const store = { setAnalysisStateV1: vi.fn(), resultsComplete, setLimitVerdicts: vi.fn(), currentResultsHash: null, currentScenarioId: 'scn-1' } as unknown as ScenarioAnalysisApplyStore
  applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, optionParticipation, store })
  expect(resultsComplete, 'the read leg must hydrate the report').toHaveBeenCalledTimes(1)
  return resultsComplete.mock.calls[0][0].report as Record<string, unknown>
}

describe('fresh Run (turn) and cold reload (read): the same Run yields the same report fact (parity)', () => {
  it('FRESH: both legs carry the fact, identically', () => {
    const turn = turnReport({ option_participation: [EXCLUDED] }).option_participation
    const read = readReport([EXCLUDED]).option_participation
    expect(turn).toEqual([{ optionId: 'olumi_bundle', state: 'excluded_olumi_proposed', unanalysableUserOptionIds: [] }])
    expect(read).toEqual(turn)
  })
  it('KEPT with and without ids: both legs carry each identically', () => {
    for (const raw of [[KEPT], [KEPT_NO_IDS]]) {
      const turn = turnReport({ option_participation: raw }).option_participation
      expect(turn).toEqual(readOptionParticipation(raw))
      expect(readReport(raw).option_participation).toEqual(turn)
    }
  })
  it('RECORDED EMPTY stays [] on both legs; NOT RECORDED and CONTRACT REFUSED are absent on both', () => {
    expect(turnReport({ option_participation: [] }).option_participation).toEqual([])
    expect(readReport([]).option_participation).toEqual([])
    expect('option_participation' in turnReport({})).toBe(false)
    expect('option_participation' in readReport(undefined)).toBe(false)
    expect('option_participation' in turnReport({ option_participation: [{ option_id: 'x', state: 'nope' }] })).toBe(false)
    expect('option_participation' in readReport([{ option_id: 'x', state: 'nope' }])).toBe(false)
  })
})

describe('the reason: the Run\'s own word first', () => {
  const edges = [{ source: 'olumi_bundle', target: 'f1' }]
  it('an excluded Olumi option is `excluded_olumi_proposed`, never the engine-blaming `not_returned`', () => {
    expect(deriveNotAnalysedReason('olumi_bundle', edges, ['olumi_bundle', 'keep_49_price'], () => 2, (id) => id === 'olumi_bundle')).toBe('excluded_olumi_proposed')
  })
  it('CONTROL: without the fact the same option is `not_returned` (today)', () => {
    expect(deriveNotAnalysedReason('olumi_bundle', edges, ['olumi_bundle', 'keep_49_price'], () => 2)).toBe('not_returned')
    expect(deriveNotAnalysedReason('olumi_bundle', edges, ['olumi_bundle', 'keep_49_price'], () => 2, () => false)).toBe('not_returned')
  })
  it('the copy says it is Olumi\'s and not the user\'s, and offers no configure action', () => {
    expect(notAnalysedReasonCopy('excluded_olumi_proposed')).toBe(OLUMI_PROPOSED_EXCLUDED_COPY)
    expect(OLUMI_PROPOSED_EXCLUDED_COPY).not.toMatch(/returned no result/)
    expect(notAnalysedActionLabel('excluded_olumi_proposed')).toBeNull()
  })
  it('the kept sentence names the user\'s unanalysable options', () => {
    expect(olumiProposedKeptCopy(['Keep £49 price'])).toContain('‘Keep £49 price’')
    expect(olumiProposedKeptCopy(['A', 'B', 'C'])).toContain('‘A’, ‘B’ and ‘C’')
    const noIds = olumiProposedKeptCopy([])
    expect(noIds).toContain('fewer than two options of your own')
    expect(noIds).not.toMatch(/analys/i)
  })
})

describe('the option card reads the fact', () => {
  const baseProps = {
    type: 'option', position: { x: 0, y: 0 }, selected: false,
    isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
    dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
  }
  const option = (id: string, label: string) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label, type: 'option' } })
  const factor = { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Bundle uptake', type: 'factor', observedState: { value: 0.2 } } }
  const nodes = [option('keep_49_price', 'Keep £49 price'), option('raise_to_59', 'Raise to £59'), option('olumi_bundle', 'Bundle AI add-on'), factor]
  const edges = [{ id: 'e1', source: 'olumi_bundle', target: 'f1', data: {} }]
  const report = (participation?: unknown) => ({
    option_probabilities: {
      keep_49_price: { status: 'computed', win_probability: 0.2 },
      raise_to_59: { status: 'computed', win_probability: 0.8 },
      ...(participation && (participation as Array<{ state: string }>)[0]?.state === 'kept_olumi_provisional' ? { olumi_bundle: { status: 'computed', win_probability: 0.1 } } : {}),
    },
    ...(participation ? { option_participation: participation } : {}),
  })
  const mount = (id: string) => {
    const n = nodes.find((x) => x.id === id)!
    return render(<ReactFlowProvider><OptionNode {...baseProps} id={n.id} data={n.data} /></ReactFlowProvider>)
  }
  beforeEach(() => {
    useCanvasStore.setState({
      nodes, edges, ceeAnalysisReady: null, viewMode: 'expert',
      analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false, importPendingServerRegistration: false,
    } as never)
  })
  afterEach(cleanup)

  it('EXCLUDED: "Not analysed · Olumi\'s suggestion", and the sentence says why, not "returned no result"', () => {
    useCanvasStore.setState({ results: { status: 'complete', report: report(readOptionParticipation([EXCLUDED])) } } as never)
    mount('olumi_bundle')
    const line = screen.getByTestId('option-not-analysed-olumi_bundle')
    expect(screen.getByTestId('option-not-analysed-olumi-olumi_bundle').textContent).toContain("Olumi's suggestion")
    expect(line.textContent).toContain(OLUMI_PROPOSED_EXCLUDED_COPY)
    expect(line.textContent).not.toMatch(/returned no result/)
  })
  it('CONTROL: no fact → today\'s not-analysed line, with no Olumi tag', () => {
    useCanvasStore.setState({ results: { status: 'complete', report: report() } } as never)
    mount('olumi_bundle')
    expect(screen.getByTestId('option-not-analysed-olumi_bundle')).toBeTruthy()
    expect(screen.queryByTestId('option-not-analysed-olumi-olumi_bundle')).toBeNull()
  })
  it('KEPT: the card is labelled Olumi\'s and names the user\'s option that could not be analysed', () => {
    useCanvasStore.setState({ results: { status: 'complete', report: report(readOptionParticipation([KEPT])) } } as never)
    mount('olumi_bundle')
    const kept = screen.getByTestId('option-participation-kept-olumi_bundle')
    expect(kept.textContent).toContain("Olumi's suggestion")
    expect(kept.textContent).toContain("Olumi's suggestion · compared for now")
    expect(kept.textContent).not.toMatch(/provisional/i)
    expect(kept.textContent).toContain('‘Keep £49 price’')
  })
  it('KEPT WITHOUT ids: the card says why without claiming a failure', () => {
    useCanvasStore.setState({ results: { status: 'complete', report: report(readOptionParticipation([KEPT_NO_IDS])) } } as never)
    mount('olumi_bundle')
    const kept = screen.getByTestId('option-participation-kept-olumi_bundle')
    expect(kept.textContent).toContain('fewer than two options of your own')
    expect(kept.textContent).not.toMatch(/can.t be analysed/)
  })
  it('CONTROL: a user option in the same Run carries no Olumi line', () => {
    useCanvasStore.setState({ results: { status: 'complete', report: report(readOptionParticipation([KEPT])) } } as never)
    mount('raise_to_59')
    expect(screen.queryByTestId('option-participation-kept-raise_to_59')).toBeNull()
    expect(screen.queryByTestId('option-not-analysed-olumi-raise_to_59')).toBeNull()
  })
})
