/**
 * ComparisonScopeNote — THE one rendering of "these numbers compare N of your
 * M options", placed next to the numbers it qualifies.
 *
 * ## Why a shared component rather than three formatted strings
 *
 * The copy and the derivation are owned by `utils/goalAnchorCopy.ts`
 * (`COMPARISON_SCOPE_COPY` / `deriveComparisonScope`), which is where a fourth
 * surface should get them from too. This component exists so the three
 * mounted surfaces also share the SUPPRESSION RULE and the markup: the
 * "say nothing when the whole set was compared" decision is made once, here,
 * rather than being re-typed as a `&&` guard at each call site where one of
 * them would eventually drift to a truthiness check and start rendering a
 * "comparing 4 of 4" note (CLAUDE.md trap 12 — the hand-maintained mirror).
 *
 * ## The `surface` prop is REQUIRED on purpose
 *
 * All three mounts can be on screen at once, so a single shared testid would
 * make every query ambiguous and force tests to bind positionally — the exact
 * bind-by-predicate defect trap 19 exists to stop. Naming the surface keeps
 * every assertion bound to the surface it is a claim about.
 *
 * ## ⚠ WHERE THIS MUST NOT BE MOUNTED
 *
 * Only beside a COMPARATIVE or SUPERLATIVE claim — win probability, rank,
 * ordinal, "highest", "came out ahead". ISL lists `probability_of_goal` among
 * the per-option quantities that are INVARIANT on a subset, so the goal-fit
 * block is deliberately NOT qualified: saying a figure is set-dependent when
 * it is not is the same class of untruth, pointing the other way.
 */
import { AlertCircle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { COMPARISON_SCOPE_COPY, type ComparisonScope } from './utils/goalAnchorCopy'

export interface ComparisonScopeNoteProps {
  /**
   * The derived scope, or `null` when there is nothing to say.
   * `deriveComparisonScope` already encodes every say-nothing state; this
   * component never re-decides them.
   */
  scope: ComparisonScope | null | undefined
  /** Which mounted surface this instance qualifies — see the header. */
  surface: 'hero' | 'comparative' | 'options'
  /**
   * Render the consequence line as well. Off by default: the compact surfaces
   * have room for the scope sentence only, and a truncated second line is
   * worse than no second line.
   */
  withDetail?: boolean
  className?: string
}

export function ComparisonScopeNote({
  scope,
  surface,
  withDetail = false,
  className = '',
}: ComparisonScopeNoteProps) {
  // The suppression rule, made once. `null` is the whole-set case and every
  // other say-nothing state; see `deriveComparisonScope`.
  if (!scope) return null

  return (
    <p
      data-testid={`comparison-scope-note-${surface}`}
      className={`${typography.panelMeta} flex items-start gap-1.5 text-text-light ${className}`}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-none" />
      <span>
        {COMPARISON_SCOPE_COPY.sentence(scope)}
        {withDetail ? ` ${COMPARISON_SCOPE_COPY.detail(scope)}` : ''}
      </span>
    </p>
  )
}

export default ComparisonScopeNote
