/**
 * safeRichText — list rendering (PX-B, response-presentation architecture).
 *
 * DEFECT (Paul's 15 Aug testing, "broken bullets — blocks of text where lists
 * should be"), MEASURED at staging tip a3c71513 before the fix:
 *
 *   '* alpha\n* beta'   → '* alpha<br>* beta'                       (a wall)
 *   '1. alpha\n2. beta' → '<span class="md-number">1</span>. alpha<br>…' (a wall)
 *
 * Both are the markdown list forms an LLM emits most often after '- ', and
 * BOTH rendered as run-on prose with a <br> between them. The asterisk form was
 * excluded deliberately (see the bullet-marker comment in safeRichText) on the
 * grounds that '*' has an emphasis use — but the bullet predicate ALREADY
 * requires a trailing space, and neither '*italic*' nor '**bold**' has one, so
 * the exclusion was broader than the collision it was defending against.
 * Ordered lists were not handled at all.
 *
 * The guards below therefore come in PAIRS: the list form must become a list,
 * AND its emphasis twin must stay untouched. A one-directional corpus here
 * would let a fix for the wall silently eat every bold lead in the product
 * (platform trap 22b — one predicate, two opposite harms).
 */
import { describe, it, expect } from 'vitest'
import { safeRichText } from '../safeRichText'

describe('safeRichText — unordered lists', () => {
  it('renders "* item" lines as a list, not a run of text', () => {
    const result = safeRichText('* alpha\n* beta\n* gamma')
    expect(result).toBe('<ul><li>alpha</li><li>beta</li><li>gamma</li></ul>')
  })

  it('still renders "- item" lines as a list (no regression)', () => {
    expect(safeRichText('- alpha\n- beta')).toBe('<ul><li>alpha</li><li>beta</li></ul>')
  })

  // OPPOSITE-DIRECTION TWINS — the asterisk fix must not eat emphasis.
  it('does NOT treat "**bold**" as a bullet', () => {
    const result = safeRichText('**Key finding**')
    expect(result).toBe('<strong>Key finding</strong>')
    expect(result).not.toContain('<ul>')
  })

  it('does NOT treat "*italic*" as a bullet', () => {
    const result = safeRichText('*italic*')
    expect(result).not.toContain('<ul>')
    expect(result).toContain('*italic*')
  })

  it('does NOT treat a horizontal rule "***" as a bullet', () => {
    const result = safeRichText('***')
    expect(result).not.toContain('<ul>')
  })

  it('does NOT treat a bare "*" with no content as a bullet', () => {
    expect(safeRichText('*')).not.toContain('<ul>')
  })
})

describe('safeRichText — ordered lists', () => {
  it('renders "1. item" lines as an ordered list, not a run of text', () => {
    const result = safeRichText('1. alpha\n2. beta\n3. gamma')
    expect(result).toBe('<ol><li>alpha</li><li>beta</li><li>gamma</li></ol>')
  })

  it('renders "1) item" lines as an ordered list', () => {
    const result = safeRichText('1) alpha\n2) beta')
    expect(result).toBe('<ol><li>alpha</li><li>beta</li></ol>')
  })

  it('does not number-style the list marker digit', () => {
    // The pre-fix wall wrapped the marker itself: '<span class="md-number">1</span>. alpha'
    const result = safeRichText('1. alpha')
    expect(result).not.toContain('<span class="md-number">1</span>.')
  })

  it('preserves numbering that does not start at 1 (meaning, not decoration)', () => {
    // A continuation list renumbered to 1 would RESTATE the producer. Presentation
    // may demote content; it may never renumber it.
    const result = safeRichText('4. delta\n5. epsilon')
    expect(result).toBe('<ol start="4"><li>delta</li><li>epsilon</li></ol>')
  })

  it('emits no start attribute for a list that does start at 1', () => {
    expect(safeRichText('1. alpha')).toBe('<ol><li>alpha</li></ol>')
  })

  // OPPOSITE-DIRECTION TWINS — the ordered-list fix must not eat decimals,
  // versions, money or ordinary sentences that merely contain digits.
  it('does NOT treat a decimal as a list marker', () => {
    const result = safeRichText('0.5 million users churned')
    expect(result).not.toContain('<ol>')
  })

  it('does NOT treat a mid-sentence number as a list marker', () => {
    const result = safeRichText('We modelled 3 options in total.')
    expect(result).not.toContain('<ol>')
  })

  it('does NOT treat a bare number line as a list marker', () => {
    expect(safeRichText('42')).not.toContain('<ol>')
  })
})

describe('safeRichText — mixed list groups', () => {
  it('does not merge an unordered group into an ordered one', () => {
    const result = safeRichText('- alpha\n1. beta')
    expect(result).toContain('<ul><li>alpha</li></ul>')
    expect(result).toContain('<ol><li>beta</li></ol>')
  })

  it('does not merge an ordered group into an unordered one', () => {
    const result = safeRichText('1. alpha\n- beta')
    expect(result).toContain('<ol><li>alpha</li></ol>')
    expect(result).toContain('<ul><li>beta</li></ul>')
  })

  it('renders a bold lead followed by an asterisk list as header + list', () => {
    const result = safeRichText('**Key points**\n* alpha\n* beta')
    expect(result).toBe('<strong>Key points</strong><ul><li>alpha</li><li>beta</li></ul>')
  })

  it('keeps inline emphasis inside a list item', () => {
    const result = safeRichText('* **alpha** matters')
    expect(result).toBe('<ul><li><strong>alpha</strong> matters</li></ul>')
  })
})

describe('safeRichText — list output stays inside the tag allowlist', () => {
  it('emits no attributes on ol beyond a numeric start', () => {
    const result = safeRichText('7. seven')
    // Numeric-only: the start value is re-serialised from a parsed integer, so
    // no producer text can reach the attribute.
    expect(result).toMatch(/^<ol start="7">/)
    expect(result).not.toMatch(/<ol[^>]*[a-z-]+=(?!"7")/)
  })

  it('escapes HTML inside list items', () => {
    const result = safeRichText('* <script>alert(1)</script>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })
})
