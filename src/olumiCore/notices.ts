/**
 * The terms and the privacy notice: olumi-core serves each as its own page on this origin (core batch R15: `GET /terms`, `GET /privacy`).
 * The lane links to them, each opening in a new tab so the person keeps their place in the scenario.
 */
export const NOTICES: ReadonlyArray<{ readonly label: string; readonly href: string }> = [
  { label: 'Terms', href: '/terms' },
  { label: 'Privacy', href: '/privacy' },
]
