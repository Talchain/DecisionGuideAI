/**
 * deriveSignalViews — pure merge of registry detections with the session
 * ledger. Live detections render as coaching rows; previously-seen signals
 * whose detection has cleared render as quiet confirmations (greyed copy +
 * check, actions hidden). Never-seen, non-detecting signals are absent —
 * no phantom confirmations.
 */

import { MAX_SHARPEN_ROWS } from '../constants'
import type { PanelSignalId, SignalView } from '../types'
import { SIGNAL_REGISTRY, type SignalDetectionInput } from './registry'

export interface DerivedSignals {
  /** ≤ MAX_SHARPEN_ROWS rows for the Sharpen section, priority-ordered. */
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

  return { sharpen: sharpen.slice(0, MAX_SHARPEN_ROWS), hero, newlySeen }
}
