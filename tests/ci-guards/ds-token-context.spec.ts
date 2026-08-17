// tests/ci-guards/ds-token-context.spec.ts
//
// Unit spec for tools/ci-guards/lib/ds-token-context.mjs — the two pure functions
// that decide WHERE a `#hex` token sits and WHAT it is.
//
// WHY THIS SPEC EXISTS AT ALL. The DS guard's `production-hex` class was left
// REPORT-ONLY for a month because its comment stripper was a per-line prefix test
// and produced 65 false positives (PR references such as `#739` in comment prose)
// in the July soak. While it was advisory, NO Design System rule gated anything.
// The prefix test is now a state machine and the ambiguous `#NNN` shape is settled
// by position — and both halves are pinned here so the next reader cannot
// "simplify" the state machine back into a prefix test without a red.
//
// The corpus below is drawn from REAL staging source at 289b730d, file:line named
// per case, not from the author's imagination — the two false-positive classes and
// the five live colour literals are all quoted verbatim.
import { describe, it, expect } from 'vitest'
import {
  stripComments,
  isColourValuePosition,
  isAmbiguousNumericHex,
} from '../../tools/ci-guards/lib/ds-token-context.mjs'

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g

/**
 * The guard's `production-hex` detector, reduced to the two functions under test.
 * Kept here rather than imported so this spec pins the CONTRACT the guard relies
 * on; the guard-level behaviour is covered by check-ds-compliance.spec.ts.
 */
function detect(source: string): string[] {
  const out: string[] = []
  for (const code of stripComments(source)) {
    let m: RegExpExecArray | null
    HEX.lastIndex = 0
    while ((m = HEX.exec(code)) !== null) {
      if (/var\(--[\w-]+,\s*$/.test(code.slice(0, m.index))) continue
      if (isAmbiguousNumericHex(m[0]) && !isColourValuePosition(code, m.index)) continue
      out.push(m[0])
    }
  }
  return out
}

describe('stripComments — block-comment state, not a line prefix', () => {
  it('preserves the line count exactly, so line indices stay shared with the raw source', () => {
    for (const src of ['a', 'a\n', 'a\nb', 'a\nb\n', '', '\n', '/* x\ny */\nz']) {
      expect(stripComments(src).length).toBe(src.split('\n').length)
    }
  })

  it('preserves column offsets (blanks, never deletes) so var(--t, #hex) slices still align', () => {
    const src = 'const a = 1 /* note */ + 2'
    const [line] = stripComments(src)
    expect(line.length).toBe(src.length)
    expect(line.startsWith('const a = 1 ')).toBe(true)
    expect(line).not.toMatch(/note/)
  })

  it('blanks a CONTINUATION line of a block comment — the 13-of-16 false-positive class', () => {
    // src/v5/blocks/V5EvidenceBlock.tsx:60 — the continuation line starts with
    // PROSE, so `line.trimStart().startsWith('*')` never fired on it.
    const src = [
      '/**',
      ' * Header line.',
      'THE UNCERTAINTY CHANNEL — #670 mechanism, consumed through the shared',
      ' */',
      "const c = '#abcdef'",
    ].join('\n')
    expect(detect(src)).toEqual(['#abcdef'])
  })

  it('blanks a JSX {/* … */} block across lines', () => {
    // src/canvas/components/OutputsDock.tsx:2377 shape.
    const src = ['{/* Analysis freshness is owned by the', 'versions lane, #739). The trigger carries NO', '*/}'].join('\n')
    expect(detect(src)).toEqual([])
  })

  it('does NOT treat // inside a string literal as a comment', () => {
    const src = "const u = 'https://example.com/x'\nconst c = '#123456'"
    expect(detect(src)).toEqual(['#123456'])
  })

  it('does NOT treat /* inside a string literal as opening a comment', () => {
    const src = ["const g = 'a/*b'", "const c = '#abcdef'"].join('\n')
    expect(detect(src)).toEqual(['#abcdef'])
  })

  it('keeps a template literal open across lines, and closes ordinary strings at the newline', () => {
    const src = ['const t = `line one', 'line two`', "const c = '#654321'"].join('\n')
    expect(detect(src)).toEqual(['#654321'])
  })

  it('still strips a TRAILING line comment on a line of live code', () => {
    expect(detect("const c = '#abcdef' // was #fedcba")).toEqual(['#abcdef'])
  })

  it('handles an escaped quote without falling out of the string', () => {
    const src = ["const s = 'it\\'s fine' // #333", "const c = '#000'"].join('\n')
    expect(detect(src)).toEqual(['#000'])
  })
})

describe('isAmbiguousNumericHex — only the shape that collides with issue refs', () => {
  it('is true for the 3-char all-digit shape', () => {
    for (const t of ['#000', '#900', '#457', '#739']) expect(isAmbiguousNumericHex(t)).toBe(true)
  })

  it('is false when a hex LETTER is present, or when the token is 6 chars', () => {
    for (const t of ['#fee', '#abc', '#0a0', '#abcdef', '#123456']) {
      expect(isAmbiguousNumericHex(t)).toBe(false)
    }
  })
})

describe('isColourValuePosition — value slot vs mid-prose', () => {
  it('accepts the start of a value slot', () => {
    for (const line of ["x: '#000'", 'x:#000', 'a(#000', 'a=#000', 'a,#000', '[#000', '{#000', '#000']) {
      expect(isColourValuePosition(line, line.indexOf('#'))).toBe(true)
    }
  })

  it('rejects mid-prose, including after a full stop and after a word', () => {
    for (const line of ['see #457 root cause', 'the hole #506 measured', 'threshold. #457 root cause']) {
      expect(isColourValuePosition(line, line.indexOf('#'))).toBe(false)
    }
  })
})

describe('the discriminating pair, on real staging source at 289b730d', () => {
  // POSITIVE CONTROL. These five are LIVE colour literals in shipped product
  // code and are exactly why "reject digit-only hex tokens" is the wrong fix:
  // that rule would make the guard blind to all five.
  const LIVE_COLOUR_LITERALS: ReadonlyArray<readonly [string, string, string]> = [
    ['src/components/GraphCanvas.tsx:353', "            color: mode === 'connect' ? '#fff' : '#000',", '#000'],
    ['src/components/GraphCanvas.tsx:529', "                  fill={connectFrom === node.id ? '#fff' : '#000'}", '#000'],
    ['src/lib/ErrorBoundary.tsx:42', "            color: '#900',", '#900'],
    ['src/main.tsx:124', "        <div style={{ padding: 12, background: '#fee', color: '#900',", '#900'],
    [
      'src/main.tsx:227',
      "      container.style.cssText = 'padding:12px;background:#fee;color:#900;font:13px ui-monospace,monospace';",
      '#900',
    ],
  ]

  it.each(LIVE_COLOUR_LITERALS)('KEEPS the live colour literal at %s', (_site, line, token) => {
    expect(detect(line)).toContain(token)
  })

  // CONTRAST CONTROL. Same `#NNN` shape, in prose. An absence claim needs both:
  // the positive control proves the detector still sees colours, the contrast
  // proves the drop is discrimination and not blindness.
  const PR_REFERENCES: ReadonlyArray<readonly [string, string]> = [
    ['src/canvas/domain/analyticalNodeFields.ts:121', '    note: "Written with threshold_source=\'user\'. #457 root cause when the allowlist omitted it.",'],
    ['src/canvas/domain/analyticalNodeFields.ts:156', '    note: "Live since #453 and analysis-affecting.",'],
    ['src/lib/scientificValidation/confidenceValidation.ts:131', "      ? ['No factor carries confidence_provenance — PR #170 work has not propagated yet.']"],
    ['src/lib/scientificValidation/flipThresholdValidation.ts:85', "      'flip_thresholds_status is not yet emitted by PLoT (PR #167 work in flight). ' +"],
    ['src/test/claimDrift/claimDriftWalker.ts:989', "      '# That is the hole #506 measured in the typecheck gate (37 diagnostics landed',"],
  ]

  it.each(PR_REFERENCES)('DROPS the PR reference in string prose at %s', (_site, line) => {
    expect(detect(line)).toEqual([])
  })

  it('discriminates the two on ONE line: a colour is kept where a reference is dropped', () => {
    // The single strongest case: same shape, same line, opposite verdicts. A
    // blind detector cannot produce a discrimination it is not making.
    const line = "  const bg = '#900' // see #457"
    expect(detect(line)).toEqual(['#900'])
  })
})
