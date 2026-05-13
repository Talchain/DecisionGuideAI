import { test, expect } from '@playwright/test'

/**
 * Real-browser repro for the 2026-05-13 P0:
 *   Fresh V5 draft → applyDraftResult writes 16 nodes at {0,0} →
 *   setPendingLayout(true) → measure/fallback path → applyLayout
 *
 * Drives the same code class without requiring CEE backend:
 *   1. open canvas (empty)
 *   2. inject CEE-shaped fixture via dynamic-imported applyDraftResult
 *   3. let the real React Flow measure-then-layout pipeline run
 *   4. assert nodes are no longer stacked AND no "Layout failed" banner
 *
 * Prints a compact failure report on assertion failure for triage.
 */

const FIXTURE_PAYLOAD = (factors: number, options: number, risks: number) => {
  const optionIds: string[] = []
  const factorIds: string[] = []
  const riskIds: string[] = []

  const nodes: Array<Record<string, unknown>> = []
  nodes.push({ id: 'decision', kind: 'decision', label: 'Decision' })

  for (let i = 0; i < options; i++) {
    const id = `option-${i}`
    optionIds.push(id)
    nodes.push({ id, kind: 'option', label: `Option ${i}` })
  }
  for (let i = 0; i < factors; i++) {
    const id = `factor-${i}`
    factorIds.push(id)
    nodes.push({ id, kind: 'factor', label: `Factor ${i}`, observed_state: { value: 0.5, baseline: 0.5 } })
  }
  for (let i = 0; i < risks; i++) {
    const id = `risk-${i}`
    riskIds.push(id)
    nodes.push({ id, kind: 'risk', label: `Risk ${i}` })
  }
  nodes.push({ id: 'goal', kind: 'goal', label: 'Goal' })

  const edges: Array<Record<string, unknown>> = []
  for (const oid of optionIds) {
    edges.push({ id: `e-d-${oid}`, from: 'decision', to: oid, weight: 0.5, belief: 0.8 })
  }
  factorIds.forEach((fid, i) => {
    const oid = optionIds[i % Math.max(1, optionIds.length)] ?? 'decision'
    edges.push({ id: `e-${oid}-${fid}`, from: oid, to: fid, weight: 0.5, belief: 0.7 })
  })
  for (const rid of riskIds) {
    edges.push({ id: `e-d-${rid}`, from: 'decision', to: rid, weight: 0.5, belief: 0.6 })
  }
  for (const n of nodes) {
    if (n.id === 'goal' || n.id === 'decision' || n.kind === 'option') continue
    edges.push({ id: `e-${n.id as string}-goal`, from: n.id, to: 'goal', weight: 0.5, belief: 0.7 })
  }

  return {
    nodes,
    edges,
    analysis_ready: {
      goal_node_id: 'goal',
      options: optionIds.map((id) => ({ id, label: id, interventions: {}, is_baseline: false })),
    },
    quality: { overall: 7, structure: 7, coverage: 7, causality: 7, safety: 7 },
  }
}

interface RuntimeResult {
  thrown?: { name?: string; message?: string; stack?: string }
  layoutFailedBanner: boolean
  bannerText: string | null
  positions: Array<{ id: string; x: number; y: number }>
  layoutVersion: number
  pendingLayout: boolean
  layoutInProgress: boolean
  consoleErrors: string[]
}

const sizes = [
  { name: '5-node', factors: 2, options: 1, risks: 0, total: 5 },
  { name: '12-node', factors: 8, options: 2, risks: 0, total: 12 },
  { name: '16-node', factors: 10, options: 3, risks: 1, total: 16 },
  { name: '30-node', factors: 23, options: 4, risks: 1, total: 30 },
]

for (const c of sizes) {
  test(`fresh V5 inline draft (${c.name}) lays out non-stacked, no "Layout failed" banner`, async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      consoleErrors.push(`pageerror: ${err.message}`)
    })

    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // Boot canvas (empty state) and wait until the store is exposed. This
    // avoids injecting while Vite/React is still settling the initial route,
    // which can otherwise destroy the evaluate context during startup.
    await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 })
    await page.waitForFunction(() => {
      const w = window as unknown as {
        useCanvasStore?: { getState?: () => unknown }
      }
      return typeof w.useCanvasStore?.getState === 'function'
    }, { timeout: 15000 })

    // Drive the V5 inline-draft class without backend: import
    // applyDraftResult via Vite's module graph and call it directly.
    const result: RuntimeResult = await page.evaluate(async (payload) => {
      const w = window as unknown as {
        useCanvasStore: { getState: () => unknown }
      }

      const mod = await import('/src/canvas/utils/applyDraftResult.ts')
      const applyDraftResult = (mod as { applyDraftResult: (p: unknown) => { nodeCount: number; edgeCount: number } }).applyDraftResult

      let thrown: { name?: string; message?: string; stack?: string } | undefined
      try {
        applyDraftResult(payload)
      } catch (e) {
        const err = e as { name?: string; message?: string; stack?: string }
        thrown = { name: err.name, message: err.message, stack: err.stack }
      }

      // Wait for the measure-then-layout pipeline to complete. layoutVersion
      // increments on commit; pendingLayout=false signals quiescence.
      const deadline = Date.now() + 4000
      const store = (w.useCanvasStore as unknown as { getState: () => { pendingLayout: boolean; layoutInProgress: boolean; layoutVersion: number } })
      while (Date.now() < deadline) {
        const s = store.getState()
        if (!s.pendingLayout && !s.layoutInProgress && s.layoutVersion > 0) break
        await new Promise((r) => setTimeout(r, 50))
      }

      const finalState = (w.useCanvasStore as unknown as { getState: () => { nodes: Array<{ id: string; position?: { x?: number; y?: number } }>; layoutVersion: number; pendingLayout: boolean; layoutInProgress: boolean } }).getState()
      const positions = finalState.nodes.map((n) => ({ id: n.id, x: n.position?.x ?? 0, y: n.position?.y ?? 0 }))

      const banner = document.querySelector('[data-testid="layout-progress-banner"], [role="status"][aria-live]')
      const bannerText = banner?.textContent ?? null
      const isFailedBanner = !!bannerText && /layout failed/i.test(bannerText)

      return {
        thrown,
        layoutFailedBanner: isFailedBanner,
        bannerText,
        positions,
        layoutVersion: finalState.layoutVersion,
        pendingLayout: finalState.pendingLayout,
        layoutInProgress: finalState.layoutInProgress,
        consoleErrors: [],
      } satisfies RuntimeResult
    }, FIXTURE_PAYLOAD(c.factors, c.options, c.risks))

    result.consoleErrors = consoleErrors

    // Compute stack-or-spread.
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity
    for (const p of result.positions) {
      xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x)
      yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y)
    }
    const xSpread = xMax - xMin
    const ySpread = yMax - yMin
    const stacked = xSpread < 40 && ySpread < 40

    // On any failure, attach the debug buffer + console errors so triage is one click away.
    const failed =
      result.layoutFailedBanner ||
      result.thrown ||
      stacked ||
      result.layoutVersion === 0 ||
      result.pendingLayout ||
      result.layoutInProgress

    if (failed) {
      // eslint-disable-next-line no-console
      console.log('FAILURE REPORT', JSON.stringify({
        size: c.name,
        thrown: result.thrown,
        layoutFailedBanner: result.layoutFailedBanner,
        bannerText: result.bannerText,
        stacked,
        xSpread,
        ySpread,
        layoutVersion: result.layoutVersion,
        pendingLayout: result.pendingLayout,
        layoutInProgress: result.layoutInProgress,
        nodeCount: result.positions.length,
        consoleErrors: result.consoleErrors,
      }, null, 2))
    }

    expect(result.thrown, `applyDraftResult should not throw; got ${result.thrown?.message}`).toBeUndefined()
    expect(result.layoutFailedBanner, `unexpected "Layout failed" banner: ${result.bannerText}`).toBe(false)
    expect(result.layoutVersion, 'layoutVersion should bump from 0').toBeGreaterThan(0)
    expect(result.pendingLayout, 'pendingLayout should clear').toBe(false)
    expect(result.layoutInProgress, 'layoutInProgress should clear').toBe(false)
    expect(stacked, `positions remained stacked (xSpread=${xSpread}, ySpread=${ySpread})`).toBe(false)
  })
}
