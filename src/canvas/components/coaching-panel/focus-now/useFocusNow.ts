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
 *  2. PREFILL-ONLY + VISIBLE — the row action MERGES the prompt into the live chat
 *     composer AND reveals the Olumi/chat surface. The visible aiPanelV2 composer is
 *     `AIInputBar`, whose textarea is bound directly to ConversationContext `draft`
 *     (`value={draft}` / `setDraft`). So we write the draft through that context —
 *     NOT canvas-store `draftComposerText` (the LEGACY composer's draft, which the
 *     aiPanelV2 composer never reads) and NOT the guidance-store `_prefillChat`
 *     (unreliable: ConversationPanel overwrites it with a no-op `composerRef`
 *     under `hideComposer`). A functional `setDraft(prev => merge(prev, text))`
 *     APPENDS to, never clobbers, an unsent draft and needs no reactive read.
 *     There is deliberately NO `sendMessage`: never auto-sends. The reveal needs
 *     aiPanelV2 (the dock redirects 'olumi'→'results' otherwise) and a live
 *     conversation, so `actionsEnabled` gates the controls off otherwise — no dead
 *     buttons. This is the same live ConversationContext path useConversationActions
 *     uses to dodge the guidance-store registration race.
 */
import { useCallback, useMemo } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useV2Run } from '@/canvas/hooks/useV2Run'
import { useUIStore } from '@/stores/uiStore'
import { useOptionalConversationContext } from '@/canvas/conversation/ConversationContext'
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
  // The live chat. Optional: null if somehow rendered outside the provider (then we
  // cannot reach the composer, so we disable the action controls — never dead).
  const conversation = useOptionalConversationContext()

  // Uncertified prose is gated OFF; the data path stays visible for the mount PR.
  const coachingSummary = CERTIFY_SUMMARY ? rawSummary : null

  const vm = useMemo(() => buildFocusRows({ coachingSummary }), [coachingSummary])
  const banner = useMemo(
    () => freshnessToBanner(classifyFreshnessForDisplay(freshness, dirty)),
    [freshness, dirty],
  )

  // The row action needs (a) a live conversation to write the draft into and (b)
  // aiPanelV2 — the reveal targets the Olumi tab, which OutputsDock redirects to
  // 'results' when aiPanelV2 is off. Without both, the controls could not produce a
  // visible effect, so the panel renders NO action controls (rows stay
  // informational, never dead buttons).
  const setDraft = conversation?.setDraft
  const draft = conversation?.draft ?? ''
  const actionsEnabled = isAiPanelV2Enabled() && !!setDraft

  const onPrefill = useCallback((text: string) => {
    if (!setDraft) return
    // Prefill the LIVE chat composer and reveal it — NEVER auto-send.
    // The visible aiPanelV2 composer (AIInputBar) is bound to ConversationContext
    // `draft`, so writing through setDraft updates whichever surface is showing
    // (strip / floating / docked). APPEND to, never clobber, an unsent draft — the
    // closed-over `draft` is the latest committed value (this hook subscribes to it).
    setDraft(mergeComposerDraft(draft, text))
    // Reveal the Olumi chat surface so the prefill is visible: forceActivate the
    // docked Olumi tab (bumps the version so the dock reconciles + opens even when
    // the tab value is unchanged), then best-effort focus a hosting floating panel.
    if (isAiPanelV2Enabled()) {
      useUIStore.getState().forceActivateOutputTab('olumi')
    }
    focusFloating()
  }, [setDraft, draft])

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
