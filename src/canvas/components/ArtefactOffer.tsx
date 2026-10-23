/**
 * ⭐ ONE SUGGESTED NEXT MOVE ON THE CANVAS (28 Sep study §3.1: offer one intervention with why it may help now; "none"
 * is an allowed answer; the user chooses to start).
 *
 * The suggestion is CEE's own ranking, never a second one: the first enabled offer in `action_bar.priority` (CEE
 * `actions/rank.ts`: a standing gap, or an action RC ranks P1–P3 after its own cooldown). An empty priority list shows
 * nothing. The press is the bar's one press path (`pressOffer`). "Not now" is the bar's own dismissal (`offer_key` binds
 * the model and the Run), so the same suggestion never repeats without a new reason. It steps aside
 * while a lens is on (`artefacts/lenses.ts`), so there is one thing to look at.
 *
 * ⭐ AN OFFER ABOUT ONE LINK IS SAID ON THAT LINK (vision spec §3, 23 Oct: "'This result is most sensitive to one link'
 * strip → a challenge note pinned on that link, with Test link"). It is Olumi's note (`OlumiAttentionCard`, anchored at
 * the link's midpoint) with the same reason, the same press and the same "Not now", never a strip at the canvas foot.
 * It steps aside while the assistant's own note is open, so Olumi speaks from one place.
 */
import { createPortal } from 'react-dom'
import { useOverlayCell } from './CanvasOverlayBand'
import { useScenarioActionBar } from '../conversation/actionBar/useScenarioActionBar'
import { pressOffer } from '../conversation/actionBar/pressOffer'
import { ACTION_BAR_COPY } from '../conversation/actionBar/ActionBar'
import { useActionBarStore } from '../conversation/actionBar/actionBarStore'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useIsViewer } from '../../lib/viewerMode'
import { OlumiAttentionCard } from './OlumiAttentionCard'
import type { OlumiAttention } from '../utils/olumiAttention'

export const ARTEFACT_OFFER_TESTID = 'artefact-offer'
export const ARTEFACT_OFFER_COPY = { notNow: 'Not now' } as const

export function ArtefactOffer() {
  const bar = useScenarioActionBar()
  // A lens's key card is the one thing to look at while it is on (option isolation is a view of the model, not a lens).
  const artefactOpen = useCanvasStore((s) => s.lens.active !== 'full' && s.lens.active !== 'option')
  const dismissed = useActionBarStore((s) => s.dismissed)
  const dismiss = useActionBarStore((s) => s.dismiss)
  const offer = bar?.priority.find((o) => o.enabled) ?? null
  // A viewer reads the model but cannot send a turn, so no move is suggested to them.
  const isViewer = useIsViewer()
  const wants = offer !== null && !isViewer && !artefactOpen && !dismissed.includes(offer.offer_key)
  // The link the offer is about, when it is about one that is on the canvas.
  const linkId = useCanvasStore((s) => {
    const t = offer?.target
    return t?.kind === 'link' ? (s.edges.find((e) => e.source === t.from_id && e.target === t.to_id)?.id ?? null) : null
  })
  const assistantNoteOpen = useCanvasStore((s) => s.olumiAttention?.note != null)
  const { granted, target } = useOverlayCell('bottom-right', 'artefact-offer', wants && linkId === null)
  if (!wants || offer === null || bar === null) return null
  const press = () => {
    // Never a dead press: with no conversation to send it to, say so (the bar's own words).
    if (pressOffer(offer, bar.revision) === 'none') {
      window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ACTION_BAR_COPY.noConversation, level: 'warning' } }))
    }
  }
  if (linkId !== null) {
    if (assistantNoteOpen) return null
    const note: OlumiAttention = {
      nodeIds: [],
      edgeIds: [linkId],
      note: {
        body: offer.why_now ?? '',
        actions: [
          { id: offer.action_id, label: offer.label, kind: 'press' },
          { id: 'not-now', label: ARTEFACT_OFFER_COPY.notNow, kind: 'dismiss' },
        ],
      },
      caveat: null,
      turnId: null,
      modelVersion: null,
    }
    return <OlumiAttentionCard held={note} onPress={press} onDismiss={() => dismiss(offer.offer_key)} />
  }
  if (!granted) return null

  const body = (
    <div
      data-testid={ARTEFACT_OFFER_TESTID}
      data-action-id={offer.action_id}
      className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-panel-border bg-panel px-3 py-1.5 shadow-2"
    >
      {/* Olumi's reason is never cut mid-word: up to two lines, then the tooltip (it read "There is only one option besides doing nothi…", 20 Oct 2026). */}
      <span className={`${typography.panelBody} min-w-0 line-clamp-2 text-text-body`} title={offer.why_now}>{offer.why_now}</span>
      <button
        type="button"
        data-testid={`${ARTEFACT_OFFER_TESTID}-press`}
        className={`${typography.panelBody} ${action('primary')} flex-none`}
        onClick={press}
      >
        {offer.label}
      </button>
      <button
        type="button"
        data-testid={`${ARTEFACT_OFFER_TESTID}-not-now`}
        className={`${typography.panelMeta} flex-none rounded text-text-light hover:text-text-body ${ACTION_FOCUS}`}
        onClick={() => dismiss(offer.offer_key)}
      >
        {ARTEFACT_OFFER_COPY.notNow}
      </button>
    </div>
  )
  return target ? createPortal(body, target) : body
}
