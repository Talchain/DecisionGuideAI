/**
 * THE single display policy for factor/driver confidence.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The Drivers panel had already ruled that `factor_sensitivity[].confidence`
 * has no display-safe source today and must never be rendered raw or defaulted
 * (`DISPLAY_SAFE_DRIVER_CONFIDENCE`, formerly a private const in
 * `DriversSection.tsx`). Three canvas surfaces + the Model tab read THE SAME
 * field off THE SAME `results.report` with no gate at all, so the product
 * simultaneously refused to show a number in one panel and printed it, bare, on
 * four others:
 *
 *   · `canvas/nodes/shared/MetricPills.tsx`   "Confidence 25%"
 *   · `canvas/nodes/FactorNode.tsx`           bar + % in Detailed view
 *   · `canvas/nodes/FactorNode.tsx`           SPOKEN PROSE — "Low confidence."
 *   · `canvas/components/model-tab/FactorsSection.tsx`  "Confidence 25%"
 *   · `canvas/ui/NodeInspector.tsx`           bar + % (dead at runtime today)
 *
 * In both real staging captures that number is `0.25` with
 * `confidence_components.sampling_stability: 0` — the exact condition
 * `isDefaultedConfidenceFromRaw` classifies as DEFAULTED — while ISL's own
 * computed figure in the same bundle was `0.3756`.
 *
 * A gate that lives in one component and is re-decided in the next is the
 * hand-maintained-mirror defect class. So the constant lives HERE and every
 * surface resolves through `resolveFactorConfidenceDisplay`. Adding a surface
 * that renders confidence without calling this function is the only way to
 * re-open the fork, and that is now a visible, reviewable act.
 *
 * WHAT THIS MODULE DOES NOT DO
 * ----------------------------
 * It does NOT flip the doctrine. `DISPLAY_SAFE_DRIVER_CONFIDENCE` keeps its
 * ruled value of `false`; this change only makes the surfaces that were
 * ignoring it obey it. Flipping it — i.e. ADDING a number to the product — is a
 * display-safety doctrine call for the science lane / Paul.
 *
 * When it IS flipped, every surface gets `isDefaulted` and `isProvisional`
 * alongside the value, so nothing renders bare: the same disclosure vocabulary
 * the Drivers panel already ships (the "Default estimate — not yet validated
 * with evidence" marker and the provisional-calibration note) applies
 * everywhere at once.
 */

/**
 * Single-source rule (see ROBUSTNESS-VERDICT-CONTRACT): there is no
 * display-safe source for driver/factor confidence today, so the signal stays
 * HIDDEN everywhere — no raw %, no bar, no dash, no confidence-derived prose.
 *
 * Flip this true ONLY when a certified display-safe confidence source exists.
 * Everything gated on it lights up together, WITH disclosure.
 */
export const DISPLAY_SAFE_DRIVER_CONFIDENCE = false

/** PLoT's confidence disclosure object, as parsed off the wire. */
export interface ConfidenceProvenanceLike {
  isProvisional?: boolean
}

/**
 * Derive `isDefaultedConfidence` from a normalised factor sensitivity row.
 *
 * Tracks ISL-side bootstrap degeneracy (sampling_stability detected as 0,
 * indicating ISL emitted a placeholder) — NOT PLoT-side `fallback_degenerate`,
 * which is a different concept. Audit A1-PRIMARY: the source-name list accepts
 * BOTH legacy values ('isl', 'isl_default') AND the new honest enum
 * ('plot_unified_from_isl_bootstrap') so the derivation survives both deploy
 * directions (old PLoT + new UI, and new PLoT + old UI).
 *
 * Lives here rather than in `useResultsSectionData` (which re-exports it for
 * its existing consumers) so that the rule and the gate that consumes it are
 * one small module, importable by canvas code without dragging a hook file in.
 */
export function isDefaultedConfidenceFromRaw(raw: {
  confidenceSource?: string
  samplingStability?: number | null
}): boolean {
  return (
    raw.confidenceSource === 'isl'
    || raw.confidenceSource === 'isl_default'
    || raw.confidenceSource === 'plot_unified_from_isl_bootstrap'
  )
    && raw.samplingStability === 0
}

/** What a surface should render for one factor's confidence. */
export type FactorConfidenceDisplay =
  | {
      show: false
      /**
       * `absent`   — the producer sent no confidence for this factor.
       * `no_display_safe_source` — a value exists but the ruled policy says it
       *   is not fit to show. NOT the same thing, and surfaces that want to
       *   explain themselves need to tell them apart.
       */
      hiddenReason: 'absent' | 'no_display_safe_source'
    }
  | {
      show: true
      /** 0-1. */
      value: number
      /** True ⇒ render the "Default estimate" marker; never render bare. */
      isDefaulted: boolean
      /** True ⇒ render the provisional-calibration note; never render bare. */
      isProvisional: boolean
    }

/**
 * Resolve one factor's confidence for display.
 *
 * @param displaySafe test seam ONLY. Production callers pass nothing, so they
 * all bind to the single module constant and cannot fork. Tests pass `true` to
 * exercise the shown branch — which is what makes the "it is hidden" assertions
 * non-vacuous: without a demonstrated PRESENCE the absence proves nothing.
 */
export function resolveFactorConfidenceDisplay(
  input: {
    confidence: number | null | undefined
    isDefaulted?: boolean
    confidenceProvenance?: ConfidenceProvenanceLike
  },
  displaySafe: boolean = DISPLAY_SAFE_DRIVER_CONFIDENCE,
): FactorConfidenceDisplay {
  const value = input.confidence
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    return { show: false, hiddenReason: 'absent' }
  }
  if (!displaySafe) {
    return { show: false, hiddenReason: 'no_display_safe_source' }
  }
  return {
    show: true,
    value,
    isDefaulted: input.isDefaulted === true,
    isProvisional: input.confidenceProvenance?.isProvisional === true,
  }
}

/**
 * Read the confidence fields off a RAW `factor_sensitivity` row and resolve the
 * display in one step.
 *
 * Exists because `ModelTabBody` builds its confidence map straight from the raw
 * wire arrays (including `rawV2Response` fallbacks) and never touches the
 * normalised driver feed. Rather than let it re-implement the field probes —
 * a mirror that would drift the moment PLoT renames a field — it calls this.
 */
export function resolveRawFactorConfidenceDisplay(
  raw: unknown,
  displaySafe: boolean = DISPLAY_SAFE_DRIVER_CONFIDENCE,
): FactorConfidenceDisplay {
  if (raw == null || typeof raw !== 'object') return { show: false, hiddenReason: 'absent' }
  const row = raw as Record<string, unknown>
  const components = row.confidence_components as Record<string, unknown> | undefined
  const provenance = row.confidence_provenance as Record<string, unknown> | undefined
  return resolveFactorConfidenceDisplay(
    {
      confidence: typeof row.confidence === 'number' ? row.confidence : null,
      isDefaulted: isDefaultedConfidenceFromRaw({
        confidenceSource: typeof row.confidence_source === 'string' ? row.confidence_source : undefined,
        samplingStability:
          typeof components?.sampling_stability === 'number'
            ? (components.sampling_stability as number)
            : undefined,
      }),
      confidenceProvenance:
        typeof provenance?.is_provisional === 'boolean'
          ? { isProvisional: provenance.is_provisional as boolean }
          : undefined,
    },
    displaySafe,
  )
}
