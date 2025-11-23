/**
 * UI utility functions
 */

import { typography, type TypographyKey } from '../styles/typography'

/**
 * Typography helper - combines typography scale with additional classes
 *
 * @example
 * <h3 className={typo('h3', 'mb-4 text-sky-600')}>Decision Review</h3>
 */
export function typo(key: TypographyKey, additional?: string): string {
  return additional ? `${typography[key]} ${additional}` : typography[key]
}
