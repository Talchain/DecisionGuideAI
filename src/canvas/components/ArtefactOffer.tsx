/**
 * ⭐ ONE SUGGESTED NEXT MOVE ON THE CANVAS (28 Sep study §3.1: offer one intervention with why it may help now; "none"
 * is an allowed answer; the user chooses to start).
 *
 * The suggestion is CEE's own ranking, never a second one: the first enabled offer in `action_bar.priority` (CEE
 * `actions/rank.ts`: a standing gap, or an action RC ranks P1–P3 after its own cooldown). An empty priority list shows
 * nothing. The press is the bar's one press path (`pressOffer`). "Not now" is the bar's own dismissal (`offer_key` binds
 * the model and the Run), so the same suggestion never repeats without a new reason. It steps aside
 * while an artefact is open beside the model, so there is one thing to look at.
 */
import { createPortal } from 'react-dom'
import { useOverlayCell } from './CanvasOverlayBand'
import { useScenarioActionBar } from '../conversation/actionBar/useScenarioActionBar'
import { pressOffer } from '../conversation/actionBar/pressOffer'
import { ACTION_BAR_COPY } from '../conversation/actionBar/ActionBar'
import { useActionBarStore } from '../conversation/actionBar/actionBarStore'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import { useArtefactStore } from '../artefacts/artefactStore'

export const ARTEFACT_OFFER_TESTID = 'artefact-offer'
export const ARTEFACT_OFFER_COPY = { notNow: 'Not now' } as const

export function ArtefactOffer() {
  const bar = useScenarioActionBar()
  const artefactOpen = useArtefactStore((s) => s.open !== null)
  const dismissed = useActionBarStore((s) => s.dismissed)
  const dismiss = useActionBarStore((s) => s.dismiss)
  const offer = bar?.priority.find((o) => o.enabled) ?? null
  const wants = offer !== null && !artefactOpen && !dismissed.includes(offer.offer_key)
  const { granted, target } = useOverlayCell('bottom-right', 'artefact-offer', wants)
  if (!wants || !granted || offer === null || bar === null) return null

  const body = (
    <div
      data-testid={ARTEFACT_OFFER_TESTID}
      data-action-id={offer.action_id}
      className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-panel-border bg-panel px-3 py-1.5 shadow-2"
    >
      <span className={`${typography.panelBody} min-w-0 truncate text-text-body`} title={offer.why_now}>{offer.why_now}</span>
      <button
        type="button"
        data-testid={`${ARTEFACT_OFFER_TESTID}-press`}
        className={`${typography.panelBody} ${action('primary')} flex-none`}
        onClick={() => {
          // Never a dead press: with no conversation to send it to, say so (the bar's own words).
          if (pressOffer(offer, bar.revision) === 'none') {
            window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ACTION_BAR_COPY.noConversation, level: 'warning' } }))
          }
        }}
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
