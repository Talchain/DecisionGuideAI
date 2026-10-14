/**
 * An existing cell keeps its OWN provenance when the canvas backfills a run request, and an absent one stays absent.
 *
 * `canvasInterventionsToCEE` (reached from `reconcileOptionsWithCanvasNodes` on both canvas-backfill branches) used to rebuild
 * EVERY entry as `{ value, source: 'cee_hypothesis' }`: a figure the user typed, or one the record never attributed, was
 * re-labelled "Estimated by Olumi" on its way back to the run request. `CEEInterventionV3.source` is optional so the producer
 * side can say "the record does not say" too; the honest readers render silence for it (`classifyInterventionProvenance`).
 *
 * Bound by IDENTITY (target id + the exact stored bytes), and the readers are the REAL ones, not a class predicate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Node } from '@xyflow/react'
import { reconcileOptionsWithCanvasNodes, flattenInterventions, ceeOptionToUIOption } from '../adapter'
import { classifyInterventionProvenance } from '../../../../canvas/domain/valueProvenance'
import type { CEEOptionV3 } from '../../../../types/options'

const node = (id: string, data: Record<string, unknown>): Node => ({ id, position: { x: 0, y: 0 }, data })
const exact = (id: string) => ({ node_id: id, match_type: 'exact_id', confidence: 'high' })

/** One option whose canvas cells are: a bare number, a stored object WITHOUT a source, and one object per genuine source. */
const nodes = (): Node[] => [
  node('goal_1', { kind: 'goal', label: 'Goal' }),
  ...['bare', 'no_source', 'typed', 'brief', 'ai'].map(id => node(id, { kind: 'factor', label: id })),
  node('opt', {
    kind: 'option',
    label: 'Raise price',
    interventions: {
      bare: 0.4,
      no_source: { value: 0.5 },
      typed: { value: 0.6, source: 'user_specified', value_confidence: 'high', reasoning: 'I set this', target_match: { node_id: 'typed', match_type: 'exact_label', confidence: 'medium' } },
      brief: { value: 0.7, source: 'brief_extraction' },
      ai: { value: 0.8, source: 'cee_hypothesis', value_confidence: 'low', reasoning: 'a guess' },
    },
  }),
]

const reconciled = (): CEEOptionV3 => {
  const all = nodes()
  const out = reconcileOptionsWithCanvasNodes(null, all, new Set(all.map(n => n.id)))
  const option = out.find(o => o.id === 'opt')
  if (!option) throw new Error('the option was not reconciled')
  return option
}

describe('canvas backfill keeps each cell\'s own provenance', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })

  it('a BARE NUMBER carries no provenance, so none is emitted (it was stamped cee_hypothesis)', () => {
    const cell = reconciled().interventions.bare
    expect(cell).toStrictEqual({ value: 0.4, target_match: exact('bare') })
    expect(Object.keys(cell)).not.toContain('source')
  })

  it('a stored object WITHOUT a source stays unattributed: not Olumi\'s, not the user\'s', () => {
    const cell = reconciled().interventions.no_source
    expect(cell).toStrictEqual({ value: 0.5, target_match: exact('no_source') })
    expect(Object.keys(cell)).not.toContain('source')
  })

  it('a user-specified cell keeps its source, confidence, reasoning and its own target_match', () => {
    expect(reconciled().interventions.typed).toStrictEqual({
      value: 0.6, source: 'user_specified', value_confidence: 'high', reasoning: 'I set this',
      target_match: { node_id: 'typed', match_type: 'exact_label', confidence: 'medium' },
    })
  })

  it('CONTRAST: a genuine brief_extraction and a genuine cee_hypothesis are still said (no blanket deletion of AI sources)', () => {
    const { brief, ai } = reconciled().interventions
    expect(brief).toStrictEqual({ value: 0.7, source: 'brief_extraction', target_match: exact('brief') })
    expect(ai).toStrictEqual({ value: 0.8, source: 'cee_hypothesis', value_confidence: 'low', reasoning: 'a guess', target_match: exact('ai') })
  })

  it('the REAL readers: unattributed reads as nothing, the typed cell as the user\'s own, the genuine estimate as Olumi\'s', () => {
    const { bare, no_source, typed, brief, ai } = reconciled().interventions
    expect(classifyInterventionProvenance(bare.source)).toBeNull()
    expect(classifyInterventionProvenance(no_source.source)).toBeNull()
    expect(classifyInterventionProvenance(typed.source)).toMatchObject({ userOwned: true })
    expect(classifyInterventionProvenance(brief.source)).toMatchObject({ kind: 'brief', userOwned: false })
    expect(classifyInterventionProvenance(ai.source)).toMatchObject({ kind: 'ai', userOwned: false })
  })

  it('the figures that reach the run request are unchanged (provenance never rides the wire)', () => {
    expect(flattenInterventions(reconciled().interventions)).toStrictEqual({ bare: 0.4, no_source: 0.5, typed: 0.6, brief: 0.7, ai: 0.8 })
  })

  it('the UI option emits no source key for an unattributed cell and keeps it for the others', () => {
    const ui = ceeOptionToUIOption(reconciled()).interventions
    expect(Object.keys(ui.bare)).not.toContain('source')
    expect(Object.keys(ui.no_source)).not.toContain('source')
    expect(ui.typed.source).toBe('user_specified')
    expect(ui.ai.source).toBe('cee_hypothesis')
  })

  it('the OTHER backfill branch (an analysis_ready option with no usable cells, a canvas node with them) keeps each cell\'s own provenance too', () => {
    const all = nodes()
    const empty = { id: 'opt', label: 'Raise price', status: 'needs_user_mapping' as const, interventions: {} }
    const out = reconcileOptionsWithCanvasNodes({ goal_node_id: 'goal_1', options: [empty] } as never, all, new Set(all.map(n => n.id)))
    const option = out.find(o => o.id === 'opt')
    expect(option?.label).toBe('Raise price')
    expect(option?.interventions).toStrictEqual(reconciled().interventions)
    expect(Object.keys(option?.interventions.bare ?? {})).not.toContain('source')
    expect(option?.interventions.typed).toMatchObject({ value: 0.6, source: 'user_specified', reasoning: 'I set this' })
    expect(option?.interventions.ai).toMatchObject({ value: 0.8, source: 'cee_hypothesis' })
  })

  it('an analysis_ready option whose cells carry no source passes through unchanged (the contract allows it)', () => {
    const all = nodes()
    const ready = { id: 'opt', label: 'Raise price', status: 'ready' as const, interventions: { bare: { value: 0.4 }, typed: { value: 0.6, source: 'user_specified' as const } } }
    const out = reconcileOptionsWithCanvasNodes({ goal_node_id: 'goal_1', options: [ready] } as never, all, new Set(all.map(n => n.id)))
    expect(out.find(o => o.id === 'opt')?.interventions).toStrictEqual(ready.interventions)
  })
})
