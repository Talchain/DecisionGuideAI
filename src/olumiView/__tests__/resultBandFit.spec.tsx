/**
 * The option card's range caption and rests-on label add lines to a card (the track itself adds none: resultRange.spec H1). Adding height has
 * broken the opening zoom before (the 31 px foot), so this pins the opening frame at Paul's 1232 x 704 (dock from x 869, top bar to y 68:
 * camera.spec.ts's derived insets) on SERVED boards (fixtures/real and the goldens, laid out by the lane's own layout from each card's served height) with every
 * option card taller by 0, 32 and the worst case DERIVED from the longest served caption and rests line (worstExtra below): each is held to two lines
 * (ResultBand.tsx: line-clamp-2 on both), so the bound is two lines of each plus the label's bar and gaps. jsdom cannot measure the real heights, so
 * the pixel amount is a stated bound (LINE_PX per line, GLYPH_PX per character), not a measurement. Bound by option id: each option must be wholly in the free canvas, clear of
 * the dock on the right, as it is today.
 */
import { describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import type { View } from '../client'
import { CARD_WIDTH, causalPlaces, QUESTION, questionPlace } from '../layout'
import { cameraFrame } from '../ViewCanvas'

const pane = { width: 1232, height: 704 }, free = { top: 68, right: 363, bottom: 26, left: 45 }
const dir = path.resolve('src/olumiView/fixtures/real')
const golden = path.resolve('src/olumiView/golden')
const read = (d: string, f: string, ext: string) => [f.replace(ext, ''), JSON.parse(readFileSync(path.join(d, f), 'utf8')) as View] as const
const boards = [...readdirSync(dir).filter((f) => f.endsWith('.view3.json')).map((f) => read(dir, f, '.view3.json')),
  ...readdirSync(golden).filter((f) => f.endsWith('.view.json')).map((f) => read(golden, f, '.view.json'))].filter(([, v]) => v.model != null && v.model.cards.length > 0)

/** Stated bounds (jsdom cannot measure): one line of the card's 11.5 px text, one character of it, the card's side padding, and the label's bar, gaps and margins. */
const LINE_PX = 16, GLYPH_PX = 6, PAD_PX = 24, FIXED_PX = 8
const perLine = Math.floor((CARD_WIDTH - PAD_PX) / GLYPH_PX)
const clamped = (text: string | null | undefined): number => (text == null || text.trim() === '' ? 0 : Math.min(2, Math.ceil(text.trim().length / perLine)))
/** Per option card with a chance: its served caption and its served rests line (the goal entry for the option and its headline aim), as lines on the card. */
const extraOf = (v: View, c: NonNullable<View['model']>['cards'][number]): number => {
  const rest = v.model!.run?.rests.find((r) => r.kind === 'goal' && r.option === c.id && r.aim === c.headline?.aim_id)
  const cap = clamped(c.headline?.range), lab = clamped(rest?.line)
  return (cap + lab) * LINE_PX + (lab > 0 ? FIXED_PX : 0)
}
const served = boards.flatMap(([, v]) => v.model!.cards.filter((c) => c.family === 'option' && c.headline?.state === 'chance').map((c) => ({ v, c })))
const worstExtra = Math.max(...served.map(({ v, c }) => extraOf(v, c)))
const longestLine = Math.max(...boards.flatMap(([, v]) => (v.model!.run?.rests ?? []).map((r) => r.line.trim().length)))

async function frameWith(view: View, extra: number) {
  const m = view.model!
  const grown = (c: (typeof m.cards)[number]) => (c.family === 'option' && c.headline?.state === 'chance' ? c.h + extra : c.h)
  const size = new Map(m.cards.map((c) => [c.id, { width: CARD_WIDTH, height: grown(c) }]))
  const places = await causalPlaces(m, size)
  const q = places.get(QUESTION)!
  const nodes: Node[] = [{ id: QUESTION, position: q, data: {}, measured: { width: questionPlace(m).width, height: 85 } },
    ...m.cards.map((c) => ({ id: c.id, position: places.get(c.id)!, data: {}, measured: { width: CARD_WIDTH, height: grown(c) } }))]
  const v = cameraFrame({ full: { zoom: 1, nodes } }, pane, free)!
  const out = nodes.filter((n) => m.cards.find((c) => c.id === n.id)?.family === 'option').filter((n) => {
    const l = n.position.x * v.zoom + v.x, t = n.position.y * v.zoom + v.y
    return !(l >= free.left - 0.5 && t >= free.top - 0.5 && l + n.measured!.width! * v.zoom <= pane.width - free.right + 0.5 && t + n.measured!.height! * v.zoom <= pane.height - free.bottom + 0.5)
  }).map((n) => n.id)
  return { zoom: v.zoom, out }
}

describe('the opening frame at 1232 x 704 with taller option cards', () => {
  it('F0 precondition: the served boards carry option cards with a chance', () => {
    expect(boards.length).toBeGreaterThan(3)
    expect(boards.filter(([, v]) => v.model!.cards.some((c) => c.family === 'option' && c.headline?.state === 'chance')).length).toBeGreaterThan(2)
  })
  it('F0b the worst case is derived from what core serves: its longest rests line needs more than the two lines the card allows, so the clamp is what bounds it, and the derived worst case lies above two lines and within four lines and the label\'s bar', () => {
    expect(longestLine, 'the longest served rests line runs past two lines at the card\'s width').toBeGreaterThan(2 * perLine)
    expect(worstExtra).toBeGreaterThan(2 * LINE_PX); expect(worstExtra).toBeLessThanOrEqual(4 * LINE_PX + FIXED_PX)
  })
  it('F1 catch: on every served board, an option wholly in the free canvas today stays wholly in it with 32 px and the derived worst case (worstExtra) more, and the zoom never rises', async () => {
    for (const [name, v] of boards) {
      const base = await frameWith(v, 0)
      for (const extra of [32, worstExtra]) {
        const t = await frameWith(v, extra)
        expect(t.out.filter((id) => !base.out.includes(id)), `${name} +${extra}px: options pushed out`).toEqual([])
        expect(t.zoom, `${name} +${extra}px`).toBeLessThanOrEqual(base.zoom + 1e-9)
      }
    }
  })
  it('F2 catch: the control is live: with 400 px more per option, some board does push an option out of the free canvas', async () => {
    let pushed = 0
    for (const [, v] of boards) { const base = await frameWith(v, 0), t = await frameWith(v, 400); pushed += t.out.filter((id) => !base.out.includes(id)).length }
    expect(pushed).toBeGreaterThan(0)
  })
})
