/**
 * Named selectors for canvas-app results state.
 *
 * Results are authoritative in useCanvasStore for the main canvas surface.
 * New code should use these selectors rather than direct store access.
 * Existing direct access is acceptable during migration.
 *
 * Note: src/pages/sandbox-guide/ uses a separate useResultsStore with the
 * same schema. See the JSDoc on src/canvas/stores/resultsStore.ts for the
 * split rationale. Do not reuse these selectors in sandbox-guide surfaces.
 */
import { useShallow } from 'zustand/react/shallow'
import { useCanvasStore } from '../store'

// ─── Single-field selectors (no useShallow needed) ──────────────────────────

/** Results panel status: 'idle' | 'preparing' | 'connecting' | 'streaming' | 'complete' | 'error' | 'cancelled'. */
export const useResultsStatus = () => useCanvasStore((s) => s.results.status)

/** True after at least one successful or restored run in this session. */
export const useHasCompletedFirstRun = () => useCanvasStore((s) => s.hasCompletedFirstRun)

/** Current progress (0..100, capped at 90 until COMPLETE). */
export const useResultsProgress = () => useCanvasStore((s) => s.results.progress)

// ─── Grouped selectors (useShallow for reference stability) ─────────────────

/**
 * Combined results payload: report + status + hash. Used by inspector panels
 * and driver/recommendation surfaces that read multiple fields together.
 */
export const useResultsReport = () =>
  useCanvasStore(
    useShallow((s) => ({
      report: s.results.report,
      status: s.results.status,
      hash: s.results.hash,
    })),
  )

/**
 * Full results + runMeta bundle for OutputsDock and the results section
 * data assembler, which need everything.
 */
export const useResultsWithRunMeta = () =>
  useCanvasStore(
    useShallow((s) => ({
      results: s.results,
      runMeta: s.runMeta,
      hasCompletedFirstRun: s.hasCompletedFirstRun,
    })),
  )

/**
 * Run diagnostics from runMeta. Used by debug drawers and error surfaces.
 */
export const useRunMetaDiagnostics = () =>
  useCanvasStore(
    useShallow((s) => ({
      diagnostics: s.runMeta?.diagnostics,
      correlationIdHeader: s.runMeta?.correlationIdHeader,
      degraded: s.runMeta?.degraded,
    })),
  )
