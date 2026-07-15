/**
 * F1 (graph-visuals) — "one guard, EVERY call site" enforced structurally.
 *
 * Every ANIMATED viewport move (`duration: <non-zero literal>` in an options
 * object) under src/canvas must route through cameraMotion.cameraDuration so
 * prefers-reduced-motion collapses it to an instant jump. A hardcoded
 * non-zero duration literal is exactly the class of regression that shipped
 * three unguarded sites past #274 (CanvasToolbar's fit button and both
 * useValidationFeedback setCenter calls) — this scan makes the next one fail
 * a test instead of a motion-sensitive user.
 *
 * Scope: all non-test .ts/.tsx under src/canvas. `duration: 0` is exempt
 * (an instant jump is already reduced-motion-safe), as are comment lines and
 * non-literal durations (cameraDuration(...) calls, *_DURATION_MS constants).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const CANVAS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

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

const isCommentLine = (line: string): boolean => {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

describe('F1 — no hardcoded animated camera durations in src/canvas', () => {
  it('every non-zero `duration:` literal routes through cameraDuration (violations must be [])', () => {
    const violations: string[] = []
    for (const file of sourceFiles(CANVAS_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (isCommentLine(line)) return
        if (/duration:\s*[1-9]/.test(line)) {
          violations.push(`${relative(CANVAS_ROOT, file)}:${i + 1} → ${line.trim()}`)
        }
      })
    }
    expect(violations).toEqual([])
  })
})
