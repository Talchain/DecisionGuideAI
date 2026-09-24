import { test, expect } from '@playwright/test'
import { openCanvas, preparePage } from '../visual/harness'

const VP = { width: 1280, height: 800 }
const PROBE = '/e2e/ai-conversation/witnessProbe.ts'

test('coaching card: live when current; disabled beside its notice when the model moved; evidence label is text', async ({ page }, info) => {
  await preparePage(page, VP)
  await openCanvas(page)
  const current = await page.evaluate(async (p) => (await import(/* @vite-ignore */ p)).renderCards(false), PROBE)
  await page.locator('#aic-host').screenshot({ path: info.outputPath('01-card-current.png') })
  const moved = await page.evaluate(async (p) => (await import(/* @vite-ignore */ p)).renderCards(true), PROBE)
  await page.locator('#aic-host').screenshot({ path: info.outputPath('02-card-model-moved.png') })
  console.log(`AICWITNESS cards ${JSON.stringify({ current, moved })}`)
  expect(current.disabled).toBe(false)
  expect(moved.disabled).toBe(true)
  expect(moved.notice).toBeTruthy()
  expect(moved.describedBy).toBeTruthy()
  expect(current.evidenceTag).toBe('P')
})

test('Run chip on the real ConversationPanel: gate closed ⇒ refused out loud, nothing dispatched', async ({ page }, info) => {
  await preparePage(page, VP)
  await openCanvas(page)
  const r = await page.evaluate(async (p) => (await import(/* @vite-ignore */ p)).renderRunChipRefusal(), PROBE)
  await page.screenshot({ path: info.outputPath('03-run-chip-refused.png') })
  console.log(`AICWITNESS runchip ${JSON.stringify(r)}`)
  expect(r.dispatched).toBe(0)
  expect(r.refusalShown).toBe(true)
})

for (const which of ['pricing', 'hiring'] as const) {
  test(`OpenAI route capture (57f903c) — ${which} explicit Run, as rendered in the dock`, async ({ page }, info) => {
    await preparePage(page, VP)
    await openCanvas(page)
    const r = await page.evaluate(async ([p, w]) => (await import(/* @vite-ignore */ p)).renderOpenAiRun(w), [PROBE, which] as const)
    await page.locator('#aic-host').screenshot({ path: info.outputPath(`04-openai-${which}-run-bottom.png`) })
    await page.evaluate(async (p) => (await import(/* @vite-ignore */ p)).scrollThreadTop(), PROBE)
    await page.locator('#aic-host').screenshot({ path: info.outputPath(`05-openai-${which}-run-top.png`) })
    console.log(`AICWITNESS openai-${which} ${JSON.stringify(r)}`)
  })
}
