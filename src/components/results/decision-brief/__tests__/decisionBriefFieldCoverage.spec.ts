/**
 * ⭐ THE ANTI-DARK GUARD — derived, not a census.
 *
 * The estate's dominant loss class is working code no user can reach. The UI
 * mappers are key-by-key allow-lists, so a new producer field is DARK BY DEFAULT
 * and fails silently with green suites at every other hop — measured on this very
 * surface, where `defaulted_assumptions` sat on the wire with zero readers.
 *
 * A hand-written list of "fields we handle" would drift into exactly that. So the
 * OBSERVED side of this guard is DERIVED: it walks the committed live captures and
 * takes the real union of `decision_brief` keys the producer has actually sent. The
 * DECIDED side is the four classification sets in the view model. A member on the
 * wire that belongs to none of them is unclassified — the guard NAMES it and fails.
 *
 * WHAT THIS CANNOT DO, stated plainly: deriving from captures proves agreement with
 * what the producer HAS sent, never with what it COULD send. A member that has never
 * appeared in a committed capture is invisible here. That is the known limit of a
 * derived guard (it moves the risk, it does not remove it), and it is why the
 * classification carries reasons a human can audit rather than just names.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  DECISION_BRIEF_CLASSIFIED,
  DECISION_BRIEF_RENDERED_HERE,
  DECISION_BRIEF_CONSUMED_AS_IDENTITY,
  DECISION_BRIEF_OWNED_ELSEWHERE,
  DECISION_BRIEF_DECLARED_DARK,
} from '../decisionBriefViewModel'

const FIXTURE_ROOTS = [
  'src/v5/__tests__/fixtures',
  'src/canvas/compare-tab/__tests__/__fixtures__',
]

function jsonFiles(dir: string): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return [] }
  return entries.flatMap(entry => {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) return jsonFiles(full)
    if (!entry.endsWith('.json') || st.size > 20_000_000) return []
    return [full]
  })
}

function* walk(value: unknown): Generator<[string, unknown]> {
  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item)
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      yield [k, v]
      yield* walk(v)
    }
  }
}

function observedDecisionBriefKeys(): { keys: Set<string>, briefs: number, files: number } {
  const keys = new Set<string>()
  let briefs = 0
  const files = FIXTURE_ROOTS.flatMap(jsonFiles)
  for (const file of files) {
    let parsed: unknown
    try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch { continue }
    for (const [k, v] of walk(parsed)) {
      if (k === 'decision_brief' && v && typeof v === 'object' && !Array.isArray(v)) {
        briefs += 1
        for (const member of Object.keys(v as Record<string, unknown>)) keys.add(member)
      }
    }
  }
  return { keys, briefs, files: files.length }
}

describe('decision_brief field coverage — derived from real captures', () => {
  const { keys, briefs, files } = observedDecisionBriefKeys()

  it('the scan can actually see captures (positive control)', () => {
    // An absence assertion with a blind instrument proves nothing. If this fails,
    // every other assertion in this file is vacuous, so it is asserted first.
    expect(files).toBeGreaterThan(0)
    expect(briefs).toBeGreaterThan(0)
    expect(keys.size).toBeGreaterThan(0)
    // A member that must be present, or the walk is not reaching the object.
    expect(keys.has('top_drivers')).toBe(true)
  })

  it('every producer member observed on the wire is classified', () => {
    const unclassified = [...keys].filter(k => !DECISION_BRIEF_CLASSIFIED.includes(k)).sort()
    expect(
      unclassified,
      unclassified.length === 0 ? '' : `Unclassified decision_brief member(s): ${unclassified.join(', ')}. `
        + 'A producer field is DARK BY DEFAULT on this surface. Add each to exactly one of '
        + 'DECISION_BRIEF_RENDERED_HERE, DECISION_BRIEF_CONSUMED_AS_IDENTITY, '
        + 'DECISION_BRIEF_OWNED_ELSEWHERE or DECISION_BRIEF_DECLARED_DARK (with a reason).',
    ).toEqual([])
  })

  it('no member is classified twice', () => {
    const all = [...DECISION_BRIEF_CLASSIFIED]
    const duplicates = all.filter((k, i) => all.indexOf(k) !== i)
    expect(duplicates).toEqual([])
  })

  it('every deliberately-dark member states why', () => {
    for (const [member, reason] of Object.entries(DECISION_BRIEF_DECLARED_DARK)) {
      expect(reason.trim().length, `${member} needs a reason`).toBeGreaterThan(20)
    }
    for (const [member, reason] of Object.entries(DECISION_BRIEF_OWNED_ELSEWHERE)) {
      expect(reason.trim().length, `${member} needs a reason`).toBeGreaterThan(20)
    }
  })

  it('what this surface renders is exactly what the view model exposes', () => {
    expect([...DECISION_BRIEF_RENDERED_HERE].sort()).toEqual([
      // `robustness_caveat` moved here from DECLARED_DARK when it gained a
      // renderer. The exactly-once rule is what forced the old entry to be
      // removed rather than left behind as a stale second classification.
      'defaulted_assumptions', 'robustness_caveat', 'top_drivers', 'what_would_change',
    ])
    expect([...DECISION_BRIEF_CONSUMED_AS_IDENTITY].sort()).toEqual([
      'brief_id', 'created_at', 'version',
    ])
  })
})
