// v2 ON THE LIVE ENGINE: the new design's own renderer (app.js, adapter.js) drawing the View the engine serves, with live/ (data source,
// actions, conversation panel). Every act is a press on the page; the driver only reads (the View by id; the store copy for refusals).
// env BASE LINKPATH SID OUT W H STORE PHASE=open|confirm|unsure|different|aside|cold SAID MEASURE
import { chromium } from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const E = process.env, OUT = E.OUT, PHASE = E.PHASE
const R = existsSync(`${OUT}/results.json`) ? JSON.parse(readFileSync(`${OUT}/results.json`, 'utf8')) : { steps: [] }
const S = existsSync(`${OUT}/state.json`) ? JSON.parse(readFileSync(`${OUT}/state.json`, 'utf8')) : {}
const step = (name, ok, note = '') => { const res = ok === null ? 'NEEDS LIVE REPLY' : ok ? 'PASS' : 'FAIL'; R.steps.push({ name, result: res, note }); console.log(`${res} ${name}${note ? ` (${note})` : ''}`); writeFileSync(`${OUT}/results.json`, JSON.stringify(R, null, 1)) }
const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: +E.W, height: +E.H } })).newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const sent = []; page.on('response', async (r) => { const q = r.request(); if (q.method() !== 'GET' && q.url().includes('/api/')) sent.push({ method: q.method(), path: new URL(q.url()).pathname, body: q.postData(), status: r.status() }) })
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const view = () => page.evaluate(async (sid) => (await fetch(`/api/scenarios/${sid}/view?schema=3&all=1`, { credentials: 'same-origin' })).json(), E.SID)
const refused = () => { const o = execFileSync('sqlite3', ['-json', `file:${E.STORE}/olumi.db?mode=ro`, "select body from rows where kind = 'version'"], { encoding: 'utf8' }).trim(); return (o ? JSON.parse(o) : []).flatMap((r) => JSON.parse(r.body).refused_readings ?? []) }
const ready = async () => { await page.waitForSelector('body.is-ready', { timeout: 30000 }); await page.waitForSelector('#live-panel', { timeout: 30000 }); await page.waitForTimeout(600) }
const drawn = async () => page.evaluate(() => ({ cards: document.querySelectorAll('#canvas [data-card]').length, title: document.title, iface: !!document.querySelector('#iface *'), topbar: (document.querySelector('#topbar')?.textContent || '').trim().slice(0, 80) }))
const visible = async (sel, text) => (await page.locator(sel).filter(text ? { hasText: text } : {}).filter({ visible: true }).count()) > 0
const reloadAfter = (f) => Promise.all([page.waitForEvent('load', { timeout: 200000 }), f()]).then(ready)
try {
  await page.goto(E.BASE + E.LINKPATH, { waitUntil: 'load' }) // the private link: its cookie
  errors.length = 0 // the link lands on / (no scenario named): only errors from the scenario's own page count
  await page.goto(`${E.BASE}/?sid=${E.SID}`, { waitUntil: 'load' }); await ready()
  const v0 = await view(), d0 = await drawn()
  if (PHASE !== 'cold') {
    step('V1 the engine\'s View drawn by v2 (adapter + renderer), with the live panel', d0.cards > 0 && d0.title.includes(v0.title) && errors.length === 0, `${d0.cards} cards; title "${d0.title}"; topbar "${d0.topbar}"; console errors ${errors.length}`)
    await shot('1-open')
    const qs = v0.model?.coaching_questions ?? [], at = qs.findIndex((q) => /success/i.test(q))
    await page.locator('[data-live="question"]').nth(at).click()
    await page.locator('[data-live="field"]').fill(E.SAID); await shot('2-answer-typed')
    await reloadAfter(() => page.locator('[data-live="send"]').click())
    const v1 = await view(), rd = (v1.proposal?.marks ?? []).find((m) => m.reading)
    const shown = !!rd && (await visible('[data-live="reading"]', rd.status)) && (await visible('[data-live="reading"]', rd.title.slice(0, 40)))
    step('V2 goal answered: Olumi\'s reply and its proposal, with Olumi\'s reading in the engine\'s words and three controls', !!v1.proposal && shown && (await visible('[data-live="turn-answered"]')), rd ? `proposal ${v1.proposal.id}; "${rd.status}"` : 'no reading')
    await shot('3-reading')
    S.placeholder = v1.model?.aim?.quantity ?? null
    if (PHASE === 'confirm' || PHASE === 'unsure') {
      await page.locator(`[data-live="reading-${PHASE}"]`).click(); await page.waitForTimeout(1200)
      const held = sent.filter((w) => w.path.includes('/approve')).length === 0 && (await page.locator(`[data-live="reading-${PHASE}"]`).getAttribute('aria-pressed')) === 'true'
      step(`V3 ${PHASE}: the answer alone sends nothing; held until the person approves (PL-640)`, held, `approvals sent ${sent.filter((w) => w.path.includes('/approve')).length}`)
      await shot(`4-${PHASE}-held`)
      await reloadAfter(() => page.locator('[data-live="approve"]').click())
      const v2 = await view(), now = v2.model?.aim?.quantity ?? null, ref = refused(), req = sent.filter((w) => w.path.includes('/approve')).at(-1)
      const ok = PHASE === 'confirm' ? v2.proposal == null && now !== S.placeholder && (req?.body ?? '').includes('only_readings') && ref.length === 0
        : v2.proposal == null && now === S.placeholder && !(req?.body ?? '').includes('only_readings') && !(req?.body ?? '').includes('refuse_readings') && ref.length === 0
      step(`V4 ${PHASE}, then Approve: ${PHASE === 'confirm' ? 'the aim is measured by the saved figure Olumi named' : 'the aim keeps the measure given; no refusal'}; v2 redraws from the engine`, ok && (await drawn()).cards > 0,
        `aim ${S.placeholder} -> ${now}; refused ${JSON.stringify(ref)}; ${req ? `${req.path} ${req.body}`.slice(0, 220) : 'no approve'} -> ${req?.status}`)
      const nc = (v2.model?.cards ?? []).filter((c) => c.family === 'option' && c.headline?.state === 'none').map((c) => c.headline.text)
      const ncDrawn = await page.evaluate((ts) => ts.every((t) => document.querySelector('#canvas').textContent.includes(t)), [...new Set(nc)])
      step('V5 "Not calculated": drawn by v2 for each option the engine cannot support', nc.length > 0 && ncDrawn, `${nc.length} options: ${[...new Set(nc)].join(' / ')}; drawn ${ncDrawn}`)
      await shot(`5-${PHASE}-after`)
      S.after = { version: v2.version?.n, aim: now, records: [...new Set((v2.collab?.records ?? []).map((r) => r.id))].sort() }
    } else if (PHASE === 'different') {
      await page.locator('[data-live="reading-different"]').click()
      const ctx = await visible('[data-live="context"]', rd?.title.slice(0, 30))
      await page.locator('[data-live="field"]').fill(E.MEASURE); await shot('4-different-typed')
      await page.locator('[data-live="send"]').click()
      await page.waitForFunction(() => !document.querySelector('[data-live="field"]')?.disabled, null, { timeout: 200000 }); await page.waitForTimeout(800)
      const v2 = await view(), last = v2.chat.at(-1), end = last?.problem ? await visible('[data-live="turn-problem"]', last.problem) : false
      step('V3 a different measure: the reading\'s question goes with the person\'s words; the turn reaches Olumi; its end shown; no refusal', ctx && end && refused().length === 0 && v2.proposal?.id === v1.proposal?.id, `context ${ctx}; end "${last?.problem ?? ''}" shown ${end}`)
      step('V3b a different measure answered by Olumi', null, 'no saved reply exists for this turn')
      await shot('5-different-ended')
    } else if (PHASE === 'aside') {
      await reloadAfter(() => page.locator('[data-live="set-aside"]').click())
      const v2 = await view(), status = (v2.chat ?? []).find((t) => t.status)?.status
      const said = status ? await visible('[data-live="turn-status"]', status) : false
      step('V3 set aside: no proposal left, and the set-aside is said in the engine\'s words', v2.proposal == null && said, `status "${status ?? ''}" shown ${said}; ${JSON.stringify(sent.filter((w) => w.path.includes('/discard')).at(-1) ?? null)}`)
      await shot('4-aside')
    }
    writeFileSync(`${OUT}/state.json`, JSON.stringify(S, null, 1))
  } else {
    const recs = [...new Set((v0.collab?.records ?? []).map((r) => r.id))].sort()
    step('V6 server restarted, reopened cold: v2 draws the same model from the engine (measure and records by id)', v0.version?.n === S.after.version && (v0.model?.aim?.quantity ?? null) === S.after.aim && JSON.stringify(recs) === JSON.stringify(S.after.records) && d0.cards > 0,
      `version ${v0.version?.n}; aim ${v0.model?.aim?.quantity}; records same ${JSON.stringify(recs) === JSON.stringify(S.after.records)}; ${d0.cards} cards`)
    await shot('6-cold')
  }
} catch (e) { step(`${PHASE}: stopped`, false, String(e).split('\n')[0]) }
R[`errors_${PHASE}`] = errors
writeFileSync(`${OUT}/results.json`, JSON.stringify(R, null, 1))
await b.close()
