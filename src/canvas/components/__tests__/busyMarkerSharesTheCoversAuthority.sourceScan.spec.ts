/**
 * The Reasoning tab's busy MARKER and its in-flight COVER read ONE authority.
 *
 * ── WHY THIS GUARD EXISTS ──────────────────────────────────────────────────
 * The first cut of the marker passed the dock's LOCAL `isRunning`, while
 * `AnalysisRunStateCover` — mounted eight lines above it, on the same tab —
 * read the COMPOSED `localRunning || wireRunning`. Review demonstrated the
 * divergence by execution: on a wire-asserted run, `cover=present`,
 * `isRunning_prop=false`, `aria-busy=null`. The user was TOLD a run had started
 * and the content was NOT marked — which is the exact surface #1201 exists to
 * stop this tab being.
 *
 * `AnalysisNewTabBody`'s own spec can pin what the component does with the prop
 * it is handed. It cannot see which value the DOCK hands it, and that is where
 * the defect lived. So the binding is asserted here, at the mount, by requiring
 * the two props to be the SAME EXPRESSION rather than merely both present —
 * `isBusy={isRunning}` would satisfy "present" and reinstate the defect.
 *
 * ⚠ THE CONTRAST CONTROL IS NOT OPTIONAL. A scan that extracts nothing agrees
 * with every claim made about what it extracted. The control asserts the
 * extractor actually recovered a non-empty expression for the cover, so a blind
 * scan fails there first and says so.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const DOCK = join(process.cwd(), 'src/canvas/components/OutputsDock.tsx')

/** The JSX element's own span, quote- and brace-aware so a `>` inside an
 *  expression does not end the tag early. Comments are stripped first, so a
 *  prop named only in prose cannot satisfy anything asserted here. */
function elementSpan(src: string, name: string): string {
  const m = new RegExp(`<${name}[\\s/>]`).exec(src)
  if (!m) return ''
  let i = m.index + m[0].length - 1
  let brace = 0
  let quote: string | null = null
  for (; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === quote && src[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue }
    if (c === '{') { brace++; continue }
    if (c === '}') { brace--; continue }
    if (c === '>' && brace === 0) break
  }
  return src.slice(m.index, i + 1)
}

/** The expression a prop is given, with whitespace collapsed. */
function propExpression(span: string, prop: string): string | null {
  const at = span.indexOf(`${prop}={`)
  if (at === -1) return null
  let i = at + prop.length + 2
  let depth = 1
  const start = i
  for (; i < span.length && depth > 0; i++) {
    if (span[i] === '{') depth++
    else if (span[i] === '}') depth--
  }
  return span.slice(start, i - 1).replace(/\s+/g, ' ').trim()
}

describe('the busy marker reads the same authority as the in-flight cover', () => {
  const src = stripComments(readFileSync(DOCK, 'utf8'), DOCK)
  const coverSpan = elementSpan(src, 'AnalysisRunStateCover')
  const bodySpan = elementSpan(src, 'AnalysisNewTabBody')

  it('CONTROL: the scan recovers a non-empty expression for the cover', () => {
    expect(coverSpan, 'no AnalysisRunStateCover mount found — the scan is blind').not.toBe('')
    expect(
      propExpression(coverSpan, 'isRunning'),
      'the cover mount has no isRunning expression, or the extractor is broken',
    ).toBeTruthy()
  })

  it('CONTROL: the scan recovers a non-empty expression for the body', () => {
    expect(bodySpan, 'no AnalysisNewTabBody mount found — the scan is blind').not.toBe('')
  })

  it('hands the marker the cover’s own expression, not merely some expression', () => {
    const cover = propExpression(coverSpan, 'isRunning')
    const busy = propExpression(bodySpan, 'isBusy')
    expect(
      busy,
      'AnalysisNewTabBody has no isBusy — the marker falls back to the dock’s local flag and goes blind to a wire-asserted run',
    ).toBeTruthy()
    expect(
      busy,
      `the marker and the cover must read ONE authority.\n  cover isRunning = ${cover}\n  body  isBusy    = ${busy}`,
    ).toBe(cover)
  })
})
