/**
 * WHAT IS PERSISTENTLY ON A CARD, AT EACH ZOOM — the census that decides what a
 * middle rung is allowed to drop.
 *
 * ⚠ WRITTEN BECAUSE THE ALTERNATIVE WAS TO GUESS. "Icons should drop at 0.75"
 * is only a good change if there ARE icons at 0.75 that a person can see at
 * rest. `NodeQuickActions` is opacity-hidden until hover/focus/selection by
 * design, so a rung that drops it changes nothing a resting user perceives.
 * This counts what is actually painted, per testid, at three zooms — so the
 * rung boundaries come from the DOM rather than from an author's model of it
 * (CLAUDE.md trap 22).
 *
 * Visibility here is PAINT, not presence: an element with `opacity: 0`,
 * `visibility: hidden`, `display: none` or a zero box does not count. That
 * distinction is the entire question.
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import { seedStarterDraft } from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

const ZOOMS = [0.9, 0.75, 0.6, 0.5, 0.35] as const

async function boot(page: Page): Promise<void> {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins }: { flagPins: Array<{ storageKey: string; value: string }> }) => {
      try {
        localStorage.clear()
        sessionStorage.clear()
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
      } catch {
        /* the anchor assertions below catch a dead storage */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
  })
  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 150_000 })
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore?.getState ===
      'function',
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
}

test('CENSUS: what is painted on a resting card at each zoom', async ({ page }) => {
  await boot(page)
  await seedStarterDraft(page, 'build-vs-buy')
  await page.waitForFunction(
    () => {
      const w = window as unknown as {
        useCanvasStore: { getState: () => { pendingLayout: boolean; layoutInProgress: boolean; layoutVersion: number } }
      }
      const s = w.useCanvasStore.getState()
      return !s.pendingLayout && !s.layoutInProgress && s.layoutVersion > 0
    },
    undefined,
    { timeout: 40_000 },
  )

  const out: Array<Record<string, unknown>> = []
  for (const z of ZOOMS) {
    // Drive the camera the way a user does — ctrl+wheel over the pane, which is
    // d3-zoom's own input — rather than writing the transform. A written
    // transform can land in a state the product's own zoom path never produces,
    // and the whole question is what the product renders on the way down.
    await page.evaluate(async (target: number) => {
      const pane = document.querySelector('.react-flow__pane') as HTMLElement
      const zoomNow = () =>
        new DOMMatrixReadOnly(
          getComputedStyle(document.querySelector('.react-flow__viewport') as HTMLElement).transform,
        ).a
      const r = pane.getBoundingClientRect()
      for (let i = 0; i < 400; i += 1) {
        const cur = zoomNow()
        if (Math.abs(cur - target) < 0.01) break
        pane.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
            deltaY: cur > target ? 6 : -6,
          }),
        )
        await new Promise((res) => requestAnimationFrame(() => res(null)))
      }
    }, z)
    await page.waitForTimeout(700)

    const census = await page.evaluate((ghostPrefix: string) => {
      const painted = (el: Element): boolean => {
        let cur: Element | null = el
        while (cur !== null && cur instanceof HTMLElement) {
          const cs = getComputedStyle(cur)
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
          cur = cur.parentElement
        }
        const r = (el as HTMLElement).getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      const nodes = (Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[]).filter(
        (el) => !(el.getAttribute('data-id') ?? '').startsWith(ghostPrefix),
      )
      const tally: Record<string, number> = {}
      for (const n of nodes) {
        for (const el of Array.from(n.querySelectorAll('[data-testid]'))) {
          const key = (el.getAttribute('data-testid') ?? '').replace(/-[a-z0-9_]{6,}$/i, '-*')
          if (!painted(el)) continue
          tally[key] = (tally[key] ?? 0) + 1
        }
      }
      const w = window as unknown as { useCanvasStore: { getState: () => { lodRung?: string } } }
      const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement
      return {
        actualZoom: new DOMMatrixReadOnly(getComputedStyle(vpEl).transform).a,
        lodRung: w.useCanvasStore.getState().lodRung ?? 'full',
        cards: nodes.length,
        painted: Object.fromEntries(Object.entries(tally).sort((a, b) => b[1] - a[1])),
      }
    }, GHOST_ID_PREFIX)

    out.push({ requestedZoom: z, ...census })
  }

  console.log(`CENSUSJSON ${JSON.stringify(out)}`)
  expect(out.length).toBe(ZOOMS.length)
})
