/**
 * A1 persistence gate (design lead, 2 Nov): on the olumi-core lane the canvas is drawn from core's View as `viewCard` nodes on
 * every open. Core holds the model; a local copy of a card is never the truth. So on the lane a viewCard, and every edge that
 * touches one, is never written to the autosave, never restored from an old one, and is left out of a snapshot's export and
 * import instead of failing the strict parse. Off the lane each row expects today's behaviour.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { saveAutosave, loadAutosave, clearAutosave } from '../scenarios'
import { exportSnapshot, importSnapshot } from '../../domain/migrations'

const KEY = 'olumi-canvas-autosave'
const slot: Record<string, string> = {}
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (k: string) => slot[k] ?? null,
    setItem: (k: string, v: string) => { slot[k] = v },
    removeItem: (k: string) => { delete slot[k] },
    clear: () => { for (const k of Object.keys(slot)) delete slot[k] },
  },
  writable: true,
})

const ordinary = { id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } } as Node
const card = { id: 'view:profit', type: 'viewCard', position: { x: 200, y: 0 }, data: { card: { id: 'profit', heading: 'Profit' } } } as Node
const toCard = { id: 'e1', source: 'price', target: 'view:profit' } as Edge
const graph = () => ({ timestamp: Date.now(), nodes: [ordinary, card], edges: [toCard] })
const saved = () => JSON.parse(slot[KEY]!) as { nodes: Node[]; edges: Edge[] }
const ids = (xs: { id: string }[]) => xs.map((x) => x.id)

describe.each([
  ['on the olumi-core lane', '1'],
  ['off the lane', ''],
])('viewCard persistence %s', (_, lane) => {
  const on = lane === '1'
  beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', lane); localStorage.clear(); clearAutosave() })
  afterEach(() => { vi.unstubAllEnvs(); clearAutosave() })

  it(on ? 'the autosave never writes a viewCard or an edge that touches one' : 'the autosave writes every node and edge, as today', () => {
    expect(saveAutosave(graph())).toBe(true)
    expect(ids(saved().nodes)).toEqual(on ? ['price'] : ['price', 'view:profit'])
    expect(ids(saved().edges)).toEqual(on ? [] : ['e1'])
  })

  it(on ? 'an old autosave holding a viewCard and an edge to it restores neither' : 'an old autosave restores every node and edge, as today', () => {
    slot[KEY] = JSON.stringify(graph())
    const restored = loadAutosave()!
    expect(ids(restored.nodes)).toEqual(on ? ['price'] : ['price', 'view:profit'])
    expect(ids(restored.edges)).toEqual(on ? [] : ['e1'])
  })

  it(on ? 'a snapshot exports and imports without the viewCard, and does not fail' : 'a snapshot with a viewCard exports it and fails the strict import, as today', () => {
    const out = exportSnapshot([ordinary, card], [toCard])
    expect(ids(out.nodes)).toEqual(on ? ['price'] : ['price', 'view:profit'])
    const back = importSnapshot(JSON.parse(JSON.stringify({ ...out, nodes: [ordinary, card], edges: [toCard] })))
    if (on) {
      expect(back).not.toBeNull()
      expect(ids(back!.nodes)).toEqual(['price'])
      expect(back!.edges).toEqual([])
    } else expect(back).toBeNull()
  })
})
