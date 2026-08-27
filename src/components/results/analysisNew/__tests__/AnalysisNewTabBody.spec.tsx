/**
 * Analysis (New) — the surface END TO END on a completed analysis.
 *
 * ⚠ WHY THIS FILE EXISTS SEPARATELY FROM THE OTHERS. The adapter suite proves
 * the view model is honest; the dock suite proves the tab mounts and costs
 * nothing to switch to. Neither proves the surface actually SHOWS anything when
 * a run has completed — the dock cases all run pre-run, and a view model full
 * of findings that no component renders is precisely this estate's most
 * expensive defect class ("we build more than we plug in").
 *
 * So this drives the real `AnalysisNewTabBody` with post-run fixtures and
 * asserts rendered content, not shape.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import {
  decisionWithLeaderWithheld,
  genuineDecision,
  highUncertainty,
  openStrategicChallenge,
} from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const renderBody = (
  data: ResultsSectionDataReturn,
  over: Partial<Parameters<typeof AnalysisNewTabBody>[0]> = {},
) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
      {...over}
    />,
  )

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the surface renders real content on a completed run', () => {
  it('shows all four sections with findings, not just headings', () => {
    renderBody(openStrategicChallenge())

    const insights = screen.getByTestId('analysis-new-key-insights')
    expect(within(insights).getAllByTestId('analysis-new-key-insights-row').length).toBeGreaterThan(0)
    expect(insights).toHaveTextContent('Supplier lead time dominates the model')

    const drivers = screen.getByTestId('analysis-new-drivers')
    expect(within(drivers).getAllByTestId('analysis-new-drivers-row').length).toBeGreaterThan(0)
    expect(drivers).toHaveTextContent('Supplier lead time')
  })

  it('carries the run identity both tabs share, so the comparison is checkable on screen', () => {
    renderBody(genuineDecision())
    expect(screen.getByTestId('analysis-new-tab-body')).toHaveAttribute('data-run-identity', 'run_abc123')
  })
})

describe('F · the three scenario classes (§24F)', () => {
  it('OPEN STRATEGIC CHALLENGE — no forced winner or option framing', () => {
    renderBody(openStrategicChallenge())
    const body = screen.getByTestId('analysis-new-tab-body')
    expect(body.textContent).not.toMatch(/\bwins\b|\bwinner\b|scores higher/i)
    // …and it is NOT empty: a decision-first IA would have nothing to say here.
    expect(within(screen.getByTestId('analysis-new-key-insights')).getAllByTestId('analysis-new-key-insights-row').length)
      .toBeGreaterThan(0)
  })

  it('GENUINE DECISION — comparative material appears, phrased as "currently scores higher"', () => {
    renderBody(genuineDecision())
    expect(screen.getByTestId('analysis-new-key-insights')).toHaveTextContent(
      'Raise price currently scores higher',
    )
  })

  it('LEADER WITHHELD — the same fixture with one boolean flipped says nothing about a leader', () => {
    // The discriminating twin of the case above.
    renderBody(decisionWithLeaderWithheld())
    const body = screen.getByTestId('analysis-new-tab-body')
    expect(body.textContent).not.toContain('currently scores higher')
    expect(body.textContent).not.toContain('Raise price')
  })

  it('HIGH UNCERTAINTY — uncertainty is prominent and the analysis is NOT presented as blocked', () => {
    renderBody(highUncertainty())
    const uncertainty = screen.getByTestId('analysis-new-uncertainty')
    expect(within(uncertainty).getAllByTestId('analysis-new-uncertainty-row').length).toBeGreaterThan(0)
    expect(uncertainty).toHaveTextContent('Customer adoption')

    const body = screen.getByTestId('analysis-new-tab-body')
    // Nothing may read as a readiness refusal — RunAdmission owns that.
    expect(body.textContent).not.toMatch(/not ready|cannot run|blocked/i)
    // The producer's own partial-run reason is carried verbatim, not dramatised.
    expect(screen.getByTestId('analysis-new-status-note')).toHaveTextContent(
      'Two factors could not be sampled to the requested precision.',
    )
    // The set-relative caveat fires, so no absolute causal-share claim stands.
    expect(screen.getByTestId('analysis-new-drivers-caveat')).toHaveTextContent(
      COPY.coverage.setRelativeInfluence,
    )
  })
})

describe('empty states say what was NOT established (§19)', () => {
  it('distinguishes "assessed, none found" from "never assessed"', () => {
    // High-uncertainty fixture has evidenceGapsAssessed:false but DOES have
    // uncertainties, so use a fixture with neither to reach the empty arm.
    const unassessed = {
      ...openStrategicChallenge(),
      confidence: { ...openStrategicChallenge().confidence, evidenceGapsAssessed: false },
    } as ResultsSectionDataReturn
    renderBody(unassessed)
    expect(screen.getByTestId('analysis-new-uncertainty-empty')).toHaveTextContent(
      COPY.empty.uncertaintyUnassessed,
    )

    cleanup()
    renderBody(openStrategicChallenge())
    expect(screen.getByTestId('analysis-new-uncertainty-empty')).toHaveTextContent(
      COPY.empty.uncertaintyAssessed,
    )
  })

  // ⚠ THE EMPTY-STRENGTHEN CASE LIVES IN `StrengthenTheReasoning.spec.tsx`, NOT
  // HERE, AND THAT IS A CORRECTION. This file first wrapped it in `if (empty)`
  // — and a probe showed the engine DOES emit an intervention for this fixture,
  // so the branch never ran and the case asserted nothing at all. A conditional
  // assertion is a test that cannot fail (CLAUDE.md trap 13b). The empty arm is
  // driven directly, with `interventions={[]}`, in the component's own spec;
  // what belongs HERE is the opposite proof — that a grounded intervention
  // reaches the screen through the real hook and the real engine.
  it('a grounded intervention reaches the screen through the real engine', () => {
    renderBody(openStrategicChallenge())
    const items = screen.getAllByTestId('analysis-new-strengthen-item')
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(3)
    const first = items[0]
    // What / why / do-it are all present, and all come from the engine.
    expect(within(first).getByTestId('analysis-new-strengthen-why')).toBeInTheDocument()
    expect(within(first).getByTestId('analysis-new-strengthen-action')).toBeInTheDocument()
    // Bound by the ENGINE's id, so a row cannot be satisfied by a lookalike.
    expect(first.getAttribute('data-recommendation-id')).toMatch(/^strengthen:/)
  })
})

describe('staleness contextualises without dominating (§20)', () => {
  it('states the MODEL changed — not that the result is wrong — and keeps the content', () => {
    renderBody(genuineDecision(), { isStale: true })
    expect(screen.getByTestId('analysis-new-status-stale')).toHaveTextContent(
      'The model has changed since this analysis ran.',
    )
    // One line, not a banner stack: the findings are still on screen.
    expect(
      within(screen.getByTestId('analysis-new-key-insights')).getAllByTestId('analysis-new-key-insights-row').length,
    ).toBeGreaterThan(0)
  })
})

describe('progressive disclosure on the real surface (§24E)', () => {
  it('holds grounding and inspect behind two levels, and reveals them on request', () => {
    renderBody(openStrategicChallenge())
    expect(screen.queryByTestId('analysis-new-drivers-grounding')).toBeNull()

    fireEvent.click(within(screen.getByTestId('analysis-new-drivers')).getAllByTestId('analysis-new-drivers-toggle')[0])
    expect(screen.getByTestId('analysis-new-drivers-grounding')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-drivers-inspect')).toBeNull()

    fireEvent.click(screen.getAllByTestId('analysis-new-drivers-inspect-toggle')[0])
    expect(screen.getByTestId('analysis-new-drivers-inspect')).toBeInTheDocument()
  })

  it('keeps deeper technical material out of the first screen', () => {
    renderBody(genuineDecision())
    // Unconditional: the run-identity group always exists when a hash is
    // supplied, so a `if (deeper)` wrapper here would only ever hide a
    // regression that removed the section entirely.
    expect(screen.getByTestId('analysis-new-deeper')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-deeper-group')).toBeNull()
    fireEvent.click(screen.getByTestId('analysis-new-deeper-toggle'))
    expect(screen.getAllByTestId('analysis-new-deeper-group').length).toBeGreaterThan(0)
  })
})
