// DL-471 (a), on #/scenario, ZERO AI calls: two people, two browser contexts in one browser. Paul invites Sam; each gives a private view
// with a different figure for the same offered id; neither sees the other's before the reveal; Paul reveals; the difference shows; Paul
// keeps it as a disagreement ("Keep this as a disagreement"); reload, then (PHASE=cold) a restarted server: the kept disagreement holds for
// both. A witness AS FOUND: each step PASS or FAIL with the screen words; it fixes nothing. Bound by ids from the View; every act a press.
// env BASE LINKPATH SID OUT W H PHASE=journey|cold
import { chromium } from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const E = process.env, OUT = E.OUT, PHASE = E.PHASE
const R = existsSync(`${OUT}/results.json`) ? JSON.parse(readFileSync(`${OUT}/results.json`, 'utf8')) : { steps: [] }
const S = existsSync(`${OUT}/state.json`) ? JSON.parse(readFileSync(`${OUT}/state.json`, 'utf8')) : {}
const step = (name, ok, note = '') => { const res = ok === 'see' ? 'SEEN' : ok ? 'PASS' : 'FAIL'; R.steps.push({ phase: PHASE, name, result: res, note: String(note).slice(0, 1500) }); console.log(`${res} [${PHASE}] ${name}${note ? ` (${String(note).slice(0, 600)})` : ''}`); writeFileSync(`${OUT}/results.json`, JSON.stringify(R, null, 1)) }
const save = () => { const {link, ...safe} = S; writeFileSync(`${OUT}/state.json`, JSON.stringify(safe, null, 1)) }
const URL_ = `${E.BASE}/#/scenario/00000000-0000-4000-8000-${E.SID.slice(2)}`
const AI = /\/(messages|moves|turns|draft)$/
const b = await chromium.launch()
const errors = [], sent = [], pages = [], offlineBlocks = []
async function person(tag) {
  const ctx = await b.newContext({ viewport: { width: +E.W, height: +E.H }, deviceScaleFactor: +(E.S ?? 1) }), page = await ctx.newPage()
  await page.route('**/*', (route) => { const q = route.request(); if (new URL(q.url()).origin !== E.BASE) { offlineBlocks.push({who:tag,origin:new URL(q.url()).origin}); return route.abort() }; if (q.method() !== 'GET' && AI.test(new URL(q.url()).pathname)) { sent.push({ who: tag, path: new URL(q.url()).pathname.replace(/(invites\/)[^/]+/, '$1<local-invite>'), blocked: true }); return route.abort() } return route.continue() })
  page.on('pageerror', (e) => errors.push(`${tag}: ${e}`)); page.on('console', (m) => { if (m.type() === 'error' && !/status of 40[49]/.test(m.text()) && !(/net::ERR_FAILED/.test(m.text()) && offlineBlocks.length > 0)) errors.push(`${tag}: ${m.text().slice(0, 160)}`) })
  page.on('response', (r) => { const q = r.request(); if (q.method() !== 'GET' && q.url().includes('/api/')) sent.push({ who: tag, path: new URL(q.url()).pathname.replace(/(invites\/)[^/]+/, '$1<local-invite>'), status: r.status() }) })
  page.tag = tag; pages.push(page); return page
}
const n = { paul: 0, sam: 0 }
const shot = (p, name) => p.screenshot({ path: `${OUT}/${PHASE}-${p.tag}-${String(++n[p.tag]).padStart(2, '0')}-${name}.png`, mask:[p.locator('[data-testid="team-invite-link"]')] })
const eshot = async (p, loc, name) => { await loc.first().scrollIntoViewIfNeeded().catch(() => null); return shot(p, name) }
const view = (p) => p.evaluate(async (sid) => (await fetch(`/api/scenarios/${sid}/view?schema=3`, { credentials: 'same-origin' })).json(), E.SID)
const diffs = (p) => p.evaluate(async (sid) => { const r = await fetch(`/api/scenarios/${sid}/differences`, { credentials: 'same-origin' }); return r.ok ? r.json() : { status: r.status, text: await r.text() } }, E.SID)
const tid = (p, id) => p.locator(`[data-testid="${id}"]`)
const vis = async (p, id) => (await tid(p, id).count()) > 0 && await tid(p, id).first().isVisible()
const into = async (p, id) => { await tid(p, id).first().scrollIntoViewIfNeeded().catch(() => null) }
const words = async (p, id) => ((await tid(p, id).first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim()
const open = async (p) => { await p.goto(URL_); await p.waitForSelector('[data-testid="view-canvas"]', { timeout: 30000 }); await p.waitForTimeout(1200) }
// The Team panel's way in on #/scenario: the lens bar's Team control (ViewLensBar.tsx), else the dock's Team tab.
async function teamTab(p) {
  if (await vis(p, 'team-tab')) return 'already open'
  if (await vis(p, 'lens-bar-team')) { await tid(p, 'lens-bar-team').click(); await p.waitForTimeout(1200); if (await vis(p, 'team-tab')) return 'lens-bar-team' }
  if (!(await vis(p, 'outputs-dock-tab-team')) && await vis(p, 'brief-panel-all-tabs')) { await tid(p, 'brief-panel-all-tabs').click(); await p.waitForTimeout(800) }
  if (await vis(p, 'outputs-dock-tab-team')) { await tid(p, 'outputs-dock-tab-team').click(); await p.waitForTimeout(1200); if (await vis(p, 'team-tab')) return 'outputs-dock-tab-team' }
  return null
}
const reopen = async (p) => { await p.reload(); await p.waitForSelector('[data-testid="view-canvas"]', { timeout: 30000 }).catch(() => null); await p.waitForTimeout(1200); return teamTab(p) }
const figsOf = (xs, by) => (xs ?? []).filter((x) => x.by_id === by).flatMap((x) => (x.figures ?? []).map((f) => ({ view: x.id, quantity: f.quantity, text: f.text ?? null, value: f.value ?? null })))
async function give(p, said, qty, typed) {
  await into(p, 'team-view-text'); await tid(p, 'team-view-text').fill(said)
  if (await vis(p, 'team-view-more')) { await tid(p, 'team-view-more').click(); await p.waitForTimeout(400) }
  const offered = await p.locator('[data-testid^="team-view-figure-"]').evaluateAll((es) => es.map((e) => e.dataset.testid.slice(17)))
  if (offered.includes(qty)) await tid(p, `team-view-figure-${qty}`).fill(typed)
  await into(p, 'team-view-give'); await eshot(p, tid(p, 'team-tab'), 'private-view-form')
  const why = await words(p, 'team-view-give-why')
  await tid(p, 'team-view-give').click(); await p.waitForTimeout(1200)
  return { offered, why }
}
// Closing the dock returns to the tab it landed from (revealReturn.ts:19), not to Team: the Team tab is pressed again, as a person would.
const undock = async (p) => { if (await vis(p, 'reveal-dock')) { S.undocked = (S.undocked ?? 0) + 1; save(); await tid(p, 'reveal-dock-close').click().catch(() => null); await p.waitForTimeout(1200) } if (!(await vis(p, 'team-differences'))) await teamTab(p) }
const keptLines = async (p, at) => { await undock(p); return keptRaw(p, at) }
const keptRaw = async (p, at) => p.locator(`[data-testid="${at}-steps"] li[data-step="dissent"]`).evaluateAll((es) => es.map((e) => ({ by: e.dataset.stepBy, text: e.textContent.replace(/\s+/g, ' ').trim() })))
async function authenticate(p, id) {
 const a = await (await fetch(`${E.BASE}/api/admin/people/${id}/reissue`, {method:'POST',headers:{'x-olumi-admin':'night-new-isolated-evidence-admin','content-type':'application/json'},body:'{}'})).json()
 await p.context().addCookies([{name:'olumi',value:a.link.slice(3),url:E.BASE,httpOnly:true,sameSite:'Lax'}])
}
const snapshot = v => ({version:v.version,proposal:v.proposal?.id??null,cards:v.model?.cards.map(c=>({id:c.id,figure:c.figure,author:c.author,headline:c.headline,change:c.change})),shared:v.collab.shared})
try {
  const paul = await person('paul'); await authenticate(paul, '1')
  if (PHASE === 'journey') {
    await open(paul); const way = await teamTab(paul); await shot(paul, 'team-open')
    step('A1 Paul opens the scenario and the Team panel (#/scenario)', !!way, `way in: ${way ?? 'none found (no lens-bar-team, no outputs-dock-tab-team)'}`)
    await into(paul, 'team-invite-name'); await tid(paul, 'team-invite-name').fill('Sam Okafor'); await tid(paul, 'team-invite-go').click(); await paul.waitForTimeout(1000)
    const link = await tid(paul, 'team-invite-link').first().inputValue().catch(() => null)
    S.link = link ? new URL(link, E.BASE).pathname + new URL(link, E.BASE).search : null; save()
    await eshot(paul, tid(paul, 'team-invite'), 'invite')
    step('A2 Paul invites Sam: core gives an invite link (team-invite-link)', !!S.link, S.link ? "a link was given (not printed)" : `screen: "${await words(paul, 'team-invite')}"`)
    const sam = await person('sam'); await sam.goto(E.BASE + S.link); await sam.waitForTimeout(1500); await open(sam); const sway = await teamTab(sam); await shot(sam, 'joined')
    const sv0 = await view(sam), pv0 = await view(paul); S.ids = { paul: pv0.you_id, sam: sv0.you_id }; save()
    step('A3 Sam opens the link in his own browser and reaches the same scenario\'s Team panel', !!sway && !!sv0.you_id && sv0.you_id !== pv0.you_id && sv0.id === E.SID, `Sam ${sv0.you_id}, Paul ${pv0.you_id}, scenario ${sv0.id}; gated ${sv0.gated}`)
    await reopen(paul)
    const v0 = await view(paul), offer = v0.collab.view_figure_cards ?? []; S.offer = offer.map((x) => x.id); S.qty = offer[0]?.id ?? null; save()
    const pg = await give(paul, 'I think funding takes longer than the model says.', S.qty, '6')
    step('A4 Paul gives a private view with his own figure (6) for an offered figure', !!S.qty && pg.offered.includes(S.qty), `offered ${JSON.stringify(pg.offered)}; chose ${S.qty}; under Give: "${pg.why}"`)
    await reopen(sam)
    const sg = await give(sam, 'I think it is quicker than that.', S.qty, '2')
    step('A5 Sam gives his own private view with a different figure (2) for the same id', sg.offered.includes(S.qty), `offered ${JSON.stringify(sg.offered)}; under Give: "${sg.why}"`)
    await reopen(paul); await reopen(sam)
    const pv = await view(paul), sv = await view(sam)
    const pText = await words(paul, 'team-tab'), sText = await words(sam, 'team-tab')
    const priv = !(pv.collab.shared ?? []).some((x) => x.by_id === S.ids.sam) && !(sv.collab.shared ?? []).some((x) => x.by_id === S.ids.paul) && !pText.includes('quicker than that') && !sText.includes('longer than the model says')
    await shot(paul, 'before-reveal'); await shot(sam, 'before-reveal')
    step('A6 private before the reveal: neither sees the other\'s view (View and screen)', priv, `Paul's View shared ${JSON.stringify((pv.collab.shared ?? []).map((x) => [x.id, x.by_id]))}; Sam's ${JSON.stringify((sv.collab.shared ?? []).map((x) => [x.id, x.by_id]))}`)
    const revOn = await vis(paul, 'team-reveal-go'); const revWords = revOn ? await words(paul, 'team-reveal-go') : ''
    if (revOn) { await into(paul, 'team-reveal-go'); await tid(paul, 'team-reveal-go').click(); await paul.waitForTimeout(1500) }
    // The dock lands once per reveal (revealLanding keeps it in localStorage), on the page that revealed: look before any reload.
    // DL journey (6): the reveal dock lands once the board settles (Codex 085d4c57e); wait for it before anything moves to the Team tab.
    for (let i = 0; i < 40 && !(await vis(paul, 'reveal-dock')); i++) await paul.waitForTimeout(500)
    S.dockLanded = await vis(paul, 'reveal-dock'); save()
    if (await vis(paul, 'reveal-dock')) {
      const dock = { heading: await words(paul, 'reveal-dock-heading'), next: await words(paul, 'reveal-dock-foot'), whole: (await words(paul, 'reveal-dock')).slice(0, 1200) }
      const label = await words(paul, 'reveal-dock-keep-open'), b0 = sent.length
      await tid(paul, 'reveal-dock-keep-open').click(); await paul.waitForTimeout(1200)
      const w = sent.slice(b0); S.dock = { ...dock, keepOpen: label, wrote: w.map((x) => [x.path, x.status]), keptInDock: await words(paul, 'reveal-dock-kept'), pressed: await tid(paul, 'reveal-dock-keep-open').getAttribute('aria-pressed').catch(() => null) }; save(); await shot(paul, 'after-keep-it-open')
      step('A7b the reveal lands on the reveal dock; Paul presses its "Keep it open"', 'see', `dock heading "${dock.heading}"; foot "${dock.next}"; pressed "${label}": wrote ${JSON.stringify(S.dock.wrote)}; dock still shown ${await vis(paul, 'reveal-dock')}; panels back ${await vis(paul, 'team-differences')}`)
    }
    await reopen(paul); await reopen(sam)
    const p2 = await view(paul), s2 = await view(sam)
    const both = (v) => figsOf(v.collab.shared, S.ids.paul).some((f) => f.quantity === S.qty) && figsOf(v.collab.shared, S.ids.sam).some((f) => f.quantity === S.qty)
    await shot(paul, 'after-reveal'); await shot(sam, 'after-reveal')
    S.afterReveal = { paulTab: (await words(paul, 'team-tab')).slice(0, 2500), samTab: (await words(sam, 'team-tab')).slice(0, 2500), paulTeamTabShown: await vis(paul, 'team-tab'), activeTabs: await paul.locator('[data-testid^="outputs-dock-tab-"][aria-selected="true"], [data-testid^="outputs-dock-tab-"][data-state="active"]').evaluateAll((es) => es.map((e) => e.dataset.testid)) }; save()
    await into(paul, 'team-revealed'); await eshot(paul, tid(paul, 'team-revealed'), 'revealed'); await into(sam, 'team-revealed'); await eshot(sam, tid(sam, 'team-revealed'), 'revealed')
    step('A7 Paul presses the reveal; both views, each with its own figure, show to both', revOn && both(p2) && both(s2), `button "${revWords}"; Paul's screen: "${(await words(paul, 'team-revealed')).slice(0, 400)}"`)
    if (S.dock) {
      // (2) after the press, each reloads: is a kept disagreement shown anywhere (whole Team tab, dock or panels), for Paul and for Sam
      const after = {}
      for (const [who, pg] of [['paul', paul], ['sam', sam]]) {
        await reopen(pg); await shot(pg, 'reload-after-keep-it-open')
        after[who] = { dock: await vis(pg, 'reveal-dock'), tab: (await words(pg, 'team-tab')).slice(0, 2500) }
        after[who].kept = /disagreement|kept|keep it open/i.test(after[who].tab) ? (after[who].tab.match(/[^.?!]*(disagreement|kept)[^.?!]*[.?!]?/gi) ?? []) : []
      }
      S.afterKeepOpen = after; save()
      step('A7c after "Keep it open", each reloads: is a kept disagreement shown anywhere for Paul and for Sam', 'see', JSON.stringify({ paul: { dock: after.paul.dock, kept: after.paul.kept }, sam: { dock: after.sam.dock, kept: after.sam.kept } }))
    }
    const D = await diffs(paul), d = (D.differences ?? []).find((x) => x.record === S.qty) ?? (D.differences ?? [])[0]
    S.diff = d ? { record: d.record, goal: d.goal, status: d.status, status_text: d.status_text, sides: d.sides?.map((x) => [x.holder, x.figure]) } : null; S.diffsRead = { heading: D.heading, empty: D.empty, gated: D.gated, version: D.version, n: (D.differences ?? []).length, status: D.status ?? null }; save()
    await into(paul, 'team-differences'); await shot(paul, 'differences-screen')
    const at = d ? `team-difference-${d.record}${d.goal ? `-${d.goal}` : ''}` : null; S.at = at; save()
    await undock(paul)
    // wait for the ACTUAL difference row and its action to mount (not the team-tab container, which also wraps the dock)
    if (at) await paul.waitForSelector(`[data-testid="${at}-actions"]`, { timeout: 15000 }).catch(() => null)
    await shot(paul, 'team-after-close'); S.teamAfterClose = { differences: await vis(paul, 'team-differences'), row: at ? await vis(paul, at) : false, actions: at ? await vis(paul, `${at}-actions`) : false, tab: (await words(paul, 'team-tab')).slice(0, 2500) }; save()
    if (at) { await into(paul, at); await eshot(paul, tid(paul, at), 'difference') }
    step('A8 the difference shows on Paul\'s screen (Differences panel), with both sides', !!at && await vis(paul, at), at ? `core's /differences: ${JSON.stringify(S.diff)} ${JSON.stringify(S.diffsRead)}; on screen: panel "${(await words(paul, 'team-differences')).slice(0, 600)}"; status "${await words(paul, `${at}-status`)}"` : `differences read: ${JSON.stringify(D).slice(0, 400)}; panel: "${(await words(paul, 'team-differences')).slice(0, 300)}"`)
    // Kept from the dock already (A7b): the Team panel says so ("What you decided") and its own Keep is disabled; that is the outcome, not a fault.
    const keptByDock = !!at && (S.dock?.wrote ?? []).some(([pa, st]) => /differences\/[^/]+\/steps$/.test(pa) && st < 300) && await tid(paul, `${at}-dissent`).isDisabled().catch(() => false)
    if (keptByDock) {
      const lines = await keptLines(paul, at); S.kept = lines; save(); await into(paul, at); await eshot(paul, tid(paul, at), 'kept')
      step('A9 kept from the reveal dock: the Team panel says so in core\'s words, and its own Keep is disabled', lines.some((l) => l.by === S.ids.paul), `dock wrote ${JSON.stringify(S.dock.wrote)}; panel Keep disabled; screen: ${JSON.stringify(lines)}`)
    } else if (at && await vis(paul, `${at}-dissent`)) {
      const label = await words(paul, `${at}-dissent`), b0 = sent.length
      await tid(paul, `${at}-dissent`).click(); await paul.waitForTimeout(1200)
      const w = sent.slice(b0); await into(paul, at); await eshot(paul, tid(paul, at), 'kept')
      const lines = await keptLines(paul, at); S.kept = lines; save()
      step('A9 Paul keeps it as a disagreement; the screen says so in core\'s words', w.some((x) => /differences\/[^/]+\/steps$/.test(x.path) && x.status < 300) && lines.some((l) => l.by === S.ids.paul), `button "${label}"; wrote ${JSON.stringify(w.map((x) => [x.path, x.status]))}; screen: ${JSON.stringify(lines)}`)
    } else step('A9 keep it as a disagreement', false, at ? `no "${at}-dissent" control drawn; actions: "${await words(paul, `${at}-actions`)}"` : 'no difference to keep')
    await reopen(paul); await reopen(sam)
    const pk = S.at ? await keptLines(paul, S.at) : [], sk = S.at ? await keptLines(sam, S.at) : []
    if (S.at) { await into(paul, S.at); await eshot(paul, tid(paul, S.at), 'reloaded'); await into(sam, S.at); await eshot(sam, tid(sam, S.at), 'reloaded') }
    S.modelSnapshot = snapshot(await view(paul)); save();
    step('A10 reload: the kept disagreement is there for both, as said', !!S.kept?.length && JSON.stringify(pk) === JSON.stringify(S.kept) && JSON.stringify(sk) === JSON.stringify(S.kept), `Paul ${JSON.stringify(pk)}; Sam ${JSON.stringify(sk)}`)
  } else {
    await open(paul); await paul.waitForTimeout(1800); await shot(paul,'cold-opening'); await teamTab(paul)
    const sam = await person('sam'); await authenticate(sam, S.ids.sam); await open(sam); await teamTab(sam)
    const pk = S.at ? await keptLines(paul, S.at) : [], sk = S.at ? await keptLines(sam, S.at) : []
    if (S.at) { await eshot(paul, paul.locator(`[data-testid="${S.at}-steps"] li[data-step="dissent"]`), 'cold'); await eshot(sam, sam.locator(`[data-testid="${S.at}-steps"] li[data-step="dissent"]`), 'cold') }
    const p2 = await view(paul)
    step('A12 model figures authorship approval and revealed views survive reopening', JSON.stringify(snapshot(p2)) === JSON.stringify(S.modelSnapshot), 'Compared exact View fields for the same person'); await shot(paul, 'cold-full-board-and-kept');
    step('A11 cold reopen (server restarted): the kept disagreement and both revealed figures hold, for both', !!S.kept?.length && JSON.stringify(pk) === JSON.stringify(S.kept) && JSON.stringify(sk) === JSON.stringify(S.kept) && figsOf(p2.collab.shared, S.ids.sam).some((f) => f.quantity === S.qty), `Paul ${JSON.stringify(pk)}; Sam ${JSON.stringify(sk)}`)
  }
  step('Z no console errors; no AI route asked', errors.length === 0 && !sent.some((x) => x.blocked), `${errors.join(' | ').slice(0, 300)} ${JSON.stringify(sent.filter((x) => x.blocked))}`)
} catch (e) { step(`${PHASE}: stopped`, false, String(e).split("\n")[0]); for (const p of pages) await shot(p, "stopped").catch(() => null) }
writeFileSync(`${OUT}/${PHASE}-sent.json`, JSON.stringify(sent, null, 1))
writeFileSync(`${OUT}/${PHASE}-offline-blocks.json`,JSON.stringify(offlineBlocks,null,1))
await b.close()
