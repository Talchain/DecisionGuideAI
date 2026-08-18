/**
 * CI guard: ONE module decides what the product says about a restored graph.
 *
 * W-1 shipped because the decision and the sentence lived ~200 lines apart in
 * `ReactFlowGraph.tsx`, joined by a `sessionStorage` flag whose only value was
 * `'true'`. A boolean cannot carry WHAT was restored, so the copy had nowhere
 * to come from but a literal at the far end — and that literal claimed the
 * user's authorship of Olumi's own bundled demo.
 *
 * Nothing structural stops the next edit re-introducing a hand-written flag or
 * a second copy of the sentence somewhere else, and the drift would read green
 * (a toast that says the wrong thing fails no test). So the invariant is
 * DERIVED from the filesystem on every run rather than remembered.
 *
 * Comments are stripped but string literals are NOT (the opposite of the
 * autosave guard): the literals ARE the thing being counted here.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { stripComments } from '../helpers/stripSourceComments'
import {
  RECOVERY_NOTICE_COPY,
  RECOVERY_NOTICE_KEY,
} from '../../src/canvas/persist/recoveryNotice'

const SRC = join(process.cwd(), 'src')
const OWNER = 'canvas/persist/recoveryNotice.ts'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue
      walk(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.spec\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/**
 * Read + strip ONCE. The sweep is ~3,500 files; doing it per assertion cost
 * 30s of shard time for four questions about the same corpus.
 */
const CORPUS: ReadonlyArray<readonly [string, string]> = walk(SRC).map(file => {
  const rel = relative(SRC, file).split('\\').join('/')
  return [rel, stripComments(readFileSync(file, 'utf8'), file)] as const
})

/** Production modules whose CODE (not comments) contains `needle`. */
function filesContaining(needle: string): string[] {
  return CORPUS.filter(([, code]) => code.includes(needle)).map(([rel]) => rel)
}

describe('recovery notice — one decider, one sentence', () => {
  it('finds the owner at all (positive control — an empty sweep proves nothing)', () => {
    // If the walker or the comment stripper breaks, every assertion below
    // passes by looking at nothing. Absence claims need a positive control.
    expect(filesContaining(RECOVERY_NOTICE_KEY)).toContain(OWNER)
    expect(filesContaining(RECOVERY_NOTICE_COPY.unsaved_work)).toContain(OWNER)
  })

  it('no other production module writes the handoff key', () => {
    expect(filesContaining(RECOVERY_NOTICE_KEY)).toEqual([OWNER])
  })

  it('no other production module carries the recovery sentences', () => {
    expect(filesContaining(RECOVERY_NOTICE_COPY.unsaved_work)).toEqual([OWNER])
    expect(filesContaining(RECOVERY_NOTICE_COPY.saved_example)).toEqual([OWNER])
  })

  it('the sentence a saved example gets claims nothing about the user', () => {
    // Bound to the words that made W-1 a fabrication, not to the whole string:
    // the copy may be reworded, it may not start claiming authorship again.
    expect(RECOVERY_NOTICE_COPY.saved_example).not.toMatch(/your last session/i)
    expect(RECOVERY_NOTICE_COPY.saved_example).not.toMatch(/unsaved/i)
    expect(RECOVERY_NOTICE_COPY.saved_example).not.toMatch(/your (work|changes|model)/i)
    // Opposite direction: the real-work sentence must still make the claim it
    // is entitled to make. Removing it would be the same defect facing round.
    expect(RECOVERY_NOTICE_COPY.unsaved_work).toMatch(/your last session/i)
  })
})
