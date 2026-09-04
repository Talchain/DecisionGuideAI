/**
 * vfitDecomp — DECOMPOSE THE VERTICAL EXTENT OF EVERY SHIPPED STARTER.
 *
 * Throwaway investigation harness (canvas vertical-fit lane, 2026-09-04).
 * NOT for merge. It asserts almost nothing; it MEASURES and prints, because the
 * question is "what is the 1931px made of", not "is it correct".
 *
 * Everything is reported in FLOW UNITS (model coordinates), which are
 * zoom-independent — a screen-px reading would change with the very quantity
 * under investigation.
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

interface NodeRow {
  id: string
  kind: string
  x: number
  y: number
  w: number
  h: number
  /** measured card height at the CURRENT zoom, in flow units */
  domH: number
  domW: number
  titleLines: number
  titleH: number
  bodyH: number
  cardPadTop: number
  cardPadBottom: number
  blocks: Array<{ tag: string; testid: string; h: number; cls: string }>
}

interface Decomp {
  starter: string
  zoom: number
  labelScale: string | null
  quickActionsMounted: number
  notice: string | null
  flowRect: { w: number; h: number }
  visibleRect: { w: number; h: number }
  nodes: NodeRow[]
}

async function decompose(page: Page): Promise<Decomp> {
  return page.evaluate((ghostPrefix: string) => {
    const flowEl = document.querySelector('.react-flow') as HTMLElement
    const flow = flowEl.getBoundingClientRect()
    const vpEl = document.querySelector('.react-flow__viewport') as HTMLElement
    const m = new DOMMatrixReadOnly(getComputedStyle(vpEl).transform)
    const zoom = m.a

    const rectOf = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? r : null
    }
    const dock = rectOf('aside[aria-label="Outputs dock"]')
    const sidebar = rectOf('nav[aria-label="Canvas tools"]')
    const banner = rectOf('[role="banner"]')
    const visible = {
      left: sidebar ? sidebar.right : flow.left,
      right: dock ? dock.left : flow.right,
      top: banner ? banner.bottom : flow.top,
      bottom: flow.bottom,
    }

    const store = (window as unknown as {
      useCanvasStore: {
        getState: () => {
          nodes: ReadonlyArray<{
            id: string
            type?: string
            position: { x: number; y: number }
            width?: number
            height?: number
            measured?: { width?: number; height?: number }
            data?: Record<string, unknown>
          }>
        }
      }
    }).useCanvasStore.getState()

    const nodes: NodeRow[] = []
    for (const n of store.nodes) {
      if (n.id.startsWith(ghostPrefix)) continue
      const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(n.id)}"]`) as HTMLElement | null
      const r = el?.getBoundingClientRect()
      // screen px -> flow units
      const domH = r ? r.height / zoom : 0
      const domW = r ? r.width / zoom : 0

      // Walk the card's own children and record each band's height in flow units.
      const blocks: NodeRow['blocks'] = []
      let titleH = 0
      let titleLines = 0
      let bodyH = 0
      let cardPadTop = 0
      let cardPadBottom = 0
      if (el) {
        // The card is the first element child that actually paints a box.
        const card = (el.firstElementChild as HTMLElement | null) ?? el
        const cs = getComputedStyle(card)
        cardPadTop = parseFloat(cs.paddingTop || '0') || 0
        cardPadBottom = parseFloat(cs.paddingBottom || '0') || 0
        const cardR = card.getBoundingClientRect()
        for (const child of Array.from(card.children) as HTMLElement[]) {
          const cr = child.getBoundingClientRect()
          if (cr.height <= 0) continue
          blocks.push({
            tag: child.tagName.toLowerCase(),
            testid: child.getAttribute('data-testid') ?? '',
            h: cr.height / zoom,
            cls: (child.className || '').toString().slice(0, 160),
          })
        }
        void cardR
        const titleEl = card.querySelector('[data-testid*="title"], [class*="nodeTitle"]') as HTMLElement | null
        const t = titleEl ?? (card.querySelector('div') as HTMLElement | null)
        if (t) {
          const tr = t.getBoundingClientRect()
          titleH = tr.height / zoom
          const lh = parseFloat(getComputedStyle(t).lineHeight || '0') || 0
          titleLines = lh > 0 ? Math.round(tr.height / lh) : 0
        }
        const bodyEl = card.querySelector('[data-testid*="metric"], [data-testid*="body"]') as HTMLElement | null
        if (bodyEl) bodyH = bodyEl.getBoundingClientRect().height / zoom
      }

      nodes.push({
        id: n.id,
        kind: (n.data?.kind as string) ?? n.type ?? '?',
        x: n.position.x,
        y: n.position.y,
        w: n.measured?.width ?? n.width ?? 0,
        h: n.measured?.height ?? n.height ?? 0,
        domH,
        domW,
        titleLines,
        titleH,
        bodyH,
        cardPadTop,
        cardPadBottom,
        blocks,
      })
    }

    const root = flowEl
    return {
      starter: '',
      zoom,
      labelScale: root ? getComputedStyle(root).getPropertyValue('--canvas-label-scale').trim() : null,
      quickActionsMounted: document.querySelectorAll('[data-testid*="quick-action"]').length,
      notice: document.querySelector('[data-testid="model-extent-count"]')?.textContent ?? null,
      flowRect: { w: flow.width, h: flow.height },
      visibleRect: { w: visible.right - visible.left, h: visible.bottom - visible.top },
      nodes,
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

async function cameraSettled(page: Page, stableMs = 500, timeoutMs = 30_000): Promise<void> {
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
  test(`DECOMP ${id}`, async ({ page }) => {
    await boot(page)
    const seeded = await seedStarterDraft(page, id, { asStarter: true })
    expect(seeded.nodeCount, `starter ${id} seeded no nodes`).toBeGreaterThan(0)
    await layoutSettled(page)
    await cameraSettled(page)
    const d = await decompose(page)
    d.starter = id
    expect(d.nodes.length, 'decomposed zero nodes — the reading would be vacuous').toBeGreaterThan(0)
    // eslint-disable-next-line no-console
    console.log(`@@DECOMP@@${JSON.stringify(d)}@@END@@`)
  })
}
