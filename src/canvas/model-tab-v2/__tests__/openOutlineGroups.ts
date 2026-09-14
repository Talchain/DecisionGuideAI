import { fireEvent, screen } from '@testing-library/react'
import { MODEL_GROUP_IDS } from '../types'

/**
 * Open every outline group, for specs whose subject is the ROWS.
 *
 * ⚠ THIS IS NAVIGATION, NOT A RELAXED ASSERTION. The Model outline now opens
 * CLOSED — `initiallyClosedGroups` was declared when `ModelOutline` was written
 * and never passed, so all seven groups rendered expanded: 1,817px of scroll
 * before the reader has chosen anything, measured on deployed staging.
 *
 * Specs written before that default exercised rows that happened to be on
 * screen at mount. Their subject — the edit transaction, the filter, the tier
 * switch, the carrier honesty — is unchanged, and NOT ONE of their assertions
 * is altered by this helper. It performs the click a user now performs.
 *
 * A spec whose subject IS the default open/closed state must NOT use this:
 * see `theOutlineOpensAsAnOutline.spec.tsx`, which asserts the closed default
 * and that the collapsed header still carries its count and unknown summary.
 */
export function openOutlineGroups(): void {
  for (const id of MODEL_GROUP_IDS) {
    const toggle = screen.queryByTestId(`model-group-v2-${id}-toggle`)
    if (toggle !== null && toggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(toggle)
    }
  }
}
