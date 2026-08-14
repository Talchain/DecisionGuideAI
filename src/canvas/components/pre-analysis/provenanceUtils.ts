import type { CEEProvenance } from '../../../adapters/cee/types'
import { classifyNodeProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'

/**
 * Node-level provenance → pill.
 *
 * ROADMAP 2.638 S2. `user_set` used to return **null**: the one value in this
 * vocabulary that says a HUMAN owns the number had no pill, while both
 * machine-owned values had one. A reader could only conclude the value was
 * unattributed — the absence read as "nobody's".
 *
 * The copy is deliberately "Set by you", not "Confirmed by you". CEE writes
 * `provenance: 'user_set'` on every applied `set_factor_value`
 * (`set-factor-value.ts:450`) whether the user typed a number or endorsed the
 * one already there — so this stamp knows a person acted and cannot say which
 * act. Naming the act here would be an over-claim; the confirm/edit
 * distinction is carried by `observed_state.source` and rendered by the
 * surfaces that read it.
 *
 * The map is TOTAL over `ValueProvenanceKind`, so a kind added to the canonical
 * classification is a type error here rather than a silent fallback (trap 12).
 */
const PILL_BY_KIND: Record<ValueProvenanceKind, { label: string; borderClass: string }> = {
  confirmed: { label: 'Confirmed by you', borderClass: 'border-success/30' },
  edited: { label: 'Edited by you', borderClass: 'border-success/30' },
  assumption: { label: 'Your assumption', borderClass: 'border-success/30' },
  human: { label: 'Set by you', borderClass: 'border-success/30' },
  brief: { label: 'From brief', borderClass: 'border-success/30' },
  ai: { label: 'AI estimate', borderClass: 'border-info/30' },
  // 0.40.0. UNREACHABLE ON THIS SURFACE TODAY and present for totality, which is
  // the honest reason: `provenanceToPill` is keyed off `classifyNodeProvenance`
  // (node.provenance -> human/brief/ai), never off `observed_state.source`, so no
  // input to this map can currently produce 'panel'. Declared rather than cast
  // away so that the day this surface switches to source-classification it
  // renders the right words instead of falling through to a neighbour's.
  panel: { label: 'From your panel', borderClass: 'border-info/30' },
}

export function provenanceToPill(
  p: CEEProvenance | undefined,
): { label: string; borderClass: string } | null {
  const cls = classifyNodeProvenance(p)
  if (!cls) return null
  return PILL_BY_KIND[cls.kind]
}
