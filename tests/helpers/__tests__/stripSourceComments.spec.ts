/**
 * Unit contract for the shared literal-aware comment stripper.
 *
 * WHY THIS EXISTS. `tests/helpers/stripSourceComments.ts` is imported by a growing
 * set of source-scanning CI guards (semantic-colour-alpha, plot-fetch-all-seams,
 * british-english, the analysis-hero hygiene/inertness family, the freshness and
 * templates routing guards, …) and by the brand-token colour pins via
 * channelTriple.mjs' sibling strip. Each guard carries its own positive control,
 * but none pins the stripper's OWN literal-awareness directly — so a regression in
 * the state machine (a mangled regex literal, a `//` swallowed inside a URL string)
 * could quietly weaken every guard at once. This is that missing direct pin.
 *
 * The properties asserted are exactly the ones the guards depend on:
 *   - JS `//` line and `/* … *​/` block comments are removed;
 *   - string, template and regex literals are KEPT as code (their contents, incl.
 *     comment-like sequences, survive) — so a real call site is still seen;
 *   - CSS gets block-comment stripping only (no `//` line comments);
 *   - every stripper is byte-length- and newline-preserving, so a guard's reported
 *     line/column never shifts.
 */
import { describe, it, expect } from 'vitest'
import {
  stripComments,
  stripJsComments,
  stripCssComments,
  stripHtmlComments,
  blankNonCode,
  regexCanStart,
} from '../stripSourceComments'

/** Byte-length and every newline offset are preserved by a stripper. */
function preservesLayout(strip: (s: string) => string, input: string): void {
  const out = strip(input)
  expect(out.length).toBe(input.length)
  const nl = (s: string) => [...s].map((c, i) => (c === '\n' ? i : -1)).filter(i => i >= 0)
  expect(nl(out)).toEqual(nl(input))
}

describe('stripJsComments — comments go, literals stay', () => {
  it('blanks a `//` line comment but keeps the code before it', () => {
    const out = stripJsComments('const x = 1 // secretword')
    expect(out).toContain('const x = 1')
    expect(out).not.toContain('secretword')
  })

  it('blanks a `/* … */` block comment, including multi-line', () => {
    const out = stripJsComments('a /* one\n two secretword */ b')
    expect(out).toContain('a')
    expect(out).toContain('b')
    expect(out).not.toContain('secretword')
  })

  it('keeps `//` inside a string literal (a URL is not a comment)', () => {
    const out = stripJsComments('const u = "http://example.com/x" // real comment')
    expect(out).toContain('http://example.com/x')
    expect(out).not.toContain('real comment')
  })

  it('keeps `/* */` inside a string literal', () => {
    const out = stripJsComments('const s = "/* not a comment */ keepme"')
    expect(out).toContain('/* not a comment */ keepme')
  })

  it('keeps a regex literal whole (its slashes are not comment starts)', () => {
    const out = stripJsComments('const re = /a\\/b\\/c/g // trailing')
    expect(out).toContain('/a\\/b\\/c/g')
    expect(out).not.toContain('trailing')
  })

  it('treats `/` after a value as division, and still strips the line comment', () => {
    const out = stripJsComments('const y = a / b // gone')
    expect(out).toContain('a / b')
    expect(out).not.toContain('gone')
  })

  it('keeps comment-like sequences inside a template literal', () => {
    const out = stripJsComments('const t = `pre // still /* here */ post`')
    expect(out).toContain('pre // still /* here */ post')
  })

  it('keeps code inside `${…}` interpolation while stripping a real trailing comment', () => {
    const out = stripJsComments('const t = `x ${weight / 2} y` // dropme')
    expect(out).toContain('${weight / 2}')
    expect(out).not.toContain('dropme')
  })

  it('is byte-length- and newline-preserving', () => {
    preservesLayout(stripJsComments, 'line1 // c\nline2 /* b\nb */ line3\n')
  })
})

describe('stripComments — dispatches on file extension', () => {
  it('.ts input is treated as JS (line comments stripped)', () => {
    expect(stripComments('a // b', 'x.ts')).not.toContain('b')
  })

  it('.css input is treated as CSS (no `//` line comments — they survive)', () => {
    // In CSS `//` is NOT a comment; the JS path would wrongly blank it.
    expect(stripComments('a // b', 'x.css')).toContain('// b')
  })
})

describe('stripCssComments — block comments only, literal-aware', () => {
  it('blanks a `/* … */` block, keeping the live declaration as the survivor', () => {
    const out = stripCssComments(':root {\n/* --x: 2; */\n  --x: 1;\n}')
    expect(out).toContain('--x: 1;')
    expect(out).not.toContain('--x: 2;')
  })

  it('does NOT treat `//` as a comment (CSS has no line comments)', () => {
    expect(stripCssComments('--url: "//cdn.example.com";')).toContain('//cdn.example.com')
  })

  it('keeps `/*` that lives inside a CSS string literal', () => {
    expect(stripCssComments('content: "/* literal */";')).toContain('"/* literal */"')
  })

  it('is byte-length- and newline-preserving', () => {
    preservesLayout(stripCssComments, ':root {\n  /* a\n  b */\n  --x: 1;\n}\n')
  })
})

describe('blankNonCode — comments AND string bodies blanked, quote kept', () => {
  it('blanks a string body but keeps the opening quote and surrounding code', () => {
    const out = blankNonCode('const s = "secretword" // note')
    expect(out).toContain('const s =')
    expect(out).toContain('"') // opening quote kept so the token still parses
    expect(out).not.toContain('secretword')
    expect(out).not.toContain('note')
  })

  it('is byte-length- and newline-preserving', () => {
    preservesLayout(blankNonCode, 'const s = "a\\nb" /* c */\nconst t = 1\n')
  })
})

describe('stripHtmlComments — HTML markers and script-body JS comments', () => {
  it('blanks `<!-- -->` and JS comments in <script>, keeping a URL string', () => {
    const out = stripHtmlComments(
      '<!-- htmlsecret --><script>const u = "http://y.example"// jssecret\n</script>',
    )
    expect(out).not.toContain('htmlsecret')
    expect(out).not.toContain('jssecret')
    expect(out).toContain('http://y.example')
  })
})

describe('regexCanStart — the value-vs-regex discriminator', () => {
  it('a `/` after a value char is division, not a regex open', () => {
    for (const prev of ['a', '1', ')', ']', '}', '.', "'", '"', '`']) {
      expect(regexCanStart(prev)).toBe(false)
    }
  })

  it('a `/` at file start or after an operator/opener opens a regex', () => {
    for (const prev of ['', '=', '(', ',', '[', '{', ';', ':', '!', '&', '|', '?', '+', '-', '*', '<', '>']) {
      expect(regexCanStart(prev)).toBe(true)
    }
  })
})
