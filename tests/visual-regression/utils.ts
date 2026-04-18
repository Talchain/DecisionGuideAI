/**
 * Visual-regression helpers — targeted DOM-snapshot utilities for Brief 5.
 *
 * Runs inside the existing vitest/jsdom setup with no dev-server dependency.
 * Intentionally small: the aim is catching structural / copy / classname drift
 * on the analysis-tab surfaces touched by Brief 5, not pixel-level regression.
 */

/**
 * Normalise a DOM node's outerHTML so the snapshot is stable across runs.
 *
 * Drops react-runtime noise (random testids that include time/seed suffixes,
 * data-reactroot, React-inserted comment nodes) and collapses whitespace. Keeps
 * semantic structure, classnames, aria-* attributes, role, and copy text.
 */
export function captureSurface(node: Element | null | undefined): string {
  if (!node) return '<empty>'
  const html = node.outerHTML ?? ''
  return normaliseDomSnapshot(html)
}

export function normaliseDomSnapshot(html: string): string {
  return html
    // React dev-only attributes
    .replace(/\s+data-reactroot="[^"]*"/g, '')
    // runtime-generated id suffixes (keep the prefix, strip the numeric tail)
    .replace(/(id|data-testid|aria-labelledby|aria-describedby|for)="([^"]*?)[:.]\d{3,}"/g, '$1="$2"')
    // collapse repeated whitespace between tags
    .replace(/>\s+</g, '><')
    // trim leading/trailing whitespace inside text nodes
    .replace(/>\s+/g, '>')
    .replace(/\s+</g, '<')
    .trim()
}

/**
 * Convenience: query a surface by its stable `data-testid` and snapshot it.
 * Returns `<missing:testid>` instead of throwing — tests should assert on the
 * returned string so a missing surface shows up as a diff, not a crash.
 */
export function captureByTestId(root: ParentNode, testId: string): string {
  const node = root.querySelector(`[data-testid="${testId}"]`)
  if (!node) return `<missing:${testId}>`
  return captureSurface(node)
}
