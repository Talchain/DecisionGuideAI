/**
 * EVERY mount of `ReanalyseBar` is handed the shell's run gate.
 *
 * ⚠ THIS GUARD IS WHAT MAKES `ReanalyseBar`'s `canRun = true` DEFAULT SAFE.
 * That default exists so an absent verdict never removes the control (losing it
 * outright is a defect the component has already paid for, ROADMAP 2.129 (a)).
 * The cost of the default is that DELETING the props silently restores the
 * ungated button with every suite green — the component's own tests cannot see
 * a caller that stopped calling. So the binding is asserted here, at the mount.
 *
 * ── WHY A CLASS AND NOT THE ONE INSTANCE ───────────────────────────────────
 * There is exactly one mount today. Pinning that one file is how the estate
 * ends up closing an instance instead of a class: the next surface to host the
 * bar would get no gate and no red. The scan therefore finds EVERY `<ReanalyseBar`
 * in `src/` and requires the pair of each.
 *
 * ── THE CONTRAST CONTROL, AND WHY IT IS NOT OPTIONAL ───────────────────────
 * An extractor that reads nothing agrees with every assertion made about what it
 * read. `AnalysisReadinessBar` — the sibling arm of the same switch, which has
 * carried `canRun` since it shipped — must be found WITH its gate by the same
 * scan. If the scan goes blind, the control fails first and says so, rather than
 * this file reporting a gate it never looked at.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const SRC = join(process.cwd(), 'src')

function sourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFilesIn(full))
    } else if (/\.tsx$/.test(entry) && !full.includes('__tests__')) {
      out.push(full)
    }
  }
  return out
}

/**
 * The JSX element's own span: from `<Name` forward to the `>` that closes THAT
 * tag, tracking quote and brace depth so a `>` inside an expression or a string
 * does not end it early. Comments are stripped BEFORE this runs, so a prop named
 * only in prose cannot satisfy the assertion.
 */
function elementSpans(src: string, name: string): string[] {
  const spans: string[] = []
  const open = new RegExp(`<${name}[\\s/>]`, 'g')
  let m: RegExpExecArray | null
  while ((m = open.exec(src)) !== null) {
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
    spans.push(src.slice(m.index, i + 1))
  }
  return spans
}

function spansFor(component: string): { file: string; span: string }[] {
  const found: { file: string; span: string }[] = []
  for (const file of sourceFilesIn(SRC)) {
    const raw = readFileSync(file, 'utf8')
    if (!raw.includes(`<${component}`)) continue
    for (const span of elementSpans(stripComments(raw, file), component)) {
      found.push({ file: file.replace(SRC, 'src'), span })
    }
  }
  return found
}

describe('every ReanalyseBar mount receives the shell run gate', () => {
  it('CONTROL: the scan can see a gated sibling — AnalysisReadinessBar carries canRun', () => {
    const sib = spansFor('AnalysisReadinessBar')
    expect(sib.length, 'scan found no AnalysisReadinessBar mount — the scan is blind').toBeGreaterThan(0)
    for (const { file, span } of sib) {
      expect(span, `${file}: sibling mount lost its gate, or the span reader is broken`).toMatch(/canRun=/)
    }
  })

  it('finds at least one ReanalyseBar mount — an empty sweep proves nothing', () => {
    expect(spansFor('ReanalyseBar').length).toBeGreaterThan(0)
  })

  it('hands every mount both the verdict and the reason', () => {
    const missing: string[] = []
    for (const { file, span } of spansFor('ReanalyseBar')) {
      if (!/canRun=/.test(span)) missing.push(`${file}: no canRun`)
      if (!/blockedReason=/.test(span)) missing.push(`${file}: no blockedReason`)
    }
    expect(
      missing,
      `A ReanalyseBar mounted without the run gate offers a button the shell knows is refused:\n${missing.join('\n')}`,
    ).toEqual([])
  })
})
