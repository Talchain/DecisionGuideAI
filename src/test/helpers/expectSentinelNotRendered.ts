/**
 * expectSentinelNotRendered — sentinel-based leak probe for the CEE
 * rendering-claims harness.
 *
 * Complements the two existing leak helpers rather than replacing them:
 *   - `expectNoReceiptLeaks` / `expectNoChipMetadataLeaks` assert against a
 *     hand-listed blocklist of known-bad terms. That shape is right for
 *     "these specific internal words must never appear", and wrong here: a
 *     blocklist of every id a producer might emit is unmaintainable, and a
 *     hand-maintained blocklist is the defect class this platform keeps
 *     losing to.
 *   - This helper inverts it. We plant a value we control into the field
 *     under test and assert *that exact value* never reaches the user-facing
 *     surface. Nothing to keep in sync — the probe derives its expectation
 *     from the fixture it just built.
 *
 * TRAP 13 — an absence assertion is vacuous unless it can first see a
 * presence. Every probe therefore REQUIRES a `witness`: a string that must
 * be present in the same extracted surface. If the component failed to
 * render, the surface extractor was pointed at the wrong node, or the render
 * threw and produced an empty tree, the witness check fails FIRST and says
 * so — instead of the sentinel check passing by testing nothing.
 */

import { expect } from 'vitest'
import { userFacingSurface } from './userFacingSurface'

/**
 * Build a distinctive sentinel that still *looks* like a real wire id, so a
 * component cannot accidentally pass by rejecting malformed input.
 *
 * `prefix` should match the real id convention for the field under test
 * (`opt`, `factor`, `node`, `edge`), keeping the fixture representative of
 * production data.
 */
export function idSentinel(prefix: string): string {
  return `${prefix}_zqxsentinel7w`
}

export interface SentinelProbeOptions {
  /** The rendered root to inspect. */
  element: HTMLElement
  /** The value planted in the field that must NOT be rendered as text. */
  sentinel: string
  /**
   * A string that MUST appear in the extracted surface. Proves the probe can
   * see rendered text at all. Use a sibling value the component is *supposed*
   * to render (narrative prose, a resolved label) — never a constant heading,
   * which can survive an otherwise-empty render.
   */
  witness: string
  /** Human name of the allowlist entry under test, quoted on failure. */
  claim: string
  /** Also sweep title/alt/placeholder and non-label aria-* attributes. */
  includeExtendedAttributes?: boolean
}

/**
 * Assert `sentinel` does not appear in the element's user-facing surface,
 * having first proven the surface contains `witness`.
 */
export function expectSentinelNotRendered(options: SentinelProbeOptions): void {
  const {
    element,
    sentinel,
    witness,
    claim,
    includeExtendedAttributes = true,
  } = options

  const surface = userFacingSurface(element, { includeExtendedAttributes })

  // ── Positive control, first and unconditionally. ──
  expect(
    surface,
    `POSITIVE CONTROL FAILED for "${claim}": the probe's witness string ` +
      `"${witness}" is absent from the rendered user-facing surface, so the ` +
      `sentinel assertion below would prove nothing. The component did not ` +
      `render, or the surface was extracted from the wrong node. ` +
      `Extracted surface was: ${JSON.stringify(surface.slice(0, 400))}`,
  ).toContain(witness)

  // ── The actual claim. ──
  expect(
    surface,
    `CEE allowlist rendering claim VIOLATED — "${claim}".\n` +
      `The wire identifier "${sentinel}" reached the user-facing surface ` +
      `(visible text or an aria label). CEE's field-coverage allowlist ` +
      `asserts this field is a machine reference that is never rendered as ` +
      `text; users must see a human label, not a raw id.\n` +
      `Extracted surface was: ${JSON.stringify(surface.slice(0, 400))}`,
  ).not.toContain(sentinel)
}

/**
 * Inverse of `expectSentinelNotRendered`, used only by the harness's own
 * self-test: proves the mechanism can DETECT a leak, so a green harness
 * means "no leak found" rather than "probe never fired".
 */
export function expectSentinelIsRendered(options: SentinelProbeOptions): void {
  const { element, sentinel, includeExtendedAttributes = true } = options
  const surface = userFacingSurface(element, { includeExtendedAttributes })
  expect(
    surface,
    `harness self-test failed: sentinel "${sentinel}" was expected to be ` +
      `visible in the user-facing surface but was not found. The leak ` +
      `detector cannot see a known-present value, so every absence ` +
      `assertion it makes is vacuous.`,
  ).toContain(sentinel)
}
