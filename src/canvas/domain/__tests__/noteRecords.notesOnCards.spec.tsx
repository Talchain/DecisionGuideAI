/**
 * OLUMI'S NOTES ARE SHOWN ON THE CARD THEY CONCERN, NEVER AS CARDS (Paul, 24 Oct 2026; identity from the canonical model).
 * Fixture: the saved graph of Paul's "focus on more strategic tasks" board (scenario 3de98183), read from staging on
 * 24 Oct: 20 nodes, 7 of them display-only records projected as `action` nodes (CEE #3709).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import graph from './fixtures/strategic-3de98183-graph.json'
import { currentNoteIds, noteRecordsOf, useNoteRecordsStore, withoutNotes } from '../noteRecords'
import { NodeNotesMark } from '../../nodes/shared/NodeNotesMark'
import { excludeNonModelNodes } from '../../utils/fitTargets'
import { allUnlockedNodesMeasured } from '../../utils/measureLayoutGate'

type N = { id: string; kind?: string; label?: string }
const savedNodes = (graph as { nodes: N[] }).nodes
const canvasIds = new Set(savedNodes.map((n) => n.id))
const NOTE_IDS = [
  'prefer_lower_spending', 'expected_human_focus_benefit', 'cost_range_interpretation', 'combined_cost_additivity',
  'annual_cost_comparison', 'focus_benefit_not_quantified', 'cost_figures_need_reconciliation',
]

beforeEach(() => { useNoteRecordsStore.setState({ scenarioId: null, records: new Map() }) })
const publish = (records: ReturnType<typeof noteRecordsOf>) => useNoteRecordsStore.getState().publish('3de98183', records)

describe('3de98183: every display-only record is a note, keyed by canonical identity', () => {
  it('all 7 are notes, in their families, each anchored on a drawn card', () => {
    const notes = noteRecordsOf(graph, canvasIds)
    expect([...notes.keys()].sort()).toEqual([...NOTE_IDS].sort())
    const families = [...notes.values()].map((n) => n.family).sort()
    expect(families).toEqual(['assumptions', 'assumptions', 'assumptions', 'claims', 'left_out', 'left_out', 'preferences'])
    expect(notes.get('cost_range_interpretation')!.anchorId).toBe('human_annual_cost')
    expect(notes.get('expected_human_focus_benefit')!.anchorId).toBe('personal_assistant')
    expect(notes.get('prefer_lower_spending')!.anchorId).toBe('annual_spend')
    for (const n of notes.values()) expect(canvasIds.has(n.anchorId!)).toBe(true)
  })

  it('0 model cards for them: not drawn, not laid out, not measured, not fitted; every other node still is', () => {
    publish(noteRecordsOf(graph, canvasIds))
    const drawn = withoutNotes(savedNodes, [])
    expect(drawn.hidden.map((n) => n.id).sort()).toEqual([...NOTE_IDS].sort())
    expect(drawn.nodes).toHaveLength(13)
    expect(excludeNonModelNodes(savedNodes as never).map((n: N) => n.id).filter((id: string) => NOTE_IDS.includes(id))).toEqual([])
    // Only the 13 drawn cards are measured: the gate does not wait for a note React Flow never renders.
    const measured = new Map(drawn.nodes.map((n) => [n.id, { measured: { width: 200, height: 80 } }]))
    expect(allUnlockedNodesMeasured(savedNodes as never, measured as never)).toBe(true)
  })

  it('every note is reachable from its card glyph, its text in full', () => {
    const notes = noteRecordsOf(graph, canvasIds)
    publish(notes)
    for (const anchor of new Set([...notes.values()].map((n) => n.anchorId!))) render(<NodeNotesMark nodeId={anchor} />)
    for (const n of notes.values()) {
      const mark = screen.getByTestId(`node-notes-${n.anchorId}`)
      expect(mark.getAttribute('aria-label')).toContain(n.text)
    }
    // The option the claim and the cost comparison both concern carries both.
    expect(screen.getByTestId('node-notes-personal_assistant')).toHaveAttribute('data-note-count', '2')
    expect(screen.getByTestId('node-notes-human_annual_cost').getAttribute('aria-label'))
      .toContain('Assumption (Olumi’s): Provisionally treat the stated dollar range')
  })
})

describe('edges of the rule', () => {
  it('a note whose concerns resolve to no drawn card is on the question card (the board), text kept', () => {
    const lonely = structuredClone(graph) as { living_model: { canonical: { claims: Array<Record<string, unknown>> } } }
    lonely.living_model.canonical.claims[0].concerns = ['not_on_the_canvas']
    const notes = noteRecordsOf(lonely, canvasIds)
    expect(notes.get('expected_human_focus_benefit')!.anchorId).toBeNull()
    publish(notes)
    render(<NodeNotesMark nodeId="mp:decision" boardNotes />)
    expect(screen.getByTestId('node-notes-mp:decision').getAttribute('aria-label'))
      .toContain(notes.get('expected_human_focus_benefit')!.text)
  })

  it('NEGATIVE: an action node whose id is in no canonical family stays a card', () => {
    const other = structuredClone(graph) as { nodes: N[] }
    other.nodes.push({ id: 'an_ordinary_action', kind: 'action', label: 'Assumption: looks like a note, is not one' })
    const ids = new Set(other.nodes.map((n) => n.id))
    const notes = noteRecordsOf(other, ids)
    expect(notes.has('an_ordinary_action')).toBe(false)
    publish(notes)
    expect(currentNoteIds().has('an_ordinary_action')).toBe(false)
    expect(withoutNotes(other.nodes, []).nodes.map((n) => n.id)).toContain('an_ordinary_action')
  })

  it('NEGATIVE: a board with no canonical model has no notes', () => {
    const legacy = { nodes: savedNodes }
    expect(noteRecordsOf(legacy, canvasIds).size).toBe(0)
  })
})
