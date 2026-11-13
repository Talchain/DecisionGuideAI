/**
 * The board's geometry, and nothing else: a pure port of the look-proof's page script (ui-ws2-20261112 `src/template.html`:
 * build() ~451, order() ~483, layout() ~505, roundPath() and px()). No DOM, no React, no window.
 *
 * It decides which View items become board nodes and of which kind, the rows and their order (the barycentre sort), the width each
 * node is drawn at, the x/y of every node, and every connector (lanes, ports, gutters, rounded paths, leaders, arrowheads, sign
 * chips and the proposed-link mark). It formats no model value: every word and figure on the board still comes from the View.
 *
 * Inputs the page has to MEASURE (the look-proof read them from the DOM), so here they are arguments:
 *  - the height of every node at the width `boardNodesOf` gave it (`offsetHeight`);
 *  - the question's last line of text (`Range.getClientRects()` on its heading), which is where the question's leader starts;
 *  - optionally the board's own client size, because at a fractional device scale the browser snaps the 48px top bar and the
 *    board's height by a pixel (ref: 1501x940 at scale 1.33 gave a board 1125x893, not 1125x892).
 *
 * CSS arithmetic reproduced rather than read: the panel is `clamp(376px, 24vw, 448px)` wide, the top bar 48px, so the board is
 * `w - clamp(376, 0.24w, 448)` by `h - 48`. The card width is not CSS at all: it comes from `layout()` and is reproduced in full.
 * Constants and rounding are the template's, line for line; do not "tidy" them.
 */
import type { View, ViewCard, ViewLink } from '../olumiView/client'

export type Box = { w: number; h: number }

/** CSS viewport as the page sees it (`innerWidth`, `innerHeight`, `devicePixelRatio`). `board` is the measured board client size. */
export type BoardViewport = { w: number; h: number; scale: number; board?: Box }

export type BoardNodeKind = 'question' | 'card' | 'note' | 'aimslot'
export type BoardRowKind = 'question' | 'options' | 'risks' | 'figures' | 'aims' | 'aimslot'

export type BoardNode = {
  id: string
  kind: BoardNodeKind
  /** The View card's family; null for the question and the aim slot. */
  family: string | null
  row: number
  rowKind: BoardRowKind
  x: number
  w: number
}

export type BoardNodeGeom = BoardNode & { y: number; h: number }

/** Where the question heading's last line of text sits, relative to the question node's own top-left corner. */
export type LastLine = { right: number; top: number; height: number }
export type Measured = { questionLastLine?: LastLine | null }

export type WireMarker =
  | { kind: 'dot'; cx: number; cy: number; r: number }
  | { kind: 'head'; cls: 'head-sized' | 'head-firm' | 'head-open'; d: string }
  | { kind: 'chip'; cx: number; cy: number; r: number; d: string; sign: 'increases' | 'decreases' }
  | { kind: 'wmark'; d: string }

export type BoardWire = {
  /** Index in the View's `model.links` (links the board cannot route are absent, so this is not dense). */
  i: number
  from: string
  to: string
  /** The path, exactly as the template builds it. */
  d: string
  /** The path's class names, exactly as the template builds them. */
  cls: string
  leader: boolean
  markers: WireMarker[]
}

export type BoardRowGeom = {
  kind: BoardRowKind
  y: number
  h: number
  ids: string[]
  /** The gap below this row (absent for the last row). */
  gap: { top: number; h: number; lanes: number; topClear: number; botClear: number } | null
}

export type BoardLayout = {
  /** The board's client size this was laid out for. */
  board: Box
  /** The stage's size: the board's width, and the taller of the content and the board. */
  stage: Box
  wide: boolean
  cardW: number
  contentH: number
  nodes: BoardNodeGeom[]
  rows: BoardRowGeom[]
  wires: BoardWire[]
  /** Links whose ends are not on the board ("from -> to"). */
  unrouted: string[]
  /** The look-proof's own report strings, so the picture and the product can be compared word for word. */
  report: { rows: string[]; cardW: number; contentH: number; overlaps: string[]; outside: string[]; fitsFirstView: boolean }
}

/* ------------------------------------------------------------------ internal model */

type Link = ViewLink
type Causal = NonNullable<ViewLink['causal']>

interface N {
  id: string
  kind: BoardNodeKind
  card: ViewCard | null
  isQ: boolean
  slot: boolean
  note: boolean
  created: number
  row: number
  x: number
  y: number
  w: number
  h: number
  b: number | null
  /** a note's offset below its row's top where more notes than columns share one column (they stack, never overlap) */
  off?: number
  ins: K[]
  outs: K[]
}
interface Mid { row: number; key: string; x: number }
interface K {
  l: Link
  i: number
  a: N
  b: N
  leader: boolean
  toQ: boolean
  same: boolean
  up: boolean
  src: N
  dst: N
  sx: number
  tx: number
  mid: Mid[]
  xs: number[] | null
  lane: number[]
  ly: number
}
interface R { kind: BoardRowKind; cards?: ViewCard[]; nodes: N[]; defer?: boolean; h: number; y: number }

const NOTE_FAMILIES = new Set(['left_out', 'condition', 'relation'])
const BAR_H = 48
const PANEL_MIN = 376
const PANEL_MAX = 448
const PANEL_VW = 0.24

/** The board's client size: the measured one if given, else the template's CSS grid arithmetic (`clamp(376px,24vw,448px)`, 48px bar). */
export function boardSizeOf(viewport: BoardViewport): Box {
  if (viewport.board) return viewport.board
  const panel = Math.min(PANEL_MAX, Math.max(PANEL_MIN, viewport.w * PANEL_VW))
  return { w: Math.round(viewport.w - panel), h: viewport.h - BAR_H }
}

function px(n: number): number { return Math.round(n) + 0.5 }

/** The template's roundPath(), unchanged: drops repeated and collinear points, rounds each corner with a quadratic. */
function roundPath(pts: number[][], r: number): string {
  const out: number[][] = [pts[0]]
  let i: number
  for (i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i]
    if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01) continue
    out.push(b)
  }
  const c: number[][] = [out[0]]
  for (i = 1; i < out.length - 1; i++) {
    const p = c[c.length - 1], m = out[i], n = out[i + 1]
    if ((Math.abs(p[0] - m[0]) < 0.01 && Math.abs(m[0] - n[0]) < 0.01) || (Math.abs(p[1] - m[1]) < 0.01 && Math.abs(m[1] - n[1]) < 0.01)) continue
    c.push(m)
  }
  c.push(out[out.length - 1])
  let d = 'M' + c[0][0] + ' ' + c[0][1]
  for (i = 1; i < c.length - 1; i++) {
    const x0 = c[i - 1][0], y0 = c[i - 1][1], x1 = c[i][0], y1 = c[i][1], x2 = c[i + 1][0], y2 = c[i + 1][1]
    const d1 = Math.hypot(x1 - x0, y1 - y0), d2 = Math.hypot(x2 - x1, y2 - y1), rr = Math.min(r, d1 / 2, d2 / 2)
    d += ' L' + (x1 - (x1 - x0) / d1 * rr) + ' ' + (y1 - (y1 - y0) / d1 * rr) + ' Q' + x1 + ' ' + y1 + ' ' + (x1 + (x2 - x1) / d2 * rr) + ' ' + (y1 + (y2 - y1) / d2 * rr)
  }
  const l = c[c.length - 1]
  return d + ' L' + l[0] + ' ' + l[1]
}

/* ------------------------------------------------------------------ build(), order() */

interface Built { rows: R[]; created: N[]; links: K[]; unrouted: string[] }

function newNode(created: N[], byId: Map<string, N>, id: string, kind: BoardNodeKind, card: ViewCard | null): N {
  const n: N = { id, kind, card, isQ: kind === 'question', slot: kind === 'aimslot', note: kind === 'note', created: created.length, row: 0, x: 0, y: 0, w: 0, h: 0, b: null, ins: [], outs: [] }
  created.push(n)
  byId.set(id, n)
  return n
}

function build(view: View): Built {
  const M = view.model
  const cards: ViewCard[] = M ? M.cards || [] : []
  const rows: R[] = []
  const created: N[] = []
  const byId = new Map<string, N>()
  const noteCards = cards.filter((c) => NOTE_FAMILIES.has(c.family))

  rows.push({ kind: 'question', nodes: [newNode(created, byId, 'page:question', 'question', null)], h: 0, y: 0 })
  const opts = cards.filter((c) => c.family === 'option')
  let quants = cards.filter((c) => c.family === 'quantity')
  const risks = cards.filter((c) => c.family === 'risk')
  const aims = cards.filter((c) => c.family === 'goal' || c.family === 'limit')
  const other = cards.filter((c) => ['option', 'quantity', 'risk', 'goal', 'limit'].indexOf(c.family) < 0 && !NOTE_FAMILIES.has(c.family))
  quants = quants.concat(other)
  /* as-late-as-possible levels inside the figure band, from the links between figures only */
  const qid = new Set<string>()
  quants.forEach((c) => { qid.add(c.id) })
  const succ = new Map<string, string[]>()
  ;(M ? M.links || [] : []).forEach((l) => {
    if (qid.has(l.from) && qid.has(l.to) && l.from !== l.to) {
      const s = succ.get(l.from) || []
      s.push(l.to)
      succ.set(l.from, s)
    }
  })
  const memo = new Map<string, number>()
  const height = (id: string, seen: Set<string> = new Set()): number => {
    const got = memo.get(id)
    if (got != null) return got
    if (seen.has(id)) return 0
    seen.add(id)
    let m = 0
    ;(succ.get(id) || []).forEach((s) => { m = Math.max(m, 1 + height(s, seen)) })
    memo.set(id, m)
    return m
  }
  let maxH = 0
  quants.forEach((c) => { maxH = Math.max(maxH, height(c.id)) })
  const levels: ViewCard[][] = []
  for (let i = 0; i <= maxH; i++) levels.push([])
  quants.forEach((c) => { levels[maxH - height(c.id)].push(c) })
  if (opts.length) rows.push({ kind: 'options', cards: opts, nodes: [], h: 0, y: 0 })
  levels.forEach((lv, i) => {
    if (i === levels.length - 1 && risks.length) rows.push({ kind: 'risks', cards: risks, defer: true, nodes: [], h: 0, y: 0 })
    if (lv.length) rows.push({ kind: 'figures', cards: lv, nodes: [], h: 0, y: 0 })
  })
  if (aims.length) rows.push({ kind: 'aims', cards: aims, nodes: [], h: 0, y: 0 })
  rows.forEach((r, ri) => {
    if (r.cards) r.nodes = r.cards.map((c) => newNode(created, byId, c.id, 'card', c))
    r.nodes.forEach((n) => { n.row = ri })
  })
  if (!aims.length) {
    const s = newNode(created, byId, 'slot:aim', 'aimslot', null)
    s.row = rows.length
    rows.push({ kind: 'aimslot', nodes: [s], h: 0, y: 0 })
  }
  noteCards.forEach((c) => {
    const n = newNode(created, byId, c.id, 'note', c)
    n.row = 0
    rows[0].nodes.push(n)
  })

  const all = (M ? M.links || [] : []).map((l, i) => ({ l, i, a: byId.get(l.from), b: byId.get(l.to) }))
  const unrouted = all.filter((k) => !k.a || !k.b).map((k) => k.l.from + ' -> ' + k.l.to)
  const links: K[] = []
  all.forEach((k) => {
    if (!k.a || !k.b || k.a === k.b) return
    links.push({
      l: k.l, i: k.i, a: k.a, b: k.b, leader: !!(k.a.note || k.b.note || k.a.isQ || k.b.isQ),
      toQ: false, same: false, up: false, src: k.a, dst: k.b, sx: 0, tx: 0, mid: [], xs: null, lane: [], ly: 0,
    })
  })
  order(rows, links)
  return { rows, created, links, unrouted }
}

/** options keep the View's order; every later row sits under what points at it */
function order(rows: R[], links: K[]): void {
  const placed = new Map<string, number>()
  const bary = (n: N): number | null => {
    const xs: number[] = []
    links.forEach((k) => {
      if (k.leader) return
      const o = k.a === n ? k.b : k.b === n ? k.a : null
      const p = o ? placed.get(o.id) : undefined
      if (o && p != null) xs.push(p)
    })
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
  }
  const place = (r: R): void => { r.nodes.forEach((n, i) => { placed.set(n.id, (i + 0.5) / r.nodes.length) }) }
  const sortRow = (r: R): void => {
    const orig = r.nodes.slice()
    r.nodes.forEach((n) => { n.b = bary(n) })
    r.nodes.sort((a, b) => {
      const x = a.b == null ? (orig.indexOf(a) + 0.5) / orig.length : a.b
      const y = b.b == null ? (orig.indexOf(b) + 0.5) / orig.length : b.b
      return x - y || orig.indexOf(a) - orig.indexOf(b)
    })
  }
  const deferred: R[] = []
  rows.forEach((r, i) => {
    if (i === 0) return
    if (i === 1) { place(r); return }
    if (r.defer) { deferred.push(r); return }
    sortRow(r)
    place(r)
  })
  deferred.forEach((r) => { sortRow(r); place(r) })
}

/* ------------------------------------------------------------------ widths (the first half of layout()) */

interface Cols { wide: boolean; padT: number; colGap: number; cardW: number; maxCount: number }

function assignWidths(rows: R[], bw: number): Cols {
  const wide = bw > 1300
  const padL = wide ? 40 : 16, padR = wide ? 40 : 16, padT = wide ? 24 : 12, colGap = wide ? 24 : 12
  const modelW = bw - padL - padR
  let maxCount = 1
  rows.forEach((r) => { if (r.kind !== 'question' && r.kind !== 'aimslot') maxCount = Math.max(maxCount, r.nodes.length) })
  const cardW = Math.floor(Math.min(wide ? 300 : 280, (modelW - (maxCount - 1) * colGap) / maxCount))
  const usedW = maxCount * cardW + (maxCount - 1) * colGap
  const x0 = padL + Math.max(0, Math.round((modelW - usedW) / 2))
  const noteList = rows[0].nodes.filter((n) => n.note)
  const nN = Math.min(noteList.length, Math.max(0, maxCount - 1))
  /* x and width: notes take the right-hand columns of the header band, the question the rest */
  rows.forEach((r) => {
    if (r.kind === 'question') {
      const q = r.nodes[0], qc = maxCount - nN
      q.x = x0
      q.w = qc * cardW + (qc - 1) * colGap
      noteList.forEach((n, i) => {
        const col = Math.min(maxCount - 1, qc + i)
        n.x = x0 + col * (cardW + colGap)
        n.w = cardW
      })
      return
    }
    if (r.kind === 'aimslot') {
      const s = r.nodes[0], sc = Math.min(maxCount, 3)
      s.w = sc * cardW + (sc - 1) * colGap
      s.x = x0 + Math.round((usedW - s.w) / 2)
      return
    }
    const n = r.nodes.length
    let ws = r.nodes.map(() => 1)
    const grow = r.kind === 'aims' && n < maxCount ? Math.min(1.5, maxCount / n) : 1
    const hasVals = (nd: N): boolean => !!(nd.card && nd.card.values && nd.card.values.length)
    if (n > 1 && r.nodes.some(hasVals) && r.nodes.some((nd) => !hasVals(nd))) ws = r.nodes.map((nd) => (hasVals(nd) ? 1.3 : 0.7))
    const sum = ws.reduce((a, b) => a + b, 0)
    const avail = Math.min(usedW - (n - 1) * colGap, Math.round(n * cardW * grow))
    const rw = avail + (n - 1) * colGap
    let x = x0 + Math.round((usedW - rw) / 2)
    r.nodes.forEach((nd, i) => {
      nd.w = Math.round(avail * ws[i] / sum)
      nd.x = x
      x += nd.w + colGap
    })
  })
  return { wide, padT, colGap, cardW, maxCount }
}

function rowKindOf(rows: R[], n: N): BoardRowKind { return rows[n.row].kind }

function publicNode(rows: R[], n: N): BoardNode {
  return { id: n.id, kind: n.kind, family: n.card ? n.card.family : null, row: n.row, rowKind: rowKindOf(rows, n), x: n.x, w: n.w }
}

/**
 * The board's nodes, row by row and left to right in the order the template draws them (question and its notes first, then the
 * options, the figure levels with the risks before the last, the aims or the empty aim slot), each with the width it is drawn at.
 * Measure each at that width, then call `layoutBoard`.
 */
export function boardNodesOf(view: View, viewport: BoardViewport): BoardNode[] {
  const b = build(view)
  assignWidths(b.rows, boardSizeOf(viewport).w)
  const out: BoardNode[] = []
  b.rows.forEach((r) => { r.nodes.forEach((n) => { out.push(publicNode(b.rows, n)) }) })
  return out
}

/* ------------------------------------------------------------------ layout(), the rest */

export function layoutBoard(view: View, heights: ReadonlyMap<string, number>, viewport: BoardViewport, measured: Measured = {}): BoardLayout {
  const { rows, created, links, unrouted } = build(view)
  const board = boardSizeOf(viewport)
  const bw = board.w, bh = board.h
  const { wide, padT, colGap, cardW } = assignWidths(rows, bw)
  const all = created

  all.forEach((n) => {
    const h = heights.get(n.id)
    if (h == null) throw new Error('layoutBoard: no height for ' + n.id)
    n.h = h
  })
  rows.forEach((r) => { r.h = Math.max(...r.nodes.map((n) => n.h)) })
  /* notes beyond the header band's free columns share its last column: stack them there (positions only; no node, link or order changes) */
  const stack = new Map<number, number>()
  rows[0].nodes.forEach((n) => { if (!n.note) return; const top = stack.get(n.x) ?? 0; n.off = top; stack.set(n.x, top + n.h + colGap) })
  stack.forEach((t) => { rows[0].h = Math.max(rows[0].h, t - colGap) })

  /* ports */
  all.forEach((n) => { n.ins = []; n.outs = [] })
  links.forEach((k) => {
    k.toQ = k.leader && (k.a.isQ || k.b.isQ)
    k.same = false
    k.up = false
    if (k.toQ) {
      k.src = k.a.isQ ? k.b : k.a
      k.dst = k.a.isQ ? k.a : k.b
      return
    }
    k.up = k.a.row > k.b.row
    k.src = k.up ? k.b : k.a
    k.dst = k.up ? k.a : k.b
    if (k.src.row === k.dst.row) { k.same = true; k.src.outs.push(k); k.dst.outs.push(k); return }
    k.src.outs.push(k)
    k.dst.ins.push(k)
  })
  const cx = (n: N): number => n.x + n.w / 2
  const portXs = (n: N, list: K[], other: (k: K, m: N) => N): void => {
    list.sort((p, q) => cx(other(p, n)) - cx(other(q, n)) || p.i - q.i)
    const c = list.length, step = Math.min(0.17, 0.66 / Math.max(1, c))
    list.forEach((k, i) => {
      const x = n.note ? px(n.x + 5 + i * 7) : px(n.x + n.w * (0.5 + (i - (c - 1) / 2) * step))
      if (k.dst === n && !k.same) k.tx = x
      else if (k.src === n) k.sx = x
      else k.tx = x
    })
  }
  all.forEach((n) => {
    portXs(n, n.ins, (k) => k.src)
    portXs(n, n.outs, (k, m) => (k.src === m ? k.dst : k.src))
  })

  /* gutters through the rows a link passes */
  const gut = new Map<string, { x: number; ks: K[] }>()
  links.forEach((k) => {
    k.mid = []
    if (k.toQ || k.same) return
    let prev = k.sx
    for (let m = k.src.row + 1; m < k.dst.row; m++) {
      const ns = rows[m].nodes.slice().sort((a, b) => a.x - b.x)
      const cands = [ns[0].x - colGap / 2]
      for (let j = 0; j < ns.length - 1; j++) cands.push((ns[j].x + ns[j].w + ns[j + 1].x) / 2)
      cands.push(ns[ns.length - 1].x + ns[ns.length - 1].w + colGap / 2)
      let best = 0, bd = 1e9
      cands.forEach((c, ci) => {
        const d = Math.abs(c - prev) + Math.abs(c - k.tx)
        if (d < bd) { bd = d; best = ci }
      })
      const key = m + ':' + best
      let g = gut.get(key)
      if (!g) { g = { x: cands[best], ks: [] }; gut.set(key, g) }
      g.ks.push(k)
      k.mid.push({ row: m, key, x: 0 })
      prev = cands[best]
    }
  })
  gut.forEach((g, key) => {
    g.ks.sort((p, q) => p.tx - q.tx)
    g.ks.forEach((k, i) => {
      k.mid.forEach((md) => { if (md.key === key) md.x = px(g.x + (i - (g.ks.length - 1) / 2) * 4) })
    })
  })

  /* lanes, and how much air each gap needs for the marks that sit in it */
  interface Seg { k: K; gi: number; j: number; a: number; b: number; lane: number; y: number }
  const nGap = rows.length - 1
  const segs: Seg[][] = [], passes: number[] = [], topC: number[] = [], botC: number[] = []
  for (let g = 0; g < nGap; g++) { segs.push([]); passes.push(0); topC.push(7); botC.push(7) }
  links.forEach((k) => {
    if (k.toQ) return
    const c: Causal | null = k.l.causal || null
    const signed = !!(c && (c.sign === 'increases' || c.sign === 'decreases'))
    if (k.same) {
      const gs = Math.min(k.src.row, nGap - 1)
      segs[gs].push({ k, gi: gs, j: 0, a: Math.min(k.sx, k.tx), b: Math.max(k.sx, k.tx), lane: 0, y: 0 })
      passes[gs]++
      topC[gs] = Math.max(topC[gs], signed ? 24 : 14)
      return
    }
    const xs = [k.sx].concat(k.mid.map((m) => m.x)).concat([k.tx])
    k.xs = xs
    k.lane = []
    for (let j = 0; j < xs.length - 1; j++) {
      const gi2 = k.src.row + j
      passes[gi2]++
      if (Math.abs(xs[j] - xs[j + 1]) > 0.01) segs[gi2].push({ k, gi: gi2, j, a: Math.min(xs[j], xs[j + 1]), b: Math.max(xs[j], xs[j + 1]), lane: 0, y: 0 })
    }
    const gS = k.src.row, gD = k.dst.row - 1, arrow = k.leader ? 8 : signed ? 23 : 11
    if (k.up) {
      topC[gS] = Math.max(topC[gS], arrow)
      if (k.l.proposed) botC[gD] = Math.max(botC[gD], 15)
    } else {
      botC[gD] = Math.max(botC[gD], arrow)
      if (k.l.proposed) topC[gS] = Math.max(topC[gS], 15)
    }
  })
  const laneCount: number[] = []
  segs.forEach((list, gi) => {
    list.sort((p, q) => p.a - q.a || p.b - q.b)
    const ends: number[] = []
    list.forEach((s) => {
      let li = -1
      for (let i = 0; i < ends.length; i++) if (ends[i] + 10 < s.a) { li = i; break }
      if (li < 0) { li = ends.length; ends.push(0) }
      ends[li] = s.b
      s.lane = li
    })
    laneCount[gi] = ends.length
  })
  const PITCH = 6
  const gapH: number[] = []
  for (let g = 0; g < nGap; g++) gapH.push(passes[g] ? topC[g] + Math.max(0, laneCount[g] - 1) * PITCH + botC[g] : (wide ? 24 : 12))

  /* y: spare height is given back as air between the layers */
  const total = padT + rows.reduce((s, r) => s + r.h, 0) + gapH.reduce((s, x) => s + x, 0) + 12
  const spare = Math.max(0, bh - total), extra = Math.min(wide ? 30 : 14, Math.floor(spare / (nGap + 1)))
  let y = padT + Math.min(extra, 20)
  const gapTop: number[] = []
  rows.forEach((r, ri) => {
    r.y = y
    r.nodes.forEach((n) => { n.y = y + (n.off ?? 0) })
    y += r.h
    if (ri < nGap) { gapTop[ri] = y; gapH[ri] += extra; y += gapH[ri] }
  })
  const laneY = (gi: number, li: number): number => {
    const n = laneCount[gi], band = gapH[gi] - topC[gi] - botC[gi], pitch = n > 1 ? Math.min(10, band / (n - 1)) : 0
    const start = gapTop[gi] + topC[gi] + (band - pitch * (n - 1)) / 2
    return px(start + li * pitch)
  }
  segs.forEach((list) => {
    list.forEach((s) => {
      s.y = laneY(s.gi, s.lane)
      if (s.k.same) s.k.ly = s.y
      else s.k.lane[s.j] = s.y
    })
  })
  const contentH = y, H = contentH + 12

  /* draw */
  const wires: BoardWire[] = []
  links.forEach((k) => {
    const l = k.l, c: Causal | null = l.causal || null
    let pts: number[][], end: number[], dir = 1
    const sized = !!(c && c.strength && c.strength.state === 'sized')
    const disputed = !!(c && (c.disputed || c.sign === 'unknown'))
    const firm = !l.doubt
    if (k.toQ) {
      const n = k.src, q = k.dst, ny = px(n.y + 9)
      let ex = q.x + q.w, my = ny
      const last = measured.questionLastLine
      if (last) {
        ex = Math.round(q.x + last.right) + 10
        my = px(q.y + last.top + last.height / 2)
      }
      const mx = px(Math.max(ex + 12, n.x - 22))
      pts = [[ex, my], [mx, my], [mx, ny], [n.x - 6, ny]]
      end = pts[0]
    } else if (k.same) {
      pts = [[k.sx, k.src.y + k.src.h], [k.sx, k.ly], [k.tx, k.ly], [k.tx, k.dst.y + k.dst.h + 1]]
      end = pts[pts.length - 1]
      dir = -1
    } else {
      const xs = k.xs as number[]
      pts = [[xs[0], k.src.y + k.src.h + (k.src.note ? 4 : 0)]]
      for (let j = 0; j < xs.length - 1; j++) {
        if (k.lane[j] != null) {
          pts.push([xs[j], k.lane[j]])
          pts.push([xs[j + 1], k.lane[j]])
        }
      }
      pts.push([k.tx, k.dst.y - 1])
      end = k.up ? [xs[0], k.src.y + k.src.h + 1] : [k.tx, k.dst.y - 1]
      dir = k.up ? -1 : 1
      if (k.up) pts[0] = end
    }
    const cls = 'wire' + (k.leader ? ' leader' : '') + (sized ? ' sized' : firm && !k.leader ? ' firm' : '') + (disputed ? ' disputed' : '')
    const wire: BoardWire = { i: k.i, from: l.from, to: l.to, d: roundPath(pts, 5), cls, leader: k.leader, markers: [] }
    wires.push(wire)
    if (k.leader) {
      wire.markers.push({ kind: 'dot', cx: end[0], cy: end[1] - (k.toQ ? 0 : 1), r: 2 })
      return
    }
    const ex2 = end[0], ey = end[1]
    if (firm || sized) {
      wire.markers.push({ kind: 'head', cls: sized ? 'head-sized' : 'head-firm', d: 'M' + (ex2 - 3.5) + ' ' + (ey - dir * 6) + 'L' + (ex2 + 3.5) + ' ' + (ey - dir * 6) + 'L' + ex2 + ' ' + ey + 'Z' })
    } else {
      wire.markers.push({ kind: 'head', cls: 'head-open', d: 'M' + (ex2 - 3.5) + ' ' + (ey - dir * 5.5) + 'L' + ex2 + ' ' + (ey - dir * 0.5) + 'L' + (ex2 + 3.5) + ' ' + (ey - dir * 5.5) })
    }
    if (c && (c.sign === 'increases' || c.sign === 'decreases')) {
      const gy = ey - dir * 15
      wire.markers.push({
        kind: 'chip', cx: ex2, cy: gy, r: 6.5, sign: c.sign,
        d: c.sign === 'increases' ? 'M' + (ex2 - 3) + ' ' + gy + 'h6M' + ex2 + ' ' + (gy - 3) + 'v6' : 'M' + (ex2 - 3) + ' ' + gy + 'h6',
      })
    }
    if (l.proposed) {
      const sx2 = k.up ? k.tx : k.xs ? k.xs[0] : k.sx, sy = k.up ? k.dst.y - 10 : k.src.y + k.src.h + 9
      wire.markers.push({ kind: 'wmark', d: 'M' + sx2 + ' ' + (sy - 4) + 'L' + (sx2 + 4) + ' ' + sy + 'L' + sx2 + ' ' + (sy + 4) + 'L' + (sx2 - 4) + ' ' + sy + 'Z' })
    }
  })

  const rowReport = rows.map((r, i) => r.kind + ':' + r.h + (i < nGap ? ' gap ' + gapH[i] + ' (lanes ' + laneCount[i] + ', top ' + topC[i] + ', bot ' + botC[i] + ')' : '') + ' [' + r.nodes.map((n) => n.w + 'x' + n.h).join(' ') + ']')

  /* the template's own overlap and outside checks, in the order the nodes were made */
  const over: string[] = [], outside: string[] = []
  all.forEach((a, i) => {
    if (a.x < 0 || a.x + a.w > bw + 0.5 || a.y < 0) outside.push(a.id)
    if (a.y + a.h > bh) outside.push(a.id + ' (below the first view by ' + Math.round(a.y + a.h - bh) + 'px)')
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j]
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) over.push(a.id + ' x ' + b.id)
    }
  })

  const nodes: BoardNodeGeom[] = []
  rows.forEach((r) => { r.nodes.forEach((n) => { nodes.push({ ...publicNode(rows, n), y: n.y, h: n.h }) }) })
  const rowsOut: BoardRowGeom[] = rows.map((r, i) => ({
    kind: r.kind, y: r.y, h: r.h, ids: r.nodes.map((n) => n.id),
    gap: i < nGap ? { top: gapTop[i], h: gapH[i], lanes: laneCount[i], topClear: topC[i], botClear: botC[i] } : null,
  }))
  return {
    board, stage: { w: bw, h: Math.max(H, bh) }, wide, cardW, contentH, nodes, rows: rowsOut, wires, unrouted,
    report: { rows: rowReport, cardW, contentH: Math.round(contentH), overlaps: over, outside, fitsFirstView: contentH <= bh },
  }
}
