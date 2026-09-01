/** TEMPORARY DIAGNOSTIC — not for commit. */
import { test, type Page } from '@playwright/test'
import { openCanvas, seedStarterDraft, waitForVisualQuiescence, preparePage, type StarterId } from '../visual/harness'

const CLAIM_MOD = '/src/canvas/utils/userCameraClaim.ts'

async function timeline(page: Page, ms = 4000) {
  return page.evaluate(async (limit: number) => {
    const out: Array<{ t: number; tr: string }> = []
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement
    const t0 = performance.now(); let last = ''
    await new Promise<void>((res) => { const tick = () => { const tr = getComputedStyle(vpEl).transform; if (tr !== last) { last = tr; out.push({ t: Math.round(performance.now() - t0), tr }) }; if (performance.now() - t0 > limit) res(); else requestAnimationFrame(tick) }; requestAnimationFrame(tick) })
    return out
  }, ms)
}
async function owns(page: Page) {
  return page.evaluate(async (p: string) => ((await import(/* @vite-ignore */ p)) as { userOwnsCamera: () => boolean }).userOwnsCamera(), CLAIM_MOD)
}

async function boot(page: Page, starter: StarterId, motion: 'reduce' | 'no-preference') {
  await preparePage(page, { width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: motion, colorScheme: 'light' })
  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await page.locator('.react-flow').waitFor({ state: 'visible', timeout: 300_000 })
  await openCanvas(page)
  await seedStarterDraft(page, starter)
  await waitForVisualQuiescence(page)
  await page.waitForTimeout(4000)
}

for (const motion of ['no-preference', 'reduce'] as const) {
  test(`motion=${motion}`, async ({ page }) => {
    test.setTimeout(900_000)
    const probes: Array<{ t: number; m: string }> = []
    const t0 = Date.now()
    page.on('console', (m) => { const t = m.text(); if (t.startsWith('PROBE')) probes.push({ t: Date.now() - t0, m: t.split('\n').slice(0, 4).join(' | ').slice(0, 400) }) })
    await boot(page, 'build-vs-buy', motion)
    probes.length = 0
    console.log(`M[${motion}] ownsBefore=${await owns(page)}`)
    await page.getByTestId('model-extent-show-all').click({ force: true })
    console.log(`M[${motion}] tl ` + JSON.stringify(await timeline(page)))
    console.log(`M[${motion}] ownsAfter=${await owns(page)}`)
    console.log(`M[${motion}] probes ` + JSON.stringify(probes, null, 1))
  })
}
