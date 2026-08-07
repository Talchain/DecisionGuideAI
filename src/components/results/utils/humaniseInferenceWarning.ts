/**
 * Shared code-keyed view model for producer inference warnings.
 *
 * P0-3 fold (external review 2026-07-14): ISL inference-warning `message`
 * strings carry internal identifiers (e.g.
 * `constraint_fac_customer_churn_max observed_state.value intercept=0`). The
 * top warning strip humanised them by `code`, but the Advanced accordion
 * rendered the raw `message` verbatim — leaking internal identifiers and
 * implementation terminology (a no-raw-message-invariant violation; not XSS —
 * React escapes the string). This module is the SINGLE humanisation path both
 * surfaces use, so they cannot drift again.
 *
 * It lives in a `.ts` file (not `.tsx`) deliberately: the V14.3
 * no-message-render guard scans only `.tsx` under `src/components/results/`,
 * so keeping every `.message` read here means the consuming components hold
 * zero `.message` access and need no defence-in-depth exemption.
 */
import { humaniseCritique } from './humaniseCritique'
import type { UncertaintyItem } from '../types'

/** The minimal warning shape both surfaces share. AdvancedSection passes the
 *  narrow `{ code, message }`; InferenceWarningStrip passes the full
 *  InferenceWarning (which additionally carries affected node ids + labels). */
export interface HumanisableInferenceWarning {
  code: string
  message?: string
  affected_nodes?: string[]
  affected_labels?: string[]
}

/** Node-label map for humaniseCritique's factor-label resolution, built from
 *  the warning's already-resolved `affected_labels` (never parsed from
 *  `message`). Returns undefined when no labels are available — humaniseCritique
 *  then falls back to its own ID-derived label. */
export function buildInferenceWarningLabelMap(
  w: HumanisableInferenceWarning,
): Map<string, string> | undefined {
  if (!w.affected_nodes || !w.affected_labels || w.affected_labels.length === 0) return undefined
  const map = new Map<string, string>()
  w.affected_nodes.forEach((nodeId, i) => {
    const label = w.affected_labels?.[i]
    if (label) map.set(nodeId, label)
  })
  return map.size > 0 ? map : undefined
}

/** Humanised, user-safe headline for an inference warning — the same
 *  code-keyed template path every other critique surface uses. Never echoes
 *  the raw `message`; unmapped codes fall through to humaniseCritique's safe
 *  generic copy. */
export function humaniseInferenceWarningTitle(w: HumanisableInferenceWarning): string {
  const item: UncertaintyItem = {
    code: w.code,
    message: w.message ?? '',
    affectedNodes: w.affected_nodes,
  }
  return humaniseCritique(item, buildInferenceWarningLabelMap(w)).title
}

/** AdvancedSection selection: keep every warning with a non-empty producer
 *  message (all severities — fail-closed on empties, no fabricated copy), and
 *  return it already humanised so the JSX never touches `.message`. */
export function selectHumanisedInferenceWarnings(
  warnings: HumanisableInferenceWarning[] | undefined,
): Array<{ code: string; title: string }> {
  return (warnings ?? [])
    .filter((w) => typeof w.message === 'string' && w.message.trim().length > 0)
    .map((w) => ({ code: w.code, title: humaniseInferenceWarningTitle(w) }))
}
