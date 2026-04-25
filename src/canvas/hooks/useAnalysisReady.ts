/**
 * Selector hooks over the canvas store's `ceeAnalysisReady` slice.
 *
 * The slice is a nested object (`CEEAnalysisReady | null`) that carries the
 * full CEE payload. Surfaces that only need the readiness status or option
 * list use these narrow selectors instead of reaching into the object,
 * which keeps the single-source-of-truth (nested slice) intact and avoids
 * the write-race risk that would come with flat duplicate state.
 *
 * See docs/ui-v5-alpha-hardening-evidence.md — Phase 2.1 slice-naming
 * decision — for why the codebase uses nested state + selectors rather
 * than flat `analysis_status` / `analysis_ready_options` slices.
 */

import { useCanvasStore } from '../store'
import type { CEEOptionV3 } from '../../adapters/cee/types'

/**
 * Returns the wire-format `analysis_ready.status` string, or `'missing'`
 * when the slice is null (no CEE response has landed yet, or it was
 * cleared by the explicit-unknown branch on an analyse turn). Use to
 * gate executable affordances like the "Run analysis" chip.
 */
export function useAnalysisStatus(): string {
  return useCanvasStore((s) => s.ceeAnalysisReady?.status ?? 'missing')
}

/** Readiness-gate helper: true only when the wire status is exactly `'ready'`. */
export function useIsAnalysisReady(): boolean {
  return useCanvasStore((s) => s.ceeAnalysisReady?.status === 'ready')
}

/**
 * Returns the option array from the slice, or `null` when no readiness
 * state is present. Consumers that need option count / status breakdown
 * (e.g. pre-analysis panel) use this instead of reading the whole slice.
 */
export function useAnalysisReadyOptions(): readonly CEEOptionV3[] | null {
  return useCanvasStore((s) => s.ceeAnalysisReady?.options ?? null)
}
