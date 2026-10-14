/**
 * `synthesiseCeeAnalysisReady`'s legacy-number restore: a plain number stored on an option node is a figure nobody attributed.
 * It used to be stamped `source: 'cee_hypothesis'` ("Estimated by Olumi"). It is now restored with NO source, and a stored
 * object keeps its own (the user-specified and the genuine estimate are both still said).
 *
 * Reached only on the uniform-default-edge branch, so the fixture gives two options whose outgoing edges all carry the canvas
 * default (weight 1, positive).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { synthesiseCeeAnalysisReady } from '../utils/applyPatch'
import { useCanvasStore } from '../../store'
import { classifyInterventionProvenance } from '../../domain/valueProvenance'

const factor = (id: string) => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: id } })
const option = (id: string, interventions: Record<string, unknown>) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: id, interventions } })
const edge = (id: string, source: string, target: string) => ({ id, source, target, data: { weight: 1, direction: 'positive' } })

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  useCanvasStore.setState({
    nodes: [
      { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Goal' } },
      factor('f_bare'), factor('f_typed'), factor('f_ai'),
      option('opt_a', { f_bare: 0.4, f_typed: { value: 0.6, source: 'user_specified' }, f_ai: { value: 0.8, source: 'cee_hypothesis' } }),
      option('opt_b', { f_bare: 0.1, f_typed: { value: 0.2, source: 'user_specified' }, f_ai: { value: 0.3, source: 'cee_hypothesis' } }),
    ] as never,
    edges: [
      edge('e1', 'opt_a', 'f_bare'), edge('e2', 'opt_a', 'f_typed'), edge('e3', 'opt_a', 'f_ai'),
      edge('e4', 'opt_b', 'f_bare'), edge('e5', 'opt_b', 'f_typed'), edge('e6', 'opt_b', 'f_ai'),
    ] as never,
    outcomeNodeId: 'goal_1',
  })
})

describe('synthesiseCeeAnalysisReady restores a stored number without inventing who set it', () => {
  const cells = () => synthesiseCeeAnalysisReady()!.options.find(o => o.id === 'opt_a')!.interventions

  it('a plain number comes back with its value and NO source key', () => {
    const cell = cells().f_bare
    expect(cell.value).toBe(0.4)
    expect(Object.keys(cell)).not.toContain('source')
    expect(classifyInterventionProvenance(cell.source)).toBeNull()
  })

  it('CONTRAST: a stored object keeps its genuine source (user-specified stays the user\'s, a genuine estimate stays Olumi\'s)', () => {
    expect(cells().f_typed).toMatchObject({ value: 0.6, source: 'user_specified' })
    expect(cells().f_ai).toMatchObject({ value: 0.8, source: 'cee_hypothesis' })
  })

  it('the second option\'s cells are restored the same way (identity-bound by option id)', () => {
    const b = synthesiseCeeAnalysisReady()!.options.find(o => o.id === 'opt_b')!.interventions
    expect(b.f_bare.value).toBe(0.1)
    expect(Object.keys(b.f_bare)).not.toContain('source')
    expect(b.f_typed.source).toBe('user_specified')
  })
})
