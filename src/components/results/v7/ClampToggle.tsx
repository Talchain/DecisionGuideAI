/**
 * ClampToggle — the row-clamp reveal affordance, ONE leaf for the THREE verbatim
 * copies in this directory.
 *
 * ⚠ R-11 — IT WAS EXTRACTED FOR "THE TWO VERBATIM COPIES" AND THERE WERE THREE.
 * The extraction landed inside `V7EvidenceDisclosure.tsx` as a module-private
 * component covering its own two copies (Drivers and Resolve next). The third —
 * `V7GuidanceSection.tsx`'s `v7-guidance-toggle` — is in the SAME directory, with
 * a byte-identical `className` down to the focus-ring, the same `showAll`
 * ternary, and the same "label counts the hidden rows" contract. Being
 * module-private is what stopped it from being consumed: the copy was not missed
 * out of carelessness, it was unreachable. A private extraction that leaves a
 * reachable copy behind converts one duplication into a duplication PLUS a claim
 * to have removed it, which is the worse of the two states.
 *
 * `hiddenCount` is the number of rows the clamp HIDES and does not change when
 * the list expands, so the affordance stays mounted as "Show fewer" — the
 * behaviour all three suites pin. Renders nothing when the clamp hides nothing.
 *
 * ⚠ THE COUNTER IS THE ONLY DIGIT-BEARING STRING IN THE RESOLVE-NEXT VIEW, and it
 * is a count of HIDDEN ROWS — never a value of information. It is the string that
 * view's no-digit assertion carves out and then pins exactly, so the carve-out
 * cannot widen into a hole a magnitude arrives through. That property now belongs
 * to one component instead of three, which is the point.
 */
import { typography } from '../../../styles/typography'

/**
 * ⚠ ONE DEFINITION OF THE REVEAL LABEL. `v7LensCopy.seeMore` and
 * `v7GuidanceCopy.showMore` were two differently-NAMED functions returning the
 * byte-identical string, in the same directory, for the same affordance — so a
 * copy change would have been applied to whichever one the author happened to
 * open. Both now reference this, keeping their own property names so their
 * consumers and copy-hygiene manifests are unchanged; what is gone is the second
 * definition of the string.
 *
 * ⚠ SCOPE. Four FURTHER copies of `Show ${n} more` exist outside this directory
 * (`strengthen/strengthenCopy.ts`, `coaching-panel/constants.ts`,
 * `pre-analysis-v3/constants.ts`, and `analysis-hero/heroCopy.ts`'s `showFewer`
 * half). They are pre-existing, belong to four other panels with their own copy
 * modules and copy-hygiene suites, and unifying user-facing copy across panels is
 * a copy decision rather than a refactor. Named here so the next reader knows the
 * count is six and not two, and does not mistake this file for the finish line.
 */
export const clampRevealLabel = (n: number): string => `Show ${n} more`

/** The collapse label, paired with `clampRevealLabel` for the same reason. */
export const clampCollapseLabel = 'Show fewer'

export function ClampToggle({
  testId,
  hiddenCount,
  expanded,
  onToggle,
}: {
  testId: string
  hiddenCount: number
  expanded: boolean
  onToggle: () => void
}) {
  if (hiddenCount <= 0) return null
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={testId}
      className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
    >
      {expanded ? clampCollapseLabel : clampRevealLabel(hiddenCount)}
    </button>
  )
}
