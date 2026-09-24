/**
 * ⛔ "binary" IS A FACTOR TYPE, NOT A UNIT — AND THE REASONING TAB PRINTED IT AS ONE.
 *
 * Served witness, UI `c3a39ae7`, OpenAI path, scenario `3d00c023` (the same run
 * #1933 leader-gated): "Could change if Enterprise tier availability passes 0.9
 * binary". The producer's `flip_thresholds[].unit` carried the factor's TYPE
 * descriptor, `classifyUnit('binary')` answers `'other'` (a real unit, printed
 * as a suffix), and the audit at staging `25314672` traced the same append to
 * three sentences on one tab:
 *
 *   · the glance condition            "passes 0.9 binary"
 *   · the Challenge tipping row       "from 0 binary to 0.9 binary"
 *   · the Sensitivity header's tips   (the same copy function as the row)
 *
 * The estate already owns the rule: `isSuppressedUnit` (`canvas/utils/labelUtils.ts`)
 * names the internal factor-type descriptors that "must never appear in
 * user-facing display" and treats one as NO unit. The factor cards apply it;
 * these two threshold sites did not.
 *
 * ⭐ THE CONTRAST CONTROL IS THE POINT OF THE PAIR. A fix that dropped every
 * unit would pass the binary half, so the same rows with a real unit ('£') must
 * still print it, at the same three sites.
 *
 * ⚠ SCOPE: this pins the TYPE-DESCRIPTOR leak only. Placeholder scale names
 * ('scale', 'index') are a different classification with their own guards.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { openAllSections } from './openNamedGroups'
import { genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

afterEach(cleanup)

/** Shaped to reproduce the witnessed sentence; a fixture, not a wire capture. */
const rowsWithUnit = (unit: string) => [
  {
    label: 'Enterprise tier availability',
    node_id: 'n_enterprise',
    current_value: 0,
    flip_value: 0.9,
    unit,
    flip_reason: 'found',
    alternative_winner_label: 'Hold price',
  },
  // A SECOND found row, so the Sensitivity header (which carries tips after
  // the first; the first is the Challenge row's) has something to render.
  {
    label: 'Partner channel live',
    node_id: 'n_partner',
    current_value: 1,
    flip_value: 0.4,
    unit,
    flip_reason: 'found',
    alternative_winner_label: 'Hold price',
  },
]

/** A PERMITTED run: every site below is leader-gated, so a withheld run would say nothing. */
const permittedWithUnit = (unit: string): ResultsSectionDataReturn => {
  const base = genuineDecision()
  return {
    ...base,
    recommendation: {
      ...base.recommendation,
      flipThresholdsStatus: 'computed',
      flipThresholds: rowsWithUnit(unit),
    },
  } as unknown as ResultsSectionDataReturn
}

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

const BINARY = /\bbinary\b/i

describe('the glance condition', () => {
  it('⛔ a binary-typed threshold states the move, never "binary"', () => {
    const vm = vmOf(permittedWithUnit('binary'))
    expect(vm.leaderClaimPermitted, 'precondition: the licence is granted').toBe(true)
    expect(vm.atAGlance.condition?.text).toBe('Enterprise tier availability moves from 0 to 0.9')
    expect(vm.atAGlance.condition?.quantity?.thresholdText).toBe('0.9')
  })

  it('⛔ the descriptor is suppressed whatever its case', () => {
    expect(vmOf(permittedWithUnit('Binary')).atAGlance.condition?.text).not.toMatch(BINARY)
  })

  it('⭐ CONTRAST: a real unit still prints', () => {
    expect(vmOf(permittedWithUnit('£')).atAGlance.condition?.text).toBe(
      'Enterprise tier availability passes £0.9',
    )
  })
})

describe('the tipping-point sentence (Challenge row and Sensitivity tips share it)', () => {
  it('⛔ a binary-typed threshold reads as a unit-less one', () => {
    const binary = COPY.disclosure.tippingPoint('Enterprise tier availability', 0, 0.9, 'Hold price', 'binary')
    expect(binary).not.toMatch(BINARY)
    // By identity: exactly the sentence the producer's absent unit yields.
    expect(binary).toBe(COPY.disclosure.tippingPoint('Enterprise tier availability', 0, 0.9, 'Hold price', ''))
  })

  it('⭐ CONTRAST: a real unit still prints on both endpoints', () => {
    expect(COPY.disclosure.tippingPoint('Enterprise tier availability', 0, 0.9, 'Hold price', '£')).toBe(
      'Enterprise tier availability would have to rise from £0 to £0.9 before Hold price leads in this model.',
    )
  })
})

describe('mounted: no site on the tab prints "binary" as a unit', () => {
  const renderBody = (data: ResultsSectionDataReturn) =>
    render(
      <AnalysisNewTabBody
        resultsSectionData={data}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_abc123"
      />,
    )

  /**
   * Each site is asserted PRESENT before its text is read, so an absence of
   * "binary" can never be the absence of the sentence.
   */
  const sites = () => ({
    glance: screen.getByTestId('analysis-new-glance-condition').textContent ?? '',
    challenge: screen.getByTestId('analysis-new-signals-tipping-sentence').textContent ?? '',
    sensitivity: screen.getByTestId('analysis-new-sensitivity-tipping-point').textContent ?? '',
  })

  it('⛔ binary: the glance, the Challenge row and the Sensitivity tip all omit it', () => {
    const { container } = renderBody(permittedWithUnit('binary'))
    openAllSections()
    const s = sites()
    expect(s.glance).toContain('Enterprise tier availability moves from 0 to 0.9')
    expect(s.challenge).toContain('Enterprise tier availability would have to rise from 0 to 0.9')
    expect(s.sensitivity).toContain('Partner channel live would have to fall from 1 to 0.4')
    for (const [site, text] of Object.entries(s)) expect(text, site).not.toMatch(BINARY)
    // And nowhere else on the opened tab either.
    expect(container.textContent ?? '').not.toMatch(BINARY)
  })

  it('⭐ CONTRAST: the same rows in £ print the unit at all three sites', () => {
    renderBody(permittedWithUnit('£'))
    openAllSections()
    const s = sites()
    expect(s.glance).toContain('Enterprise tier availability passes £0.9')
    expect(s.challenge).toContain('from £0 to £0.9')
    expect(s.sensitivity).toContain('from £1 to £0.4')
  })
})
