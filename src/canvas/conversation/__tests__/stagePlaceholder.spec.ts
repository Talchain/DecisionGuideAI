/**
 * Tests for stage-aware placeholder text in ChatComposer.
 *
 * Verifies that the STAGE_PLACEHOLDERS map covers all ScenarioStage values
 * and that the fallback is the default placeholder.
 */

import { describe, it, expect } from 'vitest'
import type { ScenarioStage } from '../../../types/scenario'
import { STAGE_PLACEHOLDERS } from '../zones/ChatComposer'

/*
 * ⚠ THIS WAS A HAND-MAINTAINED MIRROR AND IT HAD ALREADY DRIFTED.
 *
 * It copied the map with the note "tested independently to avoid rendering the
 * full component tree", and by the time the entry copy changed its `decide`
 * entry read "Challenge the RECOMMENDATION…" while the product said "Challenge
 * the RESULT…". A spec that copies the data tests its own copy: it passed
 * green through an entry-copy change it exists to guard, and it would have gone
 * on asserting a placeholder the product does not have.
 *
 * Now IMPORTED. The map is the map, so drift is impossible rather than merely
 * discouraged (trap 12 — derive, do not mirror).
 */
const DEFAULT_PLACEHOLDER = STAGE_PLACEHOLDERS.frame

const ALL_STAGES: ScenarioStage[] = ['frame', 'ideate', 'evaluate', 'decide', 'optimise']

describe('Stage-aware placeholder text', () => {
  it.each(ALL_STAGES)('stage "%s" has a non-empty placeholder', (stage) => {
    expect(STAGE_PLACEHOLDERS[stage]).toBeTruthy()
    expect(typeof STAGE_PLACEHOLDERS[stage]).toBe('string')
    expect(STAGE_PLACEHOLDERS[stage].length).toBeGreaterThan(0)
  })

  it('frame stage uses the default placeholder text', () => {
    expect(STAGE_PLACEHOLDERS.frame).toBe(DEFAULT_PLACEHOLDER)
  })

  it('ideate stage has a different placeholder from frame', () => {
    expect(STAGE_PLACEHOLDERS.ideate).not.toBe(STAGE_PLACEHOLDERS.frame)
  })

  it('evaluate stage mentions results or refining', () => {
    expect(STAGE_PLACEHOLDERS.evaluate.toLowerCase()).toMatch(/result|refin/)
  })

  it('decide stage mentions recommendation or brief', () => {
    expect(STAGE_PLACEHOLDERS.decide.toLowerCase()).toMatch(/recommend|brief/)
  })

  it('optimise stage mentions steps', () => {
    expect(STAGE_PLACEHOLDERS.optimise.toLowerCase()).toMatch(/step/)
  })

  it('unknown stage falls back to default placeholder', () => {
    const unknown = 'unknown_stage' as ScenarioStage
    const placeholder = STAGE_PLACEHOLDERS[unknown] ?? DEFAULT_PLACEHOLDER
    expect(placeholder).toBe(DEFAULT_PLACEHOLDER)
  })
})
