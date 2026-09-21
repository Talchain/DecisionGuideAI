/**
 * Links and italics in the restricted renderer.
 *
 * ⚠ WHY THESE TWO, AND WHY NOW. Measured on 21 Sep 2026 by running real
 * strings through `safeRichText`: `*important*` rendered as `*important*` and
 * `[the model](https://…)` rendered as its raw markdown. Neither is currently
 * emitted by CEE, so nothing was visibly broken — but raw `[text](url)` on
 * screen is the worst-looking failure this renderer can produce, and it would
 * appear the first time a producer sent one.
 *
 * ⚠ THE LINK TESTS BELOW ARE THE SECURITY BOUNDARY, not a formatting nicety.
 * `<a>` is now on the allowlist, so the scheme check is the thing standing
 * between producer text and an executable URL. Every rejection case here is
 * load-bearing, and each asserts the FAIL-CLOSED output (literal markdown),
 * not merely "no anchor" — a renderer that silently dropped the text would
 * also pass a weaker assertion while losing content.
 */
import { describe, it, expect } from 'vitest'
import { safeRichText } from '../safeRichText'

describe('links — accepted schemes', () => {
  it('renders an https link with target and rel', () => {
    const out = safeRichText('See [the model](https://example.com/x) now')
    expect(out).toContain('<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">the model</a>')
  })

  it('renders http and mailto', () => {
    expect(safeRichText('[a](http://example.com)')).toContain('<a href="http://example.com"')
    expect(safeRichText('[b](mailto:paul@example.com)')).toContain('<a href="mailto:paul@example.com"')
  })

  it('renders two links on one line', () => {
    const out = safeRichText('[a](https://a.com) and [b](https://b.com)')
    expect(out.match(/<a /g) ?? []).toHaveLength(2)
  })
})

describe('links — rejected schemes fail CLOSED to literal markdown', () => {
  const hostile = [
    ['javascript', '[x](javascript:alert(1))'],
    ['data uri', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
    ['vbscript', '[x](vbscript:msgbox)'],
    ['scheme-relative', '[x](//evil.com)'],
    ['bare word', '[x](evil)'],
    ['entity-obfuscated', '[x](&#x6a;avascript:alert(1))'],
  ] as const

  for (const [name, input] of hostile) {
    it(`rejects ${name}`, () => {
      const out = safeRichText(input)
      expect(out).not.toContain('<a ')
      // Fail CLOSED means the text survives as markdown, not that it vanishes.
      expect(out).toContain('[x]')
    })
  }

  /**
   * Positive control: the rejection assertions are not vacuous. The same
   * shape with a safe scheme DOES produce an anchor, so `not.toContain('<a ')`
   * is discriminating rather than always-true.
   */
  it('positive control — the same shape with https DOES link', () => {
    expect(safeRichText('[x](https://ok.com)')).toContain('<a ')
  })
})

describe('links are protected from the other transforms', () => {
  /**
   * The reason links are lifted into placeholders. Without it the numeric
   * rule rewrites digits inside the href.
   */
  it('does not inject a <span> into a URL containing digits', () => {
    const out = safeRichText('[x](https://example.com/123)')
    expect(out).toContain('href="https://example.com/123"')
    expect(out).not.toContain('href="https://example.com/<span')
  })

  it('does not italicise inside a URL containing asterisks', () => {
    const out = safeRichText('[x](https://example.com/a*b*c)')
    expect(out).toContain('href="https://example.com/a*b*c"')
    expect(out).not.toContain('<em>')
  })
})

describe('italics', () => {
  it('renders *text* as <em>', () => {
    expect(safeRichText('This is *important* here')).toContain('<em>important</em>')
  })

  it('leaves **bold** alone — bold is consumed first', () => {
    const out = safeRichText('This is **important** here')
    expect(out).toContain('<strong>important</strong>')
    expect(out).not.toContain('<em>')
  })

  it('does not italicise spaced arithmetic', () => {
    expect(safeRichText('2 * 3 * 4')).not.toContain('<em>')
  })

  /**
   * The underscore rule is deliberately absent. This product prints producer
   * field names in prose; an `_text_` rule would shred them.
   */
  it('leaves snake_case field names untouched', () => {
    for (const id of ['goal_threshold_unit', 'probability_of_joint_goal', 'opt_raise_59']) {
      const out = safeRichText(`Set ${id} now`)
      expect(out, `${id} was italicised`).not.toContain('<em>')
      // Verbatim, digits included: the numeric rule's lookbehind already
      // excludes a digit preceded by an identifier character, which is why
      // `opt_raise_59` keeps its 59 rather than gaining a <span>. Asserting
      // the whole identifier survives intact covers both rules at once.
      expect(out, `${id} was rewritten`).toContain(id)
    }
  })

  /**
   * Positive control for the pair above: the <em> assertion can fail, and the
   * numeric rule IS live on a standalone number in the same sentence shape.
   */
  it('positive control — italics and the numeric rule both still fire here', () => {
    const out = safeRichText('Set *this* to 59 now')
    expect(out).toContain('<em>this</em>')
    expect(out).toContain('<span class="md-number">59</span>')
  })
})

describe('the escaping boundary still holds', () => {
  it('still escapes a raw script tag', () => {
    expect(safeRichText('<script>alert(1)</script>')).not.toContain('<script')
  })

  it('a producer-supplied anchor is NOT honoured as markup', () => {
    const out = safeRichText('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:alert(1)">')
  })
})
