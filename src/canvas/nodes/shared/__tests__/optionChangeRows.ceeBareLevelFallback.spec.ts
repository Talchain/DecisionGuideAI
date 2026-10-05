/**
 * ⭐ "Developers 4 developers → 0.2" READS "4 → 6 developers" (Paul's staging test, 5 Oct 2026; DL 0df0e1).
 *
 * CEE's label-echo rule (olumi-assistants-service `src/cee/transforms/analysis-ready.ts:752`) replaces a synthesised
 * display that contains the factor's label with the bare normalised level: "6 developers" on "Developers" → "0.2".
 * The card printed that verbatim beside the factor's own "4 developers".
 *
 * Fixtures are the WRITER's shapes (CEE @5f5f2199 `admit-model.ts`: the Olumi-estimate factor baseline
 * `observed_state = {value: raw/frame, raw_value, unit}` with the frame on the node's `scale_frame`; the option level
 * `{value: figure/frame, source, target_match}` with or without its raw anchor; `analysis-ready.ts` detail
 * `display_value: "0.2"` after the echo rule). Driven through the card's own row path: `resolveOptionTargets` (the
 * CEE join) → `buildOptionTargetRow` → `buildOptionChangeRow`. Bound by factor id and the row's exact text.
 */
import { describe, it, expect } from 'vitest'
import { resolveOptionTargets, buildOptionTargetRow } from '../optionTargetDisplay'
import { carriedInterventionDisplay } from '../../../utils/interventionDisplay'

const FAC = 'fac_dev'
const factorNode = (label: string, extra: Record<string, unknown> = {}) => ({
  id: FAC,
  type: 'factor',
  data: {
    label,
    observedState: { value: 4 / 30, raw_value: 4, unit: 'developers', source: 'cee_inference', extractionType: 'inferred' },
    scale_frame: 30,
    ...extra,
  },
})
const targetMatch = { node_id: FAC, match_type: 'exact_id', confidence: 'high' }
/** B1: the level carries its raw anchor (admit-model `constructedLevel`, cap matches the frame). */
const B1_LEVEL = { value: 0.2, source: 'cee_hypothesis', target_match: targetMatch, raw_value: 6, unit: 'developers' }
/** B2: a bare level, the frame only on the node. */
const B2_LEVEL = { value: 0.2, source: 'cee_hypothesis', target_match: targetMatch }
/** `analysis_ready` for the option, after CEE's echo rule turned "6 developers" into "0.2". */
const ceeOption = (displayValue: string) => ({
  id: 'opt_hire',
  interventions: { [FAC]: 0.2 },
  raw_interventions: { [FAC]: 6 },
  intervention_details: { [FAC]: { display_value: displayValue, normalised_value: 0.2, raw_value: 6, unit: 'developers' } },
})

function cardRow(level: Record<string, unknown>, displayValue: string, node: unknown = factorNode('Developers')) {
  const targets = resolveOptionTargets({ interventions: { [FAC]: level } }, ceeOption(displayValue) as never)
  const target = targets.get(FAC)
  expect(target, 'the joined target for fac_dev').toBeDefined()
  return buildOptionTargetRow({ factorId: FAC, target: target!, factorNode: node as never, baselineReference: null })
}

describe('⭐ Paul\'s test: CEE\'s bare-level fallback beside a real unit and a scale', () => {
  it('⭐ B1 (raw-anchored level): "4 developers → 0.2" now reads "4 → 6 developers"', () => {
    const row = cardRow(B1_LEVEL, '0.2')
    expect(row.factorId).toBe(FAC)
    expect(row.change).toBe('4 → 6 developers')
    expect(row.change).not.toMatch(/0\.2/)
  })

  it('⭐ B2 (bare level, frame only on the node): the same reading', () => {
    const row = cardRow(B2_LEVEL, '0.2')
    expect(row.change).toBe('4 → 6 developers')
  })
})

describe('CEE\'s value still prints whenever it is not that fallback, or a unit or scale is missing', () => {
  it('⭐ after CEE-ECHO-F1 the wire carries "6 developers" on "Developers": read once, never converted twice', () => {
    // CEE #2578 keeps a reading synthesised from the option's own figure, so the detail is the quantity itself. The
    // workaround above stays for stored pre-fix payloads (a cold reload of an older Run) and must not touch this one.
    const row = cardRow(B1_LEVEL, '6 developers')
    expect(row.change).toBe('4 → 6 developers')
    expect(carriedInterventionDisplay({ label: 'Developers', value: 0.2, displayValue: '6 developers', unit: 'developers', cap: 30 }))
      .toBe('6 developers')
  })

  it('control: a real CEE reading ("6 developers", label not echoed) prints as it did', () => {
    const row = cardRow(B1_LEVEL, '6 developers', factorNode('Team size'))
    expect(row.change).toBe('4 → 6 developers')
  })

  it('no unit on the factor: CEE\'s "0.2" stands (nothing to denormalise into)', () => {
    const node = { id: FAC, type: 'factor', data: { label: 'Developers', observedState: { value: 4 / 30, raw_value: 4 }, scale_frame: 30 } }
    const row = cardRow(B2_LEVEL, '0.2', node)
    expect(row.after ?? row.change).toMatch(/0\.2/)
  })

  it('no scale recoverable (no frame, no cap, no raw anchor): CEE\'s "0.2" stands', () => {
    expect(carriedInterventionDisplay({ label: 'Developers', value: 0.2, displayValue: '0.2', unit: 'developers' })).toBe('0.2')
  })

  it('a display that is NOT this level\'s bare fallback (another number) stands', () => {
    expect(carriedInterventionDisplay({ label: 'Developers', value: 0.2, displayValue: '0.25', unit: 'developers', cap: 30 })).toBe('0.25')
  })

  it('the predicate: the fallback with a real unit and a scale is not carried; the same with a suppressed unit is', () => {
    expect(carriedInterventionDisplay({ label: 'Developers', value: 0.2, displayValue: '0.2', unit: 'developers', cap: 30 })).toBeNull()
    expect(carriedInterventionDisplay({ label: 'Developers', value: 0.2, displayValue: '0.2', unit: 'scale', cap: 30 })).toBe('0.2')
  })
})
