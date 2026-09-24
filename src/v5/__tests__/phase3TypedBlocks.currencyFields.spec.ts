/**
 * Run-turn provenance on the typed coaching adapter — ADDITIVE ONLY.
 *
 * `adaptTypedCoachingBlock` now carries `source_handler` and `created_at`
 * verbatim, because the run-turn currency rule (`coachingCurrency.ts`) needs
 * both: a `run_analysis` card is current only while its `created_at` equals
 * the current `run_state.computed_at`.
 *
 * The change must be additive in the strict sense: for EVERY coaching block
 * this repo has ever captured, the adapted output with those two keys removed
 * must be byte-identical to what the adapter produced before they existed.
 * "Before" is computed by adapting the SAME raw block with the two raw keys
 * stripped — the previous adapter never read them, so that is exactly its
 * output. Compared as JSON strings, so key ORDER is pinned too, not just
 * deep equality.
 *
 * The corpus is DERIVED from the filesystem (every capture under the named
 * roots), never a hand list, so a capture added later is covered without an
 * edit here.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import { adaptTypedCoachingBlock } from '../phase3TypedBlocks'

const REPO_ROOT = resolve(__dirname, '../../..')

/** Every JSON file under `dir`, recursively. */
function jsonFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...jsonFilesUnder(path))
    else if (name.endsWith('.json')) out.push(path)
  }
  return out
}

/**
 * The corpus: the brief's two roots (`tests/fixtures/cee-responses/**` and the
 * `live-analysis-turn-*` captures), plus every other V5 and coherence capture
 * that carries a coaching block — a superset, never a subset.
 */
const CORPUS_FILES = [
  ...jsonFilesUnder(join(REPO_ROOT, 'tests/fixtures/cee-responses')),
  ...jsonFilesUnder(join(REPO_ROOT, 'src/v5/__tests__/fixtures')),
  ...jsonFilesUnder(join(REPO_ROOT, 'src/lib/coherence/__tests__/fixtures/captures')),
  // The producer's own run-turn golden payload — the only `run_analysis` cards in the corpus.
  join(REPO_ROOT, 'src/canvas/conversation/__tests__/fixtures/run-turn-coaching-fragile-link.producer-v3.json'),
].sort()

/** Every raw object typed `coaching`, at any depth. */
function rawCoachingBlocks(value: unknown, out: Array<Record<string, unknown>> = []) {
  if (Array.isArray(value)) {
    for (const v of value) rawCoachingBlocks(v, out)
  } else if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj.type === 'coaching') out.push(obj)
    for (const v of Object.values(obj)) rawCoachingBlocks(v, out)
  }
  return out
}

const CORPUS = CORPUS_FILES.map((file) => ({
  file: relative(REPO_ROOT, file),
  blocks: rawCoachingBlocks(JSON.parse(readFileSync(file, 'utf8'))),
}))

function without<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): T {
  const copy: Record<string, unknown> = { ...obj }
  for (const k of keys) delete copy[k]
  return copy as T
}

const NEW_KEYS = ['source_handler', 'created_at'] as const

function rawCoaching(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'coaching',
    block_id: 'blk_currency_fields',
    title: 'Pressure-test a sensitive link',
    body:
      'The robustness check found the result sensitive to the link from Pro subscriber base to MRR — ' +
      'worth checking what the estimate of how strongly Pro subscriber base drives MRR rests on.',
    coaching_kind: 'assumption_check',
    source: 'deterministic_signal',
    target_refs: [],
    priority_rank: 15,
    freshness: 'fresh',
    graph_hash_at_generation: '2cac03f2a47449be',
    ...overrides,
  }
}

describe('adaptTypedCoachingBlock — source_handler / created_at carried verbatim', () => {
  it('carries both producer strings character-for-character', () => {
    const adapted = adaptTypedCoachingBlock(
      rawCoaching({ source_handler: 'run_analysis', created_at: '2026-09-24T16:47:26.848Z' }),
    )
    expect(adapted?.source_handler).toBe('run_analysis')
    expect(adapted?.created_at).toBe('2026-09-24T16:47:26.848Z')
  })

  it('never parses or normalises the timestamp (an offset form stays an offset form)', () => {
    const adapted = adaptTypedCoachingBlock(rawCoaching({ created_at: '2026-09-24T17:47:26.848+01:00' }))
    expect(adapted?.created_at).toBe('2026-09-24T17:47:26.848+01:00')
  })

  it.each([
    ['absent', undefined],
    ['blank', '   '],
    ['empty', ''],
    ['a number', 42],
    ['an object', { v: 'run_analysis' }],
    ['null', null],
  ])('omits both keys when the raw value is %s — and still adapts the card', (_label, value) => {
    const raw = rawCoaching()
    if (value !== undefined) {
      raw.source_handler = value
      raw.created_at = value
    }
    const adapted = adaptTypedCoachingBlock(raw)
    expect(adapted, 'absence costs the currency verdict, never the card').not.toBeNull()
    expect('source_handler' in (adapted as object)).toBe(false)
    expect('created_at' in (adapted as object)).toBe(false)
  })
})

describe('every captured coaching block adapts byte-identically, bar the two new keys', () => {
  it('the corpus is non-trivial and includes the live analysis-turn captures', () => {
    // Precondition (trap 13b): a corpus that silently stopped finding blocks
    // would make the identity check below pass by testing nothing.
    const liveTurnFiles = CORPUS.filter((c) => /live-analysis-turn-.*\.json$/.test(c.file))
    expect(liveTurnFiles.length).toBeGreaterThanOrEqual(5)
    const total = CORPUS.reduce((n, c) => n + c.blocks.length, 0)
    expect(total).toBeGreaterThanOrEqual(25)
    // And the new fields are actually PRESENT on the wire in that corpus, so
    // the strip below removes something real rather than a no-op.
    const carrying = CORPUS.flatMap((c) => c.blocks).filter(
      (b) => typeof b.source_handler === 'string' && typeof b.created_at === 'string',
    )
    expect(carrying.length).toBeGreaterThanOrEqual(25)
  })

  for (const { file, blocks } of CORPUS) {
    it(`${file} (${blocks.length} coaching block${blocks.length === 1 ? '' : 's'})`, () => {
      for (const raw of blocks) {
        const before = adaptTypedCoachingBlock(without(raw, NEW_KEYS))
        const after = adaptTypedCoachingBlock(raw) as unknown as Record<string, unknown> | null
        if (before === null) {
          expect(after, `${String(raw.block_id)}: the new fields must never rescue a rejected block`).toBeNull()
          continue
        }
        expect(after).not.toBeNull()
        expect(JSON.stringify(without(after as Record<string, unknown>, NEW_KEYS))).toBe(
          JSON.stringify(before),
        )
        // The two keys that differ are exactly the verbatim producer values.
        for (const key of NEW_KEYS) {
          const rawValue = raw[key]
          if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
            expect((after as Record<string, unknown>)[key]).toBe(rawValue)
          } else {
            expect(key in (after as object)).toBe(false)
          }
        }
      }
    })
  }
})
