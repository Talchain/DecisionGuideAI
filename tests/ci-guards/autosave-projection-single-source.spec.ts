/**
 * CI guard: `projectAutosaveData` is the ONLY constructor of an autosave payload.
 *
 * `saveAutosave` (canvas/store/scenarios.ts) REPLACES the stored object — it is
 * a `JSON.stringify` → `setItem`, not a merge. Seven call sites used to build
 * the payload literal by hand and six of them had already drifted, dropping
 * `ceeAnalysisReady` and/or `selectedGoalNode` that RecoveryBanner reads back.
 * The fix routes every writer through one projection.
 *
 * This guard exists because that invariant is otherwise a hand-maintained
 * mirror: nothing stops a new caller from passing a fresh object literal, and
 * the drift would be invisible (a partial write looks like a successful save).
 * The call-site list is DERIVED from the filesystem on every run — it is never
 * a checked-in list that someone must remember to update.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')

/** Modules that DEFINE a saveAutosave rather than call the scenarios one. */
const DEFINITION_FILES = [
  'canvas/store/scenarios.ts',
  // A separate, unrelated versioned-storage API that happens to share the name.
  'canvas/persist/versionedStorage.ts',
]

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

interface CallSite {
  file: string
  line: number
  argument: string
}

/** Every `saveAutosave(` / `scenarios.saveAutosave(` call in production source. */
function findCallSites(): CallSite[] {
  const sites: CallSite[] = []
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).split('\\').join('/')
    if (DEFINITION_FILES.includes(rel)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((text, i) => {
      const m = /(?:^|[^.\w])(?:scenarios\.)?saveAutosave\(/.exec(text)
      if (!m) return
      // Skip imports, and prose mentions inside comments (the projection
      // module's own docblock names the function it replaces).
      if (/^\s*import\b/.test(text)) return
      if (/^\s*(?:\*|\/\/|\/\*)/.test(text)) return
      const after = text.slice(m.index + m[0].length).trim()
      // The argument may start on the next line.
      const argument = after === '' ? (lines[i + 1] ?? '').trim() : after
      sites.push({ file: rel, line: i + 1, argument })
    })
  }
  return sites
}

describe('autosave payload has a single constructor', () => {
  const sites = findCallSites()

  it('finds the call sites at all (positive control — an empty sweep proves nothing)', () => {
    // If this ever hits zero the walker is broken and every assertion below is
    // vacuous. Absence assertions must first prove they can see a presence.
    expect(sites.length).toBeGreaterThan(0)
    expect(sites.map(s => s.file)).toContain('canvas/hooks/useAutosave.ts')
  })

  it('every saveAutosave call is passed projectAutosaveData(...)', () => {
    const offenders = sites.filter(s => !s.argument.startsWith('projectAutosaveData('))
    expect(
      offenders.map(o => `${o.file}:${o.line} → saveAutosave(${o.argument.slice(0, 60)}…)`),
    ).toEqual([])
  })

  it('no production module builds an AutosaveData literal outside the projection', () => {
    // A hand-built literal is recognisable by a `timestamp:` sibling of
    // `nodes:` in the same object passed to saveAutosave.
    const handBuilt = sites.filter(s => /^\{|timestamp\s*:/.test(s.argument))
    expect(handBuilt.map(o => `${o.file}:${o.line}`)).toEqual([])
  })
})
