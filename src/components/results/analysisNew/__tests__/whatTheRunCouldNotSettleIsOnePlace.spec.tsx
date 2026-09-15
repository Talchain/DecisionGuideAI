/**
 * ⭐⭐ §4 — WHAT THE RUN COULD NOT SETTLE LIVES IN ONE PLACE.
 *
 * ── WHAT WAS MEASURED, AND WHAT IT KILLED ──────────────────────────────────
 * Paul's complaint was that the lower panel "becomes more and more copy and
 * therefore just completely unhelpful". The obvious diagnosis — the hedges are
 * repetitive — was MEASURED AND REFUTED. On a reconstruction of the run he
 * screenshotted (no success target, three engine critiques, stale, leader
 * withheld) the panel renders EIGHT distinct "could not establish" statements
 * and only two are anything like duplicates; the chip/meaning pairs in
 * `WhatWeChecked` are a deliberate label-plus-expansion, not repetition.
 *
 * ⛔ So this is a RE-COMPOSITION, NOT A CULL. Every sentence is load-bearing and
 * several were written to close a specific fabrication — the estate has already
 * caught and reverted "improvements" to three of them. Nothing is deleted here.
 *
 * ⭐ THE ACTUAL CAUSE IS LOCATION. One category of information was spread over
 * SIX places: the critique strip, the inference strip, the glance's staleness
 * ribbon, this checks readout (12th), "Uncertainty and gaps" (18th) and the
 * value-of-information line (19th). A reader met the same kind of statement six
 * times, in six registers, never knowing they had seen the set.
 *
 * ── ⚠ WHAT DELIBERATELY DID NOT MOVE ───────────────────────────────────────
 * The two top strips stay above the glance, because
 * `mounts the warning strip ABOVE the glance, not below the sections` pins them
 * there and the reasoning is right: an engine critique qualifies the WHOLE run,
 * so a reader must meet it before the reading it qualifies. Moving it down
 * would be the fabrication risk this plan's own rule forbids — a claim
 * separated from its entitlement.
 *
 * This file pins the two that were merely far apart, and asserts the rulings
 * that constrain them still hold.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { manyFragileEdges } from './analysisNewFixtures'

const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the run-could-not-settle block is contiguous', () => {
  it('PRECONDITION: this fixture mounts both halves', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={manyFragileEdges()}
        isPreRun={false} isRunning={false} isStale={true} responseHash="s4"
      />,
    )
    expect(screen.getByTestId('analysis-new-checks')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-uncertainty')).toBeInTheDocument()
  })

  /**
   * ⭐ ADJACENCY, DERIVED — not "uncertainty comes after checks", which was
   * already true when they were SIX SECTIONS APART and is therefore the
   * assertion that would have passed throughout the defect. This asserts no
   * OTHER panel section renders between them, which is the property that
   * actually changed.
   */
  it('nothing renders BETWEEN the checks readout and the uncertainty section', () => {
    const { container } = render(
      <AnalysisNewTabBody
        resultsSectionData={manyFragileEdges()}
        isPreRun={false} isRunning={false} isStale={true} responseHash="s4"
      />,
    )
    const checks = screen.getByTestId('analysis-new-checks')
    const uncertainty = screen.getByTestId('analysis-new-uncertainty')
    expect(precedes(checks, uncertainty), 'checks must still come first').toBe(true)

    /* ⛔⛔ DERIVED, NOT HAND-LISTED — AND THE HAND-LIST HAD A HOLE.
       This filtered against a typed set of eight section ids. It omitted
       `analysis-new-decision-voi-section`, which is a real top-level section
       AND a member of the very "what this run could not settle" family this
       file exists to keep contiguous. So the value-of-information block could
       render BETWEEN checks and uncertainty and the adjacency assertion would
       not see it — the guard passing while the property it guards had gone.

       ⚠ A hand-maintained mirror of the surface's sections (trap 12), inside a
       guard about the surface's structure. Third collection gap found tonight
       by auditing what a rule COLLECTS rather than what it asserts.

       ⭐ NOW DERIVED FROM THE RENDER: every `analysis-new-*` element that is
       not nested inside another one is a top-level block, whatever it is
       called. A section added tomorrow is covered without anyone remembering
       to list it — and if one is added BETWEEN these two, this REDs. */
    /* ⚠ THE CONTAINER IS EXCLUDED FIRST, and my own PRECONDITION below caught
       its absence: `analysis-new-tab-body` is itself an `analysis-new-*`
       element, so a bare "not nested in another match" filter collapses the
       whole surface to the wrapper and returns ONE section. The same wrapper
       swallowed an earlier measurement on this panel — a container that
       matches the pattern it contains. */
    const body = container.querySelector<HTMLElement>('[data-testid="analysis-new-tab-body"]')
    expect(body, 'PRECONDITION: the tab body must render').not.toBeNull()
    const all = [...body!.querySelectorAll<HTMLElement>('[data-testid^="analysis-new-"]')]
    const sections = all.filter((el) => !all.some((o) => o !== el && o.contains(el)))
    expect(
      sections.length,
      'PRECONDITION: the derivation must yield several sections, not the wrapper alone',
    ).toBeGreaterThan(3)
    const order = sections.map((el) => el.getAttribute('data-testid'))
    const i = order.indexOf('analysis-new-checks')
    const j = order.indexOf('analysis-new-uncertainty')
    expect(i, 'PRECONDITION: checks must be in the ordered set').toBeGreaterThan(-1)
    expect(j, 'PRECONDITION: uncertainty must be in the ordered set').toBeGreaterThan(-1)
    expect(
      order.slice(i + 1, j),
      'the two halves of "what this run could not settle" must be contiguous — ' +
        `found between them: ${order.slice(i + 1, j).join(', ') || '(nothing)'}`,
    ).toEqual([])
  })

  /**
   * ⚠ THE RULINGS THIS MOVE HAD TO RESPECT, ASSERTED RATHER THAN ASSUMED.
   * Both were derived before moving anything; a later change that satisfies the
   * adjacency above by dragging the block upward would break these instead of
   * passing silently.
   */
  it('the constraining rulings still hold', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={manyFragileEdges()}
        isPreRun={false} isRunning={false} isStale={true} responseHash="s4"
      />,
    )
    const strengthen = screen.getByTestId('analysis-new-strengthen')
    const sensitivity = screen.getByTestId('analysis-new-sensitivity')
    const checks = screen.getByTestId('analysis-new-checks')
    const uncertainty = screen.getByTestId('analysis-new-uncertainty')

    expect(precedes(strengthen, checks), 'coaching stays above the detail').toBe(true)
    expect(precedes(strengthen, uncertainty), 'coaching stays above the detail').toBe(true)
    expect(precedes(sensitivity, uncertainty), '"what would change your mind" stays above').toBe(true)
  })

  /**
   * ⭐ THE DISCRIMINATOR. Without it the adjacency case passes on a panel that
   * renders only one of the two — which is a different product, not a tidier
   * one, and is exactly the shape a careless gate change would produce.
   */
  it('DISCRIMINATOR: adjacency is not absence', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={manyFragileEdges()}
        isPreRun={false} isRunning={false} isStale={true} responseHash="s4"
      />,
    )
    expect(screen.getAllByTestId('analysis-new-checks')).toHaveLength(1)
    expect(screen.getAllByTestId('analysis-new-uncertainty')).toHaveLength(1)
    expect(
      (screen.getByTestId('analysis-new-uncertainty').textContent ?? '').length,
      'the section must carry content, not merely a heading',
    ).toBeGreaterThan(20)
  })
})
