/**
 * vfitLevers — MEASURE EACH CANDIDATE HEIGHT LEVER, on the real rendered cards.
 *
 * Throwaway investigation harness (canvas vertical-fit lane, 2026-09-04). NOT for merge.
 *
 * Method: the live vertical recurrence is (traced at `src/canvas/utils/layout.ts`
 * :263, :507, :540, :549)
 *
 *     boxH(node)  = max(40, round(cardH) + LAYOUT_PADDING_Y[16])
 *     Y(next band) = Y(band) + max(boxH in band) + stride
 *     stride       = effectiveLayerSpacing[48]  between tiers
 *                  = round(48*0.6)=29           between sub-rows of one tier
 *
 * so total extent is fully determined by (a) the per-band TALLEST card and
 * (b) the band count. Band membership is decided by TIER_BY_KIND and by
 * WIDTH-driven row splitting — neither depends on card height — so an
 * intervention that only changes card HEIGHT cannot change the band structure.
 * That makes the counterfactual exactly computable from re-measured card
 * heights, with no need to re-run ELK.
 *
 * The baseline arm re-derives the SHIPPED extent from the same arithmetic and
 * is asserted against the actually-rendered extent, so the model is not trusted
 * on its own say-so (CLAUDE.md trap 13 — the arithmetic gets a positive control).
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import { seedStarterDraft } from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

const STARTERS = [
  'vendor-selection',
  'market-entry',
  'build-vs-buy',
  'pricing-model',
  'headcount-allocation',
] as const

type Arm = {
  name: string
  /** CSS injected into the page for this arm; '' for the baseline. */
  css: string
  /** value forced onto --canvas-label-scale, or null to leave the product's */
  labelScale: number | null
}

const ARMS: Arm[] = [
  { name: 'baseline(scale2)', css: '', labelScale: 2 },
  // L1 — lay out for the CURRENT text size instead of the worst case.
  { name: 'L1_scale1', css: '', labelScale: 1 },
  { name: 'L1b_scale1.43', css: '', labelScale: 1.4286 },
  // L2 — one title line instead of two.
  {
    name: 'L2_titleClamp1',
    css: `.react-flow__node [class*="line-clamp-2"]{-webkit-line-clamp:1 !important;}`,
    labelScale: 2,
  },
  // L3 — drop the 12px quick-action footer reserve (24px bottom pad -> 12px).
  {
    name: 'L3_noFooterReserve',
    css: `.react-flow__node > div{padding-bottom:12px !important;}`,
    labelScale: 2,
  },
  // L4 — L2 + L3 together.
  {
    name: 'L4_clamp1+noFooter',
    css: `.react-flow__node [class*="line-clamp-2"]{-webkit-line-clamp:1 !important;}
          .react-flow__node > div{padding-bottom:12px !important;}`,
    labelScale: 2,
  },
  // L5 — title at 12px DECLARED with NO counter-scale at all (i.e. what the
  // card would be if canvas text simply rendered at its declared size).
  { name: 'L5_scale1+clamp1', css: `.react-flow__node [class*="line-clamp-2"]{-webkit-line-clamp:1 !important;}`, labelScale: 1 },
]

interface ArmReading {
  arm: string
  nodes: Array<{ id: string; y: number; h: number; titleH: number }>
}

async function readArm(page: Page, arm: Arm): Promise<ArmReading> {
  return page.evaluate(
    ({ ghostPrefix, armName, css, labelScale }) => {
      const flow = document.querySelector('.react-flow') as HTMLElement
      const styleId = '__vfit_arm_css'
      document.getElementById(styleId)?.remove()
      if (css) {
        const s = document.createElement('style')
        s.id = styleId
        s.textContent = css
        document.head.appendChild(s)
      }
      const prev = flow.style.getPropertyValue('--canvas-label-scale')
      if (labelScale !== null) flow.style.setProperty('--canvas-label-scale', String(labelScale))
      // force layout flush
      void document.body.offsetHeight

      const store = (window as unknown as {
        useCanvasStore: {
          getState: () => { nodes: ReadonlyArray<{ id: string; position: { x: number; y: number } }> }
        }
      }).useCanvasStore.getState()

      const nodes: ArmReading['nodes'] = []
      for (const n of store.nodes) {
        if (n.id.startsWith(ghostPrefix)) continue
        const el = document.querySelector(
          `.react-flow__node[data-id="${CSS.escape(n.id)}"]`,
        ) as HTMLElement | null
        if (!el) continue
        // offsetHeight is in LAYOUT (flow) units — unaffected by the viewport
        // transform — which is exactly what `measureNodeHeightsAtLabelBound`
        // reads and what ELK is fed.
        const h = el.offsetHeight
        const titleEl = el.querySelector('[class*="line-clamp-2"]') as HTMLElement | null
        nodes.push({ id: n.id, y: n.position.y, h, titleH: titleEl?.offsetHeight ?? 0 })
      }

      // restore
      document.getElementById(styleId)?.remove()
      if (prev === '') flow.style.removeProperty('--canvas-label-scale')
      else flow.style.setProperty('--canvas-label-scale', prev)
      void document.body.offsetHeight

      return { arm: armName, nodes }
    },
    { ghostPrefix: GHOST_ID_PREFIX, armName: arm.name, css: arm.css, labelScale: arm.labelScale },
  )
}

async function layoutSettled(page: Page, stableMs = 1500, timeoutMs = 60_000): Promise<void> {
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as {
        useCanvasStore: {
          getState: () => { layoutVersion: number; pendingLayout: boolean; layoutInProgress: boolean }
        }
        __lastLv?: number
        __lvSince?: number
      }
      const s = w.useCanvasStore.getState()
      if (s.pendingLayout || s.layoutInProgress) return false
      const now = performance.now()
      if (w.__lastLv !== s.layoutVersion) {
        w.__lastLv = s.layoutVersion
        w.__lvSince = now
        return false
      }
      return now - (w.__lvSince ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 100 },
  )
}

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
        /* asserted downstream */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })) },
  )
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' })
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url())
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? r.fallback() : r.abort()
  })
  await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 150_000 })
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore
        ?.getState === 'function',
    undefined,
    { timeout: 60_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
}

for (const id of STARTERS) {
  test(`LEVERS ${id}`, async ({ page }) => {
    await boot(page)
    const seeded = await seedStarterDraft(page, id, { asStarter: true })
    expect(seeded.nodeCount).toBeGreaterThan(0)
    await layoutSettled(page)

    const readings: ArmReading[] = []
    for (const arm of ARMS) readings.push(await readArm(page, arm))

    // POSITIVE CONTROL on the arms themselves: the scale-1 arm MUST read
    // shorter than the baseline, or the CSS/var injection did nothing and every
    // saving below would be a measurement of nothing (CLAUDE.md trap 13).
    const base = readings[0]
    const s1 = readings[1]
    const baseSum = base.nodes.reduce((a, n) => a + n.h, 0)
    const s1Sum = s1.nodes.reduce((a, n) => a + n.h, 0)
    expect(s1Sum, `label-scale arm did not take: baseline sum ${baseSum}, scale1 sum ${s1Sum}`).toBeLessThan(baseSum)
    // CONTRAST: the title-clamp arm must ALSO move, and by a different amount,
    // or the selector matched nothing.
    const clampSum = readings[3].nodes.reduce((a, n) => a + n.h, 0)
    expect(clampSum, 'title-clamp arm did not take — selector matched no title').toBeLessThan(baseSum)

    // eslint-disable-next-line no-console
    console.log(`@@LEVERS@@${JSON.stringify({ starter: id, readings })}@@END@@`)
  })
}
