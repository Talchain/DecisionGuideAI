import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { BRIEF, audit, base, chancesOf, mint, openTab, passed, scenarioUrl, until, view3, wholeOnBoard, words, type View } from './lib'
import { measure, clampLongestDockLine } from './measure'

// POC-ACCEPTANCE Part 1, steps 1 to 5, as Paul would at 1232x704: brief to model, edit, analysis, next step, reopen. One person.
test.describe.configure({ mode: 'serial' })
let ctx: BrowserContext, page: Page, sid = '', link = '', v: View | null = null
const errors: string[] = []
test.beforeAll(async ({ browser }) => {
  ctx = await browser.newContext({ viewport: { width: 1232, height: 704 } }); page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
})
test.afterAll(async () => { await ctx.close() })

test('1 a messy brief becomes a faithful, editable model', async () => {
  link = await mint('Paul')
  await page.goto(`${base()}${link}`); await page.goto(`${base()}/#/canvas`)
  await page.locator('#view-chat-text').fill(BRIEF)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await page.waitForURL(/#\/scenario\/00000000-0000-4000-8000-[0-9a-f]{12}$/, { timeout: 120_000 })
  sid = `s_${page.url().slice(-12)}`
  v = await until(page, async () => { const x = await view3(page, sid); return x?.proposal || x?.version ? x : null }, 120_000)
  if (!v.version) { await page.getByRole('button', { name: 'Approve', exact: true }).first().click(); v = await until(page, async () => { const x = await view3(page, sid); return x?.version ? x : null }) }
  await page.waitForSelector('.react-flow__node-viewCard'); await page.waitForTimeout(2500)
  const cards = v.model!.cards, whole = await wholeOnBoard(page)
  // The opening head is whole beside the dock: the question, every aim and limit, every option with its chance.
  const head = cards.filter((c) => ['question', 'goal', 'limit', 'option'].includes(c.family)).map((c) => c.id)
  expect(head.length).toBeGreaterThanOrEqual(6)
  expect(head.filter((id) => !whole.includes(id)), 'head cards not whole on the board').toEqual([])
  for (const c of cards.filter((c) => c.family === 'option' && c.headline?.text)) await expect(page.locator(`[data-id="${c.id}"]`)).toContainText(c.headline!.text)
  // Ruling #2: Olumi's cards say so at rest; a person's own figures are the unmarked default, their author on hover.
  const olumis = cards.filter((c) => c.author?.by === 'olumi'), theirs = cards.filter((c) => c.author && c.author.by !== 'olumi')
  expect(olumis.length).toBeGreaterThan(0); expect(theirs.length).toBeGreaterThan(0)
  for (const c of olumis.filter((c) => whole.includes(c.id))) await expect(page.locator(`[data-view="${c.id}.author.text"]`)).toBeVisible()
  for (const c of theirs.filter((c) => whole.includes(c.id))) await expect(page.locator(`[data-view="${c.id}.author.text"]`)).toBeHidden()
  // Paul's figure in his words: six developers.
  expect(cards.find((c) => c.id === 'developers')?.figure?.text ?? '').toMatch(/\b6\b|six/i)
  passed('p1.1')
})

test('audit: the opening board at 1232 (zero-class numbers, sizes 12/14/18)', async () => {
  // The walk's own board: the hiring model just drafted. Ceilings from V11 54f74e8b's audit of the judged hiring board (21 cards).
  await audit(page, { out: 15, crossings: 9 }, 'walk board')
  passed('audit.walk')
})

test('audit contrast: a clamped dock line is counted as cut', async () => {
  await openTab(page, 'results')
  expect(await page.evaluate(clampLongestDockLine), 'a long dock line to clamp').toBe(true)
  expect((await page.evaluate(measure)).trunc.length, 'the probe sees a cut').toBeGreaterThanOrEqual(1)
  await page.reload(); await page.waitForSelector('.react-flow__node-viewCard'); await page.waitForTimeout(2000)
  passed('audit.contrast')
})

test('2 "6 developers" becomes 7 and the chances move', async () => {
  const before = chancesOf(v), n0 = v!.version!.n
  await page.getByTestId('view-figure-edit-developers').first().dispatchEvent('click')
  const box = page.getByTestId('view-figure-typed-developers').first(); await box.waitFor()
  await box.fill('7')
  const t1 = Date.now(); await page.getByTestId('view-figure-set-developers').first().dispatchEvent('click')
  await page.getByTestId('view-figure-form-developers').waitFor({ state: 'detached', timeout: 30_000 })
  expect(Date.now() - t1, 'saved within 3 s').toBeLessThanOrEqual(3000)
  v = await until(page, async () => { const x = await view3(page, sid); return x?.version?.n === n0 + 1 && JSON.stringify(chancesOf(x)) !== JSON.stringify(before) ? x : null }, 30_000)
  expect(v.model!.cards.find((c) => c.id === 'developers')?.figure?.text ?? '').toMatch(/\b7\b|seven/i)
  await page.waitForTimeout(2000)
  for (const c of v.model!.cards.filter((c) => c.family === 'option' && c.headline?.text)) await expect(page.locator(`[data-id="${c.id}"]`)).toContainText(c.headline!.text)
  passed('p1.2')
})

test('3 valid conditional analysis: each option\'s chance, no recommendation', async () => {
  await openTab(page, 'results')
  const panel = page.locator('[data-testid="outputs-dock"]')
  for (const c of v!.model!.cards.filter((c) => c.family === 'option')) {
    await expect(panel).toContainText(c.heading)
    if (c.headline?.text) await expect(panel).toContainText(c.headline.text)
  }
  const text = await panel.innerText()
  expect(['best', 'recommend', 'you should', 'winner'].filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)), 'banned words').toEqual([])
  passed('p1.3')
})

test('4 a useful next step, and Olumi\'s reply to an answer is shown', async () => {
  // Zero calls: the scripted coach answers about this model's own records, so this proves the page draws a reply core passes, not its quality.
  // DL ruling 9 Nov (one composer in the dock): the answer is sent from the Analysis tab's composer, the same one; the dock then fronts
  // the Olumi tab, where the reply is drawn.
  await openTab(page, 'results')
  const n0 = (await view3(page, sid))?.chat?.length ?? 0
  await page.locator('#view-chat-text').fill('Mostly because nobody owns the architecture, so reviews and releases stall.')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  const x = await until(page, async () => { const y = await view3(page, sid); const a = [...(y?.chat ?? [])].reverse().find((t) => t.answer)?.answer; return (y?.chat?.length ?? 0) > n0 && a ? { y, a } : null })
  await page.waitForTimeout(2000)
  await expect(page.getByTestId('outputs-dock-tab-olumi')).toHaveAttribute('aria-selected', 'true')
  const dock = page.locator('[data-testid="outputs-dock"]')
  await expect(dock).not.toContainText('broke its own rules')
  await expect(dock).not.toContainText('could not finish its reply')
  await expect(dock).toContainText(words(x.a.answer).slice(0, 40))
  const next = words(x.a.next?.text)
  expect(next.length, 'the reply carries a next step').toBeGreaterThan(0)
  await expect(dock).toContainText(next.slice(0, 40))
  v = x.y
  passed('p1.4')
})

test('5 everything survives reopening', async () => {
  const snap = (x: View | null) => JSON.stringify({ version: x?.version?.id, cards: (x?.model?.cards ?? []).map((c) => [c.id, c.heading, c.figure?.text ?? null, (c.rows ?? []).map((r) => r.text)]), chances: chancesOf(x) })
  const pre = await view3(page, sid)
  await page.close(); page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base()}${link}`); await page.goto(scenarioUrl(sid)); await page.waitForSelector('.react-flow__node-viewCard'); await page.waitForTimeout(2500)
  expect(snap(await view3(page, sid))).toBe(snap(pre))
  for (const c of pre!.model!.cards.filter((c) => c.family === 'option' && c.headline?.text)) await expect(page.locator(`[data-id="${c.id}"]`)).toContainText(c.headline!.text)
  expect(errors, 'page errors').toEqual([])
  passed('p1.5')
})
