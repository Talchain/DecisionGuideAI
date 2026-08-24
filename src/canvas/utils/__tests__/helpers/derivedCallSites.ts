/**
 * CANONICAL OWNER of the derived run-gate call-site manifest.
 *
 * ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────
 * Two derived guards — `runGateCallSites.derived.spec.ts` and
 * `blockedReasonStaleWiring.derived.spec.ts` — each carried their own
 * verbatim copy of `productionSources()` + `runGateCallSites()`. Two copies
 * of one semantic decision is competing logic: a correction to one silently
 * leaves the other wrong, which is exactly how the defect below survived in
 * BOTH of them at once. The scan now has ONE owner; the specs consume it and
 * define no scanner of their own.
 *
 * ── THE DEFECT THIS FIXES (measured, not inferred) ───────────────────────
 * The original matcher ran over RAW SOURCE TEXT, so it matched the gate's
 * name inside COMMENTS. `SuggestedChips.tsx` documents a known remainder in
 * prose:
 *
 *     // `ConversationPanel` already computes `runGateResult = canRunAnalysis({...})`
 *
 * That comment was counted as a third run-gate call site, and the guards then
 * demanded it feed `draftStreamPhase` / `readinessStale`. Four tests failed
 * against a file that contains no call to the gate at all. The guard's own
 * header states its subject: "every run-gate CALL SITE". A comment is not a
 * call site — it does not execute and cannot hand a user a live Run button —
 * so matching one is a FALSE POSITIVE, and removing it restores the guard to
 * its declared scope rather than narrowing it.
 *
 * ── HOW THE FIX PRESERVES THE ALARM ──────────────────────────────────────
 * Comments are blanked to SPACES, preserving byte offsets, so:
 *   - matching and brace-walking run over comment-free text, and
 *   - the argument slice is taken from the ORIGINAL source, so the text a
 *     spec asserts on is the real code it would have seen before.
 * The dangerous direction here is stripping too MUCH (a scanner that ate a
 * real call site would make every downstream assertion vacuous). Three things
 * guard that: string and regex literals are tracked so a `//` inside one is
 * never treated as a comment; the consuming spec pins the manifest BY NAME,
 * so a swallowed call site goes red; and `assertSeesPresence` below is a
 * self-test of the scanner over a fixture containing both a real call and a
 * commented one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const SRC = join(process.cwd(), 'src')

/** Every `.ts`/`.tsx` file under `src/`, tests and stories excluded. */
export function productionSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      productionSources(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.(spec|test|stories)\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Blank every comment to spaces, leaving all other bytes at their original
 * offsets. String and regex literals are tracked so that a `//` or `/*`
 * appearing INSIDE one is left alone — without that, a URL in a string or a
 * regex such as `/https:\/\//` would blank the remainder of a real line of
 * code and blind the scanner.
 */
export function blankComments(text: string): string {
  const out = text.split('')
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== '\n') out[k] = ' '
    }
  }
  let i = 0
  // Tracks whether a `/` in this position starts a regex literal or is division.
  let prevMeaningful = ''
  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (c === '/' && next === '/') {
      let j = i
      while (j < text.length && text[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && next === '*') {
      let j = i + 2
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j++
      blank(i, Math.min(j + 2, text.length))
      i = j + 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue }
        if (text[j] === c) break
        j++
      }
      i = j + 1
      prevMeaningful = c
      continue
    }
    // A `/` here is a regex literal only where an operand cannot precede it.
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(prevMeaningful)) {
      let j = i + 1
      let inClass = false
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue }
        if (text[j] === '[') inClass = true
        else if (text[j] === ']') inClass = false
        else if (text[j] === '/' && !inClass) break
        else if (text[j] === '\n') break
        j++
      }
      i = j + 1
      prevMeaningful = '/'
      continue
    }
    if (!/\s/.test(c)) prevMeaningful = c
    i++
  }
  return out.join('')
}

/** Walk from the `{` at `openIndex` to its matching close, over `scan` text. */
function endOfArgumentObject(scan: string, openIndex: number): number {
  let depth = 1
  let i = openIndex
  while (i < scan.length && depth > 0) {
    if (scan[i] === '{') depth++
    else if (scan[i] === '}') depth--
    i++
  }
  return i
}

export interface CallSite {
  file: string
  args: string
}

/**
 * Find every invocation of `pattern` in production source and return its
 * argument text, taken from the ORIGINAL source at comment-free offsets.
 *
 * `skipFile` excludes a module that merely defines/documents the symbol.
 */
export function deriveCallSites(
  pattern: RegExp,
  opts: { skipFile?: string } = {},
): CallSite[] {
  const found: CallSite[] = []
  for (const file of productionSources(SRC)) {
    if (opts.skipFile && file.endsWith(opts.skipFile)) continue
    const text = readFileSync(file, 'utf8')
    const scan = blankComments(text)
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(scan)) !== null) {
      const end = endOfArgumentObject(scan, m.index + m[0].length)
      found.push({ file: relative(SRC, file), args: text.slice(m.index, end) })
    }
  }
  return found
}

/** The run gate, under its exported name and the alias both live callers use. */
export const RUN_GATE_PATTERN = /\bcanRunAnalysis(?:Util)?\s*\(\s*\{/g

export function runGateCallSites(): CallSite[] {
  return deriveCallSites(RUN_GATE_PATTERN, {
    skipFile: join('canvas', 'utils', 'canRunAnalysis.ts'),
  })
}

/** Read the whole argument list of a call, balancing parens from the `(`. */
function callArguments(scan: string, openParenIndex: number): [number, number] {
  let depth = 1
  let i = openParenIndex + 1
  while (i < scan.length && depth > 0) {
    if (scan[i] === '(') depth++
    else if (scan[i] === ')') depth--
    i++
  }
  return [openParenIndex + 1, i - 1]
}

/**
 * Paren-form variant of {@link deriveCallSites}, for a call whose arguments are
 * not a single object literal. Import statements match the bare identifier and
 * are skipped; comments are blanked by the same owner, so a symbol named in
 * prose is not counted as a call (the defect documented at the top of this
 * file applied to this scanner too).
 */
export function deriveParenCallSites(
  pattern: RegExp,
  opts: { skipFile?: string } = {},
): CallSite[] {
  const found: CallSite[] = []
  for (const file of productionSources(SRC)) {
    if (opts.skipFile && file.endsWith(opts.skipFile)) continue
    const text = readFileSync(file, 'utf8')
    const scan = blankComments(text)
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(scan)) !== null) {
      const lineStart = scan.lastIndexOf('\n', m.index) + 1
      if (/\bimport\b/.test(scan.slice(lineStart, m.index))) continue
      const [from, to] = callArguments(scan, m.index + m[0].length - 1)
      found.push({ file: relative(SRC, file), args: text.slice(from, to) })
    }
  }
  return found
}

export function composerCallSites(): CallSite[] {
  return deriveParenCallSites(/\bcomposeReadinessBlockedReason\s*\(/g, {
    skipFile: join('canvas', 'utils', 'composeBlockedReason.ts'),
  })
}
