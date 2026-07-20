/**
 * F1 (graph-visuals) — "one guard, EVERY call site" enforced structurally.
 *
 * THE RULE: every camera move under src/canvas (fitView / setCenter /
 * setViewport / zoomIn / zoomOut / zoomTo) must express its `duration` as
 * either `cameraDuration(...)` — the single reduced-motion guard — or the
 * literal `0` (an instant jump is already reduced-motion-safe). Omitting
 * `duration` is fine: xyflow defaults to an instant move.
 *
 * ANY OTHER duration expression is a violation, INCLUDING a named constant.
 * The earlier version of this scan matched only `duration:\s*[1-9]` and its
 * docstring waved through "non-literal durations (*_DURATION_MS constants)" —
 * so `duration: FOCUS_MS` sailed past the very gate meant to stop it. A guard
 * with a documented way around it is not a guard: the point is that a
 * motion-sensitive user's animation cannot be reintroduced by ANY spelling.
 * `cameraDuration(FOCUS_MS, reduced)` is how a named constant stays legal.
 *
 * Scope: all non-test .ts/.tsx under src/canvas, comments stripped. The scan
 * is call-site-directed, not line-directed — it reads the arguments of camera
 * moves only, so unrelated `duration:` fields (layout engine timings,
 * telemetry elapsed ms, type declarations) are correctly ignored rather than
 * suppressed by hand.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'

const CANVAS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

/** Imperative viewport moves — the calls whose `duration` animates the camera. */
const CAMERA_MOVES = ['fitView', 'setCenter', 'setViewport', 'zoomIn', 'zoomOut', 'zoomTo']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    out.push(full)
  }
  return out
}

// `blankNonCode` (blanks comments + string/template bodies, offset-preserving)
// is the shared helper in tests/helpers/stripSourceComments.ts — the detector
// contract below still pins its behaviour for this guard. Prose about camera
// moves (this file's own docstring, the contract note in
// useFitViewOnLayoutVersion) must not read as a call site.

/** Extract the balanced `(...)` argument text starting at `openIdx`. */
function argsAt(src: string, openIdx: number): string {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      depth--
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  return src.slice(openIdx + 1)
}

/** The value expression of `duration:` at `from`, up to the depth-0 `,` or `}`. */
function durationValueAt(args: string, from: number): string {
  let depth = 0
  for (let i = from; i < args.length; i++) {
    const c = args[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return args.slice(from, i).trim()
      depth--
    } else if (c === ',' && depth === 0) return args.slice(from, i).trim()
  }
  return args.slice(from).trim()
}

const isGuarded = (value: string): boolean =>
  value === '0' || /^cameraDuration\s*\(/.test(value)

/**
 * Every camera-move `duration` in `src` that is neither `cameraDuration(...)`
 * nor literal `0`. Exported shape: `<move>(... duration: <expr> ...)`.
 */
export function findUnguardedCameraDurations(src: string): string[] {
  const code = blankNonCode(src)
  const violations: string[] = []
  for (const move of CAMERA_MOVES) {
    // No trailing \b: the ReactFlowGraph sites are called through stabilised
    // refs (`fitViewRef.current(...)`), and a trailing boundary would make the
    // scan blind to exactly those.
    const re = new RegExp(`\\b${move}`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(code)) !== null) {
      // Walk to the call's `(`, allowing only a ref/optional-chain hop
      // (`fitViewRef.current?.(`), so a mere mention is not a call site.
      let j = m.index + move.length
      while (j < code.length && /[\w.?\s]/.test(code[j]!)) j++
      if (code[j] !== '(') continue
      const args = argsAt(code, j)
      const dre = /\bduration\s*:\s*/g
      let d: RegExpExecArray | null
      while ((d = dre.exec(args)) !== null) {
        const value = durationValueAt(args, d.index + d[0].length)
        if (!isGuarded(value)) violations.push(`${move}(… duration: ${value} …)`)
      }
    }
  }
  return violations
}

describe('F1 — the scan itself bites (detector contract)', () => {
  it('catches a NAMED CONSTANT duration — the bypass the old scan sanctioned', () => {
    expect(findUnguardedCameraDurations('fitView({ duration: FOCUS_MS })')).toEqual([
      'fitView(… duration: FOCUS_MS …)',
    ])
  })

  it('catches a hardcoded numeric duration', () => {
    expect(findUnguardedCameraDurations('setCenter(x, y, { duration: 300 })')).toEqual([
      'setCenter(… duration: 300 …)',
    ])
  })

  it('catches an unguarded duration in a multi-line options object', () => {
    const src = ['fitViewRef.current({', '  padding: 0.3,', '  duration: ANIM_MS,', '})'].join('\n')
    expect(findUnguardedCameraDurations(src)).toEqual(['fitView(… duration: ANIM_MS …)'])
  })

  it('catches an arithmetic/ternary duration expression', () => {
    expect(findUnguardedCameraDurations('zoomTo(1, { duration: reduced ? 0 : 200 })')).toHaveLength(1)
  })

  it('allows cameraDuration(...) — including around a named constant', () => {
    expect(
      findUnguardedCameraDurations('fitView({ duration: cameraDuration(FOCUS_MS, reduced) })'),
    ).toEqual([])
  })

  it('allows literal 0 and an omitted duration', () => {
    expect(findUnguardedCameraDurations('setViewport(v, { duration: 0 })')).toEqual([])
    expect(findUnguardedCameraDurations('fitView({ padding: 0.1 })')).toEqual([])
  })

  it('ignores non-camera `duration:` fields (layout timings, telemetry)', () => {
    expect(findUnguardedCameraDurations('return { positions, duration: performance.now() - start }')).toEqual([])
    expect(findUnguardedCameraDurations('track("run", { duration: elapsedMs })')).toEqual([])
    expect(findUnguardedCameraDurations('interface R { duration: number }')).toEqual([])
  })

  it('ignores camera moves written in comments and strings', () => {
    expect(findUnguardedCameraDurations('// contract: fitView({ duration: 400 })')).toEqual([])
    expect(findUnguardedCameraDurations('/* fitView({ duration: 400 }) */')).toEqual([])
    expect(findUnguardedCameraDurations('const doc = "fitView({ duration: 400 })"')).toEqual([])
  })
})

describe('F1 — no unguarded camera durations in src/canvas', () => {
  it('every camera-move duration routes through cameraDuration (violations must be [])', () => {
    const violations: string[] = []
    for (const file of sourceFiles(CANVAS_ROOT)) {
      for (const v of findUnguardedCameraDurations(readFileSync(file, 'utf8'))) {
        violations.push(`${relative(CANVAS_ROOT, file)} → ${v}`)
      }
    }
    expect(violations).toEqual([])
  })
})
