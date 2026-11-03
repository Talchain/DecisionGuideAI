/**
 * v10 (#/canvas2), the "If it failed" lens: numbered failure stories beside the cards they rest on, "Write mine first"
 * (the person's own reasons before Olumi's), and no "Mitigate" line. #/canvas (the current presentation) is unchanged.
 *
 * Every block carries its CONTRAST: the same surface in the current presentation, or the same card not named by a story.
 */
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
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
import { V10WriteMineFirst, writeMineDraft } from '../V10WriteMineFirst'
import { revealOlumiSurface } from '../../canvas/conversation/revealOlumi'

vi.mock('../../flags', async (importOriginal) => ({ ...await importOriginal<Record<string, unknown>>(), isGraphLensEnabled: () => true }))
vi.mock('../../canvas/conversation/askAi', async (importOriginal) => ({ ...await importOriginal<Record<string, unknown>>(), askAiStage: () => 'ran-current' as never }))
vi.mock('../../canvas/conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn(() => true) }))
// The composer's draft lives in the conversation context; the specs below give it a real owner (see `ComposerHost`).
const composer = vi.hoisted(() => ({ draft: '' }))
vi.mock('../../canvas/conversation/ConversationContext', async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  useOptionalConversationContext: () => ({ draft: composer.draft }),
}))
const aiMode = vi.hoisted(() => ({ value: null as 'core-route' | null }))
vi.mock('../../v5/aiComparisonMode', async (importOriginal) => ({ ...await importOriginal<Record<string, unknown>>(), resolveAiComparisonMode: () => aiMode.value }))
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
  vi.mocked(revealOlumiSurface).mockClear()
  composer.draft = ''
  aiMode.value = null
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
    expect([...premortemStoryNumbers([worksheet], NODES)].map(([row, n]) => [row.row_id, n])).toEqual([['row-a', 1], ['row-b', 2]])
  })

  it('stand on the CARDS a story rests on; a link names no card, and a card no story names has no number', () => {
    const onCards = premortemNumbersOnCards([worksheet], NODES, EDGES)
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

/**
 * A real composer owner: the draft is state, and the REAL guidance store's `registerConversationCallbacks` is given the
 * host's replace-the-text prefill, exactly as `ConversationPanel` and `OlumiTabBody` do. `_prefillChat` is not mocked.
 */
function ComposerHost({ start = '' }: { start?: string }) {
  const [draft, setDraft] = useState(start)
  composer.draft = draft
  useEffect(() => useGuidanceStore.getState().registerConversationCallbacks(
    () => {}, () => {}, () => {}, () => {}, (text: string) => setDraft(text), () => {}, () => false,
  ), [])
  return <><output data-testid="draft">{draft}</output><V10WriteMineFirst /></>
}
const press = () => fireEvent.click(screen.getByTestId('premortem-write-mine'))
const draftNow = () => screen.getByTestId('draft').textContent

describe('"Write mine first" never erases what the person has typed', () => {
  const TYPED = 'Hiring slips if the £4,800 aim moves, 12 weeks at 3%'

  it('empty composer: the opening of the person’s own sentence is set (REAL guidance store)', () => {
    render(<ComposerHost />)
    press()
    expect(draftNow()).toBe('My reasons it failed: ')
  })

  it('existing text is kept character for character, with the opening put in front, once (REAL guidance store)', () => {
    render(<ComposerHost start={TYPED} />)
    press()
    expect(draftNow()).toBe(`My reasons it failed: ${TYPED}`)
  })

  it('repeated presses change nothing after the first, and erase nothing', () => {
    render(<ComposerHost start={TYPED} />)
    press(); press(); press()
    expect(draftNow()).toBe(`My reasons it failed: ${TYPED}`)
  })

  it('text the person typed after the opening survives further presses', () => {
    render(<ComposerHost start="My reasons it failed: readers drift, 3% fewer" />)
    press()
    expect(draftNow()).toBe('My reasons it failed: readers drift, 3% fewer')
  })

  it('an unchanged draft is not written back at all (nothing is replaced, not even with itself)', () => {
    useGuidanceStore.setState({ _prefillChat: prefill } as never)
    composer.draft = 'My reasons it failed: x'
    render(<V10WriteMineFirst />)
    press()
    expect(prefill).not.toHaveBeenCalled()
  })

  it('the composer may be on a hidden surface: every press fronts and focuses it, even when the text is unchanged', () => {
    render(<ComposerHost start={TYPED} />)
    press() // writes the opening (the store also reveals on a write), then the button reveals
    const afterFirst = vi.mocked(revealOlumiSurface).mock.calls.length
    expect(afterFirst).toBeGreaterThanOrEqual(1)
    press() // nothing to write: only the button's own reveal can have fired
    expect(vi.mocked(revealOlumiSurface).mock.calls.length).toBe(afterFirst + 1)
  })

  it('the older chat composer keeps its text in its own textarea: that text is kept too', () => {
    composer.draft = ''
    useGuidanceStore.setState({ _prefillChat: prefill } as never)
    render(<div data-testid="chat-composer"><textarea defaultValue="typed in the older composer" /><V10WriteMineFirst /></div>)
    press()
    expect(prefill).toHaveBeenCalledWith('My reasons it failed: typed in the older composer')
  })

  it('writeMineDraft: pure rule', () => {
    expect(writeMineDraft('')).toBe('My reasons it failed: ')
    expect(writeMineDraft('a')).toBe('My reasons it failed: a')
    expect(writeMineDraft('My reasons it failed:')).toBe('My reasons it failed:')
    expect(writeMineDraft('  spaced')).toBe('My reasons it failed:   spaced')
  })
})

describe('the numbers are heard as well as seen', () => {
  it('v10: a story’s number in the key card and on its card carry the same words, so they can be matched', () => {
    render(v10(<PreMortemWorksheet />))
    expect(screen.getAllByTestId('v10-story-no').map((el) => el.getAttribute('aria-label'))).toEqual(['Failure story 1', 'Failure story 2'])
    cleanup()
    const view = card('factor', 'factor', v10)
    expect(within(view.container).getByTestId('v10-story-discs').getAttribute('aria-label')).toBe('Failure story 2 rests on this card')
  })
})

describe('two worksheets that both use the same row_id', () => {
  const sheet = (turn: string) => {
    const r = readPremortemWorksheet({ _premortem_worksheet: { ...base, turn_id: turn, rows: [{ ...base.rows[0], row_id: 'row-1' }] } })
    expect(r.status, 'POSITIVE CONTROL: the worksheet parses').toBe('available')
    return (r as Extract<typeof r, { status: 'available' }>).worksheet
  }

  it('get distinct numbers in the merged list, on the stories and on their cards (numbered by position, not by row_id)', () => {
    const [w1, w2] = [sheet('turn-1'), sheet('turn-2')]
    expect(w1.rows[0].row_id).toBe(w2.rows[0].row_id) // the collision is real
    const numbers = premortemStoryNumbers([w1, w2], NODES)
    expect([...numbers.values()]).toEqual([1, 2])
    expect(numbers.get(w1.rows[0])).toBe(1)
    expect(numbers.get(w2.rows[0])).toBe(2)
    expect(premortemNumbersOnCards([w1, w2], NODES, EDGES).get('factor')).toEqual([1, 2])
  })

  it('CONTRAST: one worksheet alone is numbered 1', () => {
    const w1 = sheet('turn-1')
    expect([...premortemStoryNumbers([w1], NODES).values()]).toEqual([1])
  })
})

describe('where no worksheet is served, nothing is numbered and no list is drawn', () => {
  beforeEach(() => { useCanvasStore.setState({ runMeta: {} } as never) })
  const nothingDrawn = (container: HTMLElement) => {
    expect(container.querySelector('[data-testid="premortem-worksheet"]')).toBeNull()
    expect(container.querySelector('[data-testid="v10-story-no"]')).toBeNull()
    expect(container.querySelector('[data-testid="v10-story-discs"]')).toBeNull()
  }

  it('core route: the lens keeps its own line (stories arrive in the chat), no list, no numbers on the cards', () => {
    aiMode.value = 'core-route'
    const panel = render(v10(<LensInfoPanel />))
    nothingDrawn(panel.container)
    expect(screen.getByTestId('premortem-in-chat').textContent).toBe('Olumi’s failure stories arrive in the chat.')
    nothingDrawn(card('factor', 'factor', v10).container)
  })

  it('conventional route with no worksheet yet: the lens keeps "has not imagined", no list, no numbers', () => {
    const panel = render(v10(<LensInfoPanel />))
    nothingDrawn(panel.container)
    expect(screen.getByTestId('premortem-not-yet').textContent).toContain('Olumi has not imagined this model failing yet.')
  })

  it('CONTRAST: with a worksheet served, the list and the numbers are drawn', () => {
    useCanvasStore.setState({ runMeta: { premortemWorksheet: read, premortemRun: null } } as never)
    const view = render(v10(<PreMortemWorksheet />))
    expect(view.container.querySelector('[data-testid="premortem-worksheet"]')).not.toBeNull()
    expect(view.container.querySelectorAll('[data-testid="v10-story-no"]')).toHaveLength(2)
  })
})
