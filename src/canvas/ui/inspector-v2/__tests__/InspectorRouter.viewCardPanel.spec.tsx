/**
 * S4 / canvas A B6: on the olumi-core lane a selected View card, or the question, opens a panel that draws only what core wrote for it.
 * Bound by identity: every drawn string is the View's own at its `data-view` path, every word the card carries is drawn, each hover is
 * core's, and no text in the panel sits outside a View string (no "Untitled", no kind label, no DGAI words). Off the lane each gate
 * keeps today's routing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import type { View, ViewModel } from '../../../../olumiView/client'
import { QUESTION } from '../../../../olumiView/layout'

vi.mock('@xyflow/react', async (original) => ({ ...(await original<object>()), useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

const DIR = path.resolve('src/olumiView')
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal'] as const
const golden = (n: string): ViewModel => (JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8')) as View).model!

function at(model: ViewModel, p: string): unknown {
  const [id, ...rest] = p.split('.')
  let x: unknown = id === 'question' ? model.question : model.cards.find((c) => c.id === id)
  for (const k of rest) x = x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]
  return x
}

/** Every visible string a card carries, as the canvas card's own test reads it (viewCard.spec.tsx): never a hover, label, id or kind. */
const SKIP = new Set(['id', 'family', 'title', 'label', 'kind', 'aim_id', 'records', 'edit', 'driver'])
const shown = (x: unknown, p: string): string[] => typeof x === 'string' ? (x !== '' ? [p] : [])
  : Array.isArray(x) ? x.flatMap((y, i) => shown(y, `${p}.${i}`))
  : x !== null && typeof x === 'object' ? Object.entries(x).flatMap(([k, y]) => (SKIP.has(k) || (k === 'change' && typeof y === 'string') ? [] : shown(y, `${p}.${k}`))) : []

/** Text the panel draws that is not a View string. */
function foreign(panel: HTMLElement): string[] {
  const out: string[] = []
  const walk = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
  for (let t = walk.nextNode(); t !== null; t = walk.nextNode()) {
    if ((t.textContent ?? '').trim() !== '' && t.parentElement?.closest('[data-view]') == null) out.push(t.textContent!)
  }
  return out
}

const factor = { id: 'f1', type: 'factor', data: { label: 'Budget', kind: 'factor', category: 'controllable' }, position: { x: 0, y: 0 } }
const put = (nodes: unknown[]) => useCanvasStore.setState({
  nodes: nodes as never[], edges: [], results: { status: 'idle' },
  selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }, goalThreshold: null, confirmedNodeIds: new Set(), _internal: {},
} as never)
const cardNode = (card: ViewModel['cards'][number]) => ({ id: card.id, type: 'viewCard', data: { card }, position: { x: 0, y: 0 } })
const questionNode = (model: ViewModel) => ({ id: QUESTION, type: 'viewQuestion', data: { question: model.question, width: 600 }, position: { x: 0, y: 0 } })

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe('on the olumi-core lane a View card opens the View card panel', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })

  for (const n of GOLDEN) {
    it(`${n}: every card's panel draws its View strings at their paths, every word of the card, core's hovers, and nothing else`, () => {
      const model = golden(n)
      for (const card of model.cards) {
        put([cardNode(card)])
        const { unmount } = render(<InspectorRouter nodeId={card.id} edgeId={null} onClose={() => {}} />)
        const panel = screen.getByTestId('view-card-panel')
        for (const el of panel.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(model, el.dataset['view']!))
        const { id: _id, ...fields } = card
        for (const p of shown(fields, card.id)) expect(panel.querySelector(`[data-view="${p}"]`), p).not.toBeNull()
        if (card.figure !== null) expect(panel.querySelector(`[data-view="${card.id}.figure.text"]`)!.getAttribute('title')).toBe(card.figure.title)
        expect(foreign(panel), card.id).toEqual([])
        expect(screen.queryByText('Untitled')).toBeNull()
        unmount()
      }
    })
  }

  it('the question opens the panel too: its text, its date with core\'s hover, its badge, and nothing else', () => {
    // No golden question carries a date: one is set on a copy, as viewMarks.spec.tsx does, once as the person's and once as Olumi's.
    const dated = (olumi: boolean) => { const m = golden('european'); m.question.decide_by = { text: 'by 2027-03-31', title: olumi ? 'Olumi set this date' : 'You set this date', olumi }; return m }
    let seen = 0
    for (const model of [...GOLDEN.map(golden), dated(false), dated(true)]) {
      const q = model.question, n = model.question.text
      put([questionNode(model)])
      const { unmount } = render(<InspectorRouter nodeId={QUESTION} edgeId={null} onClose={() => {}} />)
      const panel = screen.getByTestId('view-card-panel')
      for (const el of panel.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(model, el.dataset['view']!))
      expect(panel.querySelector('[data-view="question.text"]')).not.toBeNull()
      if (q.decide_by !== null) {
        seen++
        const date = panel.querySelector('[data-view="question.decide_by.text"]')!
        expect(date.getAttribute('title')).toBe(q.decide_by.title)
        expect(date.classList.contains('text-info')).toBe(q.decide_by.olumi)
      }
      else expect(panel.querySelector('[data-view="question.decide_by.text"]')).toBeNull()
      expect(panel.querySelector('[data-view="question.badge.text"]') !== null).toBe(q.badge !== null)
      expect(foreign(panel), n).toEqual([])
      unmount()
    }
    expect(seen).toBe(2)
  })

  it('a ruled-out option shows its status as core wrote it (no golden card has one: core writes `ruled_out` as "ruled out")', () => {
    const model = golden('pricing'), card = model.cards.find((c) => c.family === 'option')!
    card.status = 'ruled out'
    put([cardNode(card)])
    render(<InspectorRouter nodeId={card.id} edgeId={null} onClose={() => {}} />)
    const panel = screen.getByTestId('view-card-panel')
    expect(panel.querySelector(`[data-view="${card.id}.status"]`)?.textContent).toBe('ruled out')
    expect(foreign(panel)).toEqual([])
  })

  it('an ordinary node on the lane still opens its own panel', () => {
    put([factor])
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={() => {}} />)
    expect(screen.queryByTestId('view-card-panel')).toBeNull()
    expect(screen.getByText('Budget')).toBeTruthy()
  })

  it('Close and Escape close it', () => {
    const card = golden('pricing').cards[0]!, onClose = vi.fn()
    put([cardNode(card)])
    render(<InspectorRouter nodeId={card.id} edgeId={null} onClose={onClose} />)
    fireEvent.click(within(screen.getByTestId('view-card-panel')).getByLabelText('Close inspector'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(screen.getByTestId('view-card-panel'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('off the lane routing is as today', () => {
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '') })

  it('a viewCard node opens the generic panel, not the View card panel', () => {
    const card = golden('pricing').cards[0]!
    put([cardNode(card)])
    render(<InspectorRouter nodeId={card.id} edgeId={null} onClose={() => {}} />)
    expect(screen.queryByTestId('view-card-panel')).toBeNull()
    expect(screen.getByText('Untitled')).toBeTruthy()
  })

  it('the question node opens the generic panel, not the View card panel', () => {
    put([questionNode(golden('pricing'))])
    render(<InspectorRouter nodeId={QUESTION} edgeId={null} onClose={() => {}} />)
    expect(screen.queryByTestId('view-card-panel')).toBeNull()
    expect(screen.getByText('Untitled')).toBeTruthy()
  })
})
