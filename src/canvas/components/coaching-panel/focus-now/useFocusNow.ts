/**
 * useFocusNow — the ONLY store-aware file in the Focus Now module.
 *
 * Reads live state and returns the prop bag for the presentational FocusNowPanel,
 * so the rendered tree owns no store, no network and no private store APIs. The
 * component is currently unmounted; this hook is the ready-to-wire container for
 * the future mount PR.
 *
 * Two boundaries are enforced here, not in the presentational layer:
 *  1. CLAIM-SAFETY — `coaching_summary` is uncertified CEE prose. The banned-terms
 *     tests certify UI-authored copy ONLY, never server prose. Display therefore
 *     defaults OFF (CERTIFY_SUMMARY=false). A live mount must keep it hidden or
 *     flip this on ONLY once the summary is passed through Gate Zero / certified
 *     CEE output. Do not call the panel live-safe while it shows uncertified prose.
 *  2. PREFILL-ONLY — the row action drains to the composer via `_prefillChat`.
 *     There is deliberately NO `_sendMessage` fallback: Focus Now never auto-sends.
 */
import { useCallback, useMemo } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { useV2Run } from '@/canvas/hooks/useV2Run'
import { classifyFreshnessForDisplay } from '@/canvas/store/analysisFreshness'
import { buildFocusRows } from './buildFocusRows'
import { freshnessToBanner } from './freshnessBanner'
import type { FocusNowProps } from './focusTypes'

/**
 * See boundary (1) above. HARD MOUNT-PR GATE — keep false until ALL are resolved
 * (none are resolved today; do not flip on assumption):
 *   - the exact live field / carrier of `coaching_summary` is unresolved unless
 *     verified (read here from `ceeAnalysisReady`, a generic-model carrier — see
 *     the store.ts caveat that it is NOT scenario-scoped);
 *   - draft-time vs post-analysis enrichment phase is unresolved unless verified;
 *   - a possible stale / phase-mismatch risk is unresolved unless verified;
 *   - a live mount MUST hide it until Gate Zero / certified CEE output exists.
 * Until then display is fail-closed (null), so the inert component is unaffected.
 */
const CERTIFY_SUMMARY = false

export function useFocusNow(): FocusNowProps {
  const rawSummary = useCanvasStore((s) => s.ceeAnalysisReady?.coaching_summary ?? null)
  const freshness = useCanvasStore((s) => s.analysisFreshness)
  const dirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const { runV2Analysis, isRunning } = useV2Run()

  // Uncertified prose is gated OFF; the data path stays visible for the mount PR.
  const coachingSummary = CERTIFY_SUMMARY ? rawSummary : null

  const vm = useMemo(() => buildFocusRows({ coachingSummary }), [coachingSummary])
  const banner = useMemo(
    () => freshnessToBanner(classifyFreshnessForDisplay(freshness, dirty)),
    [freshness, dirty],
  )

  const onPrefill = useCallback((text: string) => {
    // Prefill ONLY — never auto-send.
    const prefill = useGuidanceStore.getState()._prefillChat
    if (prefill) prefill(text)
  }, [])

  const onRerun = useCallback(() => {
    void runV2Analysis()
  }, [runV2Analysis])

  return {
    summary: vm.summary,
    rows: vm.rows,
    banner,
    onPrefill,
    onRerun,
    rerunDisabled: isRunning,
  }
}
