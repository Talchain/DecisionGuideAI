/**
 * vfitComp — CARD-HEIGHT COMPOSITION + THE SELF-CONSISTENCY FIXED POINT.
 *
 * Throwaway investigation harness (canvas vertical-fit lane, 2026-09-04). NOT for merge.
 *
 * Three questions:
 *  (1) Where does a card's height actually go? padding / title / each body band.
 *  (2) The counter-scale is `1/zoom` capped at 2, and the layout is fed the height
 *      at the CAP. So card height depends on zoom and zoom depends on card height.
 *      What scale is SELF-CONSISTENT, and is there one that both fits and keeps
 *      canvas text at the 10px Design System floor?
 *  (3) A positive control for the footer-reserve arm, which read exactly 0 on all
 *      five starters in the previous run — a uniform result is evidence about the
 *      probe until proven otherwise (CLAUDE.md trap 20).
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

/**
 * Scales measured. 1.6667 is the smallest counter-scale at which a 12px declared
 * title still renders at the 10px canvas floor when the camera sits at the 0.5
 * legibility floor: 12 * s * 0.5 >= 10  =>  s >= 5/3.
 */
const SCALES = [1, 1.4286, 1.6667, 2]

async function measure(page: Page): Promise<unknown> {
  return page.evaluate((ghostPrefix: string) => {
    const flow = document.querySelector('.react-flow') as HTMLElement
    const store = (window as unknown as {
      useCanvasStore: {
        getState: () => { nodes: ReadonlyArray<{ id: string; position: { x: number; y: number } }> }
      }
    }).useCanvasStore.getState()
    const modelNodes = store.nodes.filter((n) => !n.id.startsWith(ghostPrefix))
    const elFor = (id: string) =>
      document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`) as HTMLElement | null

    const setScale = (s: number | null) => {
      if (s === null) flow.style.removeProperty('--canvas-label-scale')
      else flow.style.setProperty('--canvas-label-scale', String(s))
      void document.body.offsetHeight
    }
    const prev = flow.style.getPropertyValue('--canvas-label-scale')

    // ── (1) COMPOSITION at scale 2 ─────────────────────────────────────────
    setScale(2)
    const composition: Array<{
      id: string
      cardH: number
      padTop: number
      padBottom: number
      borderY: number
      bands: Array<{ h: number; marginTop: number; marginBottom: number; label: string }>
    }> = []
    for (const n of modelNodes) {
      const el = elFor(n.id)
      if (!el) continue
      const card = (el.firstElementChild as HTMLElement | null) ?? el
      const cs = getComputedStyle(card)
      const bands: Array<{ h: number; marginTop: number; marginBottom: number; label: string }> = []
      for (const child of Array.from(card.children) as HTMLElement[]) {
        const ccs = getComputedStyle(child)
        if (ccs.position === 'absolute' || ccs.position === 'fixed') continue
        const h = child.offsetHeight
        if (h <= 0) continue
        const hasTitle = child.querySelector('[class*="line-clamp-2"]') !== null
        bands.push({
          h,
          marginTop: parseFloat(ccs.marginTop) || 0,
          marginBottom: parseFloat(ccs.marginBottom) || 0,
          label: hasTitle ? 'TITLE-ROW' : (child.getAttribute('data-testid') || child.tagName.toLowerCase()),
        })
      }
      composition.push({
        id: n.id,
        cardH: el.offsetHeight,
        padTop: parseFloat(cs.paddingTop) || 0,
        padBottom: parseFloat(cs.paddingBottom) || 0,
        borderY: (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0),
        bands,
      })
    }

    // ── (3) FOOTER-RESERVE CONTROL ─────────────────────────────────────────
    // Assert the intervention actually lands on the padded element before
    // believing any saving (or any null) it reports.
    const probeEl = elFor(modelNodes[0]!.id)!
    const probeCard = (probeEl.firstElementChild as HTMLElement | null) ?? probeEl
    const padBefore = parseFloat(getComputedStyle(probeCard).paddingBottom) || 0
    const hBefore = probeEl.offsetHeight
    // DIAGNOSTIC: dump the card subtree's padding so the arm can be aimed at the
    // element that actually carries the footer reserve, rather than assumed.
    const padDump: Array<{ path: string; padTop: number; padBottom: number; cls: string }> = []
    const walk = (el: HTMLElement, path: string, depth: number) => {
      if (depth > 3) return
      const c = getComputedStyle(el)
      padDump.push({
        path,
        padTop: parseFloat(c.paddingTop) || 0,
        padBottom: parseFloat(c.paddingBottom) || 0,
        cls: (el.className || '').toString().slice(0, 90),
      })
      Array.from(el.children).forEach((ch, i) => walk(ch as HTMLElement, path + '>' + i, depth + 1))
    }
    walk(probeEl, 'node', 0)
    // How many model cards carry ANY bottom reserve (padBottom > padTop)?
    let reserveCards = 0
    let reserveTotal = 0
    for (const n of modelNodes) {
      const e = elFor(n.id)
      if (!e) continue
      const cd = (e.firstElementChild as HTMLElement | null) ?? e
      const cc = getComputedStyle(cd)
      const pt = parseFloat(cc.paddingTop) || 0
      const pb = parseFloat(cc.paddingBottom) || 0
      if (pb > pt) { reserveCards++; reserveTotal += pb - pt }
    }
    const st = document.createElement('style')
    st.id = '__vfit_pad_probe'
    st.textContent = `.react-flow__node > div{padding-bottom:12px !important;}`
    document.head.appendChild(st)
    void document.body.offsetHeight
    const padAfter = parseFloat(getComputedStyle(probeCard).paddingBottom) || 0
    const hAfter = probeEl.offsetHeight
    // measure the whole corpus under the intervention too
    const padArm: Array<{ id: string; y: number; h: number }> = []
    for (const n of modelNodes) {
      const el = elFor(n.id)
      if (el) padArm.push({ id: n.id, y: n.position.y, h: el.offsetHeight })
    }
    st.remove()
    void document.body.offsetHeight

    // ── (2) SCALE SWEEP ────────────────────────────────────────────────────
    const scaleArms: Record<string, Array<{ id: string; y: number; h: number; titleH: number }>> = {}
    for (const s of [1, 1.4286, 1.6667, 2]) {
      setScale(s)
      const arr: Array<{ id: string; y: number; h: number; titleH: number }> = []
      for (const n of modelNodes) {
        const el = elFor(n.id)
        if (!el) continue
        const t = el.querySelector('[class*="line-clamp-2"]') as HTMLElement | null
        arr.push({ id: n.id, y: n.position.y, h: el.offsetHeight, titleH: t?.offsetHeight ?? 0 })
      }
      scaleArms[String(s)] = arr
    }
    // scale sweep WITH a one-line title, to see whether the two compose
    const scaleArmsClamp1: Record<string, Array<{ id: string; y: number; h: number }>> = {}
    const st2 = document.createElement('style')
    st2.textContent = `.react-flow__node [class*="line-clamp-2"]{-webkit-line-clamp:1 !important;}`
    document.head.appendChild(st2)
    for (const s of [1.6667, 2]) {
      setScale(s)
      const arr: Array<{ id: string; y: number; h: number }> = []
      for (const n of modelNodes) {
        const el = elFor(n.id)
        if (el) arr.push({ id: n.id, y: n.position.y, h: el.offsetHeight })
      }
      scaleArmsClamp1[String(s)] = arr
    }
    st2.remove()

    if (prev === '') flow.style.removeProperty('--canvas-label-scale')
    else flow.style.setProperty('--canvas-label-scale', prev)
    void document.body.offsetHeight

    return {
      composition,
      padControl: { padBefore, padAfter, hBefore, hAfter, probeId: modelNodes[0]!.id, padDump, reserveCards, reserveTotal, modelCount: modelNodes.length },
      padArm,
      scaleArms,
      scaleArmsClamp1,
      ys: modelNodes.map((n) => ({ id: n.id, y: n.position.y })),
    }
  }, GHOST_ID_PREFIX)
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
  test(`COMP ${id}`, async ({ page }) => {
    await boot(page)
    expect((await seedStarterDraft(page, id, { asStarter: true })).nodeCount).toBeGreaterThan(0)
    await layoutSettled(page)
    const r = (await measure(page)) as {
      padControl: Record<string, unknown>
      composition: unknown[]
    }
    expect(r.composition.length, 'composition read zero cards').toBeGreaterThan(0)
    // eslint-disable-next-line no-console
    console.log(`@@COMP@@${JSON.stringify({ starter: id, ...r })}@@END@@`)
  })
}
