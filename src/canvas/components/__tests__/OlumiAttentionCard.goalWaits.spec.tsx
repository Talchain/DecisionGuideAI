/**
 * OLUMI'S NOTE ON A GOAL WHOSE CHANCE WAITS (Paul, 24 Oct: the threshold and what it waits on go "In Olumi's note"). The
 * note beside the goal says the goal card's own target line and CEE's `goal_chance.waits_on`, in its order and words, each
 * answerable label opening its card's answer box; then the note itself.
 *
 * Fixture: the CEE 2de696a9 witness grant board after the Run press, with that turn's core `notes` entry on the goal
 * (see its `_capture`), passed through the real `coreTurnToClientBody`. Expected words are spelled inline.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { OlumiAttentionCard, OLUMI_ATTENTION_CARD_TESTID } from '../OlumiAttentionCard'
import { useCanvasStore } from '../../store'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import { useValuePrefillStore } from '../../graphChanges/valuePrefill'
import { coreTurnToClientBody, parseCoreTurn } from '../../../v5/coreTurnContract'
import grant from '../../runView/__tests__/fixtures/w3735-grant-press-read.json'

vi.mock('@xyflow/react', () => ({
  useStore: (selector: (s: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, 1] }),
}))
vi.mock('../../../components/results/coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../FloatingOlumiPanel', () => ({ measureDockInset: () => 0 }))
vi.mock('../../utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

type Node = { id: string; kind: string; label: string } & Record<string, unknown>
const GOAL = 'credible_application'

/** The served turn's note on the goal, as the client reads it (`coreTurnToClientBody`'s highlight block). */
function servedNote(): string {
  const turn = parseCoreTurn({ turn_id: 't', assistant_text: '', model: { graph: { nodes: grant.graph.nodes, edges: [] }, revision: 'r', scenario_revision: 'r' },
    cards: [], notes: grant.turn_notes, run: null, receipts: [], error: null })
  const block = (coreTurnToClientBody(turn!).blocks as { type: string; targets?: { id: string }[]; note?: string }[])
    .find((b) => b.type === 'ui_directive' && b.targets?.[0]?.id === GOAL)
  return block!.note!
}

function hold(anchorId: string, goalChance: Record<string, unknown> | null = null) {
  const view = grant.canonical_analysis_view as Record<string, any>
  useCanonicalAnalysisViewStore.getState().adopt(grant.scenario_id, parseCanonicalAnalysisView(goalChance === null ? view : { ...view, goal_chance: { ...view.goal_chance, ...goalChance } }))
  useCanvasStore.setState({
    currentScenarioId: grant.scenario_id,
    nodes: (grant.graph.nodes as Node[]).map(({ id, kind, ...data }, i) => ({ id, type: kind, position: { x: 0, y: i * 120 }, measured: { width: 200, height: 80 }, data })),
    edges: [],
    olumiAttention: { nodeIds: [anchorId], edgeIds: [], note: { body: servedNote() }, caveat: null, turnId: null, modelVersion: null },
  } as never)
}
const waits = () => screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-waits`)

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ olumiAttention: null })
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  useValuePrefillStore.setState({ request: null })
})

describe('Olumi’s note on a goal whose chance waits', () => {
  // "70 point" is the goal card's own target line today (`formatGoalTarget` does not plural "point"): the note says it the same way.
  it('⭐ says the goal card’s target and what the result waits on, above the note itself', () => {
    hold(GOAL)
    render(<OlumiAttentionCard />)
    expect(waits().querySelector('p')?.textContent).toBe('Target: 70 point')
    expect(Array.from(waits().querySelectorAll('li')).map((li) => li.textContent))
      .toEqual(['‘Weekly admin unrelated to these two projects’', '‘Score on the panel\'s published scoring sheet’'])
    expect(waits().textContent, 'no stray comma between labels (audit U2)').not.toContain(',')
    const card = screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)
    expect(card.textContent).toContain('rests on "Score on the panel\'s published scoring sheet", which is unknown')
    const body = Array.from(card.querySelectorAll('p')).find((p) => p.textContent?.startsWith('rests on'))!
    expect(waits().compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('an answerable label opens its card’s answer box; one with no answer is the label alone', () => {
    hold(GOAL)
    render(<OlumiAttentionCard />)
    fireEvent.click(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-waits-on-answer-routine_admin`))
    expect(useValuePrefillStore.getState().request).toMatchObject({ nodeId: 'routine_admin', text: '' })
    expect(screen.getByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-waits-on-panel_score`).textContent).toBe('‘Score on the panel\'s published scoring sheet’')
  })

  it('CONTRAST: a note on a card that is not a goal, or a Run with nothing listed: no target, no "Waits on"', () => {
    hold('routine_admin')
    render(<OlumiAttentionCard />)
    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID)).toBeTruthy()
    expect(screen.queryByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-waits`)).toBeNull()
    cleanup()
    hold(GOAL, { waits_on: [] })
    render(<OlumiAttentionCard />)
    expect(screen.queryByTestId(`${OLUMI_ATTENTION_CARD_TESTID}-waits`)).toBeNull()
    expect(screen.getByTestId(OLUMI_ATTENTION_CARD_TESTID).textContent).toContain('rests on')
  })
})
