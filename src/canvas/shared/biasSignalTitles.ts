/**
 * biasSignalTitles — the ONE canonical bias-signal registry: CEE bias code
 * → { humanised title, Lucide icon }. (#356 fast-follow grew this from a
 * titles-only map into the full registry — review-folds 2026-07-17: the
 * panel-local icon channel was a hand-maintained mirror with a dual-case
 * key space, a diverging CONFIRMATION_BIAS icon, prototype-chain crash
 * codes and a vacuous drift trap. One lowercase-keyed map + one guarded
 * resolver kills all four at the root.)
 *
 * Importers:
 *   - src/canvas/conversation/draftBiasSignalBlocks.ts (v5_coaching
 *     bias-signal card titles; fail-closed allowlist lookup)
 *   - src/canvas/components/pre-analysis/PreAnalysisPanel.tsx (bias
 *     trigger cards + deterministic-trigger names)
 *   - src/canvas/hooks/useScienceIcons.ts, src/canvas/nodes/OptionNode.tsx,
 *     src/canvas/nodes/DecisionNode.tsx (composed trigger/tooltip names)
 *
 * Keys are canonical lowercase; `resolveBiasSignal` lowercases first (both
 * wire conventions arrive: lowercase `type` and uppercase `code`) and
 * guards with an own-key check so hostile prototype-chain codes
 * ('__proto__' → Object.prototype, 'constructor' → Function) can never
 * escape as a truthy config. Unknown codes are the caller's fail-closed
 * concern — this registry never invents a title. Drift traps:
 * biasSignalTitles.parity.spec.ts.
 *
 * CONFIRMATION_BIAS icon: the pre-registry panel map carried Frame on the
 * lowercase row and Gauge on the uppercase row (silent divergence).
 * Canonical pick: Frame — the lowercase/wire-common row.
 */
import { Anchor, EyeOff, Frame, Gauge } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface BiasSignalEntry {
  title: string
  icon: LucideIcon
}

export const BIAS_SIGNAL_REGISTRY: Record<string, BiasSignalEntry> = {
  framing: { title: 'Narrow framing', icon: Frame },
  framing_bias: { title: 'Narrow framing', icon: Frame },
  narrow_framing: { title: 'Narrow framing', icon: Frame },
  anchoring: { title: 'Anchoring', icon: Anchor },
  anchoring_bias: { title: 'Anchoring', icon: Anchor },
  confidence: { title: 'Overconfidence', icon: Gauge },
  overconfidence: { title: 'Overconfidence', icon: Gauge },
  optimism_bias: { title: 'Optimism bias', icon: Gauge },
  blind_spots: { title: 'Blind spots', icon: EyeOff },
  status_quo_bias: { title: 'Status quo bias', icon: EyeOff },
  confirmation: { title: 'Confirmation bias', icon: Frame },
  confirmation_bias: { title: 'Confirmation bias', icon: Frame },
  authority_bias: { title: 'Authority bias', icon: Anchor },
  availability_bias: { title: 'Availability bias', icon: Frame },
  sunk_cost: { title: 'Sunk cost', icon: Anchor },
}

/**
 * THE guarded registry lookup, shared by every surface (the guard logic
 * lived in draftBiasSignalBlocks.humaniseBiasSignalCode; it now lives here
 * once — that function delegates).
 *
 * - trims + lowercases, so both wire conventions resolve;
 * - own-key guard: a bare object-literal index walks the prototype chain,
 *   so the hostile wire codes '__proto__' (returns Object.prototype, a
 *   truthy object React refuses to render) and 'constructor' (returns a
 *   Function whose .title/.icon are undefined) would escape a `?? null`
 *   and the caller's `if (!entry)` check. Only own keys are entries;
 *   everything else fails closed like any other unknown code.
 */
export function resolveBiasSignal(code: unknown): BiasSignalEntry | null {
  if (typeof code !== 'string') return null
  const key = code.trim().toLowerCase()
  if (!key) return null
  return Object.prototype.hasOwnProperty.call(BIAS_SIGNAL_REGISTRY, key)
    ? BIAS_SIGNAL_REGISTRY[key]
    : null
}
