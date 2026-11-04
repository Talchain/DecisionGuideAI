// A REAL-SIZED MODEL ON THE CANVAS (4 Nov, live olumi-core-v3: a real model opened as a diagonal, cut off). DGAI's served build, signed
// in on a scripted core, with core's european golden (22 cards, a real drafted model) served as the scenario's View. Checks that the
// cards are drawn as DGAI's causal graph (the question on top, the options below it, the goal below them, no card on another; Paul 4
// Nov), and reports the zoom and what is out of view, left of the dock, once it settles. Zero AI calls.
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
/** One version on the canvas: its cards as the causal graph, and the zoom and what is out of view once it settles. */
async function frame(view, label, whole = false) {
  await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`.react-flow__node[data-id="${id}"]`)), view.model.cards.map((c) => c.id), { timeout: 30000 })
  await page.waitForTimeout(3000)
  const drawn = await page.evaluate(() => [...document.querySelectorAll('.react-flow__node-viewCard, .react-flow__node-viewQuestion')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute('data-id'), l: r.left, t: r.top, r: r.right, b: r.bottom } }))
  const at = (id) => drawn.find((n) => n.id === id), fam = (f) => view.model.cards.filter((c) => c.family === f).map((c) => at(c.id))
  const over = drawn.flatMap((a, i) => drawn.slice(i + 1).filter((b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b).map((b) => `${a.id}/${b.id}`))
  const q = at('page:question'), options = fam('option'), goals = fam('goal')
  check(over.length === 0 && options.every((o) => o.t > q.b) && goals.every((g) => options.every((o) => g.t > o.b)),
    `${label}: the ${view.model.cards.length} cards drawn as the causal graph: the question on top, the ${options.length} options below it, the goal below them, no card on another${over.length ? ` (overlap: ${over.join(', ')})` : ''}`)
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
// Readable first (DL 4 Nov): european fits whole only below 0.5, so it is framed by its width, top-aligned, at 0.5 or more, with the
// question and every option in view (the top of the causal graph).
const tops = golden.model.cards.filter((c) => c.family === 'option').map((c) => c.id)
const topOut = await page.evaluate((ids) => {
  const dock = document.querySelector('[data-testid="outputs-dock"]').getBoundingClientRect(), pane = document.querySelector('.react-flow').getBoundingClientRect()
  return ids.filter((id) => { const r = document.querySelector(`.react-flow__node[data-id="${id}"]`)?.getBoundingClientRect(); return !r || r.left < pane.left - 1 || r.top < pane.top - 1 || r.right > dock.left + 1 || r.bottom > pane.bottom + 1 })
}, ['page:question', ...tops])
check(first.zoom >= 0.5 && first.zoom <= 1 && topOut.length === 0, `first open: zoom ${first.zoom.toFixed(3)}, the question and every option in view${topOut.length ? ` (out: ${topOut.join(', ')})` : ''}`)
// The compact face: no card shows its status, reason, bound or premises until it is selected.
// An assumption or condition (no figure, no rows) keeps what it says, its reason, on the face.
const says = golden.model.cards.filter((c) => c.figure === null && c.rows.length === 0 && c.reason !== null).map((c) => `${c.id}.reason`)
const folded = await page.evaluate((says) => [...document.querySelectorAll('[data-view$=".status"], [data-view$=".reason"], [data-view*=".bound."], [data-view*=".premises."]')].filter((e) => e.getClientRects().length > 0 && !says.includes(e.getAttribute('data-view'))).map((e) => e.getAttribute('data-view')), says)
check(folded.length === 0, `on open, every card shows its compact face${folded.length ? ` (shown: ${folded.join(', ')})` : ''}`)
// The premise and assumption links fold away until one of their cards is hovered or selected; every causal link is drawn (DL 4 Nov).
const kinds = async () => page.evaluate(() => [...document.querySelectorAll('[data-view-link]')].map((g) => g.getAttribute('data-kind')))
const causal = golden.model.links.filter((l) => l.kind !== 'reason').length, folded0 = (await kinds()).filter((k) => k === 'reason').length
check(folded0 === 0 && (await kinds()).length === causal, `on open, every one of the ${causal} causal links is drawn and no premise or assumption link (${golden.model.links.length - causal} folded)`)
if (SHOT) await page.screenshot({ path: SHOT })
// Selected, a card's other words open beside it; each premise row is one line (core's .premise: nowrap, ellipsis), however long.
const withPremises = golden.model.cards.find((c) => c.family === 'option' && c.premises.length > 0)
await page.locator(`.react-flow__node[data-id="${withPremises.id}"] [data-view="${withPremises.id}.heading"]`).click()
await page.waitForFunction((id) => document.querySelector(`[data-view-more="${id}"]`)?.getClientRects().length > 0, withPremises.id, { timeout: 5000 })
const rows = await page.evaluate(() => [...document.querySelectorAll('[data-view*=".premises."][data-view$=".glyph"]')].map((g) => g.parentElement).map((e) => { const s = getComputedStyle(e); return { id: e.firstElementChild.getAttribute('data-view'), h: e.getBoundingClientRect().height / (new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a), lh: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5 } }))
const onIt = golden.model.links.filter((l) => l.kind === 'reason' && (l.from === withPremises.id || l.to === withPremises.id)).length
check((await kinds()).filter((k) => k === 'reason').length === onIt && onIt > 0, `selected, ${withPremises.id}'s ${onIt} premise and assumption links are drawn, and no other`)
const shownRows = rows.filter((r) => r.id.startsWith(`${withPremises.id}.`))
check(shownRows.length === withPremises.premises.length && shownRows.every((r) => r.h <= r.lh * 1.5), `selected, ${withPremises.id}'s ${withPremises.premises.length} premise rows open beside it, each one line`)
// The lens bar (DL 4 Nov, lenses back on from the View): Rests on numbers every figure a person can set and every assumption and condition,
// Olumi's in blue; Model shows none. Nothing is dimmed.
await page.keyboard.press('Escape')
await page.getByTestId('lens-bar-rests_on').click()
await page.waitForFunction(() => document.querySelectorAll('[data-rests-on]').length > 0, null, { timeout: 5000 })
const marks = await page.evaluate(() => ({ all: document.querySelectorAll('[data-rests-on]').length, olumi: document.querySelectorAll('[data-rests-on-olumi]').length, dim: [...document.querySelectorAll('.react-flow__node')].filter((n) => parseFloat(getComputedStyle(n).opacity) < 1).length }))
const settable = golden.model.cards.filter((c) => (c.figure?.edit ?? null) !== null || c.family === 'assumption' || c.family === 'condition')
check(marks.all === settable.length && marks.olumi === settable.filter((c) => c.olumi !== null).length && marks.dim === 0, `Rests on: ${marks.all} cards numbered, ${marks.olumi} of them Olumi's in blue, none dimmed`)
if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/, '-rests-on.png') })
await page.getByTestId('lens-bar-full').click()
check(await page.evaluate(() => document.querySelectorAll('[data-rests-on]').length) === 0, 'Model: no card numbered')
served = { ...next, id: made.scenario, you_id: me.id, you: me.name, version: { ...next.version, id: golden.version.id + 1, n: 2, label: 'version 2' } }
await page.getByTestId('outputs-dock-tab-team').click()
await page.getByTestId('team-check').click()
// Bakery's cards fit at a readable zoom: asserted whole, at 0.5 or more.
await frame(served, 'a new version (bakery, 18 cards)', true)
await b.close()
