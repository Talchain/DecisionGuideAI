/**
 * ⭐ Run-4 judge, DL ruling (12 Oct): close the CLASS. No Results, hero, card or chip surface composes a leader claim from
 * a win share ("more runs than any other", "the most runs supported", "ahead of", "out on top", …). Ruling A and the
 * guiding principle: a win share is supporting detail, never a leader and never beside the goal chance as one. The UI
 * composed these lines; CEE sends none. They are removed, and no words replace them.
 *
 * Two envelopes, rendered through the mounted surfaces (ResultsBody, which holds the hero, the option cards and their
 * chips; and the canvas option card in both views):
 *   1. SERVED: run-4 capacity's server read (live/runs/2026-10-12T172858Z/capacity/reads/02-04-before-reopen.json,
 *      UI 616bbf21, CEE a770ce49; graph 3ce5cf5f, leader_licence 'permitted'), through the real read applier.
 *   2. CONSTRUCTED (self-authored, not wire): the same read with every option given a win share and no goal-chance
 *      licence, so every leader arm that a win share opens is reached (hero strong / slight bands, winner, runner-up
 *      near a tie, the other non-winner).
 *
 * CONTRAST: the per-option goal chance CEE served still renders verbatim on the hero.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import served from './fixtures/run4-capacity-served-read-3ce5cf5f.json'
import { applyRealRead } from '../analysis-hero/__tests__/helpers/realScenarioRead'
import { useCanvasStore } from '../../../canvas/store'
import { useCanonicalAnalysisViewStore } from '../../../canvas/stores/canonicalAnalysisViewStore'
import { useResultsSectionData, type ResultsSectionDataReturn } from '../useResultsSectionData'
import { ResultsBody } from '../ResultsBody'
import { OptionNode } from '../../../canvas/nodes/OptionNode'
import { OptionChanceCellProvider } from '../../../canvas/nodes/shared/OptionChanceCellProvider'
import type { OptionResult } from '../types'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual<Record<string, unknown>>('@xyflow/react'), Handle: () => null }))
vi.mock('../../../canvas/utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusByTarget: vi.fn() }))
afterEach(() => {
  cleanup(); vi.unstubAllGlobals()
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

/** The DL's census pattern, verbatim. */
const LEADER_WORDS = /more runs than any other|most runs|ahead of|out on top|highest .* in \d+% of runs|than any other option/i

/** The served goal chance (canonical cell face for 'Add one specialist'), the contrast that must still render. */
const SERVED_CHANCE = served.canonical_analysis_view.options.find(o => o.option_id === 'add_one_specialist')!.cell.face

function resultsText(data: ResultsSectionDataReturn): string {
  const { container } = render(
    <ResultsBody resultsSectionData={data} tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}} onFocusNode={() => {}} isRunning={false} />,
  )
  // Visible text plus every title and accessible label (a chip or tooltip says its words there too).
  const attrs = [...container.querySelectorAll('[title],[aria-label]')]
    .flatMap(el => [el.getAttribute('title'), el.getAttribute('aria-label')]).filter(Boolean)
  const text = [container.textContent ?? '', ...attrs].join('\n')
  cleanup()
  return text
}

function canvasCardsText(): string {
  const out: string[] = []
  for (const viewMode of ['standard', 'detailed'] as const) {
    useCanvasStore.setState({ viewMode } as never)
    for (const node of useCanvasStore.getState().nodes.filter(n => n.type === 'option')) {
      const card = render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode id={node.id} type="option" data={node.data as never}
        selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable selectable draggable />
      </OptionChanceCellProvider></ReactFlowProvider>)
      out.push(card.container.textContent ?? '')
      card.unmount()
    }
  }
  return out.join('\n')
}

/** Each match with a little context either side, so a RED names the sentence. */
const leaderLines = (text: string) =>
  [...text.matchAll(new RegExp(LEADER_WORDS.source, 'gi'))]
    .map(m => text.slice(Math.max(0, m.index! - 70), m.index! + m[0].length + 50).replace(/\s+/g, ' '))

async function servedData() {
  await applyRealRead({ j: served })
  return renderHook(() => useResultsSectionData()).result.current
}

/**
 * Every option carries a win share and there is no goal-chance licence. `hinge`: the runner-up is near the winner and a
 * fragile edge names it; `tie`: the runner-up's share equals the winner's and no hinge is served.
 */
function everyOptionHasAWinShare(data: ResultsSectionDataReturn, separation: 'clear' | 'slight', shape: 'hinge' | 'tie'): ResultsSectionDataReturn {
  const shares: Record<string, number> = { add_one_specialist: 0.4, keep_current_staffing: shape === 'tie' ? 0.4 : 0.39 }
  // The two analysed options keep their identity; a third, constructed option ('Hire a contractor') is the other
  // non-winner. (The served not-analysed suggestion has no win share and keeps its own card.)
  const base = data.recommendation.allOptions.filter(o => o.id in shares)
  expect(base.map(o => o.id).sort()).toEqual(Object.keys(shares).sort())
  const third: OptionResult = { ...base.find(o => o.id === 'add_one_specialist')!, id: 'hire_a_contractor',
    label: 'Hire a contractor', isRecommended: false, isBaseline: false, winProbability: 0.21 } as OptionResult
  const allOptions = [...base.map(o => ({ ...o, winProbability: shares[o.id] })), third]
  const verdict = { ...(data.recommendation.verdict ?? {}), leaderId: 'add_one_specialist', hasLeadingOption: true,
    separation, gapPp: 1, source: 'producer_band' }
  return {
    ...data,
    goalChanceLicence: null,
    recommendation: { ...data.recommendation, allOptions, verdict, leaderDesignationPermitted: true,
      recommendedOption: allOptions.find(o => o.id === 'add_one_specialist')!,
      decisionState: { hinge: shape === 'tie' ? null : { label: 'Additional specialist capacity',
        nodeId: 'additional_specialist_capacity', kind: 'edge', reason: 'fragile_edge', edgeDetail: null,
        alternativeWinnerLabel: 'Keep current staffing' } },
    },
  } as unknown as ResultsSectionDataReturn
}

describe('run 4: no surface composes a leader claim from a win share (the class, DL 12 Oct)', () => {
  it('⭐ SERVED run-4 capacity: Results (hero, cards, chips) and the canvas cards say no leader words', async () => {
    const data = await servedData()
    expect(leaderLines(resultsText(data))).toEqual([])
    expect(leaderLines(canvasCardsText())).toEqual([])
  })

  it('CONTRAST: the served goal chance still renders verbatim on the hero', async () => {
    const data = await servedData()
    expect(SERVED_CHANCE).toMatch(/about 36% chance of meeting your goal/)
    expect(resultsText(data)).toContain(SERVED_CHANCE)
  })

  it.each([['clear', 'hinge'], ['slight', 'hinge'], ['clear', 'tie']] as const)('⭐ CONSTRUCTED, every option with a win share (%s band, %s): no leader words anywhere', async (separation, shape) => {
    const data = everyOptionHasAWinShare(await servedData(), separation, shape)
    expect(data.recommendation.allOptions.every(o => typeof o.winProbability === 'number')).toBe(true)
    expect(leaderLines(resultsText(data))).toEqual([])
  })
})
