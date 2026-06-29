/**
 * CoachingMoment — the expanded body of a coaching row.
 *
 * Shows the entity context (shape + human label), any roadmap fields when
 * present, and an icon-only "Ask Olumi" affordance that is DISPLAY-ONLY this
 * phase (no handler, no execution). The full observation lives in the row
 * header (un-clamped when open) so it is not repeated here.
 *
 * The Ask-Olumi button is inlined (not imported from the in-flight
 * pre-analysis-v3 directory) to keep this panel fully file-disjoint from that
 * work; it uses the same DS tokens (info colour, 28px round, info focus ring).
 */
import { Sparkles } from 'lucide-react'
import Tooltip from '@/components/Tooltip'
import { EntityTarget } from './EntityTarget'
import { CoachingFutureFields, hasFutureFields } from './CoachingFutureFields'
import { COACHING_COPY } from './constants'
import type { CoachingSignal } from './types'

export function CoachingMoment({ signal }: { signal: CoachingSignal }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      {signal.target_label && (
        <EntityTarget targetKind={signal.target_kind} label={signal.target_label} showLabel />
      )}

      {hasFutureFields(signal) && <CoachingFutureFields signal={signal} />}

      <div className="flex justify-end">
        <Tooltip content={COACHING_COPY.askOlumi}>
          {/* Display-only: no onClick this phase. aria-label names the icon-only action. */}
          <button
            type="button"
            aria-label={COACHING_COPY.askOlumi}
            className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-info outline-none transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40"
            data-testid="coaching-ask-olumi"
          >
            <Sparkles size={16} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

export default CoachingMoment
