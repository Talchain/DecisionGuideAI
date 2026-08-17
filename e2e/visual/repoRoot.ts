/**
 * Locate the repository root without `__dirname` (unavailable — Playwright
 * loads these modules as ESM) and without trusting `process.cwd()` blindly.
 *
 * It walks up from the working directory looking for the two files this
 * harness actually reads, and THROWS if it cannot find them. A silent fallback
 * to `process.cwd()` would make every downstream `readFileSync` fail with an
 * ENOENT that reads like a missing fixture rather than a wrong root — and a
 * wrong root is exactly how a run ends up measuring a different tree
 * (CLAUDE.md trap 1).
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const MARKERS = ['netlify.toml', join('src', 'flags.ts')]

let cached: string | null = null

export function repoRoot(): string {
  if (cached) return cached
  let dir = resolve(process.cwd())
  for (let i = 0; i < 12; i++) {
    if (MARKERS.every((m) => existsSync(join(dir, m)))) {
      cached = dir
      return dir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    `[visreg] could not locate the repository root from ${process.cwd()}. ` +
      `Looked upward for: ${MARKERS.join(', ')}. Run the visual harness from inside the repo.`,
  )
}
