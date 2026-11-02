/**
 * v10 (#/canvas2), the "If it failed" lens: numbered failure stories beside the cards they rest on, "Write mine first"
 * (the person's own reasons before Olumi's), and no "Mitigate" line. #/canvas (the current presentation) is unchanged.
 *
 * Every block carries its CONTRAST: the same surface in the current presentation, or the same card not named by a story.
 */
import type { ComponentProps, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { MemoryRouter } from 'react-router-dom'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseNode } from '../../canvas/nodes/BaseNode'
import { LensInfoPanel } from '../../canvas/components/LensInfoPanel'
import { PreMortemWorksheet } from '../../components/results/analysisNew/sections/PreMortemWorksheet'
import { useCanvasStore } from '../../canvas/store'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { readPremortemWorksheet } from '../../v5/readPremortemWorksheet'
import { worksheetFixture } from '../../v5/__tests__/premortemFixture'
import { PresentationProvider } from '../v10'
import { premortemNumbersOnCards, premortemStoryNumbers } from '../V10StoryNumbers'

vi.mock('../../flags', async (importOriginal) => ({ ...await importOriginal<Record<string, unknown>>(), isGraphLensEnabled: () => true }))
vi.mock('../../canvas/conversation/askAi', async (importOriginal) => ({ ...await importOriginal<Record<string, unknown>>(), askAiStage: () => 'ran-current' as never }))
vi.mock('../../canvas/nodes/shared/useNodeAttention', () => ({
  useNodeAttention: () => ({ reasons: [], marked: false, markedCount: 0, candidateCount: 0 }),
}))

const base = worksheetFixture()
/** Story 1 is option A's, resting on a LINK (no card); story 2 is option B's, resting on the "factor" card. */
const wire = {
  ...base,
  rows: [
    { row_id: 'row-a', option_id: 'opt-a', option_label: 'Buy', failure_way: 'The seller walks away.', early_warning: 'Replies slow down.',
      mitigation: 'Keep a second seller warm.', grounding: { kind: 'link', ids: ['e1'], labels: ['Capacity', 'Growth'] }, provenance: 'olumi_hypothesis', source: 'olumi_drafted' },
    base.rows[0],
  ],
  coverage: [{ option_id: 'opt-a', option_label: 'Buy', status: 'stress_tested' }, { option_id: 'opt-b', option_label: 'Build', status: 'stress_tested' }],
}
const read = readPremortemWorksheet({ _premortem_worksheet: wire })
const NODES = ['opt-a', 'opt-b', 'factor', 'goal'].map((id) => ({
  id, type: id.startsWith('opt') ? 'option' : id === 'goal' ? 'goal' : 'factor', position: { x: 0, y: 0 }, data: { label: id, type: id.startsWith('opt') ? 'option' : id === 'goal' ? 'goal' : 'factor' },
}))
const EDGES = [{ id: 'e1', source: 'factor', target: 'goal', data: {} }]

const prefill = vi.fn()
beforeEach(() => {
  expect(read.status, 'POSITIVE CONTROL: the two-story worksheet parses').toBe('available')
  prefill.mockReset()
  useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: () => {}, _dispatchAction: () => {} } as never)
  useCanvasStore.setState({
    currentScenarioId: base.scenario_id, nodes: NODES, edges: EDGES, lodRung: 'full', analysisFreshnessDirty: false,
    lastServerGraphHash: base.run.graph_hash_at_run, runMeta: { premortemWorksheet: read, premortemRun: null },
    lens: { ...useCanvasStore.getState().lens, active: 'premortem' },
  } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [], runMeta: {}, lens: { ...useCanvasStore.getState().lens, active: 'full' } } as never)
})

const v10 = (ui: ReactNode) => <MemoryRouter><PresentationProvider value="v10">{ui}</PresentationProvider></MemoryRouter>
const current = (ui: ReactNode) => <MemoryRouter>{ui}</MemoryRouter>

function card(id: string, kind: 'factor' | 'goal', wrap: (ui: ReactNode) => ReactNode) {
  const node = NODES.find((n) => n.id === id)!
  const props = { ...node, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 }
  return render(wrap(
    <ReactFlowProvider><BaseNode {...(props as unknown as ComponentProps<typeof BaseNode>)} nodeType={kind} icon={Circle} /></ReactFlowProvider>,
  ))
}

describe('the story numbers', () => {
  const worksheet = (read as Extract<typeof read, { status: 'available' }>).worksheet

  it('number the stories in the order the key card draws them: option by option, in the model order', () => {
    expect([...premortemStoryNumbers(worksheet, NODES)]).toEqual([['row-a', 1], ['row-b', 2]])
  })

  it('stand on the CARDS a story rests on; a link names no card, and a card no story names has no number', () => {
    const onCards = premortemNumbersOnCards(worksheet, NODES, EDGES)
    expect(onCards.get('factor')).toEqual([2])
    expect(onCards.has('goal')).toBe(false) // contrast: the link e1 ends at the goal, but story 1 rests on the link itself
    expect(onCards.has('opt-a')).toBe(false)
  })
})

describe('the numbers on the cards', () => {
  it('v10: the factor card story 2 rests on wears its number while "If it failed" is on', () => {
    const view = card('factor', 'factor', v10)
    expect(within(view.container).getByTestId('v10-story-discs').textContent).toBe('2')
  })

  it('CONTRAST: a card no story rests on wears none, in v10', () => {
    const view = card('goal', 'goal', v10)
    expect(within(view.container).queryByTestId('v10-story-discs')).toBeNull()
  })

  it('CONTRAST: the current presentation draws no number on the same card', () => {
    const view = card('factor', 'factor', current)
    expect(within(view.container).queryByTestId('v10-story-discs')).toBeNull()
  })

  it('unmounts at the low-detail rung (the canvas zoomed out to lines); CONTRAST: the full rung drew it', () => {
    useCanvasStore.setState({ lodRung: 'line' } as never)
    const view = card('factor', 'factor', v10)
    expect(within(view.container).queryByTestId('v10-story-discs')).toBeNull()
  })

  it('CONTRAST: another lens draws no number on the same v10 card', () => {
    useCanvasStore.setState({ lens: { ...useCanvasStore.getState().lens, active: 'full' } } as never)
    const view = card('factor', 'factor', v10)
    expect(within(view.container).queryByTestId('v10-story-discs')).toBeNull()
  })
})

describe('the stories in the key card', () => {
  it('v10: each story leads with its number, and Olumi’s "Mitigate" line is not drawn (first signs stay)', () => {
    render(v10(<PreMortemWorksheet />))
    const articles = [...document.querySelectorAll('[data-row-id]')]
    expect(articles.map((a) => within(a as HTMLElement).getByTestId('v10-story-no').textContent)).toEqual(['1', '2'])
    expect(screen.queryAllByTestId('premortem-mitigation')).toHaveLength(0)
    expect(document.body.textContent).toContain('Early warning: Replies slow down.')
  })

  it('CONTRAST: the current presentation shows no number and keeps both Mitigate lines', () => {
    render(current(<PreMortemWorksheet />))
    expect(screen.queryAllByTestId('v10-story-no')).toHaveLength(0)
    expect(screen.getAllByTestId('premortem-mitigation')).toHaveLength(2)
  })
})

describe('"Write mine first"', () => {
  beforeEach(() => { useCanvasStore.setState({ runMeta: {} } as never) }) // no worksheet yet: the idle key

  it('v10: sits beside "Imagine it failed" and only PREFILLS the composer with the opening of the person’s own sentence', () => {
    render(v10(<LensInfoPanel />))
    expect(screen.getByTestId('premortem-ask').textContent).toBe('Imagine it failed')
    fireEvent.click(screen.getByTestId('premortem-write-mine'))
    expect(prefill).toHaveBeenCalledTimes(1)
    expect(prefill).toHaveBeenCalledWith('My reasons it failed: ')
  })

  it('v10: with no chat to take the prefill there is no button (never a dead press)', () => {
    useGuidanceStore.setState({ _prefillChat: null } as never)
    render(v10(<LensInfoPanel />))
    expect(screen.queryByTestId('premortem-write-mine')).toBeNull()
  })

  it('CONTRAST: the current presentation has no such button and keeps its own ask words', () => {
    render(current(<LensInfoPanel />))
    expect(screen.queryByTestId('premortem-write-mine')).toBeNull()
    expect(screen.getByTestId('premortem-ask').textContent).toBe('Ask Olumi to imagine it failed')
  })
})
