/**
 * ClampToggle — the row-clamp reveal affordance, ONE leaf for the FOUR clamps in
 * this directory.
 *
 * ⚠ THE COUNT HAS NOW BEEN WRONG TWICE, IN THE SAME HEADER, FOR THE SAME REASON.
 * It was extracted for "the two verbatim copies" and there were three; it then
 * said THREE while `V7WhatIWasGivenSection.tsx` — added later, in this same
 * directory — hand-rolled a FOURTH. That fourth one was not a verbatim copy,
 * which is exactly why it was easy to miss and exactly why it mattered: it
 * rendered in a DIFFERENT COLOUR from the other three (`text-text-light
 * underline` against `text-info hover:underline`) and it was ONE-WAY, with no
 * "Show fewer". A user reads the results panel as one surface, so a divergent
 * copy is not an internal tidiness problem — it is visible to them.
 * **A hand-maintained count in a header is the very defect this component
 * exists to remove (CLAUDE.md trap 12): if you add a clamp here, consume this,
 * and if you find this number wrong, the number is not the bug.**
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
 * behaviour every consumer's suite pins. Renders nothing when the clamp hides
 * nothing. ⚠ A consumer that passes `items.length - visible.length` gets zero on
 * expand and unmounts the control; that is the one-way bug, not a variant.
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
 * ⚠ SCOPE, AND A CORRECTION. This note used to say "four FURTHER copies exist
 * outside this directory … the count is six and not two", naming four COPY
 * MODULES (`strengthen/strengthenCopy.ts`, `coaching-panel/constants.ts`,
 * `pre-analysis-v3/constants.ts`, `analysis-hero/heroCopy.ts`'s `showFewer`
 * half). That total was too low, because the label is also produced INLINE in
 * components that have no copy module at all — `ChangeAttributionPanel.tsx`,
 * `conversation/InlineBlocks.tsx`, `blocks/GraphPatchBlockRenderer.tsx`,
 * `results/ConfidenceSection.tsx`, `results/TriageActionCardsBody.tsx`,
 * `sandbox-guide/.../TopDriversSection.tsx` among them. Scope of that sweep,
 * stated so the next reader can judge it: `rg` over `src/` for `Show ${…`,
 * "`Show ", "Show {" and 'Show ' filtered to more/fewer, EXCLUDING tests and
 * `__tests__/`; it does not cover `e2e/`, `docs/`, or any unmerged branch.
 * ⚠ NO TOTAL IS STATED HERE ON PURPOSE. A count in a comment is a
 * hand-maintained mirror, it has now been wrong twice in this one header, and
 * replacing a wrong number with a freshly-measured one just resets the clock
 * (CLAUDE.md trap 12). Re-derive it if you need it. What remains true and is
 * the actual point: unifying user-facing copy ACROSS panels is a copy decision
 * rather than a refactor, so this file is not the finish line for it.
 */
export const clampRevealLabel = (n: number): string => `Show ${n} more`

/** The collapse label, paired with `clampRevealLabel` for the same reason. */
export const clampCollapseLabel = 'Show fewer'

/**
 * ⚠ THE TAP TARGET IS THE REASON `py-1.5` IS NOT NEGOTIABLE HERE.
 * Tailwind's preflight sets `button { padding: 0 }` (verified in this project:
 * `src/index.css:6` loads `@tailwind base`, tailwindcss 3.4.19), so a bare
 * button really is zero-padded — not merely un-styled. `panelMeta` is
 * `text-[11px] leading-snug`, i.e. 11 x 1.375 = **15.125px** of line box, which
 * is a 15px-tall hit area for a control a user is expected to click repeatedly.
 * `py-1.5` (6px each side) takes it to **27.125px**, clearing WCAG 2.2 SC 2.5.8
 * Target Size (Minimum)'s 24x24 floor. `py-1` was considered and reaches only
 * **23.125px** — it restores the old look and still misses the floor, which is
 * why the taller value is here. Width is never the binding constraint: the
 * shortest label, "Show fewer", is far wider than 24px at any inset.
 */
const CLAMP_TAP_PADDING = 'py-1.5'

/**
 * How far the control is inset from the left, which MUST equal the horizontal
 * padding of the rows it sits beneath or the label will not line up with the
 * text above it.
 *
 * ⚠ MEASURED AT THE RENDERED DOM, not assumed: three of the four consumers
 * (`V7EvidenceDisclosure`'s drivers and resolve-next lists, `V7GuidanceSection`)
 * render rows with NO horizontal padding, so they sit flush and `'none'` is
 * correct for them. `V7WhatIWasGivenSection`'s rows carry `px-2`, so it — and
 * only it — passes `'px-2'`. Putting `px-2` on this component unconditionally
 * would have fixed one consumer by misaligning three.
 *
 * A closed union rather than a free `className`: a consumer must not be able to
 * quietly re-style the shared affordance, because divergent styling is the
 * defect this component exists to prevent, not a knob it offers.
 */
export type ClampRowInset = 'none' | 'px-2'

export function ClampToggle({
  testId,
  hiddenCount,
  expanded,
  onToggle,
  rowInset = 'none',
}: {
  testId: string
  hiddenCount: number
  expanded: boolean
  onToggle: () => void
  rowInset?: ClampRowInset
}) {
  if (hiddenCount <= 0) return null
  const inset = rowInset === 'none' ? '' : ` ${rowInset}`
  return (
    <button
      type="button"
      onClick={onToggle}
      data-testid={testId}
      className={`${typography.panelMeta} ${CLAMP_TAP_PADDING}${inset} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
    >
      {expanded ? clampCollapseLabel : clampRevealLabel(hiddenCount)}
    </button>
  )
}
