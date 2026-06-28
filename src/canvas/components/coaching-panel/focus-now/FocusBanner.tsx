/**
 * FocusBanner — the single panel-level freshness banner.
 *
 * Renders the freshness verdict it is GIVEN (the UI never derives staleness, F.6).
 * Three states, DS-correct (outlined `bg-panel`, never a soft `bg-warning-light`
 * fill):
 *   - 'stale'         → outlined warning + a short "Re-run" affordance.
 *   - 'cannot_confirm'→ NEUTRAL note, no warning colour, no re-run-as-stale.
 *   - 'none'          → renders nothing.
 *
 * Prop-driven and store-free: the re-run is an injected callback; the button is
 * disabled while a run is in flight.
 */
import { AlertTriangle, Info } from 'lucide-react'
import { typography } from '@/styles/typography'
import { FOCUS_COPY } from './focusConstants'
import type { FocusBannerState } from './focusTypes'

interface FocusBannerProps {
  state: FocusBannerState
  onRerun?: () => void
  rerunDisabled?: boolean
}

export function FocusBanner({ state, onRerun, rerunDisabled = false }: FocusBannerProps) {
  if (state.kind === 'none') return null

  if (state.kind === 'cannot_confirm') {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-panel-border bg-panel px-3 py-2"
        data-testid="focus-banner"
        data-banner="cannot_confirm"
      >
        <Info className="h-4 w-4 flex-none text-text-light" aria-hidden="true" />
        <span className={`${typography.panelBody} min-w-0 text-text-light`}>
          {FOCUS_COPY.cannotConfirmText}
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-warning/30 bg-panel px-3 py-2"
      data-testid="focus-banner"
      data-banner="stale"
    >
      <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden="true" />
      <span className={`${typography.panelBody} min-w-0 flex-1 text-text-body`}>
        {FOCUS_COPY.staleText}
      </span>
      {onRerun && (
        <button
          type="button"
          onClick={onRerun}
          disabled={rerunDisabled}
          data-testid="focus-rerun"
          className="ml-auto flex-none whitespace-nowrap rounded-full bg-primary px-3 py-1 text-text-on-color outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-info disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={typography.panelMeta}>{FOCUS_COPY.rerunLabel}</span>
        </button>
      )}
    </div>
  )
}

export default FocusBanner
