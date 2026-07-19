/**
 * `artefactIframeTemplate.ts` ⇄ `brand.css` token-mirror guard.
 *
 * THE DEFECT THIS EXISTS FOR: `--text-light` is declared TWICE in this repo.
 * Once in `src/styles/brand.css`, and once — easy to miss — inlined into the
 * `:root` of the artefact iframe template. The retint that made `--text-light`
 * WCAG-legal had to touch both; had it touched only `brand.css`, artefact
 * content would have kept rendering the failing colour and the two copies
 * would have disagreed silently, because NOTHING compared them.
 *
 * WHY THE COPY CANNOT SIMPLY BE DELETED. The artefact iframe is a separate
 * document served under `default-src 'none'; style-src 'unsafe-inline'`. CSS
 * custom properties do not cross a document boundary, so the iframe cannot
 * inherit `:root` from the parent — the tokens genuinely have to be restated
 * inside the template. Deriving them at runtime would mean turning a static
 * string constant into a DOM-dependent function that yields empty strings
 * wherever there is no live document (tests, SSR, pre-paint), which trades a
 * visible drift for an invisible one.
 *
 * So the copy stays, and THIS is what makes it safe: the mirror is checked
 * rather than trusted. Both sides are PARSED — the template's `:root` block
 * and `brand.css`'s declarations — so nothing here is a hand-typed expectation
 * that can rot alongside the thing it describes (trap 12: the hand-maintained
 * mirror is this repo's dominant defect class, and a second copy of the
 * palette is precisely that shape).
 *
 * The pin is EXACT and BIDIRECTIONAL: a NEW divergence fails, and repairing a
 * pinned one fails too, so the list cannot quietly outlive the drift it
 * records.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BRAND_CSS_PATH = join(__dirname, '../../src/styles/brand.css')
const TEMPLATE_PATH = join(__dirname, '../../src/components/chat/artefactIframeTemplate.ts')

const brandCss = readFileSync(BRAND_CSS_PATH, 'utf-8')
const template = readFileSync(TEMPLATE_PATH, 'utf-8')

/** The literal hex tokens the iframe template inlines into its own :root. */
function templateTokens(): Array<[string, string]> {
  const block = template.match(/:root\s*\{([\s\S]*?)\}/)
  if (!block) throw new Error('could not find the :root block in artefactIframeTemplate.ts')
  return [...block[1].matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/g)].map((m) => [m[1], m[2]])
}

/**
 * Declared value of a `--token` at :root in brand.css, or null if it does not
 * resolve to a literal hex.
 *
 * Resolves `var(--other)` indirection, because brand.css deliberately declares
 * some tokens as ALIASES rather than copies — `--primary: var(--info)` is the
 * whole point of D1 ("one value that cannot drift"). Comparing only literal
 * hexes would report every alias as UNCOMPARABLE, which is how this guard
 * would go blind on exactly the tokens that were made safe. Depth-limited so a
 * malformed cycle cannot hang the suite.
 */
function declared(token: string, depth = 0): string | null {
  if (depth > 8) return null
  const literal = brandCss.match(new RegExp(`^\\s*${token}:\\s*(#[0-9A-Fa-f]{3,8})\\s*;`, 'm'))
  if (literal) return literal[1].toUpperCase()
  const alias = brandCss.match(new RegExp(`^\\s*${token}:\\s*var\\((--[a-z0-9-]+)\\)\\s*;`, 'm'))
  return alias ? declared(alias[1], depth + 1) : null
}

/**
 * Tokens whose iframe value ALREADY disagreed with brand.css before this guard
 * existed. Pinned, not fixed — each is a colour decision, not a typo, and this
 * guard's job is to surface them, not to rule on them.
 *
 * `--primary|#2B7FA2` was the sole entry, and it is now REPAIRED and removed.
 * This guard's own note predicted it: the template had been moved to #2B7FA2
 * ahead of brand.css, and #2B7FA2 measures 4.47:1 on `--bg-panel` #FEFEFE, so
 * it did NOT clear SC 1.4.3 on the surface it is painted on — it only cleared
 * against pure #FFFFFF (4.51:1). That prediction was correct, and the colour
 * decision it deferred to has now been made: `--info` (and therefore
 * `--primary`, which aliases it) is #277A9D, and the template was swept to
 * match. Both sides now agree, so the exact bidirectional pin required this
 * entry to come off — working as designed.
 *
 * The list is deliberately left EMPTY rather than deleted: an empty exact pin
 * still fails the moment a NEW divergence appears, which is the property that
 * matters. Do not relax it to additions-only.
 *
 * Format: `--token|#IFRAME_VALUE`.
 */
const KNOWN_TEMPLATE_TOKEN_DRIFT: string[] = []

describe('artefact iframe template mirrors brand.css', () => {
  it('the parser can SEE the tokens it is asserting about (positive control)', () => {
    // Without this, "no divergence" could mean "parsed nothing" (trap 13: an
    // absence assertion must first prove it can see a presence).
    const tokens = templateTokens()
    expect(tokens.length, `parsed ${tokens.length} tokens from the template :root (was 15)`)
      .toBeGreaterThanOrEqual(12)

    // It must find the token this guard was born for, on BOTH sides.
    const names = tokens.map(([n]) => n)
    expect(names).toContain('--text-light')
    expect(declared('--text-light')).not.toBeNull()

    // And it must be able to detect a divergence at all — assert against a
    // value brand.css definitely does not hold.
    expect(declared('--text-light')).not.toBe('#DEADBE')
  })

  it('every token the template restates matches brand.css', () => {
    const found: string[] = []
    const unknownInBrand: string[] = []

    for (const [token, value] of templateTokens()) {
      const brandValue = declared(token)
      if (brandValue === null) {
        unknownInBrand.push(`${token} (template: ${value})`)
        continue
      }
      if (brandValue !== value.toUpperCase()) found.push(`${token}|${value.toUpperCase()}`)
    }
    found.sort()

    // A token the template invents, or one brand.css stopped declaring as a
    // literal, is reported rather than silently skipped — a skipped comparison
    // is how a mirror goes blind.
    expect(
      unknownInBrand,
      `the template restates ${unknownInBrand.length} token(s) that brand.css does not ` +
        `declare as a literal hex, so they cannot be compared:\n  ${unknownInBrand.join('\n  ')}`,
    ).toEqual([])

    const added = found.filter((f) => !KNOWN_TEMPLATE_TOKEN_DRIFT.includes(f))
    const fixed = KNOWN_TEMPLATE_TOKEN_DRIFT.filter((k) => !found.includes(k))
    expect(
      found,
      added.length
        ? `NEW token drift between artefactIframeTemplate.ts and brand.css: ${added.join(', ')} — ` +
            `the iframe cannot inherit :root across a document boundary, so this copy is ` +
            `load-bearing. Update the template to match brand.css.`
        : `${fixed.join(', ')} no longer diverge — remove them from ` +
            'KNOWN_TEMPLATE_TOKEN_DRIFT so the pin keeps matching reality.',
    ).toEqual(KNOWN_TEMPLATE_TOKEN_DRIFT)
  })

  it('--text-light specifically agrees across both declarations', () => {
    // Called out on its own, above and beyond the sweep above, because this is
    // the token whose divergence would silently reintroduce a WCAG failure
    // into artefact content — a text-legibility defect, not a brand nit.
    const [, templateValue] = templateTokens().find(([n]) => n === '--text-light')!
    expect(
      templateValue.toUpperCase(),
      'the artefact iframe inlines its own --text-light. If it drifts from brand.css, ' +
        'artefact body copy silently renders in a colour that may fail SC 1.4.3 while ' +
        'the rest of the product is compliant.',
    ).toBe(declared('--text-light'))
  })
})
