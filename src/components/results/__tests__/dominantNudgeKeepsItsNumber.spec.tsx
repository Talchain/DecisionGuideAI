/**
 * THE DOMINANT-FACTOR WARNING MUST NOT EVICT THE NUMBER IT EXISTS TO CONVEY.
 *
 * WHY THIS EXISTS
 * ---------------
 * Witnessed on deployed staging (`83f20058`, 1 Sep 2026), the amber nudge
 * rendered as:
 *
 *     ⚠ Dominant factor: two senior engineers have hinted they wo   [Validate]
 *
 * — a hard cut MID-WORD, no ellipsis, 684px of content inside a 317px box. The
 * full sentence ends "…has an influence score of 100%.", so the user never saw
 * the number. A warning that drops its own payload is worse than no warning.
 *
 * THE MECHANISM (confirmed at the bytes, then measured in real Chromium)
 * ---------------------------------------------------------------------
 * The row was `flex … overflow-hidden`. Its first two children were
 * `whitespace-nowrap` with the default `min-width: auto`, so their min-content
 * size IS their full width and they CANNOT shrink. The third child — the one
 * carrying the number — was `flex-1`, i.e. `flex-basis: 0%`. In a shrink pass
 * its scaled shrink factor is `1 × 0 = 0`, so it absorbs nothing and stays at
 * its 0px base while the two nowrap siblings overflow the box. Measured: the
 * metric span rendered **0px wide at every dock width**.
 *
 * ⚠ WHY THIS ASSERTS AT THE **PARENT**, NOT AT A LEAF
 * ---------------------------------------------------
 * `e2e/visual/nodeTextClipping.visual.spec.ts` skips any element with
 * text-bearing children (`if ([...he.children].some(...)) continue`) — leaves
 * only. Here every leaf measures CLEAN: the two nowrap spans are sized to their
 * own content, and the evicted metric span is 0px wide (also below that spec's
 * 4px floor, and outside its `.react-flow__node` scope). The clipping happens
 * at the PARENT. A leaf-level guard is structurally incapable of seeing it, so
 * this binds to the row that holds BOTH children.
 *
 * ⚠ WHAT THIS PROVES, AND WHAT IT DOES NOT
 * ----------------------------------------
 * jsdom has NO LAYOUT, so this proves the CONTAINMENT CONTRACT (the resolved
 * classes on the specific parent and its two specific children), never that a
 * pixel is painted. The pixel claim is made in real Chromium by
 * `e2e/geometry/dominantNudgeNumber.measure.ts`, which measures the painted
 * rect of the number against the row's box. Both are needed: this one runs in
 * the CI ratchet, that one can actually see a pixel.
 *
 * ⚠ THE FIX THAT MEASUREMENT REJECTED. Adding `min-w-0 truncate` to the label
 * alone — the obvious, principled-looking change — REMOVES THE OVERFLOW
 * ENTIRELY (so an overflow-based guard goes green) while the metric span stays
 * 0px and the number is still lost at EVERY width. That is why the assertions
 * below pin the metric's survival, not the absence of overflow.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { TriageActionCardsBody } from '../TriageActionCardsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { DriverItem, DriversSectionData } from '../types'

vi.mock('@/canvas/utils/focusHelpers', () => ({ focusNodeById: vi.fn() }))

/** The label from the live witness — unbounded user data, and the string that evicted the number. */
const WITNESSED_LABEL = 'two senior engineers have hinted they would leave if we outsource'

function makeDriver(factorKey: string, influenceScore: number, factorLabel: string): DriverItem {
  return {
    factorKey, factorLabel, rawElasticity: influenceScore,
    normalisedInfluence: influenceScore, influenceScore,
    displayInfluence: influenceScore, displayProvenance: 'influence_score',
    rank: 1, semanticLabel: 'biggest', canFocus: false, direction: 'positive',
  } as unknown as DriverItem
}

function makeTriageData(drivers: DriverItem[]): ResultsSectionDataReturn {
  const driversData: DriversSectionData = {
    drivers, topDrivers: drivers, driversStatus: 'computed', totalCount: drivers.length,
    hasMagnitudeData: true,
    dominantFactorId: drivers[0]?.factorKey, dominantFactorLabel: drivers[0]?.factorLabel,
  } as unknown as DriversSectionData
  return {
    drivers: driversData,
    recommendation: { recommendedOption: null },
    confidence: { recommendedOptionId: undefined },
    assumptions: { items: [] }, gaps: { items: [] }, risks: { items: [] },
  } as unknown as ResultsSectionDataReturn
}

function renderNudge(label: string) {
  render(
    <TriageActionCardsBody
      data={makeTriageData([makeDriver('f1', 1, label), makeDriver('f2', 0.4, 'Runner up')])}
      suppressTriageQueue
    />,
  )
  return {
    row: screen.getByTestId('t1-dominant-nudge-row'),
    label: screen.getByTestId('t1-dominant-nudge-label'),
    metric: screen.getByTestId('t1-dominant-nudge-metric'),
  }
}

const classes = (el: HTMLElement) => el.className.split(/\s+/).filter(Boolean)

describe('T1 dominant-factor nudge — the number survives its own container', () => {
  it('PRECONDITION: the row holds the label and the metric as DISTINCT children, and the metric carries the number', () => {
    // Trap 13b: without this the assertions below could pass on one element
    // resolving to both roles, or on a row that no longer contains them.
    const { row, label, metric } = renderNudge(WITNESSED_LABEL)
    expect(label, 'label and metric must be different elements').not.toBe(metric)
    expect(row.contains(label) && row.contains(metric), 'both must live inside the measured row').toBe(true)
    expect(label.textContent).toBe(WITNESSED_LABEL)
    expect(metric.textContent).toMatch(/has an influence score of 100%\.$/)
  })

  it('the row can take a second line instead of clipping its children away', () => {
    // PARENT LEVEL. This is where the eviction happens; every leaf measures clean.
    const { row } = renderNudge(WITNESSED_LABEL)
    expect(
      classes(row),
      'the row must wrap — a non-wrapping flex row with unshrinkable nowrap children ' +
        'evicts the trailing metric to 0px, which is the deployed defect',
    ).toContain('flex-wrap')
    expect(
      classes(row),
      'a wrapping row must not also clip: overflow-hidden here is what cut the sentence mid-word',
    ).not.toContain('overflow-hidden')
  })

  it('the metric is never the element that yields — it is not truncated and not zero-basis', () => {
    const { metric } = renderNudge(WITNESSED_LABEL)
    // `truncate` would ellipsise from the END, and the number is the LAST thing
    // in "has an influence score of 100%." — so truncating this span removes
    // precisely the payload.
    expect(classes(metric), 'truncating the metric ellipsises the number away first').not.toContain('truncate')
    // `flex-1` is flex-basis:0% — scaled shrink factor 0, so it never recovers
    // width from unshrinkable siblings. This is the exact deployed mechanism.
    expect(classes(metric), 'flex-basis:0% is what pinned this span at 0px on staging').not.toContain('flex-1')
  })

  it('the unbounded USER string is the thing that yields, and it yields with an ellipsis', () => {
    const { label } = renderNudge(WITNESSED_LABEL)
    expect(
      classes(label),
      'the user-supplied label is unbounded and must be the element that ellipsises',
    ).toContain('truncate')
    expect(classes(label), 'the label must be allowed to shrink below its content width').toContain('min-w-0')
  })

  it('a SHORT label reaches the same contract — the defect was never only about long labels', () => {
    // Measured in Chromium: with the short real-capture label "Churn Trend" the
    // number was still lost at every dock width below 480px. The contract must
    // not be label-length dependent.
    const { row, metric } = renderNudge('Churn Trend')
    expect(classes(row)).toContain('flex-wrap')
    expect(classes(metric)).not.toContain('flex-1')
    expect(metric.textContent).toMatch(/100%/)
  })
})
