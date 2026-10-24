/**
 * OLUMI'S NOTES ARE SHOWN ON THE CARD THEY CONCERN (Paul, 24 Oct 2026; identity from the canonical model, source first).
 * Fixture: the saved graph of Paul's "focus on more strategic tasks" board (scenario 3de98183), read from staging on
 * 24 Oct: 20 nodes, 7 of them display-only records that CEE still projects as `action` nodes (#3709). "After CEE" is the
 * same saved graph without those 7 nodes, which is what the graph route serves once CEE stops projecting them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import graph from './fixtures/strategic-3de98183-graph.json'
import { noteRecordsOf, useNoteRecordsStore } from '../noteRecords'
import { NodeNotesMark } from '../../nodes/shared/NodeNotesMark'
import { useCanvasStore } from '../../store'
import { NoteRecordsPublisher } from '../../components/NoteRecordsPublisher'

// The publisher's saved-graph read, controlled per row (the real hook reads the graph route).
let savedRead: unknown = null
vi.mock('../../nodes/shared/savedGraph', () => ({ useSavedGraph: () => savedRead }))

type N = { id: string; type?: string; kind?: string; label?: string; data?: unknown }
type G = { nodes: N[]; living_model: { canonical: Record<string, Array<Record<string, unknown>>> } }
const NOTE_IDS = [
  'prefer_lower_spending', 'expected_human_focus_benefit', 'cost_range_interpretation', 'combined_cost_additivity',
  'annual_cost_comparison', 'focus_benefit_not_quantified', 'cost_figures_need_reconciliation',
]
const today = graph as unknown as G
const afterCee: G = { ...today, nodes: today.nodes.filter((n) => !NOTE_IDS.includes(n.id)) }
const canvasOf = (g: G): N[] => g.nodes.map((n) => ({ id: n.id, type: n.kind, data: { label: n.label } }))
const storeNodesOf = (g: G) => canvasOf(g).map((n) => ({ ...n, position: { x: 0, y: 0 } }))

beforeEach(() => {
  savedRead = null
  useNoteRecordsStore.setState({ scenarioId: null, records: new Map() })
  useCanvasStore.setState({ currentScenarioId: '3de98183' } as never)
})
const publish = (records: ReturnType<typeof noteRecordsOf>, scenarioId = '3de98183') =>
  act(() => useNoteRecordsStore.getState().publish(scenarioId, records))

describe('3de98183 after CEE stops projecting the records: each is a note on the card it concerns', () => {
  it('all 7 are notes, in their families, each anchored on a card the canvas draws', () => {
    const canvas = canvasOf(afterCee)
    const notes = noteRecordsOf(afterCee, canvas)
    expect([...notes.keys()].sort()).toEqual([...NOTE_IDS].sort())
    expect([...notes.values()].map((n) => n.family).sort())
      .toEqual(['assumptions', 'assumptions', 'assumptions', 'claims', 'left_out', 'left_out', 'preferences'])
    expect(notes.get('cost_range_interpretation')!.anchorId).toBe('human_annual_cost')
    expect(notes.get('expected_human_focus_benefit')!.anchorId).toBe('personal_assistant')
    expect(notes.get('prefer_lower_spending')!.anchorId).toBe('annual_spend')
    // A preference has no text of its own: its direction, the quantity's card name and the person's words.
    const spend = canvas.find((n) => n.id === 'annual_spend')!.data as { label: string }
    expect(notes.get('prefer_lower_spending')!.text).toBe(`Lower ${spend.label} (“to save money”)`)
    const drawn = new Set(canvas.map((n) => n.id))
    for (const n of notes.values()) expect(drawn.has(n.anchorId!)).toBe(true)
  })

  it('every note is reachable from its card glyph, its text in full', () => {
    const notes = noteRecordsOf(afterCee, canvasOf(afterCee))
    publish(notes)
    for (const anchor of new Set([...notes.values()].map((n) => n.anchorId!))) render(<NodeNotesMark nodeId={anchor} />)
    for (const n of notes.values()) expect(screen.getByTestId(`node-notes-${n.anchorId}`).getAttribute('aria-label')).toContain(n.text)
    // The option the claim and the cost comparison both concern carries both.
    expect(screen.getByTestId('node-notes-personal_assistant')).toHaveAttribute('data-note-count', '2')
    expect(screen.getByTestId('node-notes-human_annual_cost').getAttribute('aria-label'))
      .toContain('Assumption (Olumi’s): Provisionally treat the stated dollar range')
  })
})

describe('edges of the rule', () => {
  it('NEGATIVE — today’s served data: a record the canvas draws as a card is never also a note (nothing said twice)', () => {
    const notes = noteRecordsOf(today, canvasOf(today))
    expect(notes.size).toBe(0)
    // Contrast in the same fixture: the same records are notes once the canvas does not draw them.
    expect(noteRecordsOf(afterCee, canvasOf(afterCee)).size).toBe(7)
    publish(notes)
    render(<NodeNotesMark nodeId="personal_assistant" />)
    expect(screen.queryByTestId('node-notes-personal_assistant')).toBeNull()
  })

  it('a note whose concerns resolve to no card is on the question card; with no question card, the goal — text kept', () => {
    const lonely = structuredClone(afterCee)
    lonely.living_model.canonical.claims[0].concerns = ['not_on_the_canvas']
    const notes = noteRecordsOf(lonely, canvasOf(lonely))
    expect(notes.get('expected_human_focus_benefit')!.anchorId).toBe('mp:decision')
    publish(notes)
    render(<NodeNotesMark nodeId="mp:decision" />)
    expect(screen.getByTestId('node-notes-mp:decision').getAttribute('aria-label')).toContain(notes.get('expected_human_focus_benefit')!.text)
    // No question card on the board: the goal carries it, never nobody.
    const goal = canvasOf(lonely).find((n) => n.type === 'goal')!.id
    const noQuestion = canvasOf(lonely).filter((n) => n.type !== 'decision')
    expect(noteRecordsOf(lonely, noQuestion).get('expected_human_focus_benefit')!.anchorId).toBe(goal)
  })

  it('a hidden card neither anchors a note nor counts as showing its record', () => {
    const g = structuredClone(afterCee)
    g.living_model.canonical.claims[0].concerns = ['human_annual_cost', 'personal_assistant']
    const canvas = canvasOf(g).map((n) => (n.id === 'human_annual_cost' ? { ...n, hidden: true } : n))
    expect(noteRecordsOf(g, canvas).get('expected_human_focus_benefit')!.anchorId).toBe('personal_assistant')
    // Today's projection with the record's own card hidden: nothing shows it, so it is a note.
    const hiddenCard = canvasOf(today).map((n) => (n.id === 'expected_human_focus_benefit' ? { ...n, hidden: true } : n))
    expect([...noteRecordsOf(today, hiddenCard).keys()]).toEqual(['expected_human_focus_benefit'])
  })

  it('PUBLISHER (mounted): a pending read keeps the notes, derived against the current cards — never a card and its note', () => {
    useCanvasStore.setState({ nodes: storeNodesOf(afterCee) } as never)
    savedRead = afterCee
    render(<NoteRecordsPublisher />)
    expect(useNoteRecordsStore.getState().records.size).toBe(7)
    // A refresh: the read is pending. The notes stay…
    savedRead = null
    act(() => useCanvasStore.setState({ nodes: storeNodesOf(afterCee).map((n) => ({ ...n })) } as never))
    expect(useNoteRecordsStore.getState().records.size).toBe(7)
    // …and if a record's card comes back meanwhile, its note goes (no double), the other six stay.
    const withCard = [...storeNodesOf(afterCee), { id: 'expected_human_focus_benefit', type: 'action', data: { label: 'Claim' }, position: { x: 0, y: 0 } }]
    act(() => useCanvasStore.setState({ nodes: withCard } as never))
    expect(useNoteRecordsStore.getState().records.has('expected_human_focus_benefit')).toBe(false)
    expect(useNoteRecordsStore.getState().records.size).toBe(6)
  })

  it('a note about core’s hidden option switch is shown on its option, never on the switch nobody sees', () => {
    const g = structuredClone(afterCee)
    g.living_model.canonical.claims[0].concerns = ['personal_assistant__on', 'annual_spend']
    const canvas = [...canvasOf(g), { id: 'personal_assistant__on', type: 'factor', data: { label: 'hire a personal assistant in place' } }]
    expect(noteRecordsOf(g, canvas).get('expected_human_focus_benefit')!.anchorId).toBe('personal_assistant')
  })

  it('another scenario’s notes are never shown, even before this scenario’s read answers', () => {
    publish(noteRecordsOf(afterCee, canvasOf(afterCee)), 'another-scenario')
    render(<NodeNotesMark nodeId="personal_assistant" />)
    expect(screen.queryByTestId('node-notes-personal_assistant')).toBeNull()
  })

  it('evidence shows its source, a condition and a disagreement their own words — every family CEE projects', () => {
    const g = structuredClone(afterCee)
    const c = g.living_model.canonical
    c.evidence = [{ id: 'ev1', text: 'Assistants cost about $40k a year here', source: 'the 2026 salary survey', author: 'person', concerns: ['human_annual_cost'] }]
    c.conditions = [{ id: 'cd1', text: 'Only if the budget is approved', author: 'olumi', concerns: ['personal_assistant'] }]
    c.dissent = [{ id: 'ds1', holder: 'Finance', position: 'The cost is understated', author: 'person', concerns: ['annual_spend'] }]
    const notes = noteRecordsOf(g, canvasOf(g))
    expect(notes.get('ev1')).toMatchObject({ family: 'evidence', text: 'Assistants cost about $40k a year here Source: the 2026 salary survey', anchorId: 'human_annual_cost' })
    expect(notes.get('cd1')).toMatchObject({ family: 'conditions', text: 'Only if the budget is approved', author: 'olumi', anchorId: 'personal_assistant' })
    expect(notes.get('ds1')).toMatchObject({ family: 'dissent', text: 'Finance: The cost is understated', anchorId: 'annual_spend' })
    publish(notes)
    render(<NodeNotesMark nodeId="personal_assistant" />)
    expect(screen.getByTestId('node-notes-personal_assistant').getAttribute('aria-label')).toContain('Condition (Olumi’s): Only if the budget is approved')
  })

  it('NEGATIVE: a board with no canonical model has no notes', () => {
    expect(noteRecordsOf({ nodes: afterCee.nodes }, canvasOf(afterCee)).size).toBe(0)
  })
})
