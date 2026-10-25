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
    // routes/CanvasMVP.tsx: resolveModelDisplayName(framing?.title, framing?.goal ?? goalNodeLabel, exampleTitle, questionNodeLabel)
    expect(scenarioDisplayTitle(row)).toBe(resolveModelDisplayName(undefined, storedGoalNodeLabel(row.graph)))
  })

  it('never says the question node’s producer prefix ("Decision: …")', () => {
    expect(row.graph.nodes[0].kind).toBe('decision')
    expect(row.graph.nodes[0].label).toBe('Decision: monthly recurring revenue')
    expect(scenarioDisplayTitle(row)).toBe('monthly recurring revenue')
  })

  it('⭐ names the question, not a goal that carries the raw brief (Paul, 25 Oct; served row 43b3c54f, its two nodes verbatim)', () => {
    const graph = { nodes: [
      { id: 'mp:decision', kind: 'decision', label: 'What evidence would justify delaying the app update rather than launching with the reported database sync bug?' },
      { id: 'justify_delay_to_boss', kind: 'goal', label: 'write me a list of reasons why delaying is the right move so i can show my boss' },
    ] }
    expect(scenarioDisplayTitle({ title: null, framing: null, graph })).toBe('What evidence would justify delaying the app update rather than launching with the reported database sync bug?')
    // CONTRAST: with no question node, the goal names it, as before.
    expect(scenarioDisplayTitle({ title: null, framing: null, graph: { nodes: [graph.nodes[1]] } }))
      .toBe('write me a list of reasons why delaying is the right move...')
  })

  it('a chosen name wins: the title column, then the framing title, then the framing goal', () => {
    expect(scenarioDisplayTitle({ ...row, title: '  Pricing 2027 ' })).toBe('Pricing 2027')
    expect(scenarioDisplayTitle({ ...row, framing: { title: 'Renamed on canvas', goal: 'A goal' } })).toBe('Renamed on canvas')
    // A framing goal names a row with no question node (the question card's words come first, Paul 25 Oct).
    const noQuestion = { ...row.graph, nodes: row.graph.nodes.filter((n) => n.kind !== 'decision') }
    expect(scenarioDisplayTitle({ ...row, graph: noQuestion, framing: { goal: 'Reach the revenue target' } })).toBe('Reach the revenue target')
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
