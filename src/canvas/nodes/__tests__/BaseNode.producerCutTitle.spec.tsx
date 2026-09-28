/**
 * ⭐ A TITLE THE PRODUCER CUT SHOWS THE WORDS IT WAS CUT FROM — and a title that
 * starts lower-case starts upper-case ON THE CARD (Paul's staging test, 28 Sep
 * 2026, debug export `olumi-debug-64c5eccc`).
 *
 * SERVED: the Question's label is "Help me decide whether to hire…" and the
 * Goal's "ability to focus on high-value…" — the label STRING ends in "…"; the
 * node's `description` holds the full text. The Question and Goal cards are
 * wide, and they showed the cut label.
 *
 * RULE (`shared/nodeCardTitle.ts`, applied once, in `BaseNode`'s title): a
 * label that ends in "…" / "..." whose description's first line starts with the
 * label's text before the ellipsis shows that description line; a first word
 * that is all lower-case gets an upper-case first letter. Display only — the
 * store's label is never touched.
 *
 * FIXTURE: the export's own `draft_graph` (`__fixtures__/realDraft.assistant64c5eccc.json`),
 * mapped through the product's own `mapDraftNodeToCanvas`. Bound by node id and
 * `node-title`.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { nodeCardTitle, recoverProducerCutTitle, titleCaseFirstWord } from '../shared/nodeCardTitle'
import served from '../../__fixtures__/realDraft.assistant64c5eccc.json'

type CanvasNode = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
const NODES = (served as { nodes: unknown[] }).nodes.map(mapDraftNodeToCanvas as (n: unknown) => CanvasNode)
const byId = (id: string) => {
  const n = NODES.find(x => x.id === id)
  expect(n, `PRECONDITION: the export carries ${id}`).toBeDefined()
  return n!
}

const QUESTION_ID = 'help_me_decide_whether_to_hire_a_personal_assistant_or_use_an_ai_assistant_to_save_money'
const GOAL_ID = 'ability_to_focus_on_high_value_tasks'

function renderCard(kind: 'decision' | 'goal' | 'factor', id: string, data: Record<string, unknown>) {
  const props = {
    id, type: kind, position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, data,
  }
  useCanvasStore.setState({ nodes: [props] as never, edges: [], highlightedNodes: new Set(), dimmedNodeIds: new Set() })
  const view = render(
    <ReactFlowProvider>
      <BaseNode
        id={id} type={kind} data={data} selected={false} isConnectable
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0}
        deletable selectable draggable nodeType={kind} icon={Circle}
      />
    </ReactFlowProvider>,
  )
  const root = view.container.querySelector('[role="group"]') as HTMLElement
  expect(root, 'the card root renders').not.toBeNull()
  return { root }
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [], highlightedNodes: new Set(), dimmedNodeIds: new Set() })
})
afterEach(() => cleanup())

describe('served 64c5eccc — the Question and the Goal show the words the producer cut', () => {
  it('PRECONDITION: the served labels end in "…" and the descriptions hold the full text', () => {
    expect(byId(QUESTION_ID).data.label).toBe('Help me decide whether to hire…')
    expect(byId(QUESTION_ID).data.description).toBe('Help me decide whether to hire a personal assistant or use an AI assistant to save money.')
    expect(byId(GOAL_ID).data.label).toBe('ability to focus on high-value…')
    expect(byId(GOAL_ID).data.description).toBe('ability to focus on high-value tasks')
  })

  it(`${QUESTION_ID}: node-title is the full question`, () => {
    renderCard('decision', QUESTION_ID, byId(QUESTION_ID).data)
    expect(screen.getByTestId('node-title').textContent).toBe(
      'Help me decide whether to hire a personal assistant or use an AI assistant to save money.',
    )
  })

  it(`${GOAL_ID}: node-title is the full goal, first letter upper-cased`, () => {
    renderCard('goal', GOAL_ID, byId(GOAL_ID).data)
    expect(screen.getByTestId('node-title').textContent).toBe('Ability to focus on high-value tasks')
  })

  it('the card name (accessible name) carries the full title too — not the cut label', () => {
    const { root } = renderCard('goal', GOAL_ID, byId(GOAL_ID).data)
    const name = root.getAttribute('aria-label') ?? ''
    expect(name).toContain('Ability to focus on high-value tasks')
    expect(name).not.toContain('…')
  })

  it('display only: the node data keeps the producer\'s label, byte for byte', () => {
    const data = { ...byId(GOAL_ID).data }
    renderCard('goal', GOAL_ID, data)
    expect(data.label).toBe('ability to focus on high-value…')
    const stored = useCanvasStore.getState().nodes.find(n => n.id === GOAL_ID)
    expect(stored?.data?.label).toBe('ability to focus on high-value…')
  })
})

describe('contrasts — the rule fires only on a producer cut it can prove', () => {
  it('a cut label whose description does NOT start with its text keeps the label', () => {
    renderCard('decision', 'q_other', { label: 'Help me decide whether to hire…', description: 'A different sentence entirely.' })
    expect(screen.getByTestId('node-title').textContent).toBe('Help me decide whether to hire…')
  })

  it('a label that is not cut keeps the label even when a description extends it', () => {
    renderCard('factor', 'f_whole', { label: 'Annual assistant-tool cost', description: 'Annual assistant-tool cost in USD per year' })
    expect(screen.getByTestId('node-title').textContent).toBe('Annual assistant-tool cost')
  })

  it('a first word that carries its own capitals ("iPhone") is never re-cased', () => {
    renderCard('factor', 'f_iphone', { label: 'iPhone sales' })
    expect(screen.getByTestId('node-title').textContent).toBe('iPhone sales')
  })
})

describe('nodeCardTitle — the pure rule', () => {
  it.each([
    ['Help me decide whether to hire…', 'Help me decide whether to hire a personal assistant or use an AI assistant to save money.', 'Help me decide whether to hire a personal assistant or use an AI assistant to save money.'],
    ['ability to focus on high-value…', 'ability to focus on high-value tasks', 'ability to focus on high-value tasks'],
    ['Three dots cut...', 'Three dots cut here in full', 'Three dots cut here in full'],
    ['Cut…', 'Different', 'Cut…'],
    ['Cut…', undefined, 'Cut…'],
    ['Cut…', 'Cut', 'Cut…'],
    ['…', 'Anything', '…'],
    ['Whole label', 'Whole label and more', 'Whole label'],
    ['First line only…', 'First line only is recovered\nSecond paragraph is not', 'First line only is recovered'],
  ])('recoverProducerCutTitle(%j, %j) → %j', (label, description, expected) => {
    expect(recoverProducerCutTitle(label, description)).toBe(expected)
  })

  it('a very long description is recovered up to a whole word, then marked cut', () => {
    const long = `Cut here ${'word '.repeat(60)}end.`
    const out = recoverProducerCutTitle('Cut here…', long)
    expect(out.startsWith('Cut here word')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(141)
    expect(out).not.toMatch(/wor…$/)
  })

  it.each([
    ['ability to focus', 'Ability to focus'],
    ['Already capital', 'Already capital'],
    ['iPhone sales', 'iPhone sales'],
    ['eBay listings', 'eBay listings'],
    ['£ first', '£ first'],
    ['', ''],
  ])('titleCaseFirstWord(%j) → %j', (input, expected) => {
    expect(titleCaseFirstWord(input)).toBe(expected)
  })

  it('nodeCardTitle composes both, in that order', () => {
    expect(nodeCardTitle('ability to focus on high-value…', 'ability to focus on high-value tasks')).toBe('Ability to focus on high-value tasks')
  })
})
