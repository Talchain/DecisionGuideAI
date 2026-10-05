/**
 * The name a saved row is shown under, bound to REAL rows (read-only staging capture, 4 Oct 2026, ids redacted):
 * CEE-drafted rows store `title: null` and `framing: null`; the canvas names them after the graph's goal node.
 */
import { describe, it, expect } from 'vitest'
import fixture from '../../../pages/__tests__/fixtures/realSavedScenarios.json'
import { scenarioDisplayTitle, storedGoalNodeLabel } from '../scenarioDisplayTitle'
import { resolveModelDisplayName } from '../modelDisplayName'

const row = fixture.staleRow

describe('scenarioDisplayTitle', () => {
  it('a real CEE-drafted row has neither a title nor a framing, and is named after its goal node', () => {
    expect(row.title).toBeNull()
    expect(row.framing).toBeNull()
    expect(storedGoalNodeLabel(row.graph)).toBe('monthly recurring revenue')
    expect(scenarioDisplayTitle(row)).toBe('monthly recurring revenue')
  })

  it('agrees with the canvas ladder for the same row', () => {
    // routes/CanvasMVP.tsx: resolveModelDisplayName(framing?.title, framing?.goal ?? goalNodeLabel, exampleTitle)
    expect(scenarioDisplayTitle(row)).toBe(resolveModelDisplayName(undefined, storedGoalNodeLabel(row.graph)))
  })

  it('names the goal, not the decision node that comes first in the stored graph', () => {
    expect(row.graph.nodes[0].kind).toBe('decision')
    expect(scenarioDisplayTitle(row)).not.toBe(row.graph.nodes[0].label)
  })

  it('a chosen name wins: the title column, then the framing title, then the framing goal', () => {
    expect(scenarioDisplayTitle({ ...row, title: '  Pricing 2027 ' })).toBe('Pricing 2027')
    expect(scenarioDisplayTitle({ ...row, framing: { title: 'Renamed on canvas', goal: 'A goal' } })).toBe('Renamed on canvas')
    expect(scenarioDisplayTitle({ ...row, framing: { goal: 'Reach the revenue target' } })).toBe('Reach the revenue target')
  })

  it('reads a canvas-shaped goal node too (guest-saved graphs)', () => {
    expect(scenarioDisplayTitle({ title: null, framing: null, graph: { nodes: [{ id: 'g', type: 'goal', data: { label: 'Cut response times' } }] } })).toBe('Cut response times')
  })

  it('answers null, never an invented name, when nothing names the row', () => {
    expect(scenarioDisplayTitle({ title: null, framing: null, graph: null })).toBeNull()
    expect(scenarioDisplayTitle({ title: ' ', framing: null, graph: { nodes: [{ id: 'o', kind: 'option', label: 'An option' }] } })).toBeNull()
    expect(scenarioDisplayTitle({ title: null, framing: null, graph: { nodes: [{ id: 'g', kind: 'goal', label: '  ' }] } })).toBeNull()
  })
})
