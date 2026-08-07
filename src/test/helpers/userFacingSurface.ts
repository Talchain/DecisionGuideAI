/**
 * userFacingSurface — the single definition of "what the user reads or hears"
 * for a rendered element.
 *
 * Extracted from `expectNoReceiptUserFacingTextLeaks` so that helper and the
 * CEE rendering-claims harness (`tests/contracts/cee-rendering-claims.contract.test.ts`)
 * enforce the *same* surface. Two helpers with two slightly different notions
 * of "user-facing" is exactly the hand-maintained-mirror defect class.
 *
 * WHAT IS DELIBERATELY EXCLUDED — and why it matters:
 *   `key`, `data-testid`, `data-*`, `className`, `id`, `href`
 * are implementation-detail attributes. A raw wire identifier appearing in
 * them is NOT a rendering violation: React keys and test ids are precisely the
 * legitimate machine uses that CEE's field-coverage allowlist permits
 * ("machine reference for click-handling", "React keying"). Asserting against
 * `outerHTML` would conflate the two and make the correct pattern
 * (`key={opt.option_id}` + `{opt.label}` as text) indistinguishable from the
 * defect (`{id}` as the visible chip text).
 *
 * `aria-*` label text IS included: a screen-reader user "reads" it, so an id
 * leaked into an aria-label is a real leak of the same claim type.
 */

/** Attributes whose values are announced by assistive tech or shown on hover. */
const EXTENDED_USER_FACING_ATTRIBUTES = [
  'aria-description',
  'aria-placeholder',
  'aria-valuetext',
  'aria-roledescription',
  'title',
  'alt',
  'placeholder',
] as const

export interface UserFacingSurfaceOptions {
  /**
   * Also collect `title`, `alt`, `placeholder` and the non-label `aria-*`
   * text attributes. Default `false`, which reproduces exactly the surface
   * `expectNoReceiptUserFacingTextLeaks` has always asserted against
   * (textContent + own aria-label + descendant aria-labels).
   */
  includeExtendedAttributes?: boolean
}

/**
 * Build the user-facing surface string for `element`.
 *
 * Returns textContent plus the element's own `aria-label` plus every
 * descendant `aria-label`, newline-joined. With
 * `includeExtendedAttributes`, also appends the extended attribute set
 * (own + descendants).
 */
export function userFacingSurface(
  element: HTMLElement,
  options: UserFacingSurfaceOptions = {},
): string {
  const textContent = element.textContent ?? ''
  const elementOwnAriaLabel = element.getAttribute('aria-label') ?? ''
  const childAriaLabels = Array.from(element.querySelectorAll('[aria-label]'))
    .map((el) => el.getAttribute('aria-label') ?? '')
    .join('\n')

  const parts = [textContent, elementOwnAriaLabel, childAriaLabels]

  if (options.includeExtendedAttributes === true) {
    for (const attribute of EXTENDED_USER_FACING_ATTRIBUTES) {
      const own = element.getAttribute(attribute)
      if (own !== null) parts.push(own)
      for (const el of Array.from(element.querySelectorAll(`[${attribute}]`))) {
        parts.push(el.getAttribute(attribute) ?? '')
      }
    }
  }

  return parts.join('\n')
}
