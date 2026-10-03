/**
 * POM-6 (27 Sep 2026) — A LINK NEVER RUNS UNDER A CARD IT DOES NOT CONNECT,
 * EVEN WHEN NO VERTICAL LEAD CAN CLEAR THE CARD.
 *
 * Measured on Paul's MRR board (17d1cd3a, landing and post-run, served and
 * local): "Pro paying subscribers → MRR" left its source straight down THROUGH
 * "Price sensitivity" — 62 of 117 path samples inside that card, every one
 * hidden under it — so it read as a Price sensitivity → MRR link the model does
 * not hold. The router's intermediate-tier rule could clear a card only by a
 * lead BESIDE it; here the source port (x 740) and the goal handle (x 832) both
 * sit inside the card's x-range (616–864), so it gave up and drew the plain
 * cubic through the card. On 90b8f080 two links into MRR also ran under the risk
 * row's "What else could go wrong?" prompt, which the router did not see at all.
 *
 * The geometry below is the served board's, in graph units (the skeptic's
 * measured x-ranges; rows 56 apart as the layout draws them). Assertions sample
 * the DRAWN path (`layeredLeadPath`) against every non-endpoint box.
 */
import { describe, it, expect } from 'vitest'
import { ROW_PROMPT_H, ROW_PROMPT_W } from '../../utils/nodeLayoutConstants'
import {
  resolveLayeredEdgeLeads,
  layeredLeadPath,
  layeredRouteBoxes,
  type RouteBox,
} from '../sameRowRoute'

type Box = RouteBox & { tier: number }

/** Sample an M/L/C path at `n` points per segment. */
function samplePath(d: string, n = 60): Array<{ x: number; y: number }> {
  const tokens = d.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? []
  const pts: Array<{ x: number; y: number }> = []
  let i = 0
  let cur = { x: 0, y: 0 }
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    const cmd = tokens[i++]
    if (cmd === 'M') cur = { x: num(), y: num() }
    else if (cmd === 'L') {
      const to = { x: num(), y: num() }
      for (let k = 0; k <= n; k++) pts.push({ x: cur.x + ((to.x - cur.x) * k) / n, y: cur.y + ((to.y - cur.y) * k) / n })
      cur = to
    } else if (cmd === 'C') {
      const c1 = { x: num(), y: num() }
      const c2 = { x: num(), y: num() }
      const to = { x: num(), y: num() }
      for (let k = 0; k <= n; k++) {
        const t = k / n
        const u = 1 - t
        pts.push({
          x: u * u * u * cur.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
          y: u * u * u * cur.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
        })
      }
      cur = to
    }
  }
  return pts
}

const inside = (p: { x: number; y: number }, b: RouteBox, inset = 1) =>
  p.x > b.x + inset && p.x < b.x + b.width - inset && p.y > b.y + inset && p.y < b.y + b.height - inset

// ── Paul's 17d1cd3a column, in graph units ──────────────────────────────────
const SUBSCRIBERS: Box = { id: 'pro_paying_subscribers', x: 616, y: 300, width: 248, height: 100, tier: 2 }
const NEW_SUBS: Box = { id: 'monthly_new_pro_subscribers', x: 320, y: 300, width: 248, height: 100, tier: 2 }
const PRICE_SENSITIVITY: Box = { id: 'price_sensitivity', x: 616, y: 456, width: 248, height: 100, tier: 3 }
const CHURN: Box = { id: 'monthly_churn', x: 320, y: 456, width: 248, height: 100, tier: 3 }
const MRR: Box = { id: 'mrr', x: 708, y: 720, width: 248, height: 110, tier: 5 }
const BOARD: Box[] = [SUBSCRIBERS, NEW_SUBS, PRICE_SENSITIVITY, CHURN, MRR]
// Source port at the card's bottom-centre (740); the goal handle at x 832, on
// its kind shape, 20.64 above the card.
const SX = 740
const SY = SUBSCRIBERS.y + SUBSCRIBERS.height
const TX = 832
const TY = MRR.y - 20.64

function drawn(boxes: Box[], sourceId = SUBSCRIBERS.id, targetId = MRR.id, sx = SX, sy = SY, tx = TX, ty = TY) {
  const route = resolveLayeredEdgeLeads(sourceId, targetId, sx, sy, tx, ty, boxes)
  const d = route
    ? layeredLeadPath(sx, sy, tx, ty, route)[0]
    : `M${sx},${sy} C${sx},${sy + 30} ${tx},${ty - 30} ${tx},${ty}`
  return { route, d, pts: samplePath(d) }
}

describe('POM-6 — a link past a card no lead can clear takes a sideways detour', () => {
  it('CONTRAST: the plain line from Pro paying subscribers to MRR runs through Price sensitivity', () => {
    const plain = samplePath(`M${SX},${SY} C${SX},${SY + 30} ${TX},${TY - 30} ${TX},${TY}`)
    expect(plain.filter((p) => inside(p, PRICE_SENSITIVITY)).length).toBeGreaterThan(10)
  })

  it('the router detours: the drawn line passes under NO card but its own ends', () => {
    const { route, pts } = drawn(BOARD)
    expect(route?.via, 'a detour column').toBeDefined()
    for (const b of BOARD) {
      if (b.id === SUBSCRIBERS.id || b.id === MRR.id) continue
      expect(pts.filter((p) => inside(p, b)).length, `under ${b.id}`).toBe(0)
    }
  })

  it('the detour column runs beside the card (right side, nearer the goal), and the line still ends on the goal handle', () => {
    const { route, pts } = drawn(BOARD)
    expect(route!.via!.x).toBeGreaterThanOrEqual(PRICE_SENSITIVITY.x + PRICE_SENSITIVITY.width)
    expect(route!.via!.top).toBeLessThan(PRICE_SENSITIVITY.y)
    expect(route!.via!.bottom).toBeGreaterThan(PRICE_SENSITIVITY.y + PRICE_SENSITIVITY.height)
    const last = pts[pts.length - 1]!
    expect(last.x).toBeCloseTo(TX, 6)
    expect(last.y).toBeCloseTo(TY, 6)
  })

  it('with a neighbour on the right, the column is the middle of the gap', () => {
    const right: Box = { id: 'other_risk', x: 912, y: 456, width: 248, height: 100, tier: 3 }
    const { route, pts } = drawn([...BOARD, right])
    expect(route?.via?.x).toBe((PRICE_SENSITIVITY.x + PRICE_SENSITIVITY.width + right.x) / 2)
    expect(pts.filter((p) => inside(p, right)).length).toBe(0)
  })

  it('CONTROL: a link a vertical lead CAN clear keeps its plain leads (no detour)', () => {
    // Pro plan price → MRR on the same board (#2121's case): the source port is
    // beside the card, so the lead-out drops below it.
    const PRICE: Box = { id: 'pro_plan_price', x: 912, y: 300, width: 248, height: 100, tier: 2 }
    const sx = PRICE.x + 40 // the port is beside Price sensitivity, not over it
    const { route } = drawn([...BOARD, PRICE], PRICE.id, MRR.id, sx, PRICE.y + PRICE.height, TX, TY)
    expect(route?.via).toBeUndefined()
  })
})

describe('POM-6 — the row-end prompt is an obstacle in its band', () => {
  // As SERVED (90b8, 27 Sep): a prompt in the xyflow store carries NO `measured`
  // size — the app never writes a prompt's dimensions back — so the router must
  // size it itself (the fixed prompt size).
  const prompt = {
    id: '__ghost-risk__',
    type: 'ghost-tier',
    position: { x: 912, y: 456 },
    data: { label: 'What else could go wrong?', tier: 'risk' },
  }
  const card = (b: Box, type: string) => ({ id: b.id, type, position: { x: b.x, y: b.y }, measured: { width: b.width, height: b.height } })

  it('layeredRouteBoxes gives a prompt its family\'s tier, and the joint consequence door tier 3', () => {
    const boxes = layeredRouteBoxes([card(SUBSCRIBERS, 'factor'), prompt, { ...prompt, id: '__ghost-consequence__', data: { tier: 'consequence' } }], () => false)
    expect(boxes.find((b) => b.id === '__ghost-risk__')?.tier).toBe(3)
    // Unmeasured, it takes the fixed prompt size the layout reserved.
    expect(boxes.find((b) => b.id === '__ghost-risk__')).toMatchObject({ x: 912, y: 456, width: ROW_PROMPT_W, height: ROW_PROMPT_H })
    expect(boxes.find((b) => b.id === '__ghost-consequence__')?.tier).toBe(3)
    expect(boxes.find((b) => b.id === SUBSCRIBERS.id)?.tier).toBe(2)
  })

  it('a line that would run under the prompt is routed clear of it', () => {
    // "Other MRR growth → MRR" on 90b8: its source sits above the prompt, its port 12 right of the prompt's right
    // edge, so the line bends left through the prompt on its way to MRR (Paul 1 Oct halved the prompt to 32; the
    // old source, port at x 1036, then passed clear of it and the CONTRAST below went false). Probed: a port at
    // x 932–980 crosses the 32 prompt blind and clears it routed; 956 is the middle.
    const OTHER: Box = { id: 'other_mrr_growth', x: 912 + ROW_PROMPT_W + 12 - 248 / 2, y: 300, width: 248, height: 100, tier: 2 }
    const boxes = layeredRouteBoxes(
      [card(SUBSCRIBERS, 'factor'), card(NEW_SUBS, 'factor'), card(PRICE_SENSITIVITY, 'risk'), card(CHURN, 'outcome'), card(MRR, 'goal'), card(OTHER, 'factor'), prompt],
      () => false,
    )
    const ghost = boxes.find((b) => b.id === '__ghost-risk__')!
    const sx = OTHER.x + OTHER.width / 2
    const { pts } = drawn(boxes, OTHER.id, MRR.id, sx, OTHER.y + OTHER.height, TX, TY)
    expect(pts.filter((p) => inside(p, ghost)).length).toBe(0)
    // CONTRAST: without the prompt in the box list the same line runs under it.
    const blind = boxes.filter((b) => b.id !== ghost.id)
    const { pts: blindPts } = drawn(blind, OTHER.id, MRR.id, sx, OTHER.y + OTHER.height, TX, TY)
    expect(blindPts.filter((p) => inside(p, ghost)).length).toBeGreaterThan(0)
  })
})
