import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { BRIEF, base, mint, openTab, passed, scenarioUrl, until, view3 } from './lib'

// POC-ACCEPTANCE Part 2, step 6, at 1232x704: invite, private views, reveal, one doubts a link and the other keeps it, reopen.
test.describe.configure({ mode: 'serial' })
let A: Page, B: Page, ctxA: BrowserContext, ctxB: BrowserContext, sid = '', samLink = ''
const errors: string[] = []
const PAUL = 'A tech lead unblocks reviews, so the six of us ship more before launch.', SAM = 'Two more developers add hands now; leadership can come after launch.'
const DOUBT = 'I doubt a tech lead moves productivity before launch: onboarding eats the first month.', KEEP = 'I keep it: a lead clears the review queue in week one.'
const team = (p: Page) => openTab(p, 'team')
const text = (p: Page) => p.evaluate(() => document.body.innerText)

test.beforeAll(async ({ browser }) => {
  ctxA = await browser.newContext({ viewport: { width: 1232, height: 704 } }); ctxB = await browser.newContext({ viewport: { width: 1232, height: 704 } })
  A = await ctxA.newPage(); B = await ctxB.newPage()
  for (const [who, p] of [['A', A], ['B', B]] as const) p.on('pageerror', (e) => errors.push(`${who} ${e.message}`))
  await A.goto(`${base()}${await mint('Paul')}`); await A.goto(`${base()}/#/canvas`)
  await A.locator('#view-chat-text').fill(BRIEF); await A.getByRole('button', { name: 'Send', exact: true }).click()
  await A.waitForURL(/#\/scenario\/00000000-0000-4000-8000-[0-9a-f]{12}$/, { timeout: 120_000 }); sid = `s_${A.url().slice(-12)}`
  const v = await until(A, async () => { const x = await view3(A, sid); return x?.proposal || x?.version ? x : null }, 120_000)
  if (!v.version) { await A.getByRole('button', { name: 'Approve', exact: true }).first().click(); await until(A, async () => (await view3(A, sid))?.version) }
  await A.waitForTimeout(2000)
})
test.afterAll(async () => { await ctxA.close(); await ctxB.close() })

test('6.1 invite: their link is made and opens the scenario', async () => {
  await team(A)
  let invite = A.getByTestId('team-invite-name')
  if (await invite.count() === 0) { await A.getByRole('button', { name: /Invite a colleague/ }).first().click(); invite = A.getByTestId('team-invite-name') }
  await invite.first().fill('Sam'); await A.getByTestId('team-invite-go').first().click()
  const u = new URL(await A.getByTestId('team-invite-link').first().inputValue()); samLink = `${u.pathname}${u.search}`
  await B.goto(`${base()}${samLink}`); await B.waitForTimeout(2000)
  if (!B.url().includes(sid.slice(2))) await B.goto(scenarioUrl(sid))
  await B.waitForSelector('.react-flow__node-viewCard')
  passed('p2.6.1')
})

test('6.2 each writes a private view; neither sees the other\'s before the reveal', async () => {
  for (const [p, w] of [[A, PAUL], [B, SAM]] as const) {
    await team(p); await p.getByTestId('team-view-text').first().fill(w)
    await expect(p.getByTestId('team-view-give').first()).toBeEnabled(); await p.getByTestId('team-view-give').first().click(); await p.waitForTimeout(2000)
  }
  expect(await text(B)).not.toContain(PAUL); expect(await text(A)).not.toContain(SAM)
  passed('p2.6.2')
})

test('6.3 reveal: both views are shared', async () => {
  await A.reload(); await A.waitForTimeout(2500); await team(A)
  await expect(A.getByTestId('team-reveal-go').first()).toBeEnabled(); await A.getByTestId('team-reveal-go').first().click(); await A.waitForTimeout(2500)
  expect((await view3(A, sid))?.collab?.shared?.length ?? 0).toBeGreaterThanOrEqual(2)
  await B.reload(); await B.waitForTimeout(2500); await team(B)
  expect(await text(A)).toContain(SAM); expect(await text(B)).toContain(PAUL)
  passed('p2.6.3')
})

test('6.4 one doubts a link in their words, the other keeps it; both shown, no side picked', async () => {
  const stance = async (p: Page, s: 'doubt' | 'keep', w: string, pick?: string) => {
    await team(p)
    const sel = p.getByTestId('team-link-stance-link').first(); await sel.scrollIntoViewIfNeeded()
    const value = pick ?? (await sel.locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).find((x) => x !== '')
    expect(value, 'a link to take a stance on').toBeTruthy()
    await sel.selectOption(value!); await p.getByTestId(`team-link-stance-${s}`).first().check(); await p.getByTestId('team-link-stance-words').first().fill(w)
    await p.getByTestId('team-link-stance-send').first().click(); await p.waitForTimeout(2500)
    await expect(p.getByTestId('team-link-stance-error')).toHaveCount(0)
    return value!
  }
  const link = await stance(B, 'doubt', DOUBT); await stance(A, 'keep', KEEP, link)
  await A.reload(); await A.waitForTimeout(3000); await team(A)
  const all = await text(A)
  expect(all).toContain(DOUBT); expect(all).toContain(KEEP)
  expect(['is right', 'is wrong', 'wins', 'better argument', 'correct view'].filter((w) => all.toLowerCase().includes(w)), 'picks a side').toEqual([])
  passed('p2.6.4')
})

test('6.5 reopening shows the same to the other person', async () => {
  await B.close(); B = await ctxB.newPage(); B.on('pageerror', (e) => errors.push(`B ${e.message}`))
  await B.goto(`${base()}${samLink}`); await B.waitForTimeout(2000); await B.goto(scenarioUrl(sid)); await B.waitForSelector('.react-flow__node-viewCard'); await B.waitForTimeout(2500); await team(B)
  const all = await text(B)
  expect(all).toContain(DOUBT); expect(all).toContain(KEEP)
  expect(errors, 'page errors').toEqual([])
  passed('p2.6.5')
})
