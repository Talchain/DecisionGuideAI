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
 *  2. PREFILL-ONLY + VISIBLE — the row action MERGES the prompt into the composer
 *     (via `draftComposerText` for the unmounted case + `_prefillChat` for an
 *     already-mounted one) AND reveals the Olumi/chat surface. It APPENDS to, never
 *     clobbers, an unsent draft (the composer mirrors its value to draftComposerText,
 *     so a message typed on the Olumi tab is persisted there). On the Analysis tab
 *     the chat composer is not mounted (ConversationPanel lives in the Olumi tab) and
 *     its `_prefillChat` callback is null; the persisted `draftComposerText` is what
 *     a freshly-mounting composer initialises from, and `forceActivateOutputTab('olumi')`
 *     mounts/reveals it (the live-diagnosed reveal used by useConversationActions).
 *     There is deliberately NO `_sendMessage`: never auto-sends. The reveal needs
 *     aiPanelV2 (the dock redirects 'olumi'→'results' otherwise), so `actionsEnabled`
 *     gates the controls off when it is disabled — no dead buttons.
 */
import { useCallback, useMemo } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { useV2Run } from '@/canvas/hooks/useV2Run'
import { useUIStore } from '@/stores/uiStore'
import { focusFloating } from '@/canvas/hooks/useFloatingFocus'
import { isAiPanelV2Enabled } from '@/flags'
import { classifyFreshnessForDisplay } from '@/canvas/store/analysisFreshness'
import { buildFocusRows } from './buildFocusRows'
import { freshnessToBanner } from './freshnessBanner'
import { mergeComposerDraft } from './composerDraft'
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

  // The row action reveals the Olumi chat tab, which only exists when aiPanelV2 is
  // on — OutputsDock redirects a requested 'olumi' tab to 'results' otherwise, so
  // the action would set a draft nobody can see. When off we tell the panel to
  // render NO action controls (rows stay informational, never dead buttons).
  const actionsEnabled = isAiPanelV2Enabled()

  const onPrefill = useCallback((text: string) => {
    // Prefill the chat and reveal it — NEVER auto-send.
    // 1. Merge into (never clobber) any unsent draft. The chat composer mirrors
    //    its value to draftComposerText (useComposerState), so a message typed on
    //    the Olumi tab is persisted here; overwriting it would silently destroy
    //    the user's unsent text. A freshly-mounting composer initialises from this.
    const merged = mergeComposerDraft(useCanvasStore.getState().draftComposerText, text)
    useCanvasStore.setState({ draftComposerText: merged })
    // 2. If a composer IS already mounted (e.g. an open floating chat), set its
    //    live value to the SAME merged text — the mount-time initialiser in (1)
    //    won't re-run for it. (`_prefillChat` is null on the Analysis tab.)
    useGuidanceStore.getState()._prefillChat?.(merged)
    // 3. Reveal the Olumi chat surface so the prefill is visible. Mirrors the
    //    live-diagnosed reveal in useConversationActions: forceActivate the docked
    //    Olumi tab (bumps the version so the dock reconciles + opens even when the
    //    tab value is unchanged), then best-effort focus a hosting floating panel.
    if (isAiPanelV2Enabled()) {
      useUIStore.getState().forceActivateOutputTab('olumi')
    }
    focusFloating()
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
    actionsEnabled,
  }
}
