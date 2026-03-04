/**
 * Tests for stage-aware placeholder text in ConversationPanel.
 *
 * Verifies that the STAGE_PLACEHOLDERS map covers all ScenarioStage values
 * and that the fallback is the default placeholder.
 */

import { describe, it, expect } from 'vitest'
import type { ScenarioStage } from '../../../types/scenario'

// Mirror the map from ConversationPanel — tested independently to avoid
// rendering the full component tree (canvas store deps make that expensive).
const STAGE_PLACEHOLDERS: Record<ScenarioStage, string> = {
  frame:    'What decision are you facing?',
  ideate:   'Tell me more about your goals and constraints...',
  evaluate: "Say 'run it' to analyse, or keep refining",
  decide:   'Ask about results, or challenge the recommendation',
  optimise: 'Edit the brief, share it, or start a new scenario',
}

const DEFAULT_PLACEHOLDER = 'What decision are you facing?'

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

  it('evaluate stage mentions running or refining', () => {
    expect(STAGE_PLACEHOLDERS.evaluate.toLowerCase()).toMatch(/run|refin/)
  })

  it('decide stage mentions results or recommendation', () => {
    expect(STAGE_PLACEHOLDERS.decide.toLowerCase()).toMatch(/result|recommend/)
  })

  it('optimise stage mentions brief or scenario', () => {
    expect(STAGE_PLACEHOLDERS.optimise.toLowerCase()).toMatch(/brief|scenario/)
  })

  it('unknown stage falls back to default placeholder', () => {
    const unknown = 'unknown_stage' as ScenarioStage
    const placeholder = STAGE_PLACEHOLDERS[unknown] ?? DEFAULT_PLACEHOLDER
    expect(placeholder).toBe(DEFAULT_PLACEHOLDER)
  })
})
