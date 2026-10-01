/**
 * Button classes for the sign-in surfaces, written to Design System v5 §8.1
 * exactly: 12px/24px padding, pill radius, semibold 14px, shadow-1; primary
 * shifts info blue → success green on hover with a 1px lift, darker green on
 * press; 40% primary when disabled with no shadow; §6.3 focus ring.
 */

import { typography } from '../../styles/typography'

const base = `${typography.button} inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-pill px-6 py-3 transition-all duration-fast ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info disabled:cursor-not-allowed`

export const primaryButton = `${base} bg-primary text-text-on-color shadow-1 hover:bg-primary-hover hover:-translate-y-px active:bg-primary-active active:translate-y-0 disabled:bg-primary-disabled disabled:shadow-none disabled:translate-y-0`

export const secondaryButton = `${base} border border-[rgba(38,38,38,0.16)] bg-transparent text-text-body hover:bg-panel-hover disabled:opacity-50`

/** §8.7: info colour, no underline at rest, underline on hover. */
export const textLink = `${typography.bodySmall} font-medium text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info rounded-sm disabled:cursor-not-allowed disabled:opacity-50`
