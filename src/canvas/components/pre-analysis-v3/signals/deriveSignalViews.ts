/**
 * deriveSignalViews — pure merge of registry detections with the session
 * ledger. Live detections render as coaching rows; previously-seen signals
 * whose detection has cleared render as quiet confirmations (greyed copy +
 * check, actions hidden). Never-seen, non-detecting signals are absent —
 * no phantom confirmations.
 *
 * Returns the FULL priority-ordered row list (bounded by the registry, ≤4
 * sharpen rows). The visible cap and "Show N more" reveal live in
 * SharpenSection — CEE rows hold their deterministic priority slot, so an
 * enrichment row can never push the visible set beyond the cap.
 */

import type { PanelSignalId, SignalView } from '../types'
import { SIGNAL_REGISTRY, type SignalDetectionInput } from './registry'

export interface DerivedSignals {
  /** All sharpen rows, priority-ordered (registry order is the priority). */
  sharpen: SignalView[]
  /** Hero-surface detections (drive field attention, not rows). */
  hero: SignalView[]
  /** Ids detected this pass that the ledger has not seen yet. */
  newlySeen: PanelSignalId[]
}

export function deriveSignalViews(
  input: SignalDetectionInput,
  seen: Partial<Record<PanelSignalId, { firstSeenAt: number }>>,
): DerivedSignals {
  const sharpen: SignalView[] = []
  const hero: SignalView[] = []
  const newlySeen: PanelSignalId[] = []

  for (const def of SIGNAL_REGISTRY) {
    const detection = def.detect(input)
    if (detection) {
      if (!seen[def.signal_id]) newlySeen.push(def.signal_id)
      const view: SignalView = { detection, status: 'live' }
      if (def.surface === 'hero') hero.push(view)
      else sharpen.push(view)
    } else if (seen[def.signal_id] && def.surface === 'sharpen' && def.resolvedCopy) {
      sharpen.push({
        detection: {
          signal_id: def.signal_id,
          copy: { lead: def.resolvedCopy, emphasis: '' },
          rationale: '',
          entityKind: def.entityKind,
        },
        status: 'resolved',
      })
    }
  }

  return { sharpen, hero, newlySeen }
}
