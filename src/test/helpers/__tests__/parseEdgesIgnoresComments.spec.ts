/**
 * THE WALKER MUST READ CODE AND NOT PROSE — and the pair below is what proves
 * it, because either assertion alone is satisfiable by a broken stripper.
 *
 * A stripper that removes everything makes the comment case pass and blinds the
 * walker to the 857 real dynamic imports in this tree. A stripper that removes
 * nothing makes the code case pass and is the defect. Only the PAIR
 * discriminates, and they fail on DIFFERENT assertions.
 *
 * ── What this cost ───────────────────────────────────────────────────────────
 * `lib/staleBuildRecovery.ts:222` documents what React.lazy waits for with the
 * prose line `` `import('../routes/CanvasMVP')` ``. The walker matched it, and
 * that one comment pulled the whole canvas route into the Reasoning tab's copy
 * scope: 15 failing assertions in `noWinnerVocabulary.spec.ts`, including the
 * CONTRAST CONTROL written to prove the walk is not "everything under results/".
 * It fired on a PR that changed one import specifier and no copy at all.
 */

import { describe, it, expect } from 'vitest'

import { parseEdges, stripCommentsPreservingStrings } from '../reasoningTabCopyScope'

const specs = (src: string): string[] => parseEdges(src).map((e) => e.spec)

describe('parseEdges reads code, not comments', () => {
  it('FOLLOWS a real dynamic import', () => {
    expect(specs(`const C = React.lazy(() => import('../routes/CanvasMVP'))`)).toContain(
      '../routes/CanvasMVP',
    )
  })

  it('IGNORES the same import written as prose in a block comment', () => {
    // Byte-for-byte the shape that actually shipped.
    const src = [
      '/**',
      " * `import('../routes/CanvasMVP')`: React.lazy waits for the ENTIRE STATIC MODULE",
      ' */',
      "export const X = 1",
    ].join('\n')
    expect(specs(src)).not.toContain('../routes/CanvasMVP')
    expect(specs(src)).toEqual([])
  })

  it('IGNORES a static import written in a line comment', () => {
    expect(specs("// import { A } from '../ghost'\nexport const Y = 2")).toEqual([])
  })

  it('FOLLOWS a static import that sits directly beneath a comment', () => {
    // The stripper keeps newlines from block comments precisely so the
    // line-anchored arm of the edge regex still matches the line below one.
    const src = ["/* a block", "   comment */", "import { A } from '../real'"].join('\n')
    expect(specs(src)).toContain('../real')
  })

  it('PRESERVES a string containing a comment opener', () => {
    // A naive regex stripper eats from `//` to end of line and destroys this.
    expect(stripCommentsPreservingStrings(`const u = 'https://example.com/x'`)).toBe(
      `const u = 'https://example.com/x'`,
    )
    expect(specs(`import { A } from 'https://example.com/a.js'`)).toContain(
      'https://example.com/a.js',
    )
  })

  it('PRESERVES a block-comment opener inside a string', () => {
    expect(stripCommentsPreservingStrings(`const s = "/* not a comment */"`)).toBe(
      `const s = "/* not a comment */"`,
    )
  })

  it('does not let an apostrophe inside a comment open a phantom string', () => {
    // `it's` in prose used to be a real hazard for line-oriented strippers:
    // the unmatched quote swallows the code that follows.
    const src = ["// it's fine", "import { A } from '../after-apostrophe'"].join('\n')
    expect(specs(src)).toContain('../after-apostrophe')
  })

  it('handles an escaped quote inside a string without losing the next edge', () => {
    const src = [String.raw`const s = 'a\'b'`, "import { A } from '../after-escape'"].join('\n')
    expect(specs(src)).toContain('../after-escape')
  })

  /**
   * ⭐⭐ THE REGEX-PLUS-LIVE-TAIL CONTROL — the case that shipped broken.
   *
   * The first stripper did not track regex literals and I called the gap exotic
   * in its own docblock. An independent review found the ordinary case: a URL
   * regex ENDS in `\\/` `\\/` `/`, so the scanner saw `//`, read a line comment,
   * and dropped the live import after it. Proven by execution BEFORE the fix —
   * `parseEdges` returned `[]` and the strip returned `const url = /^https?:\\/\\`.
   *
   * ⛔ AND THE DIRECTION I CLAIMED WAS SAFE IS THE DANGEROUS ONE. A dropped edge
   * shrinks the closure SILENTLY: `length > 40`, the historically-swept list and
   * the copy-count floor all still pass while a whole subtree goes unswept,
   * because every one of them measures the corpus in aggregate.
   */
  it('PRESERVES the live tail after a URL regex — the exact witness', () => {
    const src = String.raw`const url = /^https?:\/\//; const detector = 'Failed to fetch dynamically imported module'`
    // Pre-fix this returned `const url = /^https?:\/\` and everything after the
    // regex was gone. The singleton guard reads whole-file `.includes`, so a
    // second detector declared on such a tail became invisible to it.
    expect(stripCommentsPreservingStrings(src)).toContain(
      'Failed to fetch dynamically imported module',
    )
    expect(stripCommentsPreservingStrings(src)).toContain(String.raw`/^https?:\/\//`)
  })

  it('FOLLOWS an import on the line after a URL regex', () => {
    const src = [
      String.raw`const url = /^https?:\/\//`,
      "import { A } from '../real-tail'",
    ].join('\n')
    expect(specs(src)).toContain('../real-tail')
  })

  it('⚠ NAMED LIMIT: a MID-LINE import is not an edge, and that is parseEdges, not the stripper', () => {
    // Stated so the next reader does not mistake it for this fix failing. The
    // edge regex is line-anchored (`(?:^|\n)\s*(?:import|export)`) and always
    // has been; the stripper hands it the whole line either way.
    const src = String.raw`const url = /^https?:\/\//; import { A } from '../mid-line'`
    expect(stripCommentsPreservingStrings(src)).toContain('../mid-line')
    expect(specs(src)).toEqual([])
  })

  it('CONTRAST: a real line comment after a regex is STILL stripped', () => {
    // Without this the fix could pass by never stripping anything again.
    const src = [
      String.raw`const url = /^https?:\/\//  // a genuine trailing comment`,
      "import { A } from '../after-regex-comment'",
    ].join('\n')
    expect(specs(src)).toContain('../after-regex-comment')
    expect(stripCommentsPreservingStrings(src)).not.toContain('genuine trailing comment')
  })

  it('DIVISION is not mistaken for a regex opener', () => {
    // The other half of the lexer ambiguity. If `a / b` were read as a regex it
    // would consume to the next slash and could swallow real code.
    const src = ["const ratio = total / count // done", "import { A } from '../after-division'"].join('\n')
    expect(specs(src)).toContain('../after-division')
    expect(stripCommentsPreservingStrings(src)).toContain('total / count')
    expect(stripCommentsPreservingStrings(src)).not.toContain('done')
  })

  it('a slash inside a regex CHARACTER CLASS does not close it', () => {
    const src = ["const weird = /[/]/", "import { A } from '../after-class'"].join('\n')
    expect(specs(src)).toContain('../after-class')
  })

  it('a regex after `return` is a regex, not division', () => {
    const src = ["function f(s) { return /a\\/b/.test(s) }", "import { A } from '../after-return'"].join('\n')
    expect(specs(src)).toContain('../after-return')
  })
})
