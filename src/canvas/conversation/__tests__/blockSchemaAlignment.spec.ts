/**
 * Block Schema Alignment — Contract Tests
 *
 * Asserts that adaptCEEBlock preserves exact field names from CEE's
 * block data schemas. One test per block type. Each test fails if a
 * field name changes on either side of the boundary.
 */

import { describe, it, expect, vi } from 'vitest'
import { adaptCEEBlock } from '../useConversation'
import type {
  ComparisonBlock,
  PremortemBlock,
  FlipAnalysisBlock,
  ProposalBlock,
  ExerciseBlock,
  CommentaryBlock,
} from '../types'

// Flags mock — adaptCEEBlock doesn't depend on flags directly, but
// imports from useConversation reference them.
vi.mock('../../../flags', () => ({
  isOrchestratorRenderingV2Enabled: vi.fn(() => true),
  isDeterministicCeeEnabled: vi.fn(() => true),
  isPreAnalysisEnrichedEnabled: vi.fn(() => false),
  isDebugBundleV2Enabled: vi.fn(() => false),
}))

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — comparison', () => {
  const raw = {
    block_type: 'comparison',
    data: {
      narrative: 'A leads.',
      options: [
        {
          id: 'opt_a',
          label: 'Option A',
          probability: 0.65,
          rank: 1,
          strengths: ['Fast'],
          weaknesses: ['Expensive'],
          key_differentiators: ['Speed'],
        },
      ],
    },
  }

  it('preserves all CEE field names without renaming', () => {
    const result = adaptCEEBlock(raw) as ComparisonBlock
    expect(result.type).toBe('comparison')
    expect(result.narrative).toBe('A leads.')
    expect(result.options).toHaveLength(1)
    const opt = result.options[0]
    expect(opt.id).toBe('opt_a')
    expect(opt.label).toBe('Option A')
    expect(opt.probability).toBe(0.65)
    expect(opt.rank).toBe(1)
    expect(opt.strengths).toEqual(['Fast'])
    expect(opt.weaknesses).toEqual(['Expensive'])
    expect(opt.key_differentiators).toEqual(['Speed'])
  })

  it('does not carry old "differentiators" field name', () => {
    const result = adaptCEEBlock(raw) as Record<string, unknown>
    const opt = (result.options as any[])[0]
    expect(opt.differentiators).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Premortem
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — premortem', () => {
  const raw = {
    block_type: 'premortem',
    data: {
      target_option: { id: 'opt_a', label: 'Option A' },
      narrative: 'What if it fails?',
      risk_paths: [
        {
          path: ['Market risk', 'Revenue loss'],
          description: 'Market downturn reduces revenue',
          influence: 0.7,
          likelihood: 'medium',
          mitigation: 'Diversify markets',
        },
      ],
    },
  }

  it('preserves target_option as object with id and label', () => {
    const result = adaptCEEBlock(raw) as PremortemBlock
    expect(result.type).toBe('premortem')
    expect(result.target_option).toEqual({ id: 'opt_a', label: 'Option A' })
  })

  it('preserves risk_path fields including path array', () => {
    const result = adaptCEEBlock(raw) as PremortemBlock
    const rp = result.risk_paths[0]
    expect(rp.path).toEqual(['Market risk', 'Revenue loss'])
    expect(rp.description).toBe('Market downturn reduces revenue')
    expect(rp.influence).toBe(0.7)
    expect(rp.likelihood).toBe('medium')
    expect(rp.mitigation).toBe('Diversify markets')
  })
})

// ---------------------------------------------------------------------------
// Flip Analysis
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — flip_analysis', () => {
  const raw = {
    block_type: 'flip_analysis',
    data: {
      current_winner: { id: 'opt_a', label: 'Option A', probability: 0.65 },
      narrative: 'Close race.',
      flip_conditions: [
        {
          assumption: 'Market share holds above 30%',
          current_value: '35%',
          flip_threshold: '28%',
          direction: 'decreases below',
          alternative_winner: 'Option B',
        },
      ],
    },
  }

  it('preserves current_winner as object with id, label, probability', () => {
    const result = adaptCEEBlock(raw) as FlipAnalysisBlock
    expect(result.type).toBe('flip_analysis')
    expect(result.current_winner).toEqual({ id: 'opt_a', label: 'Option A', probability: 0.65 })
  })

  it('preserves flip_condition CEE field names exactly', () => {
    const result = adaptCEEBlock(raw) as FlipAnalysisBlock
    const fc = result.flip_conditions[0]
    expect(fc.assumption).toBe('Market share holds above 30%')
    expect(fc.current_value).toBe('35%')
    expect(fc.flip_threshold).toBe('28%')
    expect(fc.direction).toBe('decreases below')
    expect(fc.alternative_winner).toBe('Option B')
  })

  it('does not carry old field names (factor_label, threshold, impact)', () => {
    const result = adaptCEEBlock(raw) as Record<string, unknown>
    const fc = (result.flip_conditions as any[])[0]
    expect(fc.factor_label).toBeUndefined()
    expect(fc.threshold).toBeUndefined()
    expect(fc.impact).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Proposal
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — proposal', () => {
  const raw = {
    block_type: 'proposal',
    data: {
      proposal_id: 'abc-123',
      action_type: 'add_factor',
      description: 'Add Regulatory Risk',
      changes: [
        { operation: 'add', target: 'Regulatory Risk', detail: 'New factor node' },
      ],
      consequences: ['More complexity'],
      confirmation_required: true,
    },
  }

  it('preserves CEE changes field names (operation, target, detail)', () => {
    const result = adaptCEEBlock(raw) as ProposalBlock
    expect(result.type).toBe('proposal')
    expect(result.proposal_id).toBe('abc-123')
    expect(result.action_type).toBe('add_factor')
    expect(result.description).toBe('Add Regulatory Risk')
    const change = result.changes[0]
    expect(change.operation).toBe('add')
    expect(change.target).toBe('Regulatory Risk')
    expect(change.detail).toBe('New factor node')
  })

  it('does not carry old field names (element_label, change_description)', () => {
    const result = adaptCEEBlock(raw) as Record<string, unknown>
    const change = (result.changes as any[])[0]
    expect(change.element_label).toBeUndefined()
    expect(change.change_description).toBeUndefined()
  })

  it('preserves consequences and confirmation_required', () => {
    const result = adaptCEEBlock(raw) as ProposalBlock
    expect(result.consequences).toEqual(['More complexity'])
    expect(result.confirmation_required).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — exercise', () => {
  const raw = {
    block_type: 'exercise',
    data: {
      exercise_type: 'premortem',
      title: 'Pre-mortem Exercise',
      instructions: 'Imagine this decision failed.',
      content: '<p>Worksheet content</p>',
    },
  }

  it('preserves all CEE field names', () => {
    const result = adaptCEEBlock(raw) as ExerciseBlock
    expect(result.type).toBe('exercise')
    expect(result.exercise_type).toBe('premortem')
    expect(result.title).toBe('Pre-mortem Exercise')
    expect(result.instructions).toBe('Imagine this decision failed.')
    expect(result.content).toBe('<p>Worksheet content</p>')
  })
})

// ---------------------------------------------------------------------------
// Commentary
// ---------------------------------------------------------------------------

describe('adaptCEEBlock — commentary', () => {
  const raw = {
    block_type: 'commentary',
    data: {
      narrative: 'Here is the analysis.',
      sections: [
        { heading: 'Key Insight', content: 'The data shows...', items: ['Point 1', 'Point 2'] },
      ],
    },
  }

  it('preserves narrative and sections', () => {
    const result = adaptCEEBlock(raw) as CommentaryBlock
    expect(result.type).toBe('commentary')
    expect(result.text).toBe('Here is the analysis.')
    expect(result.sections).toHaveLength(1)
    const sec = result.sections![0]
    expect(sec.heading).toBe('Key Insight')
    expect(sec.content).toBe('The data shows...')
    expect(sec.items).toEqual(['Point 1', 'Point 2'])
  })
})
