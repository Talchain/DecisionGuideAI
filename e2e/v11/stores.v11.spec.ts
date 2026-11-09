import { test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STORES, audit, base, mint, passed, scenarioUrl, storeDir } from './lib'

// The 1232 audit on the recorded boards (COPIES of the stores, V11J_STORES): the judged hiring board, J1's bookshop and the Reveal, as
// their own member where the board is a member's. Ceilings are V11 54f74e8b's audit (hiring 15 off / 9 behind; J1 and Reveal 0 / 1 and 0 / 0).
const BOARDS = [
  { id: 'audit.hiring', store: 'hiring', offset: 1, sid: 's_dc9a71c29b29', token: null, limits: { out: 15, crossings: 9 } },
  { id: 'audit.j1', store: 'gate', offset: 2, sid: 's_a8f9adfdb54b', token: 'maya-bookshop.token', limits: { out: 0, crossings: 1 } },
  { id: 'audit.reveal', store: 'gate', offset: 2, sid: 's_5ed29e40af8c', token: 'maya-strategy.token', limits: { out: 0, crossings: 0 } },
]
for (const b of BOARDS) test(`${b.id}: the 1232 audit`, async ({ browser }) => {
  test.skip(!STORES, 'V11J_STORES unset: globalTeardown reports these boards as not covered')
  const ctx = await browser.newContext({ viewport: { width: 1232, height: 704 } }), page = await ctx.newPage()
  const link = b.token ? `/k/${readFileSync(join(storeDir(b.store), b.token), 'utf8').trim()}` : await mint('Auditor', b.sid, b.offset)
  await page.goto(`${base(b.offset)}${link}`); await page.goto(scenarioUrl(b.sid, b.offset)); await page.reload()
  await page.waitForSelector('.react-flow__node-viewCard'); await page.waitForTimeout(3000)
  // A new member's analysis waits for their private view or a skip (no synthesis before the reveal); the auditor skips, on the copy.
  const skip = page.getByText('I would rather not answer this', { exact: true })
  if (!b.token && await skip.count()) { await skip.first().click(); await page.waitForTimeout(1500) }
  await audit(page, b.limits, b.id)
  passed(b.id)
  await ctx.close()
})
