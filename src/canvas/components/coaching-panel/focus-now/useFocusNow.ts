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
 *  2. AUTO-SEND + VISIBLE — the row action SENDS the prompt to Olumi immediately
 *     (per Paul's decision, these coaching actions auto-send rather than prefill)
 *     and reveals the Olumi/chat surface so the user sees it land + the reply. Send
 *     goes through the guidance-store `_sendMessage` (the real conversation
 *     sendMessage, reliably registered by OlumiTabBody + ConversationPanel — no
 *     null/no-op problem). Reveal via `revealOlumiSurface`. The action needs
 *     aiPanelV2 (the dock redirects 'olumi'→'results' otherwise) and a live
 *     `_sendMessage`, so `actionsEnabled` gates the controls off otherwise — no dead
 *     buttons.
 */
import { useCallback, useMemo } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { revealOlumiSurface } from '@/canvas/conversation/revealOlumi'
import { isAiPanelV2Enabled } from '@/flags'
import { buildFocusRows } from './buildFocusRows'
import type {
  FocusBannerState, FocusNowProps } from './focusTypes'

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
  // Reliably-registered send wire (real conversation sendMessage). Subscribe to its
  // presence so the controls hide when no chat can receive the message — never dead.
  const canSendToChat = useGuidanceStore((s) => s._sendMessage !== null)

  // Uncertified prose is gated OFF; the data path stays visible for the mount PR.
  const coachingSummary = CERTIFY_SUMMARY ? rawSummary : null

  const vm = useMemo(() => buildFocusRows({ coachingSummary }), [coachingSummary])
  // Wave F-B (brief §5.3): NO second stale banner inside Strengthen your
  // model — the Analysis freshness strip is the sole owner. The panel keeps
  // its rows; staleness context lives one card above.
  const banner: FocusBannerState = { kind: 'none' }

  // The row action needs (a) a live `_sendMessage` to deliver the prompt and (b)
  // aiPanelV2 — the reveal targets the Olumi tab, which OutputsDock redirects to
  // 'results' when aiPanelV2 is off. Without both, the controls could not produce a
  // visible effect, so the panel renders NO action controls (rows stay
  // informational, never dead buttons).
  const actionsEnabled = isAiPanelV2Enabled() && canSendToChat

  const onPrefill = useCallback((text: string) => {
    // AUTO-SEND the coaching prompt to Olumi, then reveal the chat so the user sees
    // it land + the reply. `_sendMessage` is the real conversation sendMessage.
    const send = useGuidanceStore.getState()._sendMessage
    if (!send) return
    void send(text)
    revealOlumiSurface()
  }, [])

  // Wave F-B: onRerun retired with the banner — it was a private useV2Run
  // pipeline (the class this wave removes). FocusBanner never renders now.
  const onRerun = undefined

  return {
    summary: vm.summary,
    rows: vm.rows,
    banner,
    onPrefill,
    onRerun,
    rerunDisabled: true,
    actionsEnabled,
  }
}
