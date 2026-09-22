/**
 * DOES THE GOAL CARD AND THE GOAL PANEL SAY THE SAME THING?
 *
 * The CARD already renders the reader's own figure — measured on deployed
 * `8cf38c42`: `Target: 11 £M ARR` on the International Expansion example, whose
 * store holds `goalThreshold 0.73 / representation normalised / raw 11 / unit
 * "£M ARR"`. The PANEL derived its readout from `goalThreshold` with the unit
 * stripped when normalised, which would make it say `0.73`.
 *
 * ⛔ SO THIS IS THE CLAIM THAT DECIDES WHETHER PR #1847's GoalPanel CHANGE HAS
 * ANY USER VALUE. If both surfaces already say `11 £M ARR`, the change is inert
 * and should be described as such. If they disagree, the same model shows two
 * different targets four inches apart, which is a trust defect.
 *
 * ⚠ NO FILTERED CAPTURE. An earlier version of this probe piped its output
 * through `grep` and the failure diagnostic was lost entirely — twice tonight a
 * windowed/filtered read produced a wrong conclusion. Everything is printed.
 */
import { test, type Page } from '@playwright/test'

const ORIGIN = process.env.WITNESS_ORIGIN ?? 'https://staging--olumi.netlify.app'

async function openExample(page: Page, re: RegExp): Promise<void> {
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
  const guest = page.getByRole('button', { name: /continue without an account/i })
  if (await guest.count() > 0) await guest.click().catch(() => {})
  // ⚠ WAIT FOR THE CHOOSER, do not assume a delay. The first version of this probe
  // used a fixed 4.5s and timed out against the alias mid-deploy — a transient that
  // reads identically to "the example is missing".
  // ⚠ ROLE, NOT TEXT. Each example is ONE button whose accessible name is the
  // title AND the subtitle on two lines, so `getByText(/title/)` failed to resolve
  // a visible node and timed out at 45s — a locator defect that reads exactly like
  // "the example is missing from this build". Verified against the real build: the
  // accessible names are the full two-line strings.
  const card = page.getByRole('button', { name: re })
  await card.first().waitFor({ state: 'visible', timeout: 45_000 })
  await card.first().click()
  await page.waitForLoadState('networkidle', { timeout: 40_000 }).catch(() => {})
  await page.waitForTimeout(8_000)
}

test('goal CARD vs goal PANEL on the threshold-bearing examples', async ({ page }) => {
  for (const [label, re] of [
    ['market-entry', /International Expansion Strategy/i],
    ['pricing-model', /Pricing Model Transition Strategy/i],
  ] as const) {
    await openExample(page, re)

    const store = await page.evaluate(() => {
      const w = window as unknown as { useCanvasStore?: { getState(): Record<string, unknown> } }
      const st = w.useCanvasStore?.getState() as Record<string, unknown> | undefined
      const nodes = (st?.nodes ?? []) as Array<Record<string, unknown>>
      const g = nodes.find((n) => n.type === 'goal' || (n.data as Record<string, unknown> | undefined)?.kind === 'goal')
      const gd = (g?.data ?? {}) as Record<string, unknown>
      const el = g ? document.querySelector(`[data-id="${String(g.id)}"]`) as HTMLElement | null : null
      return {
        gid: String(g?.id ?? ''),
        threshold: st?.goalThreshold ?? null,
        rep: st?.goalThresholdRepresentation ?? null,
        raw: gd.goal_threshold_raw ?? null,
        unit: gd.goal_threshold_unit ?? null,
        card: (el?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }
    })
    console.log(`[CVP] ${label}: threshold=${store.threshold} rep=${store.rep} raw=${store.raw} unit=${JSON.stringify(store.unit)}`)
    console.log(`[CVP] ${label}: CARD  full textContent = "${store.card}"`)

    // Bring the goal node on screen — a ReactFlow node off-camera has no box.
    const fit = page.getByRole('button', { name: /fit to view/i }).first()
    if (await fit.count() > 0) { await fit.click().catch(() => {}); await page.waitForTimeout(3000) }
    const loc = page.locator(`[data-id="${store.gid}"]`)
    const box = await loc.boundingBox().catch(() => null)
    console.log(`[CVP] ${label}: goal node box = ${JSON.stringify(box)}`)
    if (!box) { console.log(`[CVP] ${label}: ⛔ goal node has no box even after Fit to view — PANEL UNREAD`); continue }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down(); await page.mouse.up()
    await page.waitForTimeout(4000)

    const panel = await page.evaluate(() => {
      const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')) as HTMLElement[]
      const bodies = dlgs.map((d) => (d.textContent ?? '').replace(/\s+/g, ' ').trim())
      const biggest = bodies.slice().sort((a, b) => b.length - a.length)[0] ?? ''
      return { dialogCount: dlgs.length, biggest }
    })
    console.log(`[CVP] ${label}: dialogs=${panel.dialogCount}`)
    console.log(`[CVP] ${label}: PANEL full textContent = "${panel.biggest}"`)
  }
})
