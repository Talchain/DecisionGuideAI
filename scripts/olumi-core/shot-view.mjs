// ONE VIEW FROM A FILE, AS A PERSON SEES IT ON OPEN (DL 4 Nov: case 0 beside Paul's staging screen). DGAI's served build, signed in on a
// scripted core, with the View at VIEW_FIXTURE served as the scenario's View; reports the zoom and saves a screenshot. Zero AI calls.
//   VIEW_FIXTURE=<view.json> node scripts/olumi-core/shot-view.mjs --shot <png>     (VIEW_W, default 1440; CHROME, as two-people.mjs)
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const BASE = process.env.CORE_BASE ?? 'http://127.0.0.1:3951', ADMIN = process.env.OLUMI_ADMIN_KEY ?? 'dgai-core-admin-key-0123456789abcdef'
const SHOT = process.argv.includes('--shot') ? process.argv[process.argv.indexOf('--shot') + 1] : null
const golden = JSON.parse(readFileSync(process.env.VIEW_FIXTURE, 'utf8'))

const r = await fetch(`${BASE}/api/admin/people`, { method: 'POST', headers: { 'x-olumi-admin': ADMIN, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Fit' }) })
const link = (await r.json()).link.split('?')[0]
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
const page = await (await b.newContext({ viewport: { width: Number(process.env.VIEW_W ?? 1440), height: 900 } })).newPage()
await page.goto(BASE + link)
const made = await page.evaluate(async (op) => (await fetch('/api/scenarios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief: 'Our team resolves 80 tickets a week. Keep current staffing or add one specialist? We need at least 100 tickets a week.', op }) })).json(), `fit-${Date.now()}`)
await page.evaluate(async (p) => fetch(`/api/proposals/${p}/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base: null }) }), made.proposal)
const me = (await page.evaluate(async () => (await fetch('/api/me')).json())).me
const served = { ...golden, id: made.scenario, you_id: me.id, you: me.name }
await page.route(/\/api\/scenarios\/[^/]+\/view/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(served) }))
await page.goto(`${BASE}/#/scenario/00000000-0000-4000-8000-${made.scenario.slice(2)}`)
// A View from a file (VIEW_FIXTURE), as the person sees it on open, saved to --shot. For layout checks against Paul's screen.
await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`.react-flow__node[data-id="${id}"]`)), golden.model.cards.map((c) => c.id), { timeout: 30000 })
await page.waitForTimeout(3000)
const zoom = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a)
console.log(`  · ${golden.model.cards.length} cards, zoom ${zoom.toFixed(3)}`)
if (SHOT) await page.screenshot({ path: SHOT })
await b.close()
