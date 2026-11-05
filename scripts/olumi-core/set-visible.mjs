// THE SET BUTTON STAYS VISIBLE WITH NO CARD SELECTED (github-3c, Paul's directive via Codex review, 5 Nov; R4 witness run 3 BLOCK). DGAI's
// served build on a local scripted core, core's european golden served as the scenario's View, 1440 wide, no card selected. Three checks,
// each with the open editor's card UNSELECTED: (1) the pointer moved off the card: Set visible and on top at its centre; (2) Tab from the
// typed figure: Set focused and visible; (3) a canvas re-layout while the editor is open (an Enter that core refuses grows the card): Set
// still visible. Negative control: the same run on a build with f9c7459 reverted goes red. Zero AI calls; localhost only.
//   VIEW_FIXTURE=src/olumiView/golden/european.view.json node scripts/olumi-core/set-visible.mjs     (VIEW_W default 1440; CHROME as two-people)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const BASE = process.env.CORE_BASE ?? 'http://127.0.0.1:3951', ADMIN = process.env.OLUMI_ADMIN_KEY ?? 'dgai-core-admin-key-0123456789abcdef'
const HOST = new URL(BASE).hostname
if (HOST !== 'localhost' && HOST !== '127.0.0.1') { console.error(`refusing to run against ${BASE}: not localhost`); process.exit(9) }
const golden = JSON.parse(readFileSync(process.env.VIEW_FIXTURE ?? 'src/olumiView/golden/european.view.json', 'utf8'))
let fails = 0
const check = (ok, what) => { console.log(`  ${ok ? '✓' : '✗'} ${what}`); if (!ok) fails += 1 }

const r = await fetch(`${BASE}/api/admin/people`, { method: 'POST', headers: { 'x-olumi-admin': ADMIN, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ada' }) })
const link = (await r.json()).link.split('?')[0]
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
const page = await (await b.newContext({ viewport: { width: Number(process.env.VIEW_W ?? 1440), height: 900 } })).newPage()
await page.goto(BASE + link)
const made = await page.evaluate(async (op) => (await fetch('/api/scenarios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief: 'Our team resolves 80 tickets a week. Keep current staffing or add one specialist? We need at least 100 tickets a week.', op }) })).json(), `set-${Date.now()}`)
await page.evaluate(async (p) => fetch(`/api/proposals/${p}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base: null }) }), made.proposal)
const me = (await page.evaluate(async () => (await fetch('/api/me')).json())).me
const served = { ...golden, id: made.scenario, you_id: me.id, you: me.name, members: [{ id: me.id, name: me.name }] }
await page.route(/\/api\/scenarios\/[^/]+\/view/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(served) }))
await page.goto(`${BASE}/#/scenario/00000000-0000-4000-8000-${made.scenario.slice(2)}`)
await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`.react-flow__node[data-id="${id}"]`)), golden.model.cards.map((c) => c.id), { timeout: 30000 })
await page.waitForTimeout(3000)

// A card core offers to edit, drawn inside the free canvas (left of the dock, below the top bars).
const id = await page.evaluate((ids) => {
  const dock = document.querySelector('[data-testid="outputs-dock"]')?.getBoundingClientRect(), right = dock && dock.width > 0 ? dock.left : innerWidth
  return ids.find((i) => { const r = document.querySelector(`.react-flow__node[data-id="${i}"]`)?.getBoundingClientRect(); return r && r.top > 120 && r.bottom < innerHeight - 40 && r.left > 60 && r.right < right - 20 }) ?? null
}, golden.model.cards.filter((c) => c.figure?.edit).map((c) => c.id))
check(id !== null, `a card core offers to edit is in view (${id})`)
if (id === null) { await b.close(); process.exit(1) }
const node = page.locator(`.react-flow__node[data-id="${id}"]`), set = page.getByTestId(`view-figure-set-${id}`)
const selected = () => page.evaluate(() => [...document.querySelectorAll('.react-flow__node.selected')].map((e) => e.getAttribute('data-id')))
/** A point on empty canvas: over the pane, over no card and no control. */
const emptyPoint = () => page.evaluate(() => {
  for (let y = innerHeight - 60; y > 140; y -= 20) for (let x = 80; x < innerWidth / 2; x += 20) { const e = document.elementFromPoint(x, y); if (e?.classList.contains('react-flow__pane')) return { x, y } }
  return null
})
/** Set is shown and is what a pointer at its centre would press (nothing over it). */
const setShown = () => page.evaluate((tid) => {
  const s = document.querySelector(`[data-testid="${tid}"]`); if (!s) return { exists: false }
  const r = s.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  const over = top === null ? null : `${top.tagName.toLowerCase()}${top.getAttribute("data-testid") ? "#" + top.getAttribute("data-testid") : ""}${top.className && typeof top.className === "string" ? "." + top.className.split(" ").slice(0, 3).join(".") : ""} in node ${top.closest(".react-flow__node")?.getAttribute("data-id") ?? "-"}`
  return { exists: true, visibility: getComputedStyle(s).visibility, wrap: getComputedStyle(s.closest('[data-at-rest-hidden]') ?? s).visibility, onTop: top === s || s.contains(top), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], over }
}, `view-figure-set-${id}`)
/** No card selected: React Flow's own pane click, dispatched where the pointer is not (the pointer does not move). */
const deselect = () => page.evaluate(() => document.querySelector('.react-flow__pane')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

// Open the editor as a person does: point at the card, press ✎. Then no card selected.
await node.hover()
await page.getByTestId(`view-figure-edit-${id}`).click()
await set.waitFor({ state: 'attached', timeout: 10000 })
await deselect()
await page.waitForTimeout(300)
check((await selected()).length === 0, `no card selected (${(await selected()).join(', ') || 'none'})`)

// (1) The pointer moved off the card.
const off = await emptyPoint()
check(off !== null, 'an empty point on the canvas to move to')
await page.mouse.move(off.x, off.y)
await page.waitForTimeout(400)
let s = await setShown()
check(s.exists && s.visibility === 'visible' && s.onTop && (await set.isVisible()), `(1) pointer off the card, no card selected: Set visible and on top (${JSON.stringify(s)})`)

// (2) Tab from the typed figure to Set.
await page.getByTestId(`view-figure-typed-${id}`).focus()
await page.keyboard.type('5')
await page.keyboard.press('Tab')
const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
s = await setShown()
check(focused === `view-figure-set-${id}` && s.visibility === 'visible' && (await set.isVisible()) && (await selected()).length === 0, `(2) Tab: Set focused (${focused}) and visible (${s.visibility}), no card selected`)

// (3) A canvas re-layout while the editor is open: a figure core cannot read, sent with Enter, shows core's refusal on the card, the card
// grows, and the graph is laid out again. The pointer stays off the card; no card selected.
const at = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.react-flow__node')].map((e) => [e.getAttribute('data-id'), Math.round(e.getBoundingClientRect().top)])))
const before = await at()
await page.getByTestId(`view-figure-typed-${id}`).fill('lots')
await page.getByTestId(`view-figure-typed-${id}`).press('Enter')
await page.getByTestId(`view-figure-error-${id}`).waitFor({ state: 'attached', timeout: 15000 })
await page.waitForTimeout(1500)
const after = await at(), moved = Object.keys(after).filter((k) => k !== id && before[k] !== after[k])
await page.mouse.move(off.x, off.y)
await deselect()
await page.waitForTimeout(400)
s = await setShown()
check(moved.length > 0, `(3) the canvas was laid out again while the editor was open (${moved.length} cards moved)`)
check(s.visibility === 'visible' && s.onTop && (await set.isVisible()) && (await selected()).length === 0, `(3) after the re-layout, pointer off, no card selected: Set visible and on top (${JSON.stringify(s)})`)

await b.close()
console.log(fails === 0 ? '\nAll three hold.' : `\n${fails} failed.`)
process.exit(fails === 0 ? 0 : 1)
