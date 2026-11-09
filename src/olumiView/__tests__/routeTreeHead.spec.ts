/**
 * V11 rehearsal (DL 9 Nov): the opening board at 1232x704 shows the question, the aims and the options before any card detail.
 * Bound by card id on core's OWN Views:
 * - the hiring model a real first draft made (fixtures/rehearsal: the 04:35Z judged run's store, served by core 97f8c61a + ad57a105,
 *   zero calls), whose aims ended a tall story at its foot, off the opening frame;
 * - CONTRAST: the J1 bookshop and the strategy Reveal boards, which fit as the prototype draws them and keep that layout.
 */
import { FOOT_CLEAR, FOOT_W } from '../regions'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { aimsOf, QUESTION, routeTree } from '../layout'

const load = (f: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/fixtures/${f}`), 'utf8'))
const hiring = load('rehearsal/hiring-judged.core-97f8c61a+ad57a105.view3.json')
// The room the camera opens on at 1232x704 beside the 300 px dock (canvas.ts roomOf, measured on the served build): 584 down, 900 across.
const ROOM = 584, ROOM_W = 900, QW = 200
const H = (v: View, id: string) => (id === QUESTION ? 256 : v.model!.cards.find((c) => c.id === id)!.h)
const headOf = (v: View) => [QUESTION, ...aimsOf(v.model!), ...v.model!.cards.filter((c) => c.family === 'option').map((c) => c.id)]
const inRoom = (v: View, places: Map<string, { x: number; y: number }>) => {
  const ids = headOf(v), xs = ids.map((id) => places.get(id)!.x)
  return { across: Math.max(...xs) + 200 - Math.min(...xs), down: Math.max(...ids.map((id) => places.get(id)!.y + H(v, id))) }
}
const sizes = (v: View) => new Map([[QUESTION, { width: QW, height: 256 }], ...v.model!.cards.map((c) => [c.id, { width: 200, height: c.h }] as const)])

describe('the opening board shows the question, the aims and the options', () => {
  it('hiring (a real first draft): every aim and option is inside the opening room, the question first, the options under the aims', () => {
    const places = routeTree(hiring.model!, sizes(hiring), QW, new Set(), ROOM, ROOM_W)
    expect(aimsOf(hiring.model!)).toEqual(['increase_productivity', 'maintaining_code_quality', 'budget'])
    const r = inRoom(hiring, places)
    expect(r.across).toBeLessThanOrEqual(ROOM_W)
    expect(r.down).toBeLessThanOrEqual(ROOM)
    expect(places.get(QUESTION)).toEqual({ x: 0, y: 0 })
    const optionsTop = Math.min(...['hire_a_tech_lead', 'hire_two_developers', 'reallocate_a_developer_day_each_week_to_technical_leadership'].map((id) => places.get(id)!.y))
    for (const a of aimsOf(hiring.model!)) expect(places.get(a)!.y).toBeLessThan(optionsTop)
    // The story follows below the head: no story card sits above the options' row.
    for (const c of hiring.model!.cards) if (!headOf(hiring).includes(c.id)) expect(places.get(c.id)!.y).toBeGreaterThan(optionsTop)
  })
  it('V11 pixel pass (9 Nov): no story card straddles the opening room\'s foot; the story starts whole below it', () => {
    const places = routeTree(hiring.model!, sizes(hiring), QW, new Set(), ROOM, ROOM_W)
    const story = hiring.model!.cards.filter((c) => !headOf(hiring).includes(c.id))
    const straddle = story.filter((c) => places.get(c.id)!.y < ROOM && places.get(c.id)!.y + c.h > ROOM).map((c) => c.id)
    expect(straddle).toEqual([])
  })
  it('DL ruling (9 Nov): hiring\'s first story row, the person\'s first figures, is read whole in the opening room, FOOT_CLEAR above its foot', () => {
    const places = routeTree(hiring.model!, sizes(hiring), QW, new Set(), ROOM, ROOM_W)
    const story = hiring.model!.cards.filter((c) => !headOf(hiring).includes(c.id))
    const top = Math.min(...story.map((c) => places.get(c.id)!.y)), row = story.filter((c) => places.get(c.id)!.y === top)
    expect(top).toBeLessThan(ROOM)
    // Over the foot controls' columns a card ends FOOT_CLEAR above the room's foot; elsewhere within the room.
    for (const c of row) expect(top + c.h, c.id).toBeLessThanOrEqual(ROOM - (places.get(c.id)!.x < FOOT_W ? FOOT_CLEAR : 0))
    // The question flanks the aims and the options: they sit to its right.
    for (const id of headOf(hiring).filter((x) => x !== QUESTION)) expect(places.get(id)!.x, id).toBeGreaterThan(0)
  })
  it('CONTRAST: in a room too short for that row, the story starts whole past the room\'s foot, never cut', () => {
    const story = hiring.model!.cards.filter((c) => !headOf(hiring).includes(c.id))
    const full = routeTree(hiring.model!, sizes(hiring), QW, new Set(), ROOM, ROOM_W), top = Math.min(...story.map((c) => full.get(c.id)!.y))
    // One pixel too short for the first row to end FOOT_CLEAR above the foot.
    const short = Math.max(...story.filter((c) => full.get(c.id)!.y === top).map((c) => top + c.h + (full.get(c.id)!.x < FOOT_W ? FOOT_CLEAR : 0))) - 1
    const places = routeTree(hiring.model!, sizes(hiring), QW, new Set(), short, ROOM_W)
    expect(Math.min(...story.map((c) => places.get(c.id)!.y))).toBeGreaterThan(short)
  })
  it('CONTRAST: without the room (no measured canvas) the board is the prototype route tree, where the aims end the story off the frame', () => {
    const places = routeTree(hiring.model!, sizes(hiring), QW, new Set(), 0, 0)
    expect(inRoom(hiring, places).down).toBeGreaterThan(ROOM)
  })
  it('CONTRAST: the J1 bookshop, which fits, keeps the prototype layout (the routes in a column under the question)', () => {
    const v = load('j1/bookshop-v1-open.core-261df1d4.view3.json'), places = routeTree(v.model!, sizes(v), QW, new Set(), ROOM, ROOM_W)
    for (const c of v.model!.cards.filter((x) => x.family === 'option')) expect(places.get(c.id)!.x, c.id).toBe(0)
    expect(places.get(QUESTION)).toEqual({ x: 0, y: 0 })
  })
  it('the Reveal board, whichever layout its heights give, opens with its question, aims and routes inside the room', () => {
    const v = load('j1/strategy-reveal-split.core-261df1d4.view3.json'), r = inRoom(v, routeTree(v.model!, sizes(v), QW, new Set(), ROOM, ROOM_W))
    expect([r.across <= ROOM_W, r.down <= ROOM]).toEqual([true, true])
  })
})
