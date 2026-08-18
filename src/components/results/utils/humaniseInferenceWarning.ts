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
  /** Producer severity. The strip shows only `'warning'`; see `isStripEntry`. */
  severity?: string
  affected_nodes?: string[]
  affected_labels?: string[]
}

/**
 * THE STRIP'S ADMISSION PREDICATE — one definition, two consumers.
 *
 * `InferenceWarningStrip` shows warning-severity entries with a real producer
 * message and nothing else. `AdvancedSection` shows the COMPLEMENT of exactly
 * this set, so the two cannot both state the same sentence.
 *
 * It lives here rather than in the strip because a complement computed from a
 * SECOND spelling of the predicate is a hand-maintained mirror (CLAUDE.md trap
 * 12): the day someone widens the strip, the Advanced side would start
 * repeating again and nothing would say so. Both sides now call this.
 */
export function isStripEntry(w: HumanisableInferenceWarning): boolean {
  return w.severity === 'warning' && typeof w.message === 'string' && w.message.trim().length > 0
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

// `selectHumanisedInferenceWarnings` — the UNFILTERED selector — was DELETED on
// 18 Aug 2026. It went dead when #766 partitioned the Advanced list and the
// warning strip into an exact complement: every caller moved to
// `selectHumanisedInferenceWarningsOutsideStrip` below, leaving the unfiltered
// form with a definition and no callers. Rowed in TRUE-BACKLOG from the #766
// review, trigger "next Analysis-surface tidy" — this is that tidy. Re-adding an
// unfiltered selector would re-open the duplicate-render defect the complement
// was built to close, so it is recorded here rather than silently dropped.

/**
 * AdvancedSection selection: the entries the strip does NOT show.
 *
 * Derived as the COMPLEMENT of `isStripEntry`, never as its own filter list.
 * Measured on deployed staging `c71ea7e0`: without this, the Advanced trust
 * list repeated all three of the strip's sentences verbatim five screens below
 * them. The remainder is what Advanced uniquely carries — info-severity
 * entries the strip filters out — so nothing is lost and nothing repeats.
 */
export function selectHumanisedInferenceWarningsOutsideStrip(
  warnings: HumanisableInferenceWarning[] | undefined,
): Array<{ code: string; title: string }> {
  return (warnings ?? [])
    .filter((w) => typeof w.message === 'string' && w.message.trim().length > 0)
    .filter((w) => !isStripEntry(w))
    .map((w) => ({ code: w.code, title: humaniseInferenceWarningTitle(w) }))
}
