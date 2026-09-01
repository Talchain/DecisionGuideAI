/**
 * OVERLAP SEQUENCE — the reproducer for the founder-reported canvas overlap.
 *
 * ⭐ THERE ARE TWO SEPARATE DEFECTS AND THEY LIVE IN DIFFERENT STATE CLASSES.
 * A fresh-draft witness is not evidence about a reloaded user (CLAUDE.md's
 * fixture state-class rule). Both earlier diagnoses measured only the fresh
 * path and generalised. This file measures BOTH, and names which it is in.
 *
 * ── ARM 1 (default): FRESH DRAFT — a transient, self-healing ────────────────
 * The layout is an ITERATIVE CONVERGENCE. Cards do not reach final height
 * before the first pass; each growth step triggers a corrective pass. Measured
 * (real Chromium, 24 trials, 3 starters, 2 viewports, load 4.7-29.5):
 *   run-now @ 2031px total -> lv=1; growth-correction @ 2768 -> lv=2;
 *   growth-correction @ 5890 -> lv=3; converged.
 * `layoutVersion` is the ITERATION COUNTER, not a defect indicator. Between
 * passes the previous, wrong geometry is on screen: 1.5-2.0s unthrottled,
 * 9-14.6s at SEQ_CPU=6. 24/24 trials had an overlapping window; 0/24 ended
 * overlapping. `waitForVisualQuiescence` (3 polls x 100ms) routinely fires
 * INSIDE that window, which is why single-instant harness measurements of this
 * defect are not reproducible and why an unmatched A/B on them means nothing.
 *
 * ── ARM 2 (SEQ_MODE=reload): SAVED SCENARIO, RELOADED — permanent ───────────
 * This is the one the founder is looking at. It is DETERMINISTIC, not a race.
 *
 * `applyLayout` writes the width it laid out against via
 * `layoutStore.setLayoutNodeWidth` — which does NOT call `persist()`, and
 * `layoutNodeWidth` is not among the fields `persist()` writes
 * (`layoutStore.ts:141,180`). So it is session-only and returns `null`.
 * `BaseNode.tsx:460` then falls back:
 *     maxWidth ?? layoutNodeWidth ?? NODE_CARD_MAX_W
 * Measured: cards laid out at **230px** come back rendering at **320px** —
 * 90px wider than the stride their positions were computed for — so
 * same-row neighbours overlap horizontally.
 *
 * And nothing corrects it, by construction:
 *   - `useInitialLayoutGuard` fires only when `graphNeedsInitialLayout()` is
 *     true, i.e. xSpread < 40 AND ySpread < 40 (stacked at the origin). A
 *     restored real layout spreads thousands of px, so it never fires.
 *   - => `pendingLayout` stays false => the gate is 'idle' => `run-now` never
 *     runs => `useMeasureThenLayout`'s `laidOutHeightsRef` stays EMPTY =>
 *     the growth correction's `laidOutHeightsRef.current.size > 0` guard is
 *     false forever, and `laidOutWithFallbackRef` is false.
 *   - ALL THREE corrective branches are structurally unreachable on reload.
 * Measured over 30s after reload: pairs CONSTANT (12/12/10 on build-vs-buy /
 * vendor-selection / market-entry), `layoutVersion` 0, zero hook branches,
 * zero `applyLayout` calls.
 *
 * ⭐ AND IT IS CAUSAL, NOT CORRELATIONAL. The persisted POSITIONS are innocent:
 * this arm persists a FULLY CONVERGED, ZERO-OVERLAP layout through the
 * product's own write path, and reload restores all 19 positions IDENTICALLY
 * and still overlaps. Restoring ONLY `layoutNodeWidth` afterwards — no
 * position, no height, no layout, `layoutVersion` still 0 — takes it to
 * ZERO pairs, 3/3 starters. That rules out "we persisted a mid-convergence
 * transient", which was the standing hypothesis.
 *
 * ⚠ THIS HARNESS COULD NOT SEE ARM 2 UNTIL NOW, WHICH IS WHY NOBODY MEASURED
 * IT: `preparePage` installs an initScript that runs `localStorage.clear()` on
 * EVERY navigation, so a reload wipes the autosave before the app reads it.
 * This file re-registers the captured storage in a LATER initScript (they run
 * in registration order), which is the only reason the reload path is
 * observable at all. Any future reload test must do the same.
 *
 * ── Running it ─────────────────────────────────────────────────────────────
 *   pnpm exec playwright test -c playwright.geometry.config.ts overlapSequence
 * Env knobs:
 *   SEQ_STARTER   build-vs-buy | vendor-selection | market-entry | ...
 *   SEQ_W/SEQ_H   viewport (default 1280x800)
 *   SEQ_TRIALS    repeat count
 *   SEQ_CPU       CDP CPU throttle (6 makes the ARM-1 window ~10s and
 *                 trivially catchable — controlled, not machine load)
 *   SEQ_MODE      reload  -> run ARM 2
 *   SEQ_FLUSH_AT  converged (default) | transient — which geometry to persist
 *
 * ⚠ `SEQ_CPU` must NOT be replaced by Playwright's clock mock: under it
 * `layoutVersion` appeared to climb at 1Hz forever and settled at 4 on a real
 * clock. Treat an apparent loop as an instrument question first.
 *
 * ⚠ SCOPE. `hookBranches`/`applyEvents` are populated only when
 * `useMeasureThenLayout` / `store.applyLayout` carry local trace sinks; without
 * them those two fields read empty and prove nothing. Everything else — the
 * overlap series, `layoutVersion`, `layoutNodeWidth`, rendered widths and the
 * causal probe — needs no source change and is what the claims above rest on.
 *
 * ⚠ DURATIONS ARE DEV-SERVER FIGURES. The SHAPE of both arms is a code
 * property; the millisecond values are inflated by an unknown factor and must
 * be re-measured against a production build before being quoted.
 */
import { test } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'

const STARTER = (process.env.SEQ_STARTER ?? 'build-vs-buy') as StarterId
const VP = {
  width: Number(process.env.SEQ_W ?? 1280),
  height: Number(process.env.SEQ_H ?? 800),
}
const TRIALS = Number(process.env.SEQ_TRIALS ?? 1)

for (let trial = 1; trial <= TRIALS; trial++) {
  test(`SEQ ${STARTER} @${VP.width}x${VP.height} #${trial}`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>
      const trace: unknown[] = []
      ;(w as { __seqTrace: unknown[] }).__seqTrace = trace

      const domHeights = (): Record<string, number> => {
        const out: Record<string, number> = {}
        for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
          const e = el as HTMLElement
          out[e.dataset.id!] = e.offsetHeight
        }
        return out
      }
      const storeHeights = (nodes: unknown[]): Record<string, number | null> => {
        const out: Record<string, number | null> = {}
        for (const raw of nodes) {
          const n = raw as { id: string; height?: number; measured?: { height?: number } }
          out[n.id] = n.measured?.height ?? n.height ?? null
        }
        return out
      }
      const digest = (m: Record<string, number | null>): string => {
        const vs = Object.values(m).filter((v): v is number => typeof v === 'number')
        return `n=${Object.keys(m).length} measured=${vs.length} sum=${vs.reduce((a, b) => a + b, 0)} max=${vs.length ? Math.max(...vs) : 0}`
      }

      let installed = false
      const install = (): void => {
        if (installed) return
        const s = w.useCanvasStore as
          | { getState: () => Record<string, unknown>; subscribe: (f: (s: Record<string, unknown>) => void) => void }
          | undefined
        if (!s) return
        installed = true
        let prev = s.getState()
        const snap = (st: Record<string, unknown>, why: string): void => {
          const nodes = (st.nodes ?? []) as unknown[]
          const sh = storeHeights(nodes)
          const dh = domHeights()
          trace.push({
            t: Math.round(performance.now()),
            why,
            lv: st.layoutVersion,
            pl: st.pendingLayout,
            lip: st.layoutInProgress,
            rid: st.layoutRequestId,
            storeDigest: digest(sh),
            domDigest: digest(dh as Record<string, number | null>),
            storeH: sh,
            domH: dh,
          })
        }
        snap(prev, 'install')
        s.subscribe((st) => {
          if (
            st.layoutVersion !== prev.layoutVersion ||
            st.pendingLayout !== prev.pendingLayout ||
            st.layoutInProgress !== prev.layoutInProgress ||
            st.layoutRequestId !== prev.layoutRequestId
          ) {
            snap(st, 'transition')
          }
          prev = st
        })
      }
      const iv = setInterval(install, 5)
      setTimeout(() => clearInterval(iv), 60_000)

      // OVERLAP-vs-TIME sampler: how long is the canvas actually overlapping?
      const overlapNow = (): { pairs: number; lv: number } | null => {
        const st = (w.useCanvasStore as { getState?: () => { nodes: Array<{ id: string; position: { x: number; y: number } }>; layoutVersion: number } } | undefined)?.getState?.()
        if (!st) return null
        const rendered = new Map<string, { w: number; h: number }>()
        for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
          const e = el as HTMLElement
          rendered.set(e.dataset.id!, { w: e.offsetWidth, h: e.offsetHeight })
        }
        const boxes = st.nodes.filter((n) => rendered.has(n.id)).map((n) => ({ x: n.position.x, y: n.position.y, ...rendered.get(n.id)! }))
        let pairs = 0
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i], B = boxes[j]
          if (Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 0 && Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) > 0) pairs++
        }
        return { pairs, lv: st.layoutVersion }
      }
      const ov: Array<{ t: number; pairs: number; lv: number }> = []
      ;(w as { __ovSeries: unknown[] }).__ovSeries = ov
      setInterval(() => {
        const o = overlapNow()
        if (o) ov.push({ t: Math.round(performance.now()), ...o })
      }, 100)

      // DOM growth sampler — locates card growth in time, independent of the store.
      let lastDom = ''
      setInterval(() => {
        const dh = domHeights()
        const key = JSON.stringify(dh)
        if (key === lastDom) return
        lastDom = key
        const vs = Object.values(dh)
        trace.push({
          t: Math.round(performance.now()),
          why: 'dom',
          domDigest: `n=${vs.length} sum=${vs.reduce((a, b) => a + b, 0)} max=${vs.length ? Math.max(...vs) : 0}`,
          domH: dh,
        })
      }, 40)
    })

    const THROTTLE = Number(process.env.SEQ_CPU ?? 1)
    if (THROTTLE > 1) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
    }
    await preparePage(page, VP)
    await openCanvas(page)
    await seedStarterDraft(page, STARTER)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    if (process.env.SEQ_FLUSH_AT !== 'transient') await waitForVisualQuiescence(page)

    // ── PAIRED MEASUREMENT ──────────────────────────────────────────────
    // T0: the instant `waitForVisualQuiescence` returns — exactly where the
    // existing geometry harness measures.
    // T1: 3s later — after any still-running corrective pass has landed.
    // Same trial, same page, same load. If T0 overlaps and T1 does not, the
    // harness was measuring a transient mid-chain state, not a defect.
    const measure = async () => page.evaluate(() => {
      const w = window as unknown as {
        useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }>; layoutVersion: number } }
      }
      const store = w.useCanvasStore.getState()
      const rendered = new Map<string, { w: number; h: number }>()
      for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
        const e = el as HTMLElement
        rendered.set(e.dataset.id!, { w: e.offsetWidth, h: e.offsetHeight })
      }
      const boxes = store.nodes.filter((n) => rendered.has(n.id)).map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, ...rendered.get(n.id)! }))
      const pairs: Array<{ a: string; b: string; ox: number; oy: number }> = []
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i], B = boxes[j]
        const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
        const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)
        if (ox > 0 && oy > 0) pairs.push({ a: A.id, b: B.id, ox: +ox.toFixed(1), oy: +oy.toFixed(1) })
      }
      return { lv: store.layoutVersion, pairs: pairs.length, worst: pairs.sort((a, b) => b.ox * b.oy - a.ox * a.oy).slice(0, 3) }
    })
    const T0 = await measure()
    if (process.env.SEQ_FLUSH_AT !== 'transient') await page.waitForTimeout(3000)
    const T1 = await measure()

    // ── RELOAD ARM (state class: SAVED SCENARIO, RELOADED) ────────────────
    // A fresh-draft witness is not evidence about a reloaded user. This arm
    // persists a chosen geometry through the product's OWN write path
    // (`flushWorkToAutosave`), reloads, and samples for 30s.
    //   SEQ_FLUSH_AT=converged  — persist the settled layout (control)
    //   SEQ_FLUSH_AT=transient  — persist a mid-convergence layout
    let reload: unknown = null
    if (process.env.SEQ_MODE === 'reload') {
      const flushed = await page.evaluate(async () => {
        const modulePath = '/src/canvas/persist/crashFlush.ts'
        const mod = (await import(/* @vite-ignore */ modulePath)) as { flushWorkToAutosave: () => boolean }
        return mod.flushWorkToAutosave()
      })
      const before = await measure()
      const geomOf = () => page.evaluate(async () => {
        const w = window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }> } } }
        const modulePath = '/src/canvas/layoutStore.ts'
        let lnw: number | null = null
        try {
          const mod = (await import(/* @vite-ignore */ modulePath)) as { useLayoutStore: { getState: () => { layoutNodeWidth: number | null } } }
          lnw = mod.useLayoutStore.getState().layoutNodeWidth
        } catch { /* ignore */ }
        const boxes: Record<string, number[]> = {}
        for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
          const e = el as HTMLElement
          boxes[e.dataset.id!] = [e.offsetWidth, e.offsetHeight]
        }
        return {
          layoutNodeWidth: lnw,
          positions: Object.fromEntries(w.useCanvasStore.getState().nodes.map((n) => [n.id, [Math.round(n.position.x), Math.round(n.position.y)]])),
          boxes,
        }
      })
      const beforeGeom = await geomOf()
      const beforePositions = beforeGeom.positions

      // ⚠ `preparePage` installs an initScript that runs `localStorage.clear()`
      // on EVERY navigation — so this harness is structurally incapable of
      // testing a reload unless the persisted state is put back. Init scripts
      // run in registration order, so one added HERE runs AFTER the clear.
      // Restoring the whole of localStorage reproduces a returning user
      // exactly: the flag pins and the autosave, as the product left them.
      const persisted = await page.evaluate(() => {
        const out: Record<string, string> = {}
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!
          out[k] = localStorage.getItem(k) ?? ''
        }
        return out
      })
      const autosaveKeys = Object.keys(persisted).filter((k) => /autosave|canvas|scenario/i.test(k))
      await page.addInitScript((entries: Record<string, string>) => {
        try { for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v) } catch { /* ignore */ }
      }, persisted)

      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.react-flow__node[data-id]', { timeout: 60_000 })

      // Sample every ~1.5s for 30s, matching the deployed-production cadence.
      const series: Array<{ t: number; lv: number; pairs: number; nodes: number }> = []
      for (let k = 0; k < 20; k++) {
        const m = await page.evaluate(() => {
          const w = window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }>; layoutVersion: number } } }
          const st = w.useCanvasStore.getState()
          const rendered = new Map<string, { w: number; h: number }>()
          for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
            const e = el as HTMLElement
            rendered.set(e.dataset.id!, { w: e.offsetWidth, h: e.offsetHeight })
          }
          const boxes = st.nodes.filter((n) => rendered.has(n.id)).map((n) => ({ x: n.position.x, y: n.position.y, ...rendered.get(n.id)! }))
          let pairs = 0
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const A = boxes[i], B = boxes[j]
            if (Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 0 && Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) > 0) pairs++
          }
          return { t: Math.round(performance.now()), lv: st.layoutVersion, pairs, nodes: boxes.length }
        })
        series.push(m)
        if (k < 19) await page.waitForTimeout(1500)
      }

      const post = await page.evaluate(() => {
        const g = globalThis as unknown as { __hookTrace?: Array<Record<string, unknown>>; __applyTrace?: Array<Record<string, unknown>> }
        const w = window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }> } } }
        return {
          hookBranches: (g.__hookTrace ?? []).filter((e) => e.branch !== 'gate').map((e) => e.branch),
          gateDecisions: [...new Set((g.__hookTrace ?? []).filter((e) => e.branch === 'gate').map((e) => e.decision))],
          applyEvents: (g.__applyTrace ?? []).map((e) => e.ev),
          positions: Object.fromEntries(w.useCanvasStore.getState().nodes.map((n) => [n.id, [Math.round(n.position.x), Math.round(n.position.y)]])),
        }
      })

      // Did reload restore the SAME positions that were persisted?
      let samePositions = 0, diffPositions = 0
      for (const [id, xy] of Object.entries(beforePositions)) {
        const after = (post.positions as Record<string, [number, number]>)[id]
        if (!after) continue
        if (after[0] === (xy as number[])[0] && after[1] === (xy as number[])[1]) samePositions++; else diffPositions++
      }

      // ⚠ CAPTURED BEFORE THE CAUSAL PROBE. Taking this afterwards reports the
      // RESTORED width as the post-reload width — an instrument artefact that
      // hides the entire finding. Order is load-bearing here.
      const afterGeom = await geomOf()

      // ⭐ CAUSAL TEST, not correlation. Restore ONLY `layoutNodeWidth` — touch
      // no position, no height, no layout — and re-measure. If the overlap
      // vanishes, the lost render width IS the defect. If it does not, this
      // whole diagnosis is wrong and should be discarded.
      const causal = await page.evaluate(async (w: number | null) => {
        if (w === null) return null
        const modulePath = '/src/canvas/layoutStore.ts'
        const mod = (await import(/* @vite-ignore */ modulePath)) as { useLayoutStore: { getState: () => { setLayoutNodeWidth: (n: number) => void } } }
        mod.useLayoutStore.getState().setLayoutNodeWidth(w)
        return true
      }, beforeGeom.layoutNodeWidth)
      await page.waitForTimeout(2500)
      const afterFix = await page.evaluate(() => {
        const w = window as unknown as { useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }>; layoutVersion: number } } }
        const st = w.useCanvasStore.getState()
        const rendered = new Map<string, { w: number; h: number }>()
        for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
          const e = el as HTMLElement
          rendered.set(e.dataset.id!, { w: e.offsetWidth, h: e.offsetHeight })
        }
        const boxes = st.nodes.filter((n) => rendered.has(n.id)).map((n) => ({ x: n.position.x, y: n.position.y, ...rendered.get(n.id)! }))
        let pairs = 0
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i], B = boxes[j]
          if (Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 0 && Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) > 0) pairs++
        }
        const widths = [...new Set([...rendered.values()].map((v) => v.w))].sort((a, b) => a - b)
        return { lv: st.layoutVersion, pairs, widths }
      })

      reload = {
        causalApplied: causal, afterFix,
        flushAt: process.env.SEQ_FLUSH_AT ?? 'converged',
        flushed,
        before: { lv: before.lv, pairs: before.pairs },
        series,
        hookBranches: post.hookBranches,
        gateDecisions: post.gateDecisions,
        applyEvents: post.applyEvents,
        samePositions, diffPositions,
        beforeGeom, afterGeom,
        persistedKeyCount: Object.keys(persisted).length,
        autosaveKeys,
      }
    }

    const out = await page.evaluate(() => {
      const w = window as unknown as {
        __seqTrace: Array<Record<string, unknown>>
        useCanvasStore: { getState: () => { nodes: Array<{ id: string; position: { x: number; y: number } }>; layoutVersion: number } }
      }
      const store = w.useCanvasStore.getState()
      const rendered = new Map<string, { w: number; h: number }>()
      for (const el of document.querySelectorAll('.react-flow__node[data-id]')) {
        const e = el as HTMLElement
        rendered.set(e.dataset.id!, { w: e.offsetWidth, h: e.offsetHeight })
      }
      const boxes = store.nodes
        .filter((n) => rendered.has(n.id))
        .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, ...rendered.get(n.id)! }))
      const pairs: Array<{ a: string; b: string; ox: number; oy: number }> = []
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i], B = boxes[j]
          const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x)
          const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y)
          if (ox > 0 && oy > 0) pairs.push({ a: A.id, b: B.id, ox: +ox.toFixed(1), oy: +oy.toFixed(1) })
        }
      }
      const g = globalThis as unknown as { __hookTrace?: unknown[]; __applyTrace?: unknown[] }
      const hookTrace = g.__hookTrace ?? []
      const applyTrace = g.__applyTrace ?? []
      const tr = w.__seqTrace
      // Compact: keep transitions in full, collapse dom samples to digests.
      const compact = tr.map((e) =>
        e.why === 'dom' ? { t: e.t, why: 'dom', domDigest: e.domDigest } : { ...e, storeH: undefined, domH: undefined },
      )
      // Per-lv-bump: store heights vs the FINAL dom heights, per node.
      const finalDom: Record<string, number> = {}
      for (const [k, v] of rendered) finalDom[k] = v.h
      const bumps = tr
        .filter((e) => e.why === 'transition')
        .map((e, i) => ({ i, t: e.t, lv: e.lv, pl: e.pl, lip: e.lip, rid: e.rid, storeDigest: e.storeDigest, domDigest: e.domDigest }))
      // Staleness at the LAST committed layout: how many nodes did the store
      // under-report vs what is painted now, and by how much.
      const lastCommit = [...tr].reverse().find((e) => e.why === 'transition' && (e as { lv: number }).lv === store.layoutVersion)
      let staleness: unknown = null
      if (lastCommit) {
        const sh = (lastCommit as { storeH: Record<string, number | null> }).storeH ?? {}
        const under: Array<{ id: string; storeH: number | null; finalH: number; delta: number }> = []
        for (const [id, fh] of Object.entries(finalDom)) {
          const s = sh[id] ?? null
          const delta = s === null ? fh : fh - s
          if (delta > 2) under.push({ id, storeH: s, finalH: fh, delta: +delta.toFixed(1) })
        }
        under.sort((a, b) => b.delta - a.delta)
        staleness = { atLv: (lastCommit as { lv: number }).lv, t: (lastCommit as { t: number }).t, underCount: under.length, worst: under.slice(0, 8) }
      }
      return {
        finalLv: store.layoutVersion,
        overlapPairs: pairs.length,
        worst: pairs.sort((a, b) => b.ox * b.oy - a.ox * a.oy).slice(0, 6),
        bumps,
        staleness,
        ovSeries: (w as unknown as { __ovSeries: Array<{ t: number; pairs: number; lv: number }> }).__ovSeries,
        traceLen: tr.length,
        hookTrace,
        applyTrace,
        compact,
      }
    })

    // eslint-disable-next-line no-console
    console.log('SEQJSON ' + JSON.stringify({ starter: STARTER, vp: `${VP.width}x${VP.height}`, trial, T0, T1, reload, ...out }))
  })
}
