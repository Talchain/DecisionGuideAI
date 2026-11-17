/**
 * Kept ideas with no model are framed with their label in view (Test pilot, pair v3, 06:29Z: on a words-start board "Ideas you kept" sat under the
 * top bar at 2000, 1232 and 1.33). ideasOnlyPlaces leaves the label's room above the first row; the camera's board now starts at that room
 * (frameNodesOf). One camera: the ideas board has its own key (ideasBoardKeyOf) and settles without waiting for a question card it does not have
 * (settleIdsOf). The ideas are invented; the free canvas is the 1232 shot's (top bar and lens row to y 104, left toolbar to x 45, panel from x 885).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import { cameraFrame, frameNodesOf, ideasBoardKeyOf, IDEAS_TOP } from '../ViewCanvas'
import { ideasOnlyPlaces, QUESTION, settleIdsOf, SIMPLE_GAP_Y, simpleStageRow } from '../layout'
import { frameTop } from '../regions'
import type { View } from '../client'

const PANE = { width: 1232, height: 704 }, FREE = { top: 104, right: 1232 - 885, bottom: 26, left: 45 }
const row = simpleStageRow(PANE.width - FREE.left - FREE.right)
const extras = [{ id: 'idea:kept:1', band: 'ideas', h: 96 }, { id: 'idea:kept:2', band: 'ideas', h: 96 }] as never[] as { id: string; band: 'ideas'; h: number }[]
const places = ideasOnlyPlaces(extras as never, new Map(extras.map((e) => [e.id, { width: row.cardW, height: e.h }])), row)
const ideas: Node[] = extras.map((e) => { const p = places.get(e.id)!; return { id: e.id, type: 'viewIdea', position: { x: p.x, y: p.y }, data: {}, measured: { width: p.w, height: e.h } } })
const frame = (nodes: Node[]) => cameraFrame({ full: { zoom: 1, nodes } }, PANE, FREE, null, true)!
/** Where flow y lands on screen under a frame. */
const screenY = (v: { y: number; zoom: number }, y: number) => v.y + y * v.zoom

const served = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View
const keptRow = (id: number) => ({ id, text: `An invented idea number ${id}.`, turn: 3, by: 'olumi', kept_by: { id: 'p_1', name: 'Tester' }, from: 'floor' })
const wordsBoard = (ids: number[]) => ({ ...served, model: null, version: null, proposal: null, kept: ids.map(keptRow) }) as unknown as View

describe('kept ideas with no model: the camera frames their label too', () => {
  it('precondition (layout): the first row of ideas stands one row gap below the board origin, the label\'s room', () => {
    expect(Math.min(...[...places.values()].map((p) => p.y))).toBe(SIMPLE_GAP_Y)
    expect(SIMPLE_GAP_Y).toBeGreaterThan(0)
  })

  it('catch: framed with the label\'s room, the board\'s top (flow y 0) is at or below the free canvas\'s top; the first row sits a gap lower', () => {
    const v = frame(frameNodesOf(ideas, true))
    const top = frameTop(FREE.top)
    expect(screenY(v, 0)).toBeGreaterThanOrEqual(top - 0.5)
    expect(screenY(v, SIMPLE_GAP_Y)).toBeGreaterThan(top + 1)
  })

  it('contrast (the fault): framed from the idea cards alone, the first row is at the free top and the label\'s room starts above it, under the bar', () => {
    const v = frame(frameNodesOf(ideas, false))
    const top = frameTop(FREE.top)
    expect(Math.abs(screenY(v, SIMPLE_GAP_Y) - top)).toBeLessThan(0.5)
    expect(screenY(v, 0)).toBeLessThan(top - 1)
  })

  it('a board with a model is framed from its own nodes: no stand-in; the stand-in is one zero-size node at y 0, never for an empty board', () => {
    expect(frameNodesOf(ideas, false)).toEqual(ideas)
    const withTop = frameNodesOf(ideas, true)
    expect(withTop.slice(0, ideas.length)).toEqual(ideas)
    expect(withTop.slice(ideas.length).map((n) => [n.id, n.position.y, n.measured?.width, n.measured?.height])).toEqual([[IDEAS_TOP, 0, 0, 0]])
    expect(frameNodesOf([], true)).toEqual([])
  })
})

describe('one camera: the ideas board is a board of its own', () => {
  it('its key names the scenario and the kept set, and changes when an idea is kept; none with a model, none with nothing kept', () => {
    const one = ideasBoardKeyOf('s_1', wordsBoard([1])), two = ideasBoardKeyOf('s_1', wordsBoard([1, 2]))
    expect(one).not.toBe('')
    expect(two).not.toBe(one)
    expect(ideasBoardKeyOf('s_1', wordsBoard([]))).toBe('')
    expect(ideasBoardKeyOf('s_1', { ...wordsBoard([1]), model: served.model } as View)).toBe('')
    expect([ideasBoardKeyOf(null, wordsBoard([1])), ideasBoardKeyOf('s_1', null)]).toEqual(['', ''])
  })

  it('it settles on what it draws: no question card to wait on when there is no model; a model board still waits on its question', () => {
    const held = new Set(['idea:kept:1', 'idea:kept:2'])
    expect([...settleIdsOf(held, [], false)].sort()).toEqual(['idea:kept:1', 'idea:kept:2'])
    expect(settleIdsOf(held, [{ id: 'a' }]).has(QUESTION)).toBe(true)
  })
})
