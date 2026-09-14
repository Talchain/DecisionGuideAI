/**
 * ⭐⭐ THE BRAND PROTECTS THE CALLS. THIS PROTECTS THE READS.
 *
 * `strengthenStore` keys records by (decision, finding). Every WRITE goes
 * through a mutator taking a branded `RecordKey`, so a bare finding id is a
 * compile error and the call sites cannot drift.
 *
 * **The reads have no such protection.** `records` is a `Record<string, …>`, so
 *
 *     strengthenRecords[rec.id]
 *
 * compiles perfectly, returns `undefined`, and the feature silently stops
 * working with no red anywhere. Two of these were shipped in the very change
 * that introduced the key — one in `StrengthenContainer`'s direct-credit
 * effects, one rendering the standing objection in `StrengthenTheReasoning` —
 * and BOTH were found by a test failing for a confusing reason, not by reading
 * the code. That is the signature of a defect class that needs a scanner.
 *
 * ── WHAT IT CHECKS ─────────────────────────────────────────────────────────
 * Every index into a strengthen `records` map in PRODUCT code composes its key
 * through `recordKey(...)`. It is a source scan, so:
 *
 * ⚠ IT CANNOT PROVE THE KEY IS THE *RIGHT* ONE. `recordKey(someOtherDecision,
 * id)` passes this and is still wrong. It catches the mechanical omission —
 * which is the one that actually happened, twice — and claims nothing more.
 *
 * ⚠ IT SCANS SOURCE AND SO CANNOT TELL PROSE FROM CODE. Comments are stripped
 * first, and the positive control below proves the stripper did not simply eat
 * the file: an absence assertion over an empty string passes beautifully.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_SRC = join(__dirname, '..', '..', '..')

/**
 * The product files that index a strengthen records map.
 *
 * ⚠ A HAND-LISTED SET, AND THE COMPLETENESS ASSERTION BELOW IS WHY THAT IS NOT
 * A HAND-MAINTAINED MIRROR (trap 12). A list alone would go stale the moment a
 * third consumer appears — silently, reading green. So the list is checked
 * against a DERIVED sweep of the tree, and a new consumer REDs this file until
 * it is either listed or fixed.
 */
const KNOWN_CONSUMERS = [
  'canvas/stores/strengthenStore.ts',
  'components/results/strengthen/StrengthenContainer.tsx',
  'components/results/analysisNew/sections/StrengthenTheReasoning.tsx',
  /* ⭐ FOUND BY THE COMPLETENESS SWEEP BELOW, not by hand — and it was the
     worst of the three bare-id reads: it filters the ACTIVE list, so an
     unkeyed index made `!record` unconditionally true and every addressed or
     dismissed finding would have come back. */
  'components/results/analysisNew/useAnalysisNewViewModel.ts',
]

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** Every `<something>records[<expr>]` index, with its key expression. */
function recordIndexes(code: string): string[] {
  const out: string[] = []
  const re = /[Rr]ecords\[([^\]]*)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) out.push(m[1].trim())
  return out
}

describe('THE SCANNER WORKS (positive control)', () => {
  it('finds an index and reports its key expression', () => {
    expect(recordIndexes('const r = strengthenRecords[rec.id]')).toEqual(['rec.id'])
  })

  it('⭐ flags a BARE id and passes a keyed one — the discriminating pair', () => {
    const bad = recordIndexes('records[rec.id]').filter((k) => !k.includes('recordKey('))
    const good = recordIndexes('records[recordKey(scenarioId, rec.id)]').filter(
      (k) => !k.includes('recordKey('),
    )
    // One alone proves nothing: the first shows it can fail, the second shows it
    // is not simply failing on everything.
    expect(bad).toEqual(['rec.id'])
    expect(good).toEqual([])
  })

  it('…and does NOT see an index that appears only in a comment', () => {
    expect(recordIndexes(stripComments('/* records[rec.id] was the old way */'))).toEqual([])
    expect(recordIndexes(stripComments('// like records[id], but keyed'))).toEqual([])
  })

  it('the files it reads are real and non-empty', () => {
    for (const rel of KNOWN_CONSUMERS) {
      expect(readFileSync(join(REPO_SRC, rel), 'utf8').length).toBeGreaterThan(500)
    }
  })
})

/**
 * ⚠ THE LIST IS CHECKED AGAINST THE TREE, WHICH IS WHAT KEEPS IT FROM BEING A
 * HAND-MAINTAINED MIRROR. A list alone goes stale the moment a fourth consumer
 * appears, silently and green — the estate's dominant defect (trap 12). This
 * derives the consumer set and REDs when it disagrees, so a new consumer cannot
 * be added without someone deciding what to do about it.
 */
function sweepConsumers(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === '__fixtures__') continue
      sweepConsumers(full, acc)
      continue
    }
    if (!/\.tsx?$/.test(name) || /\.spec\.|\.d\.ts$/.test(name)) continue
    const code = stripComments(readFileSync(full, 'utf8'))
    // A consumer both KNOWS the store and INDEXES a records map. Either alone
    // is not a consumer of this key: plenty of files import the store only for
    // its selectors, and other stores have their own `records`.
    const knowsStore = /strengthenStore|useStrengthenStore/.test(code)
    if (knowsStore && recordIndexes(code).length > 0) {
      acc.push(relative(REPO_SRC, full))
    }
  }
  return acc
}

describe('THE CONSUMER LIST IS DERIVED, NOT REMEMBERED', () => {
  it('the sweep finds something at all (positive control)', () => {
    // An empty sweep would make the equality below pass against an empty list.
    expect(sweepConsumers(REPO_SRC).length).toBeGreaterThan(0)
  })

  it('⭐ the tree holds exactly the consumers this file checks', () => {
    expect(sweepConsumers(REPO_SRC).sort()).toEqual([...KNOWN_CONSUMERS].sort())
  })
})

describe('every product read of a strengthen record composes its key', () => {
  it('⭐ no bare-id index survives in any known consumer', () => {
    const offenders: string[] = []
    for (const rel of KNOWN_CONSUMERS) {
      const code = stripComments(readFileSync(join(REPO_SRC, rel), 'utf8'))
      for (const key of recordIndexes(code)) {
        // `key` and `[key]` are the store's own already-composed variable; a
        // literal string key inside the store's persistence shape is not a
        // record index. Everything else must name `recordKey`.
        if (key === 'key' || key === 'rel' || key.includes('recordKey(')) continue
        offenders.push(`${rel} → records[${key}]`)
      }
    }
    expect(offenders).toEqual([])
  })
})
