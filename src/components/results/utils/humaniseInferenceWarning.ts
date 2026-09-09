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
  /** Producer field path, e.g. `nodes[c591da5e].observed_state.value`. PLoT
   *  forwards this for the codes that name a single node; see
   *  `nodeIdFromField`. */
  field?: string
}

/**
 * ⭐ THE NODE ID, READ FROM THE STRUCTURED `field` KEY — NOT FROM `message`.
 *
 * `humaniseCritique.ts:281` rules that every template ignores the resolved
 * label DELIBERATELY, because "PLoT forwards `{code, message, severity,
 * field?, elapsed_ms?}` and NEVER `affected_nodes`", so a label would resolve
 * to the unresolved "This factor" and printing it would be worse than saying
 * nothing. That premise is correct and its own sentence lists the third
 * option: **`field` carries the identity.**
 *
 * Measured across every capture and fixture in this repo: 27 inference-warning
 * entries, 0 with `affected_nodes`, 0 with `affected_labels` — and
 * `ROOT_NODE_DEFAULT_VALUE` 6/6 plus `GOAL_ANCESTOR_DATA_GAP` 3/3 carrying a
 * `field`, every one DISTINCT. The discriminator was on the wire the whole
 * time; it was simply not where the label map looked.
 *
 * ⚠ THIS DOES NOT BREACH THE GLOBAL RULE, which is "labels resolve via nodeId →
 * graph store lookup ONLY. Never parsed from critique message strings." An id
 * taken from a structured KEY and resolved against the store IS that route.
 * The ids inside `message` prose — including GOAL_ANCESTOR_DATA_GAP's root
 * ancestors — stay unread, and this returns undefined for any field that is
 * not a node path, so an edge or a scalar field yields nothing.
 */
export function nodeIdFromField(field?: string): string | undefined {
  if (!field) return undefined
  const m = /^nodes\[([^\]]+)\]/.exec(field)
  return m ? m[1] : undefined
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
    // ⚠ AN ID USED AS ITS OWN LABEL IS NOT A LABEL. The adapter fills
    // `affected_labels` with `nodeLabelMap.get(id) ?? id`, so an unresolved
    // node arrives carrying its raw id in the label position. Admitting that
    // would report `labelIsGenuine: true` and print an engine identifier at
    // the user — the exact defect the genuine-gate exists to stop, reached
    // through a side door rather than through `factorIdToLabel`.
    if (label && label !== nodeId) map.set(nodeId, label)
  })
  return map.size > 0 ? map : undefined
}

/** Humanised, user-safe headline for an inference warning — the same
 *  code-keyed template path every other critique surface uses. Never echoes
 *  the raw `message`; unmapped codes fall through to humaniseCritique's safe
 *  generic copy. */
export function humaniseInferenceWarningTitle(
  w: HumanisableInferenceWarning,
  /** Node id → label, from the graph store. Optional: without it the copy is
   *  exactly what it has always been. */
  nodeLabels?: ReadonlyMap<string, string>,
): string {
  const fromField = nodeIdFromField(w.field)
  const item: UncertaintyItem = {
    code: w.code,
    message: w.message ?? '',
    // `affected_nodes` first — it is the declared carrier and wins wherever a
    // producer ever starts sending it. `field` is the fallback that is
    // ACTUALLY populated today.
    // ⚠⚠ `??` WAS WRONG HERE AND IT MADE THE WHOLE FEATURE DARK. The mounted
    // adapter (`useResultsSectionData.ts`) rebuilds every warning with
    // `affected_nodes: safeArray(...)`, i.e. an EMPTY ARRAY for the defaulting
    // family — and `[] ?? x` yields `[]`, so the field fallback never fired and
    // both roots kept the same anonymous sentence. Absent and empty must
    // resolve identically; only a NON-EMPTY declared list outranks the field.
    affectedNodes:
      w.affected_nodes && w.affected_nodes.length > 0
        ? w.affected_nodes
        : fromField
          ? [fromField]
          : undefined,
  }
  return humaniseCritique(item, buildInferenceWarningLabelMap(w) ?? nodeLabels).title
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
  /** Node id → label, from the graph store. Omitted, every sentence is
   *  byte-identical to before — the two same-code rows stay indistinguishable,
   *  which is the pre-existing contract and the fallback this relies on. */
  nodeLabels?: ReadonlyMap<string, string>,
): Array<{ code: string; title: string }> {
  return (warnings ?? [])
    .filter((w) => typeof w.message === 'string' && w.message.trim().length > 0)
    .filter((w) => !isStripEntry(w))
    .map((w) => ({ code: w.code, title: humaniseInferenceWarningTitle(w, nodeLabels) }))
}
