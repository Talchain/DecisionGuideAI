/**
 * EVERY mount of `ReanalyseBar` is handed the shell's run gate.
 *
 * ⚠ THIS GUARD IS WHAT MAKES `ReanalyseBar`'s `canRun = true` DEFAULT SAFE.
 * That default exists so an absent verdict never removes the control (losing it
 * outright is a defect the component has already paid for, ROADMAP 2.129 (a)).
 * The cost of the default is that DELETING the props silently restores the
 * ungated button with every check green — the component's own tests cannot see
 * a caller that stopped calling. So the binding is asserted here, at the mount.
 *
 * ── WHAT THIS ENFORCES, STATED AS NARROWLY AS IT IS TRUE ───────────────────
 * An earlier cut of this file claimed to close the whole class and did not.
 * Review defeated it with two GREEN mutants, and both are now closed:
 *
 *   · `<ReanalyseBar as FooterBar>` — an ALIASED import left an ungated bar in
 *     `src/` and passed. The scan now resolves each file's local binding from
 *     its own import statement, so the alias is followed rather than missed.
 *   · `canRun={undefined}` — the check tested the prop's NAME, so an explicit
 *     `undefined` satisfied it and the component's default then un-gated the
 *     button. TypeScript accepts that spelling too. The EXPRESSION is now
 *     checked, not the name.
 *
 * ⚠ AND A THIRD ROUND DEFEATED THAT ONE, WITH TWO ONE-TOKEN RESPELLINGS.
 * `canRun={(undefined)}` and `canRun={undefined as any}` both hand the component
 * `undefined`, both let its `canRun = true` default reinstate the ungated button
 * — and both were GREEN here, because `EMPTY` was exact-equality on the raw
 * expression string and matches neither. Re-measured at `5502f10d` before this
 * change: each mutant left `tsc -p tsconfig.app.json` at **1826 errors, the
 * pristine number**, and this file at **5/5 passing**. Neither guard saw them.
 * The compiler CANNOT see them either — `canRun` is a PRESENT key of type
 * `boolean | undefined`, so every one of those spellings type-checks. What the
 * required-and-nullable prop closes is OMISSION (`TS2741`, +1 error at the exact
 * line), which is a different class. So the spelling class is THIS scan's job
 * alone, and `normaliseExpression` below is where it is done: wrapping parens, a
 * trailing `as …` cast and a trailing `!` are stripped before `EMPTY` is applied.
 *
 * ⚠ AND THE LIMITS THAT REMAIN, because a guard whose header overstates its
 * reach is the next stale mirror: this scans `.tsx` files under `src/` only. A
 * `.jsx` mount, a mount outside `src/`, or one built through a component
 * indirection (`const C = cond ? ReanalyseBar : Other`) is NOT covered. The
 * normaliser is textual and quote-unaware, so an expression whose parens sit
 * inside a string literal is normalised conservatively (it can under-strip, i.e.
 * miss a disguised `undefined`; it does not invent one). A spelling that reaches
 * `undefined` through a BINDING (`const u = undefined; canRun={u}`) is likewise
 * out of reach of any textual scan. The failure message states the scope, so
 * nobody inherits a guarantee the code does not make.
 *
 * ⚠ THE CONTRAST CONTROL IS NOT OPTIONAL. A scan that extracts nothing agrees
 * with every claim made about what it extracted. The control asserts the
 * extractor recovers a gated sibling, so a blind scan fails there first.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

const SRC = join(process.cwd(), 'src')

/** Every non-test `.tsx` under `src/`. The scan's whole reach, and it is stated. */
function sourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFilesIn(full))
    else if (/\.tsx$/.test(entry) && !full.includes('__tests__')) out.push(full)
  }
  return out
}

/**
 * The LOCAL name a file binds an import to — `ReanalyseBar`, or whatever it was
 * aliased to. Returns null when the file does not import it at all.
 */
function localNameFor(src: string, exported: string): string | null {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"][^'"]*['"]`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    for (const clause of m[1]!.split(',')) {
      const alias = /^\s*([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)\s*$/.exec(clause)
      if (alias && alias[1] === exported) return alias[2]!
      if (clause.trim() === exported) return exported
    }
  }
  return null
}

/** The JSX element's own span, quote- and brace-aware. */
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

/** The expression a prop is given, whitespace collapsed; null when absent. */
function propExpression(span: string, prop: string): string | null {
  const at = span.search(new RegExp(`\\b${prop}=\\{`))
  if (at === -1) return null
  let i = span.indexOf('{', at) + 1
  let depth = 1
  const start = i
  for (; i < span.length && depth > 0; i++) {
    if (span[i] === '{') depth++
    else if (span[i] === '}') depth--
  }
  return span.slice(start, i - 1).replace(/\s+/g, ' ').trim()
}

/** Mounts of `exported`, following each file's own alias. */
function mountsOf(exported: string): { file: string; span: string }[] {
  const found: { file: string; span: string }[] = []
  for (const file of sourceFilesIn(SRC)) {
    const raw = readFileSync(file, 'utf8')
    if (!raw.includes(exported)) continue
    const src = stripComments(raw, file)
    const local = localNameFor(src, exported)
    if (!local) continue
    for (const span of elementSpans(src, local)) {
      found.push({ file: file.replace(SRC, 'src'), span })
    }
  }
  return found
}

/**
 * Wrapping parens stripped, then a trailing `as …` cast, then a trailing `!`,
 * repeatedly until the expression stops shrinking — so `(undefined)`,
 * `undefined as any`, `undefined!` and `(undefined as unknown as boolean)` all
 * reduce to the token `EMPTY` tests. Parens are stripped ONLY when they wrap the
 * whole expression (`f(undefined)` and `(a)(b)` are left alone), so a legitimate
 * call or a parenthesised identifier is never mistaken for an absent verdict.
 */
function normaliseExpression(expr: string): string {
  let e = expr.trim()
  for (let round = 0; round < 10; round++) {
    const before = e
    e = stripWrappingParens(e)
    e = e.replace(/\s+as\s+[A-Za-z0-9_$.<>[\]|&\s]+$/, '').trim()
    e = e.replace(/!+$/, '').trim()
    if (e === before) break
  }
  return e
}

/** Parens removed only when the FIRST one closes at the very end. */
function stripWrappingParens(expr: string): string {
  let s = expr.trim()
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0
    let wrapsWhole = true
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++
      else if (s[i] === ')') {
        depth--
        if (depth === 0 && i < s.length - 1) { wrapsWhole = false; break }
      }
    }
    if (!wrapsWhole || depth !== 0) break
    s = s.slice(1, -1).trim()
  }
  return s
}

/** A prop that is present but hands over nothing usable. */
const EMPTY = /^(undefined|null|void 0)$/

/** The whole test: normalise the spelling away, then ask whether anything is left. */
function handsOverNothing(expr: string): boolean {
  return EMPTY.test(normaliseExpression(expr))
}

describe('every ReanalyseBar mount receives the shell run gate', () => {
  it('CONTROL: the scan can see a gated sibling — AnalysisReadinessBar carries canRun', () => {
    const sib = mountsOf('AnalysisReadinessBar')
    expect(sib.length, 'scan found no AnalysisReadinessBar mount — the scan is blind').toBeGreaterThan(0)
    for (const { file, span } of sib) {
      const expr = propExpression(span, 'canRun')
      expect(expr, `${file}: sibling mount lost its gate, or the span reader is broken`).toBeTruthy()
    }
  })

  it('CONTROL: alias resolution works — a renamed binding is still found', () => {
    // Proves the alias limb rather than trusting it: the same reader, over a
    // synthetic file that only an alias-aware scan can see into.
    const synthetic = `import { ReanalyseBar as FooterBar } from './x'\nconst A = () => <FooterBar onReanalyse={f} />`
    expect(localNameFor(synthetic, 'ReanalyseBar')).toBe('FooterBar')
    expect(elementSpans(synthetic, 'FooterBar').length).toBe(1)
  })

  it('CONTROL: an explicit undefined is recognised as handing over nothing', () => {
    expect(handsOverNothing(propExpression('<X canRun={undefined} />', 'canRun') ?? '')).toBe(true)
    expect(handsOverNothing(propExpression('<X canRun={canRunAnalysis} />', 'canRun') ?? '')).toBe(false)
  })

  it('CONTROL: the two spellings that defeated the previous cut are normalised away', () => {
    // These are not hypotheticals. Review handed the mount each of them and both
    // were GREEN here, at `tsc` +0. They are the reason `normaliseExpression`
    // exists, so they are pinned by name rather than described in a comment.
    for (const spelling of [
      '(undefined)',
      'undefined as any',
      '(undefined as any)',
      'undefined!',
      '((undefined))',
      'undefined as unknown as boolean',
      '(null) as any',
      '(void 0)',
    ]) {
      expect(
        handsOverNothing(propExpression(`<X canRun={${spelling}} />`, 'canRun') ?? ''),
        `${spelling} hands over nothing and must be caught`,
      ).toBe(true)
    }
  })

  it('CONTROL: a guard that REDs on everything is not a guard — real verdicts pass', () => {
    // The other half of the discriminating pair. Stripping casts and parens must
    // not start swallowing legitimate expressions: an over-eager normaliser that
    // reduced everything to `undefined` would catch the mutants AND the product.
    for (const spelling of [
      'canRunAnalysis',
      '(canRunAnalysis)',
      'canRunAnalysis as boolean',
      'canRunAnalysis!',
      '!isRunning && canRunAnalysis',
      'gate(undefined)',
      'false',
      'true',
    ]) {
      expect(
        handsOverNothing(propExpression(`<X canRun={${spelling}} />`, 'canRun') ?? ''),
        `${spelling} is a real expression and must NOT be flagged`,
      ).toBe(false)
    }
  })

  it('finds at least one ReanalyseBar mount — an empty sweep proves nothing', () => {
    expect(mountsOf('ReanalyseBar').length).toBeGreaterThan(0)
  })

  it('hands every mount a real verdict, a real reason, and the running state', () => {
    const bad: string[] = []
    for (const { file, span } of mountsOf('ReanalyseBar')) {
      for (const prop of ['canRun', 'blockedReason', 'isAnalysing']) {
        const expr = propExpression(span, prop)
        if (expr === null) bad.push(`${file}: no ${prop}`)
        else if (handsOverNothing(expr)) bad.push(`${file}: ${prop}={${expr}} hands over nothing`)
      }
    }
    expect(
      bad,
      'A ReanalyseBar mounted without the run gate offers a button the shell knows is refused.\n' +
        'Scope enforced: .tsx under src/, aliases resolved, and wrapping parens / a trailing\n' +
        '`as …` cast / a trailing `!` stripped before the emptiness test. NOT covered: .jsx,\n' +
        'mounts outside src/, a component reached through an indirection, or an `undefined`\n' +
        'reached through a binding rather than written at the mount.\n' +
        bad.join('\n'),
    ).toEqual([])
  })
})
