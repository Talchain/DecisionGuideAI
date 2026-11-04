#!/usr/bin/env node
/**
 * The spec §8 team proof in DGAI, by two people in two browsers, against a scripted olumi-core serving this build (run.sh core): zero
 * provider calls. Each step is driven in DGAI and checked three ways: on DGAI's screen, in core's View, and on core's own page for the
 * same scenario, so both screens are shown to agree.
 *
 *   scripts/olumi-core/run.sh build && CORE_DIR=<olumi-core wip/v3.1> scripts/olumi-core/run.sh core     # in another terminal
 *   node scripts/olumi-core/two-people.mjs [--shots <dir>]          # CHROME=<a Chromium binary> if Playwright's own is not installed
 *
 * Exits non-zero on the first step that does not hold, naming it.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.CORE_BASE ?? `http://127.0.0.1:${process.env.CORE_PORT ?? 3951}`
const ADMIN = process.env.OLUMI_ADMIN_KEY ?? 'dgai-core-admin-key-0123456789abcdef'
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null
const BRIEF = 'Our team resolves 80 tickets a week. Each specialist adds about 20, somewhere between 10 and 30. Keep current staffing or add one specialist? We need at least 100 tickets a week. Total is today plus the specialists. Our team lead says a new hire may unsettle the team.'
// A real core drafts a first model in minutes (PL review 4 Nov): against a served CORE_BASE each step waits up to 10 minutes.
const T = Number(process.env.STEP_TIMEOUT_MS ?? (process.env.CORE_BASE ? 600_000 : 30_000))

const step = (n, what) => console.log(`\n▶ ${n}. ${what}`)
const ok = (what) => console.log(`  ✓ ${what}`)
function check(cond, what) { if (!cond) { console.error(`  ✗ ${what}`); process.exit(1) } ok(what) }

async function mint(name, scenario) {
  const r = await fetch(`${BASE}/api/admin/people`, { method: 'POST', headers: { 'x-olumi-admin': ADMIN, 'content-type': 'application/json' }, body: JSON.stringify({ name, ...(scenario ? { scenario } : {}) }) })
  if (r.status !== 201) throw new Error(`core made no link for ${name}: ${r.status}`)
  return (await r.json()).link.split('?')[0]
}
const uuidOf = (sid) => `00000000-0000-4000-8000-${sid.slice(2)}`

// CHROME: a Chromium to drive when Playwright's own is not installed (one headless browser at a time on the Mac).
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
/** A person in their own browser: their private link signs it in and core lands it (on DGAI's scenario route when it names one); then `to`, if given. */
const person = async (name, link, to) => {
  const ctx = await browser.newContext({ viewport: { width: Number(process.env.VIEW_W ?? 1440), height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error(`  [${name} page error] ${e.message}`))
  await page.goto(`${BASE}${link}`)
  if (to) await page.goto(`${BASE}/${to}`)
  return { name, ctx, page }
}
const view = (p, sid) => p.page.evaluate(async (s) => (await fetch(`/api/scenarios/${s}/view`)).json(), sid)
/** The View once core holds what was just asked for: a press answers asynchronously, so a read straight after the click can come first. */
const viewWhen = async (p, sid, ready) => {
  for (const end = Date.now() + T; Date.now() < end;) { const v = await view(p, sid); if (ready(v)) return v; await p.page.waitForTimeout(500) }
  return view(p, sid)
}
/** What a screen shows after a read: polled until it holds or the step's time runs out (a live server answers slower than 400 ms;
 *  github-a7's and the live witness, 4 Nov). */
const seen = async (p, f) => { for (const end = Date.now() + T; Date.now() < end;) { if (await f().catch(() => false)) return true; await p.page.waitForTimeout(500) } return f().catch(() => false) }
const shot = async (p, label) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await p.page.screenshot({ path: `${SHOTS}/${label}.png` }) } }
const tab = async (p, id) => { await p.page.getByTestId(`outputs-dock-tab-${id}`).click() }
const teamCheck = async (p) => { await tab(p, 'team'); await p.page.getByTestId('team-check').click(); await p.page.waitForTimeout(400) }
/** Pan the canvas as a person does in select mode (a middle-button drag), moving its content by (dx, dy). */
const pan = async (p, dx, dy) => {
  // From empty canvas, as a person does: the first point on a grid where the pane itself is under the pointer (not a card or a note).
  const at = await p.page.evaluate(() => {
    const r = document.querySelector('.react-flow').getBoundingClientRect()
    for (let fy = 0.5; fy < 1; fy += 0.04) for (let fx = 0.1; fx < 0.9; fx += 0.04) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy, el = document.elementFromPoint(x, y)
      if (el?.classList.contains('react-flow__pane')) return { x, y }
    }
    return null
  })
  if (at === null) throw new Error('no empty canvas to drag from')
  const { x, y } = at
  await p.page.mouse.move(x, y)
  await p.page.mouse.down({ button: 'middle' })
  await p.page.mouse.move(x + dx, y + dy, { steps: 12 })
  await p.page.mouse.up({ button: 'middle' })
}
/** Bring a card to the middle of the canvas by panning to it: a real first model has cards beyond the view, which Playwright's scroll
 *  cannot reach on a transformed canvas (github-a7's real-AI witness, 4 Nov). */
/** The canvas a person can see: the React Flow pane left of the dock (the dock sits over the canvas's right side). */
const free = async (p) => {
  const pane = await p.page.locator('.react-flow').first().boundingBox(), dock = await p.page.getByTestId('outputs-dock').boundingBox()
  const right = dock && dock.x > pane.x ? Math.min(pane.x + pane.width, dock.x) : pane.x + pane.width
  return { x: pane.x, y: pane.y, width: right - pane.x, height: pane.height }
}
const reach = async (p, id) => {
  const f = await free(p), b = await p.page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox()
  await pan(p, f.x + f.width / 2 - (b.x + b.width / 2), f.y + f.height / 2 - (b.y + b.height / 2))
}
const inView = async (p, id) => {
  const f = await free(p), b = await p.page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox()
  return b.x >= f.x && b.y >= f.y && b.x + b.width <= f.x + f.width && b.y + b.height <= f.y + f.height
}
/** Tick change line i. Over 12 changes core groups them (proposal.groups) and each line sits in its folded group: open that group first,
 *  as a person does (github-a7's real-AI witness, 4 Nov: 13 lines, tick 0 'not visible'). */
const tickLine = async (p, proposal, i, on = true) => {
  const box = p.page.getByTestId(`view-change-tick-${i}`)
  const gi = proposal.groups?.findIndex((g) => g.lines.includes(i)) ?? -1
  if (gi >= 0 && !(await box.isVisible())) await p.page.locator(`[data-view="proposal.groups.${gi}.heading"]`).click()
  await (on ? box.check({ timeout: T }) : box.uncheck({ timeout: T }))
}
/** The View's cards and question that lie outside the canvas a person can see (left of the dock), by id; [] when the whole model is in view. */
const outOfView = async (p) => {
  const f = await free(p)
  return p.page.evaluate((f) => [...document.querySelectorAll('.react-flow__node-viewCard, .react-flow__node-viewQuestion')].filter((e) => {
    const r = e.getBoundingClientRect()
    return r.left < f.x - 1 || r.top < f.y - 1 || r.right > f.x + f.width + 1 || r.bottom > f.y + f.height + 1
  }).map((e) => e.getAttribute('data-id')), f)
}
/**
 * What a person must see on landing (DL 4 Nov, readable first): the question and every option (the top of the causal graph), in the canvas left of the dock;
 * and the whole board when it fits there at 0.5 or more. Returns the ids missing, [] when all is as it should be.
 */
const notFramed = async (p, model) => p.page.evaluate(({ model, f }) => {
  const rect = (id) => document.querySelector(`.react-flow__node[data-id="${id}"]`)?.getBoundingClientRect()
  const inside = (r) => r && r.left >= f.x - 1 && r.top >= f.y - 1 && r.right <= f.x + f.width + 1 && r.bottom <= f.y + f.height + 1
  const z = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform).a
  const all = ['page:question', ...model.cards.map((c) => c.id)], rs = all.map(rect).filter(Boolean)
  const bw = (Math.max(...rs.map((r) => r.right)) - Math.min(...rs.map((r) => r.left))) / z, bh = (Math.max(...rs.map((r) => r.bottom)) - Math.min(...rs.map((r) => r.top))) / z
  const whole = Math.min(f.width / bw, f.height / bh) >= 0.5
  const tops = model.cards.filter((c) => c.family === 'option').map((c) => c.id)
  return (whole ? all : ['page:question', ...tops]).filter((id) => !inside(rect(id)))
}, { model, f: await free(p) })
/** Core's own page for the scenario, opened by the same person (their cookie), as its text. */
const corePage = async (p, sid) => {
  const other = await p.ctx.newPage()
  await other.goto(`${BASE}/s/${sid}`)
  await other.waitForSelector('text=Team views', { timeout: T })
  // Its team panel is a folded <details>: its text is read whole, folded or not.
  const text = await other.locator('body').evaluate((b) => b.textContent ?? '')
  await other.close()
  return text
}

// ── 0. Ada starts the scenario in DGAI ──────────────────────────────────────────────────────────────────────────────────────────
step(0, 'Ada writes the brief in DGAI and approves Olumi\'s first model')
const ada = await person('Ada', await mint('Ada'), '#/canvas')
await ada.page.waitForSelector('#view-chat-text', { timeout: T })
await ada.page.fill('#view-chat-text', BRIEF)
await ada.page.getByRole('button', { name: 'Send', exact: true }).click()
await ada.page.getByTestId('view-chat-proposal').waitFor({ timeout: T })
await ada.page.waitForURL(/#\/scenario\/00000000-0000-4000-8000-[0-9a-f]{12}$/, { timeout: T })
await shot(ada, '0-first-model-proposal')
const sid = `s_${ada.page.url().slice(-12)}`
check(/^s_[0-9a-f]{12}$/.test(sid), `the address bar names core's scenario (${sid} as /#/scenario/${uuidOf(sid)})`)
await ada.page.getByRole('button', { name: 'Approve', exact: true }).click()
await ada.page.waitForFunction(() => document.querySelectorAll('.react-flow__node-viewCard').length > 0, null, { timeout: T })
let v = await viewWhen(ada, sid, (x) => x.proposal === null)
await ada.page.waitForTimeout(300)
const cards = await ada.page.locator('.react-flow__node-viewCard').count()
// The whole model in view on first open, left of the dock (live olumi-core-v3, 4 Nov: a real model opened cut off).
// The requirement changed (DL 4 Nov): the question and every option (the top of the causal graph), and the whole board when it fits at 0.5 or more.
const v1 = await viewWhen(ada, sid, (x) => x.version?.n === 1 && x.model !== null)
check(await seen(ada, async () => (await notFramed(ada, v1.model)).length === 0), `on first open: the question, every option, and the whole board when it fits at 0.5 or more${(await notFramed(ada, v1.model)).length ? ` (out: ${(await notFramed(ada, v1.model)).join(', ')})` : ''}`)
await shot(ada, '0-canvas-version-1')
check(v.version?.n === 1 && v.proposal === null, 'core holds version 1 and nothing pending')
check(cards === v.model.cards.length, `DGAI's canvas draws every card of core's View (${cards} of ${v.model.cards.length})`)
check(!(await ada.page.getByText('Untitled scenario').first().isVisible().catch(() => false)) && await ada.page.getByText(v.title, { exact: true }).first().isVisible(), `the top bar names the scenario as core does ("${v.title}")`)
for (const c of v.model.cards.slice(0, 4)) check(await ada.page.locator(`.react-flow__node-viewCard >> text=${c.heading}`).first().isVisible(), `card "${c.heading}" in core's words`)
// No dead controls (Paul's W4 rule): what the lane cannot serve is not on the page at all, not shown dark.
for (const gone of ['analysisNew', 'diagnostics', 'compare']) check(await ada.page.getByTestId(`outputs-dock-tab-${gone}`).count() === 0, `no ${gone === 'analysisNew' ? 'Reasoning' : gone === 'diagnostics' ? 'Model' : 'Compare'} tab`)
check(await ada.page.getByTestId('lens-bar').count() === 0, 'no lens bar')
for (const kept of ['olumi', 'results', 'team']) check(await ada.page.getByTestId(`outputs-dock-tab-${kept}`).count() === 1, `the ${kept} tab is there`)
// G6: Olumi's next step, beside the one card core names, in core's words.
const next = v.chat.find((t) => t.answer?.next.newest)?.answer?.next
check(next && next.at !== null, `core puts Olumi's next step beside one card (${next?.at})`)
const note = ada.page.getByTestId('olumi-attention-card')
await note.waitFor({ timeout: T })
const nextWords = next.text.map((p) => p.text ?? '').join('').trim()
check((await note.innerText()).includes(nextWords), `Olumi's note on the canvas says it: "${nextWords}"`)
// Lane C: the note sits beside its card and covers none (measured from what is drawn).
await ada.page.waitForTimeout(500)
const covers = await ada.page.evaluate(() => {
  const n = document.querySelector('[data-testid="olumi-attention-card"]').getBoundingClientRect()
  return [...document.querySelectorAll('.react-flow__node')].filter((e) => { const r = e.getBoundingClientRect(); return Math.min(n.right, r.right) > Math.max(n.left, r.left) && Math.min(n.bottom, r.bottom) > Math.max(n.top, r.top) }).map((e) => e.getAttribute('data-id'))
})
check(covers.length === 0, `Olumi's note covers no card${covers.length ? ` (covers ${covers.join(', ')})` : ''}`)
// …and no canvas control (live, 4 Nov: it sat on the zoom controls).
const onControls = await ada.page.evaluate(() => {
  const n = document.querySelector('[data-testid="olumi-attention-card"]').getBoundingClientRect()
  return ['nav[aria-label="Viewport controls"]', 'nav[aria-label="Canvas tools"]'].filter((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return Math.min(n.right, r.right) > Math.max(n.left, r.left) && Math.min(n.bottom, r.bottom) > Math.max(n.top, r.top) })
})
check(onControls.length === 0, `Olumi's note covers no canvas control${onControls.length ? ` (covers ${onControls.join(', ')})` : ''}`)
await shot(ada, '0-ada-model')

// ── 1. Bea joins by her link, on the same address ───────────────────────────────────────────────────────────────────────────────
step(1, 'Ada brings Bea in from DGAI\'s Team tab (her own link, no admin key); Bea opens it in a second browser; each gives a private view')
await tab(ada, 'team')
await ada.page.getByTestId('team-invite-name').fill('Bea')
await ada.page.getByTestId('team-invite-go').click()
const beaLink = new URL(await ada.page.getByTestId('team-invite-link').inputValue())
check(beaLink.pathname.startsWith('/k/'), 'core made Bea\'s own private link')
// G5: the one link signs Bea in and lands her on this scenario in DGAI; nothing else is opened.
const bea = await person('Bea', beaLink.pathname + beaLink.search)
await bea.page.waitForURL(`${BASE}/#/scenario/${uuidOf(sid)}`, { timeout: T })
ok('the link alone lands Bea on the scenario\'s DGAI address')
await bea.page.waitForFunction(() => document.querySelectorAll('.react-flow__node-viewCard').length > 0, null, { timeout: T })
check(await bea.page.locator('.react-flow__node-viewCard').count() === cards, 'Bea\'s DGAI draws the same model')
// The signature also covers who is in the round, so the two are compared on the version and the model itself, read now.
const [va1, vb] = [await view(ada, sid), await view(bea, sid)]
check(vb.version.id === va1.version.id && JSON.stringify(vb.model) === JSON.stringify(va1.model), 'Bea\'s View is the same version and model, marks and results as Ada\'s')
for (const [p, words] of [[ada, 'Hire now: the backlog is the real risk.'], [bea, 'Wait a month: a new hire may unsettle the team.']]) {
  await teamCheck(p)
  await p.page.getByTestId('team-view-text').fill(words)
  await p.page.getByTestId('team-view-give').click()
  await p.page.getByTestId('team-mine').getByText(words).waitFor({ timeout: T })
  ok(`${p.name}'s view is held, private to ${p.name}`)
}
await teamCheck(ada)
check(!(await ada.page.getByTestId('team-tab').innerText()).includes('Wait a month'), 'Ada cannot see Bea\'s view before the reveal')
await shot(bea, '1-bea-private-view')

// ── 2. The reveal ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
step(2, 'Ada reveals everyone\'s views together; Bea sees both')
await ada.page.getByTestId('team-reveal-go').click()
await ada.page.getByTestId('team-revealed').getByText('Wait a month').waitFor({ timeout: T })
await teamCheck(bea)
check(await seen(bea, async () => { const t = await bea.page.getByTestId('team-revealed').innerText(); return t.includes('Hire now') && t.includes('Wait a month') }), 'both views, with their authors, on Bea\'s screen')
v = await view(bea, sid)
check(v.collab.shared.length === 2 && v.collab.mine.length === 0, 'core\'s View: two shared, none private')
await shot(bea, '2-bea-revealed')

// ── 3. The disagreement investigated: a challenge, through the chat ─────────────────────────────────────────────────────────────
step(3, 'Bea investigates the disagreement: she asks Olumi in DGAI\'s chat (a question, no model change)')
await tab(bea, 'olumi')
await bea.page.fill('#view-chat-text', 'What would a new hire really add in the first month?')
await bea.page.getByRole('button', { name: 'Send', exact: true }).click()
await bea.page.getByTestId('view-chat-working').waitFor({ state: 'detached', timeout: T }).catch(() => {})
v = await view(bea, sid)
check(v.chat.some((t) => t.said.includes('really add in the first month')), 'core holds Bea\'s question in the shared conversation')
check(v.proposal === null && v.version.n === 1, 'a question changes nothing in the model')

// ── 4. Evidence ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
step(4, 'Bea adds evidence that challenges a card of the approved model')
await tab(bea, 'team')
const target = v.model.cards.find((c) => c.family === 'quantity') ?? v.model.cards[0]
await bea.page.getByTestId('team-evidence-open').click()
await bea.page.getByTestId('team-evidence-body').fill('Last year two hires took six weeks to reach full speed.')
await bea.page.getByTestId('team-evidence-source').fill('https://example.org/onboarding-review')
await bea.page.getByTestId('team-evidence-bears').selectOption(target.id)
await bea.page.getByLabel('Challenges it').check()
await bea.page.getByTestId('team-evidence-add').click()
await bea.page.getByText('Last year two hires took six weeks').waitFor({ timeout: T })
await teamCheck(ada)
check(await seen(ada, async () => (await ada.page.getByTestId('team-evidence-list').innerText()).includes(`Bears on: ${target.heading}`)), `Ada sees it, on "${target.heading}"`)
v = await view(ada, sid)
check(v.evidence.length === 1 && v.evidence[0].stance === 'challenges' && v.evidence[0].concerns[0] === target.id, 'core\'s View holds it as Bea gave it')

// ── 5. An approved change ───────────────────────────────────────────────────────────────────────────────────────────────────────
step(5, 'Ada asks for a change in DGAI\'s chat, sees it as a proposal, and approves it')
await tab(ada, 'olumi')
await ada.page.fill('#view-chat-text', 'Add staff absence as a factor.')
await ada.page.getByRole('button', { name: 'Send', exact: true }).click()
await ada.page.getByTestId('view-chat-proposal').waitFor({ timeout: T })
// L8: core's change list on the card, each line with its tick; ticking one offers "Approve ticked · 1" (approved whole here; step 9 ticks).
const held = (await view(ada, sid)).proposal
const ticks = await ada.page.locator('[data-testid^="view-change-tick-"]').count()
if (held.changes.length > 1) {
  check(ticks === held.changes.length, `core's ${held.changes.length} change lines, each with its tick`)
  await tickLine(ada, held, 0)
  check((await ada.page.getByTestId('view-approve-ticked').innerText()).includes('Approve ticked · 1'), 'one tick offers Approve ticked · 1')
  await shot(ada, '5-proposal-ticked')
  await tickLine(ada, held, 0, false)
} else check(held.changes.length === 1 && ticks === 0 && await ada.page.getByTestId('view-approve-ticked').count() === 0, 'core\'s one change line, with no tick: Approve is the whole of it')
await ada.page.getByRole('button', { name: 'Approve', exact: true }).click()
await ada.page.waitForFunction(() => document.querySelectorAll('.react-flow__node-viewCard').length > 0, null, { timeout: T })
v = await viewWhen(ada, sid, (x) => x.proposal === null && x.version?.n === 2)
await ada.page.waitForTimeout(500)
check(v.version.n === 2 && v.proposal === null, 'core holds version 2')
check(await seen(ada, async () => (await notFramed(ada, v.model)).length === 0), 'version 2 on Ada\'s canvas: the question, every option, and the whole board when it fits at 0.5 or more')
check(await ada.page.locator('.react-flow__node-viewCard').count() === v.model.cards.length, 'Ada\'s canvas draws version 2\'s cards')
await teamCheck(bea)
check(await seen(bea, async () => await bea.page.locator('.react-flow__node-viewCard').count() === v.model.cards.length), 'Bea\'s canvas moved to version 2 on her next read')
check(JSON.stringify((await view(bea, sid)).model) === JSON.stringify(v.model), 'Bea\'s View is version 2\'s model')
await shot(bea, '5-bea-version-2')

// ── 5b. The person's own figure, changed on its card ────────────────────────────────────────────────────────────────────────────
step('5b', 'Ada changes a figure on its card in DGAI, typed as she would say it; core reads it and both screens show it')
const editable = v.model.cards.find((c) => c.figure?.edit)
check(editable !== undefined, `core offers a figure to change ("${editable?.heading}")`)
// The card may be beyond the view on a real first model: here it is first panned off, then Ada pans to it, so the proof always reaches it.
await pan(ada, 4000, 0)
check(!(await inView(ada, editable.id)), 'the card is off the view')
await reach(ada, editable.id)
check(await inView(ada, editable.id), 'Ada pans the canvas to it')
await shot(ada, '5b-reached')
await ada.page.getByTestId(`view-figure-edit-${editable.id}`).click()
await ada.page.getByTestId(`view-figure-typed-${editable.id}`).fill('lots')
await ada.page.getByTestId(`view-figure-set-${editable.id}`).click()
await ada.page.getByTestId(`view-figure-error-${editable.id}`).waitFor({ timeout: T })
check((await ada.page.getByTestId(`view-figure-error-${editable.id}`).innerText()) === editable.figure.edit.ask, 'a figure core cannot read is refused in the card\'s own words')
// What-if on a copy: the same figure tried first, nothing saved (core's POST /whatif); drawn over the chances, marked not saved.
await ada.page.getByTestId(`view-figure-typed-${editable.id}`).fill('5')
await ada.page.getByTestId(`view-figure-try-${editable.id}`).click()
await ada.page.getByTestId('view-whatif').waitFor({ timeout: T })
check((await ada.page.getByTestId('view-whatif').innerText()).includes('What-if, not saved'), 'the try opens the chances: a what-if drawn over them, marked not saved')
check((await view(ada, sid)).version.n === 2, 'core saved nothing: still version 2')
await shot(ada, '5b-whatif')
check(await ada.page.getByText('This element has no detailed editor yet.').count() === 0, 'the card\'s editor works on the card, with no inspector opened over the canvas')
await ada.page.getByTestId('view-whatif-clear').click()
check(await ada.page.getByTestId('view-whatif').count() === 0, 'Clear removes it')
await ada.page.getByTestId(`view-figure-typed-${editable.id}`).fill('15 to 25')
await ada.page.getByTestId(`view-figure-set-${editable.id}`).click()
await ada.page.getByTestId(`view-figure-form-${editable.id}`).waitFor({ state: 'detached', timeout: T })
v = await view(ada, sid)
const edited = v.model.cards.find((c) => c.id === editable.id)
check(v.version.n === 3 && edited.figure.text !== editable.figure.text, `core holds version 3: "${editable.figure.text}" is now "${edited.figure.text}"`)
check(await ada.page.locator(`[data-view="${editable.id}.figure.text"]`).innerText() === edited.figure.text, 'Ada\'s card says it as core does')
await teamCheck(bea)
check(await seen(bea, async () => await bea.page.locator(`[data-view="${editable.id}.figure.text"]`).innerText() === edited.figure.text), 'Bea\'s card too, on her next read')
const coreText = await corePage(ada, sid)
check(coreText.includes(edited.figure.text), 'core\'s own page shows the new figure')

// ── 6. A commitment ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
step(6, 'Ada records the next action, owned by Bea')
await tab(ada, 'team')
await ada.page.getByTestId('team-commitment-open').click()
await ada.page.getByTestId('team-c-action').fill('Run a four-week trial hire')
await ada.page.getByTestId('team-c-owner').selectOption({ label: 'Bea' })
await ada.page.getByTestId('team-c-expect').fill('At least 95 tickets a week by week four')
await ada.page.getByTestId('team-c-reconsider').fill('Under 85 tickets a week at week two')
// G3: the disagreement the approved model records stays open, by its id; its label comes back from core.
// With real AI the approved model may hold no disagreement record (the views stay contributions): then nothing is offered to keep, and
// the action is recorded without one (github-a7's real-AI witness, 4 Nov). Either branch is witnessed.
const dissent = (await view(ada, sid)).collab.dissent
if (dissent.length > 0) {
  ok(`core records ${dissent.length} disagreement(s) in the approved model`)
  await ada.page.getByTestId(`team-c-keep-${dissent[0].id}`).check()
} else check(await ada.page.locator('[data-testid^="team-c-keep-"]').count() === 0, 'core records no disagreement in the approved model, so none is offered to keep')
await ada.page.getByTestId('team-commitment-save').click()
await ada.page.getByText('Run a four-week trial hire').waitFor({ timeout: T })
await teamCheck(bea)
check(await seen(bea, async () => (await bea.page.getByTestId('team-commitment-list').innerText()).includes('owner Bea · set by Ada')), 'Bea sees it, owned by her')
const kept = (await view(bea, sid)).collab.commitments[0]
if (dissent.length > 0) {
  check(JSON.stringify(kept.keeps) === JSON.stringify([dissent[0].id]), 'core holds the commitment keeping that disagreement open')
  check(await bea.page.getByTestId(`team-commitment-keeps-${kept.id}`).isVisible(), 'Bea sees what it keeps open')
} else check(kept.keeps.length === 0 && await bea.page.getByTestId(`team-commitment-keeps-${kept.id}`).count() === 0, 'core holds the commitment keeping nothing open, and Bea sees none')

// ── 7. The later review ─────────────────────────────────────────────────────────────────────────────────────────────────────────
step(7, 'Bea records what happened against the expectation')
const c = (await view(bea, sid)).collab.commitments[0]
await bea.page.getByTestId(`team-outcome-open-${c.id}`).click()
await bea.page.getByTestId(`team-o-${c.id}-happened`).fill('92 a week by week four; the reconsider point did not come up.')
await bea.page.getByTestId(`team-o-${c.id}-versus`).getByLabel('Worse than expected').check()
await bea.page.getByTestId(`team-o-${c.id}-triggered`).getByLabel('No, it did not').check()
await bea.page.getByTestId(`team-o-${c.id}-save`).click()
await bea.page.getByText('92 a week by week four').waitFor({ timeout: T })
await teamCheck(ada)
check(await seen(ada, async () => (await ada.page.getByTestId(`team-commitments`).innerText()).includes('92 a week by week four')), 'Ada sees the outcome')
await shot(ada, '7-ada-team')

// ── Both screens agree ──────────────────────────────────────────────────────────────────────────────────────────────────────────
step(8, 'core\'s own page, opened by each person, shows the same team state')
for (const p of [ada, bea]) {
  const text = await corePage(p, sid)
  for (const words of ['Hire now: the backlog is the real risk.', 'Wait a month: a new hire may unsettle the team.', 'Run a four-week trial hire', 'At least 95 tickets a week by week four'])
    check(text.includes(words), `${p.name} on core's page: "${words}"`)
}
// The record and how the model moved, from DGAI's Team tab, both core's own (PL review 4 Nov).
await teamCheck(ada)
check(await ada.page.getByTestId('team-record-link').getAttribute('href') === `/s/${sid}/record`, 'the printable record is core\'s page for this scenario')
check(await ada.page.evaluate(async (s) => (await fetch(`/s/${s}/record`)).status, sid) === 200, 'core serves it to Ada')
await ada.page.getByTestId('team-compare').locator('summary').click()
await ada.page.getByTestId('team-compare-from').selectOption('1')
await ada.page.getByTestId('team-compare-go').click()
await ada.page.getByTestId('team-compare-out').waitFor({ timeout: T })
await shot(ada, '8-compare')
const cmp = await ada.page.evaluate(async (s) => (await fetch(`/api/scenarios/${s}/compare?from=1&to=3`)).json(), sid)
const shownChanges = await ada.page.getByTestId('team-compare-changes').locator('li').count()
check(cmp.changes.length > 0 && shownChanges === cmp.changes.length, `compare version 1 with 3 draws core's ${cmp.changes.length} change lines`)
const [va, vb2] = [await view(ada, sid), await view(bea, sid)]
check(va.version.id === vb2.version.id && JSON.stringify(va.model) === JSON.stringify(vb2.model) && JSON.stringify(va.evidence) === JSON.stringify(vb2.evidence) && JSON.stringify(va.collab.commitments) === JSON.stringify(vb2.collab.commitments), 'Ada\'s and Bea\'s Views are the same model, marks, results, evidence and commitments')

// ── 9. Partial approval (L8) ────────────────────────────────────────────────────────────────────────────────────────────────────
step(9, 'Ada asks for another change and approves only its first line (core\'s `only` / `only_top`)')
const before = va.version.n
await tab(ada, 'olumi')
await ada.page.fill('#view-chat-text', 'Add a third option.')
await ada.page.getByRole('button', { name: 'Send', exact: true }).click()
await ada.page.getByTestId('view-chat-proposal').waitFor({ timeout: T })
const part = (await viewWhen(ada, sid, (x) => x.proposal !== null)).proposal
await tickLine(ada, part, 0)
await ada.page.getByTestId('view-approve-ticked').click()
// Core refuses a line that needs an unchosen added record (409, naming it), in its own words; a person then ticks the rest too.
const saved = (x) => x.proposal === null && x.version?.n === before + 1
for (const end = Date.now() + T; Date.now() < end && !saved(await view(ada, sid)) && await ada.page.getByTestId('view-chat-said').count() === 0;) await ada.page.waitForTimeout(500)
let alone = true
if (await ada.page.getByTestId('view-chat-said').count() > 0 && !saved(await view(ada, sid))) {
  ok(`core refused the first line alone, in its words: "${await ada.page.getByTestId('view-chat-said').innerText()}"`)
  alone = false
  for (let i = 1; i < part.changes.length; i++) await tickLine(ada, part, i)
  await ada.page.getByTestId('view-approve-ticked').click()
}
v = await viewWhen(ada, sid, saved)
check(saved(v), alone ? `core approved the ticked line alone ("${part.changes[0].text}" of ${part.changes.length}): version ${before + 1}` : `core approved the ticked lines: version ${before + 1}`)

console.log(`\nAll steps hold. Scenario ${sid}: DGAI ${BASE}/#/scenario/${uuidOf(sid)} · core ${BASE}/s/${sid}`)
await browser.close()
