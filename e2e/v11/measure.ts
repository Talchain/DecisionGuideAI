/**
 * The 1232 audit's measures (output/ui-plan-20261107/audit.mjs, measure()), run in the page. Self-contained: Playwright serialises it.
 * cards off the pane (left of the dock), link words over cards, links drawn behind cards, cut text on cards / the dock / its tabs,
 * distinct on-screen type sizes (canvas text at the canvas zoom), controls under 24 px, and the dock's gaps to the header, the window's right
 * edge and its foot (DL 9 Nov: the comp's even 8 px float on every side).
 */
export type Audit = { cards: number; out: string[]; wordsOver: number; crossings: number; trunc: string[]; sizes: number[]; smallTargets: string[]; dockGaps: { top: number; right: number; bottom: number } | null; underZoom: string[]; underHead: string[]; band: boolean; firstPaint: 'fits' | 'cue' | 'neither' }

export function measure(): Audit {
  const R = (e: Element) => e.getBoundingClientRect()
  const inter = (a: DOMRect, b: DOMRect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  const vis = (e: Element) => { const s = getComputedStyle(e), r = R(e); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0 && r.width > 1 && r.height > 1 }
  const P = R(document.querySelector('.react-flow')!)
  const dockEl = document.querySelector('[data-testid="outputs-dock"]'), D = dockEl ? R(dockEl) : null
  const right = D && D.left > P.left + 100 ? D.left : P.right
  const cardEls = [...document.querySelectorAll('.react-flow__node-viewCard')]
  const cards = cardEls.map((e) => ({ id: e.getAttribute('data-id') ?? '', r: R(e) }))
  const out = cards.filter((c) => c.r.top < P.top - 1 || c.r.bottom > Math.min(P.bottom, innerHeight) + 1 || c.r.left < P.left - 1 || c.r.right > right + 1).map((c) => c.id)
  const words = [...document.querySelectorAll('[data-view-link-words]')].filter(vis).map((e) => R(e))
  let wordsOver = 0; for (const w of words) for (const c of cards) if (inter(w, c.r) > 20) wordsOver++
  let crossings = 0
  for (const g of document.querySelectorAll('g[data-view-link]')) {
    const path = (g.querySelector('path.react-flow__edge-path') ?? g.querySelector('path')) as SVGPathElement | null; if (!path) continue
    const L = path.getTotalLength(), M = path.getScreenCTM(); if (!M || L < 40) continue
    let hit = false
    for (let i = 1; i < 60 && !hit; i++) { const d = (L * i) / 60; if (d < 14 || d > L - 14) continue; const p = path.getPointAtLength(d), x = M.a * p.x + M.c * p.y + M.e, y = M.b * p.x + M.d * p.y + M.f
      for (const c of cards) if (x > c.r.left + 2 && x < c.r.right - 2 && y > c.r.top + 2 && y < c.r.bottom - 2) hit = true }
    if (hit) crossings++
  }
  const trunc: string[] = []
  for (const s of [...cardEls, ...(dockEl ? [dockEl] : []), ...document.querySelectorAll('[data-testid="outputs-dock-tabstrip"]')]) for (const e of s.querySelectorAll('*')) {
    if (!vis(e) || e.children.length > 3 || e.closest('[data-disclosure]')) continue
    const st = getComputedStyle(e) as CSSStyleDeclaration & { webkitLineClamp?: string }
    if ((st.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) || (st.webkitLineClamp && st.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 1)) trunc.push((e.textContent ?? '').trim().slice(0, 70))
  }
  // A typed value wider than its box is cut too (the re-score's "≈£4,300/mont" in Compare's what-if, round 6).
  if (dockEl) for (const e of dockEl.querySelectorAll<HTMLInputElement>('input:not([type]), input[type="text"]')) if (vis(e) && e.value !== '' && e.scrollWidth > e.clientWidth + 1) trunc.push(`input: ${e.value.slice(0, 60)}`)
  const v = document.querySelector('.react-flow__viewport'), zm = v && getComputedStyle(v).transform.match(/matrix\(([^,]+)/), zoom = zm ? +zm[1] : 1
  const sizes = new Set<number>(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!(n.textContent ?? '').trim()) continue; const e = n.parentElement; if (!e || !vis(e)) continue
    const f = parseFloat(getComputedStyle(e).fontSize); sizes.add(Math.round((e.closest('.react-flow__viewport') ? f * zoom : f) * 4) / 4) }
  const smallTargets: string[] = []
  for (const e of document.querySelectorAll('button, a[href], [role="button"], input, select, textarea')) { if (!vis(e)) continue; const lab = e.matches('input') ? e.closest('label') : null, r = R(lab ?? e)
    if ((r.width < 23.99 || r.height < 23.99) && getComputedStyle(e).display !== 'inline') smallTargets.push((e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 30)) }
  // Cards any part of which the zoom panel covers (DL ruling 9 Nov: none, at any audited width).
  const Z = document.querySelector('nav[aria-label="Viewport controls"]')?.getBoundingClientRect() ?? null
  const underZoom = Z === null ? [] : cards.filter((c) => inter(c.r, Z) > 0).map((c) => c.id)
  // The layout pass's regions (DL 9 Nov): no card's drawn box is under the head band; and the first paint either shows every card or the
  // more-below cue says how many are below. Drawn boxes, not React Flow's node wrappers.
  const B = document.querySelector('[data-testid="view-canvas-head-band"]')?.getBoundingClientRect() ?? null
  const drawn = cardEls.map((e) => ({ id: e.getAttribute('data-id') ?? '', r: R(e.querySelector('[data-view-card]') ?? e) }))
  const underHead = B === null ? [] : drawn.filter((c) => inter(c.r, B) > 0).map((c) => c.id)
  const below = drawn.some((c) => c.r.top > innerHeight), cue = document.querySelector('[data-testid="view-below-cue"]') !== null
  const firstPaint = !below ? 'fits' : cue ? 'cue' : 'neither'
  return { underZoom, underHead, band: B !== null, firstPaint, cards: cards.length, out, wordsOver, crossings, trunc, sizes: [...sizes].sort((a, b) => a - b), smallTargets,
    dockGaps: D ? { top: Math.round(D.top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0)), right: Math.round(innerWidth - D.right), bottom: Math.round(innerHeight - D.bottom) } : null }
}

/** The contrast (DL 7 Nov): the longest line in the dock clamped to one line, so a cut count of 0 elsewhere is evidence the probe sees cuts. */
export function clampLongestDockLine(): boolean {
  const dock = document.querySelector('[data-testid="outputs-dock"]'); if (!dock) return false
  const long = [...dock.querySelectorAll('p, span, div')].filter((e) => e.children.length === 0 && e.getBoundingClientRect().height > 30 && !e.closest('[data-disclosure]'))
    .sort((x, y) => (y.textContent ?? '').length - (x.textContent ?? '').length)[0] as HTMLElement | undefined
  if (!long) return false
  Object.assign(long.style, { display: '-webkit-box', webkitLineClamp: '1', webkitBoxOrient: 'vertical', overflow: 'hidden' })
  return true
}
