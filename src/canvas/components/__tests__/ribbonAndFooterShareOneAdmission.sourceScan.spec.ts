/**
 * THE RIBBON'S RE-ANALYSE CONTROL AND THE SHELL'S FOOTER READ ONE ADMISSION.
 *
 * ── WHY THIS GUARD EXISTS ──────────────────────────────────────────────────
 * `AtAGlance` renders a re-analyse control inside the staleness ribbon on the
 * Analysis (New) surface, and `shellContract.ts` gives that same surface a
 * footer bar whose control reads the dock's `runGateResult`. The ribbon
 * control was handed a bare `handleRunAnalysis` and no gate, so once the
 * footer honours the verdict the surface can show a DISABLED footer control
 * carrying the refusal beside an ENABLED ribbon control for the same action.
 *
 * `AnalysisNewTabBody`'s own spec can pin what the component does with the
 * verdict it is handed. It cannot see WHICH value the dock hands it, and that
 * is where the defect lived — so the binding is asserted here, at the mount,
 * by requiring the SAME EXPRESSION rather than merely a present prop.
 * `canRunAnalysis={someOtherFlag}` would satisfy "present" and reinstate the
 * contradiction.
 *
 * The anchor is `AnalysisReadinessBar`, the in-file reader of the shared
 * verdict that already takes both halves of it (`canRun` + `blockedReason`)
 * off `runGateResult`. Aligning to an anchor that is itself derived is the
 * point: this asserts ONE admission with many readers, never two defaults
 * that happen to agree today (CLAUDE.md trap 21).
 *
 * ⚠ THE CONTRAST CONTROL IS NOT OPTIONAL. A scan that extracts nothing agrees
 * with every claim made about what it extracted (trap 13). The controls below
 * assert the extractor recovered non-empty expressions for the anchor FIRST,
 * so a blind scan fails there and says so instead of certifying agreement.
 *
 * Modelled on `busyMarkerSharesTheCoversAuthority.sourceScan.spec.ts`, which
 * pins the sibling binding on the same mount for the same reason.
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

describe('the ribbon re-analyse control reads the footer’s own admission', () => {
  const src = stripComments(readFileSync(DOCK, 'utf8'), DOCK)
  const barSpan = elementSpan(src, 'AnalysisReadinessBar')
  const bodySpan = elementSpan(src, 'AnalysisNewTabBody')

  it('CONTROL: the scan recovers the shared verdict off the readiness bar', () => {
    expect(barSpan, 'no AnalysisReadinessBar mount found — the scan is blind').not.toBe('')
    expect(
      propExpression(barSpan, 'canRun'),
      'the readiness bar has no canRun expression, or the extractor is broken',
    ).toBeTruthy()
    expect(
      propExpression(barSpan, 'blockedReason'),
      'the readiness bar has no blockedReason expression, or the extractor is broken',
    ).toBeTruthy()
  })

  it('CONTROL: the scan recovers a non-empty expression for the body', () => {
    expect(bodySpan, 'no AnalysisNewTabBody mount found — the scan is blind').not.toBe('')
  })

  it('hands the tab the bar’s own verdict, not merely some boolean', () => {
    const anchor = propExpression(barSpan, 'canRun')
    const mine = propExpression(bodySpan, 'canRunAnalysis')
    expect(
      mine,
      'AnalysisNewTabBody has no canRunAnalysis — the ribbon control offers a run the gate refuses',
    ).toBeTruthy()
    expect(
      mine,
      `the ribbon and the footer must read ONE admission.\n  bar  canRun         = ${anchor}\n  body canRunAnalysis = ${mine}`,
    ).toBe(anchor)
  })

  it('hands the tab the bar’s own refusal, not a second sentence', () => {
    const anchor = propExpression(barSpan, 'blockedReason')
    const mine = propExpression(bodySpan, 'runBlockedReason')
    expect(
      mine,
      'AnalysisNewTabBody has no runBlockedReason — a blocked ribbon control could not say why',
    ).toBeTruthy()
    expect(
      mine,
      `the ribbon and the footer must state ONE refusal.\n  bar  blockedReason   = ${anchor}\n  body runBlockedReason = ${mine}`,
    ).toBe(anchor)
  })
})
