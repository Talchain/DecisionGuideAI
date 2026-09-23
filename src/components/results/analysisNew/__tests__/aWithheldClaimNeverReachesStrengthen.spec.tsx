/**
 * ⭐⭐ A CLAIM THE RUN WITHHOLDS NEVER REACHES "STRENGTHEN THE REASONING" — THE
 * SURFACE THE READER ACTUALLY SEES, FED BY A REAL WIRE CAPTURE.
 *
 * The engine-level rule is pinned in
 * `strengthen/__tests__/reviewCardsObeyTheRunsClaimLicence.spec.ts`. This file
 * pins the CHAIN, because a green engine says nothing about a panel whose
 * builder forgot to thread the licence (CLAUDE.md: execute the top of the
 * chain):
 *
 *   captured CEE turn body
 *     → parseV5Response → extractPhase3FromV5Response → toStoreGuidanceItem
 *       (the real ingestion chain, useConversation)
 *     → buildStrengthenInputsForAnalysisNew   (threads the two licence inputs)
 *     → buildRecommendations                   (the phase-3 promotion)
 *     → <StrengthenTheReasoning />             (`analysis-new-strengthen-why`)
 *
 * ## ⚠ THE CORPUS IS NOT SELF-AUTHORED
 *
 * The review cards are the producer's own, from the committed staging capture
 * `live-analysis-turn-T3-20260808T155759Z.json` (`decision_review_enricher`):
 * an ANALYSIS_NARRATIVE that ranks a leader by 56 percentage points, a
 * PRE_MORTEM that presupposes it, a FRAGILE_RESULT that grades the ordering, and
 * three ASSUMPTION_CHECK cards. Only the ADMISSION is supplied here — the one
 * axis this file moves.
 *
 * ## ⚠ BOUND BY IDENTITY
 *
 * Rows are selected by `data-recommendation-id`, i.e. `strengthen:phase3:` + the
 * capture's own `block_id`. The absence assertions are paired with a CONTRAST
 * run (licence granted) on the same capture, which proves the same three rows
 * DO render when the run permits them — without it every absence below could
 * be passing because the capture never reached the panel at all.
 */

import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { buildStrengthenInputsForAnalysisNew } from '../buildStrengthenInputsForAnalysisNew'
import { buildRecommendations } from '../../strengthen/buildRecommendations'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { GuidanceItem } from '../../../../canvas/stores/guidanceStore'
import { parseV5Response } from '../../../../v5/responseParser'
import { extractPhase3FromV5Response } from '../../../../v5/extractPhase3FromV5Response'
import { toStoreGuidanceItem } from '../../../../canvas/conversation/useConversation'
import liveTurnBody from '../../../../v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

/** The capture's own `block_id`s — identity anchors, never a text predicate. */
const BLOCK = {
  narrative: '4440b6a7-f373-567c-8c4b-38f46328b785', // ANALYSIS_NARRATIVE, rank 10
  preMortem: '2ac3d62a-9082-54fa-b0bd-853026f5fe7f', // PRE_MORTEM, rank 20
  fragile: '08691ec5-7cce-5ab0-831c-6c80085c22b3', // FRAGILE_RESULT, rank 50
  assumption: '7f8eb83e-e9fd-569c-9dcb-6288d1f8f7cd', // ASSUMPTION_CHECK, rank 71
} as const
const rowId = (blockId: string) => `strengthen:phase3:${blockId}`

/** Drive the capture through the REAL exported ingestion chain. */
async function ingestCapture(): Promise<GuidanceItem[]> {
  const res = new Response(JSON.stringify(liveTurnBody), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  const parsed = await parseV5Response(res)
  if (parsed.kind !== 'response') throw new Error(`capture failed to parse: ${parsed.kind}`)
  return extractPhase3FromV5Response(parsed.response).guidanceItems.map(toStoreGuidanceItem)
}

/**
 * The run's admission is the ONLY axis that moves. `quantified_provisional` is
 * the witnessed mode: figures admitted, no leader, no strength word. The
 * composed leader answer is set to match, exactly as `useResultsSectionData`
 * publishes it for that mode.
 */
const run = (licensed: boolean): ResultsSectionDataReturn =>
  ({
    recommendation: {
      analysisStatus: 'computed',
      goalThreshold: 62,
      hasGoalTarget: true,
      leaderDesignationPermitted: licensed,
      analysisAdmission: {
        permitted_analysis_mode: licensed ? 'comparative_leader' : 'quantified_provisional',
      },
      verdict: { hasLeadingOption: true, separation: 'clear' },
      allOptions: [],
      recommendedOption: null,
      flipThresholds: null,
    },
    confidence: { challengeFragileEdges: [], robustnessStatus: null, robustnessLevel: null },
    drivers: { drivers: [] },
  }) as unknown as ResultsSectionDataReturn

async function renderPanel(licensed: boolean): Promise<void> {
  const guidanceItems = await ingestCapture()
  const recs = buildRecommendations(
    buildStrengthenInputsForAnalysisNew({
      data: run(licensed),
      guidanceItems,
      biasSignals: null,
      currentStage: null,
    }),
  )
  render(<StrengthenTheReasoning interventions={recs} />)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
}

const renderedRowIds = (): string[] =>
  screen
    .queryAllByTestId('analysis-new-strengthen-item')
    .map((r) => r.getAttribute('data-recommendation-id') ?? '')

/**
 * The row's reading line. Only the OPEN row mounts `-why`; a closed row renders
 * the SAME `strengthenWhyLine(signal, whyNow)` under `-summary`. Either is the
 * sentence the reader meets, so either is accepted — never neither.
 */
const whyLine = (r: HTMLElement): HTMLElement => {
  const el = r.querySelector<HTMLElement>(
    '[data-testid="analysis-new-strengthen-why"], [data-testid="analysis-new-strengthen-summary"]',
  )
  expect(el, 'the row rendered no reading line').toBeTruthy()
  return el as HTMLElement
}

/** The section's list, by the `id` its show-more control's `aria-controls` names. */
const list = (): HTMLElement => {
  const el = document.getElementById('analysis-new-strengthen-list')
  expect(el, 'the Strengthen list did not render').toBeTruthy()
  return el as HTMLElement
}

const row = (id: string): HTMLElement => {
  const found = screen
    .getAllByTestId('analysis-new-strengthen-item')
    .find((r) => r.getAttribute('data-recommendation-id') === id)
  expect(found, `row ${id} did not render`).toBeTruthy()
  return found as HTMLElement
}

beforeEach(() => {
  cleanup()
  useStrengthenStore.getState()._reset()
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom */
  }
})

describe('Strengthen the reasoning shows no review-card claim the run withholds', () => {
  it('quantified_provisional: the narrative, pre-mortem and robustness cards are absent; the assumption is shown verbatim', async () => {
    await renderPanel(false)
    const ids = renderedRowIds()
    // Anti-vacuity: the section rendered rows at all.
    expect(ids.length).toBeGreaterThan(0)

    expect(ids).not.toContain(rowId(BLOCK.narrative))
    expect(ids).not.toContain(rowId(BLOCK.preMortem))
    expect(ids).not.toContain(rowId(BLOCK.fragile))

    // ⭐ The freed slot reaches a real finding — the assumption card, which the
    // three claim cards used to push past the four-row budget on this capture.
    expect(whyLine(row(rowId(BLOCK.assumption)))).toHaveTextContent(
      'The relationship from User Adoption Uncertainty to Sales Team Productivity',
    )

    // And the claims' own sentences are nowhere in the section.
    const section = list()
    expect(section).not.toHaveTextContent('leads by a substantial 56 percentage points')
    expect(section).not.toHaveTextContent('Imagine this decision has failed')
    expect(section).not.toHaveTextContent('The ordering holds in about 75% of variations')
  })

  it('CONTRAST: comparative_leader on the SAME capture renders all three claim cards', async () => {
    await renderPanel(true)
    const ids = renderedRowIds()
    expect(ids).toContain(rowId(BLOCK.narrative))
    expect(ids).toContain(rowId(BLOCK.preMortem))
    expect(ids).toContain(rowId(BLOCK.fragile))
    // The same sentence the withheld arm asserts absent, present here — so that
    // absence is a finding about the licence, not about the probe.
    expect(whyLine(row(rowId(BLOCK.narrative)))).toHaveTextContent(
      'leads by a substantial 56 percentage points',
    )
    expect(list()).toHaveTextContent('leads by a substantial 56 percentage points')
  })
})
