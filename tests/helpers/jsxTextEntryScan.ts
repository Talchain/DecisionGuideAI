// ─────────────────────────────────────────────────────────────────────────────
// Span-bounded JSX opening-tag scanner.
// Verified in /private/tmp/olumi-panel-lane-20260904-b0 @ 6870d5e5.
// Reproduces today's three controls exactly (ModelDetailRegion.tsx:263 tabular,
// ModelRowView.tsx:567 tabular, ModelTabV2Panel.tsx:481 bodySmall) while closing
// the four silent-pass routes the line-walk carried.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from './stripSourceComments'

/** Directories that hold no shipping JSX. Same set as modelTabV2Boundary.sourceScan.spec.ts. */
const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__mocks__', '__snapshots__'])

/**
 * Every shipping `.tsx` under `dir`, RECURSIVELY — a control in a subdirectory
 * is in scope the moment it is written. `.ts` is excluded because JSX cannot
 * live there; spec/test files are excluded because they are not the product.
 */
export function jsxSourceFilesIn(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...jsxSourceFilesIn(full))
      continue
    }
    if (!/\.tsx$/.test(entry)) continue
    if (/\.(spec|test)\.tsx$/.test(entry)) continue
    out.push(full)
  }
  return out
}

/**
 * The text-entry tags. The negative lookahead (rather than `\b`) is deliberate:
 * it states the intent — `<input` must not be the prefix of a longer tag name —
 * and keeps this estate out of the `\b` habit that silently zeroes `git grep`.
 * Case-sensitive, so a `<Input>` component is not a DOM control.
 */
export const TEXT_ENTRY_TAG = /<(input|textarea)(?![A-Za-z0-9_$-])/

export interface TagSpan {
  /** Index of the `>` that closes THIS opening tag. */
  readonly end: number
  /** True when that `>` was preceded by `/`. */
  readonly selfClosing: boolean
}

/**
 * Walk from just past a JSX tag name to THAT TAG'S OWN closing `>`.
 *
 * ⚠ THIS IS THE WHOLE FIX. The line-walk it replaces could not terminate on the
 * element's own line (its boundary was gated on `j > i`) and could not see a
 * `>`-closed element at all (it tested `/\/>/`, which matches neither `<textarea …>`
 * nor `</textarea>`). Both walked on into a LATER SIBLING's className, so a
 * `text-xs` control was reported wearing its neighbour's 14px token.
 *
 * One stack, four states. `{` pushes a JSX expression container and `${` pushes a
 * template interpolation; a `>` ends the span only at depth zero outside every
 * string, so `placeholder="a > b"` and `onKeyDown={e => { if (a > b) f() }}` cannot
 * truncate it. Regex literals need no state of their own: inside an opening tag
 * every expression is already inside `{…}`.
 *
 * Returns `null` when the tag never closes — a hard error for the caller, never a
 * silent skip.
 */
export function openingTagSpan(code: string, from: number): TagSpan | null {
  const stack: Array<'brace' | 'interp'> = []
  let state: 'tag' | 'single' | 'double' | 'template' = 'tag'
  let i = from
  while (i < code.length) {
    const c = code[i]
    if (state === 'tag') {
      if (c === "'") { state = 'single'; i++; continue }
      if (c === '"') { state = 'double'; i++; continue }
      if (c === '`') { state = 'template'; i++; continue }
      if (c === '{') { stack.push('brace'); i++; continue }
      if (c === '}') { if (stack.pop() === 'interp') state = 'template'; i++; continue }
      if (c === '>' && stack.length === 0) {
        return { end: i, selfClosing: /\/\s*$/.test(code.slice(from, i)) }
      }
      i++; continue
    }
    if (state === 'single') { if (c === '\\') { i += 2; continue } if (c === "'") state = 'tag'; i++; continue }
    if (state === 'double') { if (c === '\\') { i += 2; continue } if (c === '"') state = 'tag'; i++; continue }
    // state === 'template'
    if (c === '\\') { i += 2; continue }
    if (c === '`') { state = 'tag'; i++; continue }
    if (c === '$' && code[i + 1] === '{') { stack.push('interp'); state = 'tag'; i += 2; continue }
    i++
  }
  return null
}

/** Index just past the `{…}` beginning at `code[i] === '{'`, or -1 if unbalanced. */
export function balancedBraceEnd(code: string, i: number): number {
  const stack: Array<'brace' | 'interp'> = []
  let state: 'code' | 'single' | 'double' | 'template' = 'code'
  while (i < code.length) {
    const c = code[i]
    if (state === 'code') {
      if (c === "'") { state = 'single'; i++; continue }
      if (c === '"') { state = 'double'; i++; continue }
      if (c === '`') { state = 'template'; i++; continue }
      if (c === '{') { stack.push('brace'); i++; continue }
      if (c === '}') {
        const top = stack.pop()
        if (top === 'interp') state = 'template'
        i++
        if (stack.length === 0 && top === 'brace') return i
        continue
      }
      i++; continue
    }
    if (state === 'single') { if (c === '\\') { i += 2; continue } if (c === "'") state = 'code'; i++; continue }
    if (state === 'double') { if (c === '\\') { i += 2; continue } if (c === '"') state = 'code'; i++; continue }
    if (c === '\\') { i += 2; continue }
    if (c === '`') { state = 'code'; i++; continue }
    if (c === '$' && code[i + 1] === '{') { stack.push('interp'); state = 'code'; i += 2; continue }
    i++
  }
  return -1
}

/**
 * Every `className` VALUE region inside a span — the balanced `{…}` expression or
 * the quoted literal. Reading ONLY inside the span is the identity binding: a
 * neighbour's classes are not in scope, whatever their proximity.
 */
export function classNameValuesIn(span: string): string[] {
  const out: string[] = []
  const re = /className\s*=\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(span)) !== null) {
    const i = m.index + m[0].length
    const open = span[i]
    if (open === '{') {
      const end = balancedBraceEnd(span, i)
      if (end === -1) { out.push(span.slice(i)); break }
      out.push(span.slice(i, end)); re.lastIndex = end; continue
    }
    if (open === '"' || open === "'" || open === '`') {
      let j = i + 1
      while (j < span.length && span[j] !== open) { if (span[j] === '\\') j++; j++ }
      const end = Math.min(j + 1, span.length)
      out.push(span.slice(i, end)); re.lastIndex = end; continue
    }
  }
  return out
}

/** `typography.<token>` references on the element. */
export const TYPOGRAPHY_REF = /typography\.([A-Za-z_$][\w$]*)/g
/**
 * Literal Tailwind `text-*` utilities on the element. Every such token is
 * collected and the resolver does the discriminating — colour utilities
 * (`text-text-body`, `text-info`) resolve to `absent` on the size axis, while
 * `text-xs` and `text-[11px]` resolve to a size. A `${typography.x}`
 * interpolation never spells a literal utility, so the two collectors cannot
 * contaminate each other.
 *
 * ⚠ THE PREFIX CLASS CARRIES `:` AND `!`, AND AN EARLIER VERSION OF THIS COMMENT
 * WAS FALSE WITHOUT THEM. It claimed "every `text-*` token is collected"; a
 * reviewer refuted it by execution. With the old class, `"text-sm md:text-xs"`
 * collected only `text-sm` and `"text-sm !text-xs"` only `text-sm`, so a
 * variant-prefixed or important-flagged below-minimum size walked straight past
 * the guard wearing its sibling utility's compliant size. The contrast in the
 * same probe — `"text-sm text-xs"` — collected both, which is why the hole was
 * invisible to a casual check.
 *
 * Measured at the time of the fix: ZERO live instances in `src/`, so this was a
 * latent hole rather than a shipped defect. It is closed anyway, because a guard
 * whose own comment overstates its reach is the mirror this file exists to kill.
 */
export const LITERAL_TEXT_CLASS = /(?:^|[\s'"`{}(,:!])(text-[A-Za-z0-9[\]().:,%_-]+)/g

export interface Control {
  readonly file: string
  readonly line: number
  readonly tag: 'input' | 'textarea'
  /** True when the opening tag never closed — a hard error, asserted against. */
  readonly unterminated: boolean
  readonly tokens: readonly string[]
  readonly literals: readonly string[]
  readonly selfClosing: boolean
}

/**
 * Scan one source text for text-entry controls.
 *
 * ⚠ `stripComments`, NOT `blankNonCode`. Measured on this tree: `blankNonCode`
 * turns `className="text-xs w-24"` into `className="            "` and
 * ``className={`${typography.tabular} w-24`}`` into ``className={`             …`}``
 * — it erases BOTH things this guard exists to read, because both live inside a
 * string or template literal. A scan built on it would be structurally incapable
 * of firing, which is the exact defect `modelTabV2Boundary.sourceScan.spec.ts`
 * records having shipped twice. `stripComments` preserves byte offsets and
 * newlines, so the line numbers below stay exact.
 *
 * Exported and fixture-driveable on purpose: the positive controls run THIS
 * function on synthetic sources, so instrument and control no longer share the
 * repo's file list and can no longer go blind together.
 */
export function scanSource(src: string, file: string): Control[] {
  const code = stripComments(src, file)
  const out: Control[] = []
  const re = new RegExp(TEXT_ENTRY_TAG.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    const from = m.index + m[0].length
    const line = code.slice(0, m.index).split('\n').length
    const tag = m[1] as 'input' | 'textarea'
    const span = openingTagSpan(code, from)
    if (span === null) {
      out.push({ file, line, tag, unterminated: true, tokens: [], literals: [], selfClosing: false })
      break
    }
    const text = code.slice(m.index, span.end + 1)
    const tokens: string[] = []
    const literals: string[] = []
    for (const value of classNameValuesIn(text)) {
      for (const t of value.matchAll(new RegExp(TYPOGRAPHY_REF.source, 'g'))) tokens.push(t[1])
      for (const l of value.matchAll(new RegExp(LITERAL_TEXT_CLASS.source, 'g'))) literals.push(l[1])
    }
    out.push({ file, line, tag, unterminated: false, tokens, literals, selfClosing: span.selfClosing })
    re.lastIndex = span.end + 1
  }
  return out
}

/** Every text-entry control under `dir`, recursively. */
export function textEntryControls(dir: string): Control[] {
  return jsxSourceFilesIn(dir).flatMap(f => scanSource(readFileSync(f, 'utf8'), f))
}

// ── The verdict, resolved by the SHARED resolver ─────────────────────────────
//
// ⚠ THE PREVIOUS VERDICT WAS A HAND-ROLLED BOOLEAN AND IT FAILED OPEN.
// `/\btext-(?:xs\b|\[(?:[0-9]|1[0-3])(?:\.\d+)?px\])/` answers "did I match?",
// which has ONE bit for THREE states — so "did not match" silently absorbed both
// "no size class at all" (`sr-only`) and "a size class I cannot read"
// (`text-[length:calc(11px*var(--canvas-label-scale,1))]`). Measured: it missed
// `nodeTitle`, `nodeLabel`, `edgeLabel` and `screenReaderOnly`, and a mutant
// swapping a real input onto any of them left the suite 4/4 GREEN.
//
// `resolveSizePx` reports `resolved` / `absent` / `unparseable` separately, so
// each becomes its own named failure and NONE of them defaults to pass.
import { resolveSizePx } from '../../scripts/lib/type-scale.mjs'

/** Why a control failed. Three reasons, because there are three ways to fail. */
export type OffenceKind = 'below-minimum' | 'unparseable-size' | 'no-resolvable-size'

export interface Offence {
  readonly kind: OffenceKind
  readonly file: string
  readonly line: number
  readonly tag: string
  readonly detail: string
  /** `file:line` — the identity a KNOWN-exception set pins against. */
  readonly id: string
}

export const MINIMUM_PX = 14

/**
 * Judge every control against the DS v5 §2.1 minimum.
 *
 * A control's size may be set by a `typography.<token>` reference or by a literal
 * `text-*` utility, so BOTH are resolved and the SMALLEST resolved size decides.
 * The minimum (not the last, not the first) is deliberate: two size classes on
 * one element is already a defect, CSS order — not class order — picks the
 * winner, and the conservative reading is the one that cannot bless a control
 * that might render at 12px.
 */
export function judgeControls(
  controls: readonly Control[],
  typography: Record<string, string>,
  repoRelative: (abs: string) => string = (p) => p,
): Offence[] {
  const out: Offence[] = []
  for (const c of controls) {
    const rel = repoRelative(c.file)
    const id = `${rel}:${c.line}`
    if (c.unterminated) {
      out.push({ kind: 'no-resolvable-size', file: rel, line: c.line, tag: c.tag, id,
        detail: 'the opening tag never closed — the scanner could not bound this element' })
      continue
    }

    const candidates: Array<{ source: string; classes: string }> = [
      ...c.tokens.map(t => ({ source: `typography.${t}`, classes: typography[t] ?? '' })),
      ...c.literals.map(l => ({ source: `raw "${l}"`, classes: l })),
    ]

    const resolved: Array<{ source: string; px: number }> = []
    let sawUnparseable = false
    for (const cand of candidates) {
      if (cand.classes === '') {
        out.push({ kind: 'unparseable-size', file: rel, line: c.line, tag: c.tag, id,
          detail: `${cand.source} is not a token in src/styles/typography.ts` })
        sawUnparseable = true
        continue
      }
      const { px, outcome } = resolveSizePx(cand.classes, cand.source)
      if (outcome === 'unparseable') {
        out.push({ kind: 'unparseable-size', file: rel, line: c.line, tag: c.tag, id,
          detail: `${cand.source} = "${cand.classes}" — a size class this resolver cannot read` })
        sawUnparseable = true
      } else if (outcome === 'resolved' && px !== null) {
        resolved.push({ source: cand.source, px })
      }
      // `absent` contributes nothing: a colour utility has no size axis.
    }
    if (sawUnparseable) continue

    if (resolved.length === 0) {
      out.push({ kind: 'no-resolvable-size', file: rel, line: c.line, tag: c.tag, id,
        // ⚠ THIS MESSAGE USED TO ASSERT "no className on the element at all",
        // which is FALSE for the commonest case: an element WITH a className the
        // scanner could not read (a variable, a helper call, a conditional). A
        // reviewer measured 83 such controls across `src/` carrying that
        // sentence. Saying "I found no size" is true; saying "there is no
        // className" is a claim about the code that the scan cannot support.
        detail: candidates.length === 0
          ? 'no typography token or literal text-* utility could be read from this element — its className may be a variable, a helper call or a conditional, so the rendered size is not knowable from source'
          : `no size class among ${candidates.map(x => x.source).join(', ')} — the rendered size is inherited and this scan cannot see it` })
      continue
    }

    const smallest = resolved.reduce((a, b) => (b.px < a.px ? b : a))
    if (smallest.px < MINIMUM_PX) {
      out.push({ kind: 'below-minimum', file: rel, line: c.line, tag: c.tag, id,
        detail: `${smallest.source} resolves to ${smallest.px}px` })
    }
  }
  return out
}
