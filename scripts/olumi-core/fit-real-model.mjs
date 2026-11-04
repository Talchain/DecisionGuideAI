// A REAL-SIZED MODEL ON THE CANVAS (4 Nov, live olumi-core-v3: a real model opened as a diagonal, cut off). DGAI's served build, signed
// in on a scripted core, with core's european golden (22 cards, a real drafted model) served as the scenario's View. Checks that the
// cards are drawn as DGAI's causal graph (the question on top, the options below it, the goal below them, no card on another; Paul 4
// Nov), and reports the zoom and what is out of view, left of the dock, once it settles. Zero AI calls.
//   node scripts/olumi-core/fit-real-model.mjs [--shot <png>]     (VIEW_W, default 1440; CHROME, as two-people.mjs)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const BASE = process.env.CORE_BASE ?? 'http://127.0.0.1:3951', ADMIN = process.env.OLUMI_ADMIN_KEY ?? 'dgai-core-admin-key-0123456789abcdef'
const SHOT = process.argv.includes('--shot') ? process.argv[process.argv.indexOf('--shot') + 1] : null
const european = JSON.parse(readFileSync('src/olumiView/golden/european.view.json', 'utf8'))
// As core e16a497 serves it: each option's driver names its figure (core's golden: `existing_market_acquisitions`, folded into `customers`).
const golden = { ...european, model: { ...european.model, cards: european.model.cards.map((c) => (c.driver ? { ...c, driver: { ...c.driver, figure: 'existing_market_acquisitions' } } : c)) } }
// Version 2: core's bakery golden (18 cards), served as the same scenario's next version, for the after-a-new-version frame.
const next = JSON.parse(readFileSync('src/olumiView/golden/bakery.view.json', 'utf8'))
// THE REAL DENSE BOARDS (DL 4 Nov: three R2 defects showed only on real-AI models): the capacity View from github-3c's R2 witness store
// (14 cards; Olumi's next step on its own card, test_net_contribution, with a Why) and the R2-shaped hiring View (19 cards).
const real = ['capacity', 'hiring'].map((name) => ({ name, view: JSON.parse(readFileSync(`src/olumiView/fixtures/real/${name}.view3.json`, 'utf8')) }))
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
  // R1.1 (Paul's screen: A2 half under the dock): no card rect intersects the dock's.
  const underDock = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="outputs-dock"]').getBoundingClientRect()
    return [...document.querySelectorAll('.react-flow__node')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > d.left + 1 && r.left < d.right && r.bottom > d.top && r.top < d.bottom }).map((e) => e.getAttribute('data-id'))
  })
  // DL 4 Nov 17Z (readable first wins; R3: whole from 0.8): a board that fits at 0.8 or more has no card under the dock; a wider one opens at 0.9 with the
  // question and every option wholly in the visible rect (never under the dock), the rest reached by panning.
  const headIds = ['page:question', ...view.model.cards.filter((c) => c.family === 'option').map((c) => c.id)]
  const fitsWhole = zoom > 0.8 - 0.005 && Math.abs(zoom - 0.9) >= 0.005
  if (fitsWhole) check(underDock.length === 0, `${label}: fits at ${zoom.toFixed(3)}, no card under the dock${underDock.length ? ` (under it: ${underDock.join(', ')})` : ''}`)
  else console.log(`  · ${label}: cards under the dock at 0.9 (reached by panning): ${underDock.length === 0 ? 'none' : underDock.join(', ')}`)
  if (!fitsWhole) check(Math.abs(zoom - 0.9) < 0.005 && headIds.every((id) => !underDock.includes(id)), `${label}: zoom ${zoom.toFixed(3)} (0.9, never lower), the question and every option clear of the dock${headIds.some((id) => underDock.includes(id)) ? ` (under it: ${headIds.filter((id) => underDock.includes(id)).join(', ')})` : ''}`)
  const out = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="outputs-dock"]').getBoundingClientRect(), pane = document.querySelector('.react-flow').getBoundingClientRect()
    return [...document.querySelectorAll('.react-flow__node-viewCard, .react-flow__node-viewQuestion')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < pane.left - 1 || r.top < pane.top - 1 || r.right > dock.left + 1 || r.bottom > pane.bottom + 1 }).map((e) => e.getAttribute('data-id'))
  })
  // Reported, not asserted: a model taller than the canvas holds at the lane's floor (0.25) is top-anchored there, so its last card can
  // run past the bottom (the european golden's option cards carry every row).
  // Readable first (DL 4 Nov, the original look): whole when it fits at 0.9 or more, else at 0.9 (lower only as far as keeps the
  // question and options across) with the question and options in view.
  const head = ['page:question', ...view.model.cards.filter((c) => c.family === 'option').map((c) => c.id)]
  if (whole) check(zoom >= 0.5 && head.every((id) => !out.includes(id)), `${label}: zoom ${zoom.toFixed(3)}, ${out.length === 0 ? 'the whole model in view' : 'the question and every option in view'}${head.some((id) => out.includes(id)) ? ` (out: ${head.filter((id) => out.includes(id)).join(', ')})` : ''}`)
  else console.log(`  · ${label}: zoom ${zoom.toFixed(3)}; ${out.length === 0 ? 'the whole model is in view' : `out of view: ${out.join(', ')}`}`)
  return { zoom, out }
}
const first = await frame(golden, 'first open (european, 22 cards)')
// Readable first (DL 4 Nov, then the original look; R3 whole from 0.8): european opens whole at 0.8 or more, else at 0.9, top-aligned, with the
// question and every option in view (the top of the causal graph).
const tops = golden.model.cards.filter((c) => c.family === 'option').map((c) => c.id)
const topOut = await page.evaluate((ids) => {
  const dock = document.querySelector('[data-testid="outputs-dock"]').getBoundingClientRect(), pane = document.querySelector('.react-flow').getBoundingClientRect()
  return ids.filter((id) => { const r = document.querySelector(`.react-flow__node[data-id="${id}"]`)?.getBoundingClientRect(); return !r || r.left < pane.left - 1 || r.top < pane.top - 1 || r.right > dock.left + 1 || r.bottom > pane.bottom + 1 })
}, ['page:question', ...tops])
check(first.zoom >= 0.8 - 0.005 && first.zoom <= 1 && topOut.length === 0, `first open: zoom ${first.zoom.toFixed(3)}, the question and every option in view${topOut.length ? ` (out: ${topOut.join(', ')})` : ''}`)
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
// What would change: the figure the options' chances move most with is marked on the card that draws it, with how many options it moves.
await page.getByTestId('lens-bar-what_changes').click()
await page.waitForFunction(() => document.querySelectorAll('[data-driver-of]').length > 0, null, { timeout: 5000 })
const drivers = await page.evaluate(() => [...document.querySelectorAll('[data-driver-of]')].map((e) => [e.closest('.react-flow__node').getAttribute('data-id'), e.getAttribute('data-driver-of')]))
check(JSON.stringify(drivers) === JSON.stringify([['customers', 'broader_entry single_country_test no_new_european_entry']]), `What would change: ${JSON.stringify(drivers)}`)
if (SHOT) { await page.waitForTimeout(400); await page.screenshot({ path: SHOT.replace(/\.png$/, '-what-changes.png') }) }
await page.getByTestId('lens-bar-full').click()
check(await page.evaluate(() => document.querySelectorAll('[data-rests-on], [data-driver-of]').length) === 0, 'Model: no card numbered or marked')
served = { ...next, id: made.scenario, you_id: me.id, you: me.name, version: { ...next.version, id: golden.version.id + 1, n: 2, label: 'version 2' } }
await page.getByTestId('outputs-dock-tab-team').click()
await page.getByTestId('team-check').click()
// Bakery: readable first, as above.
await frame(served, 'a new version (bakery, 18 cards)', true)
// Each real board as the next version: drawn as the causal graph, framed readable, and Olumi's note, opened from its icon, covers no card
// and is one note (one of each of its test ids, one reachable "Why"), as the real-AI witness checks it.
let n = 3
for (const { name, view } of real) {
  served = { ...view, id: made.scenario, you_id: me.id, you: me.name, version: { ...view.version, id: golden.version.id + n, n, label: `version ${n}` } }
  n += 1
  // The note's panel case opens the Olumi tab for it, so the Team tab is pressed again before reading the next version.
  await page.getByTestId('outputs-dock-tab-team').click()
  await page.getByTestId('team-check').click()
  await frame(served, `real ${name} (${view.model.cards.length} cards)`, true)
  const at = [...view.chat].reverse().find((t) => t.answer?.next?.newest)?.answer?.next?.at ?? null
  if (at === null) { ok(`real ${name}: no next step to open`); continue }
  const icon = page.getByTestId('olumi-attention-card-icon')
  await icon.waitFor({ timeout: 20000 })
  await icon.click()
  await page.getByTestId('olumi-attention-card').waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)
  const note = await page.evaluate(() => {
    const n = document.querySelector('[data-testid="olumi-attention-card"]').getBoundingClientRect()
    const covers = [...document.querySelectorAll('.react-flow__node')].filter((e) => { const r = e.getBoundingClientRect(); return Math.min(n.right, r.right) > Math.max(n.left, r.left) && Math.min(n.bottom, r.bottom) > Math.max(n.top, r.top) }).map((e) => e.getAttribute('data-id'))
    const ids = [...document.querySelectorAll('[data-testid^="olumi-attention-card"]')].map((e) => e.getAttribute('data-testid'))
    const whys = [...document.querySelectorAll('[data-testid^="olumi-attention-card"] summary, [data-note-measure] summary')].filter((e) => !e.closest('[aria-hidden="true"], [inert]')).length
    return { covers, dup: ids.filter((id, i) => ids.indexOf(id) !== i), whys, inPanel: document.querySelector('[data-testid="olumi-attention-card"]').hasAttribute('data-in-panel') }
  })
  check(note.covers.length === 0, `real ${name}: Olumi's note, opened at ${at}${note.inPanel ? ' (in the Olumi tab: no free spot on the canvas)' : ''}, covers no card${note.covers.length ? ` (covers ${note.covers.join(', ')})` : ''}`)
  check(note.dup.length === 0 && note.whys <= 1, `real ${name}: one note: each test id once${note.dup.length ? ` (twice: ${note.dup.join(', ')})` : ''}, ${note.whys} reachable "Why"`)
  if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/, `-real-${name}.png`) })
}
await b.close()
