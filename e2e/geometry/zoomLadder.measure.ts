/**
 * ZOOM LADDER — what a card actually says at the zoom a laptop parks at.
 *
 * ⭐ THE QUESTION THIS ANSWERS, AND WHY IT IS A BROWSER PROBE. "How many cards
 * render nothing at low zoom" is a claim about SIZE ON SCREEN and about which
 * branch of `BaseNode` a live store lands in. jsdom has no layout, so a passing
 * DOM assertion there proves a class is present and proves nothing about what a
 * person can read (CLAUDE.md trap 3).
 *
 * ⭐ IT MEASURES THE GESTURE, NOT A NUMBER SOMEONE PICKED. The product's
 * automatic fit is floored at `LABEL_LEGIBLE_ZOOM`, so it can never park in the
 * band this file is about. The band is reached by the USER — "Show whole
 * model", the left-rail fit, scroll-zoom — and `fitBoundsFor('user')` is
 * deliberately unbounded. So each starter is measured at BOTH:
 *
 *   settle   the product's own post-layout fit (floored)
 *   whole    after clicking "Show whole model" (the laptop gesture, unfloored)
 *
 * ⚠ SCOPE, STATED RATHER THAN IMPLIED (CLAUDE.md trap 20). This measures the
 * five COMMITTED STARTER DRAFTS — verbatim `POST /assist/v1/draft-graph` wire
 * payloads — at two viewports, on this checkout, with the pinned flag posture.
 * It is not a claim about every model a user could build, and the per-type
 * counts below are bounded by which types those five payloads contain: derived
 * in the run itself as `typesPresent`, so a type that is absent reads as absent
 * rather than as "zero blanks".
 *
 * ⚠ THE PROBE ASSERTS ITS OWN PRECONDITIONS. A run in which the camera never
 * crossed the legibility floor would report zero blank bodies for the most
 * boring possible reason, and would look exactly like a fixed product (trap
 * 13). So the store's rung and the node count are asserted before any count is
 * believed, and a starter that fails either is a hard error.
 */
import { test, expect, type Page } from '@playwright/test'
import { posturePins } from '../visual/flagPosture'
import { seedStarterDraft } from '../visual/harness'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'
import { LABEL_LEGIBLE_ZOOM } from '../../src/canvas/utils/zoomLegibility'

const STARTERS = ['build-vs-buy', 'headcount-allocation', 'market-entry', 'pricing-model', 'vendor-selection'] as const
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const

interface CardReading {
  id: string
  type: string
  /** The reduced line's text, or null when the card renders none. */
  lodLine: string | null
  /** The title's text as rendered (empty string = the card has no name on it). */
  title: string
  /** Rendered px of the title glyphs — `declared x counter-scale x zoom`. */
  titlePx: number
  /** Rendered px of the reduced line, or null when absent. */
  lodPx: number | null
  /** True when the card's body wrapper is `visibility: hidden`. */
  bodyHidden: boolean
}

interface Reading {
  zoom: number
  lodRung: string
  labelScale: number
  cards: CardReading[]
}

async function readCanvas(page: Page): Promise<Reading> {
  return page.evaluate((ghostPrefix: string) => {
    const w = window as unknown as {
      useCanvasStore: { getState: () => { lodRung?: string; nodes: Array<{ id: string; type?: string }> } }
    }
    const state = w.useCanvasStore.getState()
    const typeById = new Map(state.nodes.map((n) => [n.id, n.type ?? 'unknown']))

    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement
    const zoom = new DOMMatrixReadOnly(getComputedStyle(vpEl).transform).a
    const rootEl = document.querySelector('.react-flow') as HTMLElement
    const rawScale = getComputedStyle(rootEl).getPropertyValue('--canvas-label-scale').trim()
    const labelScale = rawScale === '' ? 1 : Number(rawScale)

    // Rendered px, read from the LIVE computed style and multiplied by the live
    // viewport scale. Never from a token constant: the whole point is to catch a
    // token and a transform disagreeing.
    const renderedPx = (el: Element | null): number =>
      el === null ? 0 : Number.parseFloat(getComputedStyle(el).fontSize) * zoom

    const cards = (Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[])
      .map((el) => ({ el, id: el.getAttribute('data-id') ?? '' }))
      .filter((n) => !n.id.startsWith(ghostPrefix) && typeById.has(n.id))
      .map(({ el, id }) => {
        const lodEl = el.querySelector('[data-testid="node-lod-line"]')
        const titleEl = el.querySelector('[data-testid="node-title"]')
        const bodyEl = el.querySelector('[data-lod-hidden]')
        return {
          id,
          type: typeById.get(id) ?? 'unknown',
          lodLine: lodEl === null ? null : (lodEl.textContent ?? '').trim(),
          title: titleEl === null ? '' : (titleEl.textContent ?? '').trim(),
          titlePx: renderedPx(titleEl),
          lodPx: lodEl === null ? null : renderedPx(lodEl),
          bodyHidden: bodyEl !== null,
        }
      })
      .sort((a, b) => a.id.localeCompare(b.id))

    return { zoom, lodRung: state.lodRung ?? 'full', labelScale, cards }
  }, GHOST_ID_PREFIX)
}

async function cameraSettled(page: Page, stableMs = 500, timeoutMs = 20_000): Promise<void> {
  await page.waitForFunction(
    ({ stable }: { stable: number }) => {
      const w = window as unknown as { __lastT?: string; __since?: number }
      const el = document.querySelector('.react-flow__viewport') as HTMLElement | null
      if (!el) return false
      const t = getComputedStyle(el).transform
      const now = performance.now()
      if (w.__lastT !== t) {
        w.__lastT = t
        w.__since = now
        return false
      }
      return now - (w.__since ?? now) >= stable
    },
    { stable: stableMs },
    { timeout: timeoutMs, polling: 50 },
  )
}

async function layoutSettled(page: Page, stableMs = 1200, timeoutMs = 40_000): Promise<void> {
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

async function boot(page: Page, width: number, height: number): Promise<void> {
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
  await page.setViewportSize({ width, height })
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

test('LADDER: what every card says at the zoom the laptop gesture parks at', async ({ page }) => {
  const rows: Array<Record<string, unknown>> = []

  for (const vp of VIEWPORTS) {
    await boot(page, vp.width, vp.height)

    for (const starter of STARTERS) {
      const seeded = await seedStarterDraft(page, starter)
      expect(seeded.nodeCount, `starter ${starter} seeded no nodes`).toBeGreaterThan(0)
      await layoutSettled(page)
      await cameraSettled(page)

      const settle = await readCanvas(page)

      // The laptop gesture. Absent notice ⇒ the model already fits, and the
      // band this file measures is not reached — recorded, never silently
      // treated as a zero.
      const btn = page.locator('[data-testid="model-extent-show-all"]')
      const hasNotice = (await btn.count()) === 1
      let whole = settle
      if (hasNotice) {
        await btn.click()
        await cameraSettled(page)
        whole = await readCanvas(page)
      }

      for (const [phase, r] of [
        ['settle', settle],
        ['whole', whole],
      ] as const) {
        const byType = new Map<string, { total: number; noLine: number }>()
        for (const c of r.cards) {
          const acc = byType.get(c.type) ?? { total: 0, noLine: 0 }
          acc.total += 1
          if (c.lodLine === null || c.lodLine === '') acc.noLine += 1
          byType.set(c.type, acc)
        }
        rows.push({
          viewport: `${vp.width}x${vp.height}`,
          starter,
          phase,
          hasNotice,
          zoom: Number(r.zoom.toFixed(4)),
          lodRung: r.lodRung,
          labelScale: r.labelScale,
          cards: r.cards.length,
          bodyHidden: r.cards.filter((c) => c.bodyHidden).length,
          noLodLine: r.cards.filter((c) => c.lodLine === null || c.lodLine === '').length,
          noTitle: r.cards.filter((c) => c.title === '').length,
          minTitlePx: Number(Math.min(...r.cards.map((c) => c.titlePx)).toFixed(2)),
          minLodPx: (() => {
            const v = r.cards.map((c) => c.lodPx).filter((n): n is number => n !== null)
            return v.length === 0 ? null : Number(Math.min(...v).toFixed(2))
          })(),
          byType: Object.fromEntries([...byType].sort().map(([k, v]) => [k, `${v.noLine}/${v.total} blank`])),
          sample: r.cards.slice(0, 3).map((c) => `${c.type}: "${c.title}" | ${c.lodLine ?? '<none>'}`),
        })
      }

      // ── PRECONDITION, ASSERTED (trap 13) ────────────────────────────────
      // Every count above is about the low-zoom band. If the camera never got
      // there, the numbers are about something else and must not be reported.
      if (hasNotice) {
        expect(whole.zoom, `${starter} @ ${vp.width}: the laptop gesture did not reach the low-zoom band`).toBeLessThan(
          LABEL_LEGIBLE_ZOOM,
        )
        expect(
          whole.lodRung,
          `${starter} @ ${vp.width}: below the legibility floor but the store's rung is not \`line\``,
        ).toBe('line')
      }
    }
  }

  // The types the corpus can speak about at all. A type absent here is NOT
  // "zero blanks" — it is unmeasured, and saying so is the whole point.
  const typesPresent = [...new Set(rows.flatMap((r) => Object.keys(r.byType as object)))].sort()
  console.log(`LADDERJSON ${JSON.stringify({ typesPresent, rows })}`)
  expect(rows.length, 'no rows measured — the probe reported on itself').toBeGreaterThan(0)
})
