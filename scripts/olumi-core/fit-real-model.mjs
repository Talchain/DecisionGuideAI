// A REAL-SIZED MODEL ON THE CANVAS (4 Nov, live olumi-core-v3: a real model opened as a diagonal, cut off). DGAI's served build, signed
// in on a scripted core, with core's european golden (22 cards, a real drafted model) served as the scenario's View. Checks that the
// cards stay in core's columns (one x per `col`), and reports the zoom and what is out of view, left of the dock, once it settles. Zero AI calls.
//   node scripts/olumi-core/fit-real-model.mjs [--shot <png>]     (VIEW_W, default 1440; CHROME, as two-people.mjs)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const BASE = process.env.CORE_BASE ?? 'http://127.0.0.1:3951', ADMIN = process.env.OLUMI_ADMIN_KEY ?? 'dgai-core-admin-key-0123456789abcdef'
const SHOT = process.argv.includes('--shot') ? process.argv[process.argv.indexOf('--shot') + 1] : null
const golden = JSON.parse(readFileSync('src/olumiView/golden/european.view.json', 'utf8'))
// Version 2: core's bakery golden (18 cards), served as the same scenario's next version, for the after-a-new-version frame.
const next = JSON.parse(readFileSync('src/olumiView/golden/bakery.view.json', 'utf8'))
const ok = (w) => console.log(`  ✓ ${w}`)
function check(c, w) { if (!c) { console.error(`  ✗ ${w}`); process.exit(1) } ok(w) }

const r = await fetch(`${BASE}/api/admin/people`, { method: 'POST', headers: { 'x-olumi-admin': ADMIN, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Fit' }) })
const link = (await r.json()).link.split('?')[0]
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
const page = await (await b.newContext({ viewport: { width: Number(process.env.VIEW_W ?? 1440), height: 900 } })).newPage()
await page.goto(BASE + link)
const made = await page.evaluate(async (op) => (await fetch('/api/scenarios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief: 'Our team resolves 80 tickets a week. Keep current staffing or add one specialist? We need at least 100 tickets a week.', op }) })).json(), `fit-${Date.now()}`)
await page.evaluate(async (p) => fetch(`/api/proposals/${p}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base: null }) }), made.proposal)
const me = (await page.evaluate(async () => (await fetch('/api/me')).json())).me
let served = { ...golden, id: made.scenario, you_id: me.id, you: me.name }
await page.route(/\/api\/scenarios\/[^/]+\/view/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(served) }))
await page.goto(`${BASE}/#/scenario/00000000-0000-4000-8000-${made.scenario.slice(2)}`)
/** One version on the canvas: its cards in core's columns, and the zoom and what is out of view once it settles. */
async function frame(view, label, whole = false) {
  await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`.react-flow__node[data-id="${id}"]`)), view.model.cards.map((c) => c.id), { timeout: 30000 })
  await page.waitForTimeout(3000)
  const drawn = await page.evaluate(() => [...document.querySelectorAll('.react-flow__node-viewCard')].map((e) => ({ id: e.getAttribute('data-id'), x: Math.round(new DOMMatrix(getComputedStyle(e).transform).e) })))
  const xsByCol = new Map()
  for (const c of view.model.cards) { const d = drawn.find((n) => n.id === c.id); xsByCol.set(c.col, new Set([...(xsByCol.get(c.col) ?? []), d?.x])) }
  check([...xsByCol.values()].every((xs) => xs.size === 1), `${label}: the ${view.model.cards.length} cards stay in core's ${xsByCol.size} columns (one x per column)`)
  const zoom = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a)
  const out = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="outputs-dock"]').getBoundingClientRect(), pane = document.querySelector('.react-flow').getBoundingClientRect()
    return [...document.querySelectorAll('.react-flow__node-viewCard, .react-flow__node-viewQuestion')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < pane.left - 1 || r.top < pane.top - 1 || r.right > dock.left + 1 || r.bottom > pane.bottom + 1 }).map((e) => e.getAttribute('data-id'))
  })
  // Reported, not asserted: a model taller than the canvas holds at the lane's floor (0.25) is top-anchored there, so its last card can
  // run past the bottom (the european golden's option cards carry every row).
  if (whole) check(out.length === 0 && zoom >= 0.5, `${label}: the whole model in view at zoom ${zoom.toFixed(3)}${out.length ? ` (out: ${out.join(', ')})` : ''}`)
  else console.log(`  · ${label}: zoom ${zoom.toFixed(3)}; ${out.length === 0 ? 'the whole model is in view' : `out of view: ${out.join(', ')}`}`)
  return { zoom, out }
}
const first = await frame(golden, 'first open (european, 22 cards)')
// Each premise row is one line on the served build (core's .premise: nowrap, ellipsis), however long core's text.
const rows = await page.evaluate(() => [...document.querySelectorAll('[data-view*=".premises."][data-view$=".glyph"]')].map((g) => g.parentElement).map((e) => { const s = getComputedStyle(e); return { id: e.firstElementChild.getAttribute('data-view'), h: e.getBoundingClientRect().height / (new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a), lh: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5 } }))
check(rows.length > 0 && rows.every((r) => r.h <= r.lh * 1.5), `each of the ${rows.length} premise rows is one line${rows.filter((r) => r.h > r.lh * 1.5).length ? ` (taller: ${rows.filter((r) => r.h > r.lh * 1.5).map((r) => r.id).join(', ')})` : ''}`)
// Readable first (DL 4 Nov): european fits whole only below 0.5, so it is framed by its width, top-aligned, at 0.5 or more, with the
// question and every column's first card in view (before: whole at 0.272, tall, narrow, unreadable).
const firsts = [...new Set(golden.model.cards.map((c) => c.col))].map((col) => golden.model.cards.find((c) => c.col === col).id)
const topOut = await page.evaluate((ids) => {
  const dock = document.querySelector('[data-testid="outputs-dock"]').getBoundingClientRect(), pane = document.querySelector('.react-flow').getBoundingClientRect()
  return ids.filter((id) => { const r = document.querySelector(`.react-flow__node[data-id="${id}"]`)?.getBoundingClientRect(); return !r || r.left < pane.left - 1 || r.top < pane.top - 1 || r.right > dock.left + 1 || r.bottom > pane.bottom + 1 })
}, ['page:question', ...firsts])
check(first.zoom >= 0.5 && first.zoom <= 1 && topOut.length === 0, `first open: framed by width at zoom ${first.zoom.toFixed(3)}, the question and every column's first card in view${topOut.length ? ` (out: ${topOut.join(', ')})` : ''}`)
if (SHOT) await page.screenshot({ path: SHOT })
served = { ...next, id: made.scenario, you_id: me.id, you: me.name, version: { ...next.version, id: golden.version.id + 1, n: 2, label: 'version 2' } }
await page.getByTestId('outputs-dock-tab-team').click()
await page.getByTestId('team-check').click()
// Bakery's cards fit at a readable zoom: asserted whole, at 0.5 or more.
await frame(served, 'a new version (bakery, 18 cards)', true)
await b.close()
