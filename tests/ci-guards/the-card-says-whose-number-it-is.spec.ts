/**
 * ⭐⭐ WHO SUPPLIED THE NUMBER IS SAID IN WORDS, NOT ONLY IN A PICTURE.
 *
 * The card anatomy's second question is "what does the model record, AND WHO PUT
 * IT THERE", and every design board draws the second half as a visible line
 * beneath the value.
 *
 * Shipped answered it with a 14px icon: `NodeProvenanceMark` renders
 * `<span role="img" aria-label={label}><Icon aria-hidden/></span>` inside a
 * tooltip, with NO TEXT NODE, in the header row. So the words existed only on
 * hover and in the accessibility tree — a screen-reader user was told whose
 * number it was and a sighted reader was not, and on touch there is no hover at
 * all. Same asymmetry as the bare-number option badge, one question over.
 *
 * ⚠ THIS GUARD PINS A PRESENCE, so its risk is the mirror of an absence guard: it
 * could pass on prose. Asserted over comment-stripped code, with the stripper's
 * own controls, because this file's header names every symbol it checks for.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VALUE_PROVENANCE_LABEL } from '../../src/canvas/domain/valueProvenance'

const ROOT = join(__dirname, '..', '..')
const FACTOR = join(ROOT, 'src', 'canvas', 'nodes', 'FactorNode.tsx')

function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter(l => l.trim().length > 0)
    .join('\n')
}

const src = readFileSync(FACTOR, 'utf8')
const code = codeOnly(src)

describe('controls', () => {
  it('POSITIVE CONTROL: the stripper removes prose naming the testid', () => {
    expect(codeOnly('/* factor-value-basis */\nconst a=1\n').includes('factor-value-basis')).toBe(false)
    expect(codeOnly('const a=1 // factor-value-basis\n').includes('factor-value-basis')).toBe(false)
    expect(codeOnly('<p data-testid="factor-value-basis" />\n')).toContain('factor-value-basis')
  })
  it('POSITIVE CONTROL: the file was read and the value render exists', () => {
    expect(src.length).toBeGreaterThan(10_000)
    expect(code, 'the value render was not found — this guard is reading the wrong shape').toContain('collapseEstimateDisplay(valueDisplay)')
  })
})

describe('the factor card says whose number it is', () => {
  it('⭐ a visible basis caption is rendered, in code', () => {
    expect(
      code,
      'the factor card no longer states the value\'s origin in words. The provenance glyph carries it only on hover and in the accessibility tree, so a sighted reader — and every touch user — is told less than a screen-reader user.',
    ).toContain('data-testid="factor-value-basis"')
    // ⚠ BOUND TO THE CAPTION ELEMENT, NOT THE FILE. The identical expression
    // renders in the POPOVER a few hundred lines up, so a file-wide match would
    // stay green while someone inlined a literal here — my own mutant kit caught
    // exactly that. An anchor that is not unique is not a binding (trap 19).
    const basisAt = code.indexOf('data-testid="factor-value-basis"')
    const element = code.slice(basisAt, basisAt + 260)
    expect(
      element,
      'the basis caption does not render the shared provenance vocabulary — a literal here lets the card face and the popover drift into two spellings of one fact',
    ).toMatch(/VALUE_PROVENANCE_LABEL\[currentValueOrigin\.kind\]/)
  })

  it('it sits BELOW the value, which is where the anatomy puts it', () => {
    const valueAt = code.indexOf('collapseEstimateDisplay(valueDisplay)')
    const basisAt = code.indexOf('data-testid="factor-value-basis"')
    expect(valueAt).toBeGreaterThan(-1)
    expect(basisAt).toBeGreaterThan(-1)
    expect(
      basisAt,
      'the basis caption renders before the value — the anatomy is value first, then the line beneath saying where it came from',
    ).toBeGreaterThan(valueAt)
  })

  it('it is withheld when the origin is unknown — never guessed', () => {
    // A card that captions every value would have to invent a provenance for the
    // ones it does not know. The render is gated on a non-null origin.
    expect(code).toMatch(/valueDisplay !== null && currentValueOrigin != null &&/)
  })

  it('`est.` is kept — origin and basis are two facts', () => {
    // The design rules that they stay two facts: `est.` says the number is an
    // estimate rather than a measurement; the caption says who supplied it. A
    // `brief` value carries the second without the first.
    expect(code).toContain('<EstimateMarker />')
  })

  it('the vocabulary is shared, not re-minted here', () => {
    // If someone inlines literals instead, the popover and the card face can
    // drift into two spellings of one fact.
    expect(Object.keys(VALUE_PROVENANCE_LABEL).length).toBeGreaterThanOrEqual(5)
    for (const word of Object.values(VALUE_PROVENANCE_LABEL)) {
      expect(code, `the literal "${word}" is inlined in FactorNode — it belongs to VALUE_PROVENANCE_LABEL`).not.toContain(`"${word}"`)
    }
  })
})
