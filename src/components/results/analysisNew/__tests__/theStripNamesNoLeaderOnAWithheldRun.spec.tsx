/**
 * ⛔ THE STRIP MUST NOT SAY WHAT THE SECTION WAS WITHHELD FOR SAYING.
 *
 * #1941 gates "What would change your mind" on the leader licence. Independent
 * review (5811790177) found that the Model strip still carried the section's
 * rows as mentions. On a withheld run, picking the edge's source node read
 * *"Also in What would change your mind: If "Enterprise price → MRR" changes
 * significantly, "Raise Pro to £59" could lead"*. That names an option that
 * could lead on a run that refused to name one, and it points at a heading
 * that is not on screen.
 *
 * The rule under test: the tab body feeds ONE licence-gated sensitivity list
 * to both the section and the strip's mentions.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openGroupsIfPresent } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { decisionWithLeaderWithheld, genuineDecision, manyFragileEdges, withLeaderLicensed } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const STRIP = 'analysis-new-model-strip'
const FROM = 'f_ent_price'
const TO = 'g_mrr'
const WITNESS_ALT = 'Raise Pro to £59'
const COULD_LEAD = /could lead/i

const NODES = [
  { id: TO, type: 'goal', data: { label: 'MRR' } },
  { id: FROM, type: 'factor', data: { label: 'Enterprise price' } },
]

/** The witnessed fragile edge, joined to a real node by id at both ends. */
const withWitnessedEdge = (base: ResultsSectionDataReturn): ResultsSectionDataReturn => {
  const template = manyFragileEdges().confidence.uncertainties.find((u) => u.code === 'SENSITIVE_ASSUMPTION')
  expect(template, 'PRECONDITION: the fixture carries a fragile-edge row to copy').toBeDefined()
  const sentence = `If "Enterprise price → MRR" changes significantly, "${WITNESS_ALT}" could lead in this model`
  return {
    ...base,
    confidence: {
      ...base.confidence,
      uncertainties: [
        {
          ...template,
          message: sentence,
          displayText: sentence,
          messageWithSubjectNamedAbove: `If this changes significantly, "${WITNESS_ALT}" could lead in this model`,
          edgeFromLabel: 'Enterprise price',
          edgeToLabel: 'MRR',
          edgeLabelsResolved: true,
          edgeFromId: FROM,
          edgeToId: TO,
          affectedNodes: [FROM, TO],
          alternativeWinnerId: 'opt_a',
          alternativeWinnerLabel: WITNESS_ALT,
          switchProbability: 0.24,
        },
      ],
    },
  } as unknown as ResultsSectionDataReturn
}

const previous = { nodes: [] as unknown }
beforeEach(() => {
  previous.nodes = useCanvasStore.getState().nodes
  useCanvasStore.setState({ nodes: NODES, goalThreshold: null } as never)
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: previous.nodes } as never)
})

const renderPanel = (data: ResultsSectionDataReturn) => {
  render(
    <AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="run_witness" />,
  )
  openGroupsIfPresent()
}

/** Pick the edge's source node BY ID, never by position. */
const pickSource = () => {
  // Design B2: the tab's strip is static and its region always mounted.
  expect(screen.getByTestId(`${STRIP}-region`)).toBeInTheDocument()
  const mark = screen.getAllByTestId(`${STRIP}-mark`).find((m) => m.getAttribute('data-node-id') === FROM)
  expect(mark, `no mark for ${FROM}; every assertion after this would be vacuous`).toBeTruthy()
  fireEvent.click(mark as HTMLElement)
  const detail = screen.getByTestId(`${STRIP}-detail`)
  expect(detail).toHaveAttribute('data-node-id', FROM)
  return detail
}

const sensitivityMentions = () =>
  screen
    .queryAllByTestId(`${STRIP}-detail-mention`)
    .filter((el) => el.getAttribute('data-mention-section') === 'sensitivity')

describe('the strip honours the leader licence the section honours', () => {
  /*
   * ⚠⚠ RE-PINNED 26 Sep 2026 (design audit B12). The mark detail no longer
   * carries "Also in …" pointers at all — the V2 prototype's detail has none —
   * so the licensed twin can no longer be a pointer that appears. It is now
   * the contrast that the SECTION carries the edge on a licensed run while
   * the detail repeats none of it: the rule this file exists for (the strip
   * never says what a section was withheld for saying) now holds on every run,
   * because the strip says nothing about sections.
   */
  it('CONTRAST: on a licensed run the section names the edge, and the detail repeats none of it', () => {
    renderPanel(withLeaderLicensed(withWitnessedEdge(genuineDecision())))
    const detail = pickSource()
    const section = screen.getByTestId('analysis-new-sensitivity')
    // The section mounts closed; its rows are read with it open.
    const toggle = screen.getByTestId('analysis-new-sensitivity-toggle')
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    expect(section.textContent ?? '', 'PRECONDITION: the licensed section carries the edge').toContain(
      'Enterprise price → MRR',
    )
    expect(sensitivityMentions()).toHaveLength(0)
    expect(detail.textContent ?? '').not.toContain('Enterprise price → MRR')
  })

  it('⛔ on a withheld run the strip names no option that could lead, and points at no absent section', () => {
    renderPanel(withWitnessedEdge(decisionWithLeaderWithheld()))
    const detail = pickSource()
    expect(screen.queryByTestId('analysis-new-sensitivity'), 'PRECONDITION: the section is withheld').toBeNull()
    expect(sensitivityMentions()).toHaveLength(0)
    expect(detail.textContent ?? '').not.toMatch(COULD_LEAD)
    expect(detail.textContent ?? '', 'no pointer at a section that is not on screen').not.toContain('What would change your mind')
  })
})
