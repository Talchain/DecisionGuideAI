/**
 * DIVERGENCE — the UI's per-option compute predicate against the PRODUCER's
 * own classification, over the LIVE CAPTURE CORPUS.
 *
 * ## Why the corpus comes from outside this lane's head (CLAUDE.md trap 22)
 *
 * The thing under test is a predicate over PRODUCER OUTPUT. A corpus I write
 * myself encodes my model of the producer rather than the producer, and a full
 * mutant kit against it is a perfect score on the wrong exam (trap 13c). So the
 * corpus here is the twelve captured payloads in `src/v5/__tests__/fixtures/`,
 * read whole — HISTORIC RECORDS, appended to but never edited (trap 14b).
 *
 * The chain driven is the REAL one, end to end: fixture bytes →
 * `mapV5AnalysisToReport` (the V5 canonical mapper, the live analyse path) →
 * `option_probabilities` → `optionComputationProducedResult`. Nothing is
 * hand-shaped in between, so a field dropped at any hop shows up here as a
 * disagreement rather than as a green test about a synthetic object.
 *
 * ## ⚠⚠ WHAT THIS CORPUS CAN AND CANNOT CERTIFY — STATED, NOT ASSUMED
 *
 * DERIVED (not inherited) by reading all twelve files at this tip:
 *
 *   · 9 of 12 carry `enrichment.option_comparison[]` with a per-option `status`,
 *     and EVERY ONE of the 34 entries reads `'computed'`.
 *   · 1 of 12 (`v5-analysis-result.staging-real-shape.json`) carries
 *     `option_comparison[]` with NO `status` key at all — the legacy shape, and
 *     a genuine captured absent-status control rather than one I invented.
 *   · `status_reason` appears ZERO times, on any option, in any capture.
 *   · `'partial'` and `'failed'` appear ZERO times.
 *
 * So this corpus is ONE-DIRECTIONAL. It certifies that the predicate does not
 * FALSELY SUPPRESS anything the live wire actually sends — which is the failure
 * direction that would break every working run, and the one an author's own
 * corpus is least likely to contain (trap 22b: a corpus that tests one
 * direction is a guard watching one door). It certifies NOTHING about the
 * `'failed'` direction, because the wire has never sent one here. The failed
 * direction is pinned separately, against the PRODUCER'S DECLARED CONTRACT
 * rather than against a capture, in `optionComputeStatus.spec.ts` and the two
 * render specs — and that limit is reported, not papered over.
 *
 * ## The instrument proves itself before it is believed (trap 13 / 13e)
 *
 * Every extraction here asserts a NON-ZERO, EXPECTED count by name before any
 * agreement is claimed. A locator that finds nothing agrees with every other
 * locator that finds nothing, and `expect(a).toEqual(b)` on two empty arrays is
 * a green test about no data at all. The magnitudes are pinned as exact numbers
 * so a fixture that stops parsing REDs instead of quietly shrinking.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { optionComputationProducedResult } from '../utils/notAnalysedOptions'
import { narrowOptionComputeStatus } from '../../../adapters/plot/optionComputeStatus'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'
import type { ResultsOptionProbability } from '../types'

const FIXTURE_DIR = join(__dirname, '../../../v5/__tests__/fixtures')

/** Every captured payload, read whole. Never filtered by name. */
function fixtureFiles(): string[] {
  return readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
}

interface RawEntry {
  readonly file: string
  readonly optionId: string
  /** The producer's own token, UNNARROWED — read straight off the capture. */
  readonly rawStatus: unknown
}

/**
 * Walk a captured payload and yield every `option_comparison[]` entry, wherever
 * the envelope happens to nest it.
 *
 * ⚠ THE NESTING GENUINELY DIFFERS ACROSS CAPTURES — `blocks[0].enrichment`,
 * `enrichment`, and `block.enrichment` all occur — so a locator pinned to one
 * path would silently return zero for two thirds of the corpus and look exactly
 * like a corpus with no statuses in it. Walking for the KEY rather than for a
 * path is what makes the count below trustworthy.
 */
function collectRawEntries(file: string, node: unknown, out: RawEntry[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectRawEntries(file, child, out)
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'option_comparison' && Array.isArray(value)) {
      for (const entry of value) {
        if (entry !== null && typeof entry === 'object') {
          const e = entry as Record<string, unknown>
          const optionId = typeof e.option_id === 'string' ? e.option_id : String(e.id ?? '')
          out.push({ file, optionId, rawStatus: e.status })
        }
      }
    }
    collectRawEntries(file, value, out)
  }
}

/** Every analysis block in a capture, wherever it is nested. */
function collectAnalysisBlocks(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectAnalysisBlocks(child, out)
    return
  }
  if (node === null || typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  if (obj.enrichment !== null && typeof obj.enrichment === 'object') {
    const enrichment = obj.enrichment as Record<string, unknown>
    if (Array.isArray(enrichment.option_comparison)) out.push(obj)
  }
  for (const value of Object.values(obj)) collectAnalysisBlocks(value, out)
}

const RAW_ENTRIES: RawEntry[] = (() => {
  const out: RawEntry[] = []
  for (const file of fixtureFiles()) {
    out.push(
      ...(() => {
        const acc: RawEntry[] = []
        collectRawEntries(file, JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')), acc)
        return acc
      })(),
    )
  }
  return out
})()

describe('live-capture corpus — the instrument, before any agreement is claimed', () => {
  it('reads all twelve captured payloads', () => {
    // Pinned exactly. A fixture added to the directory REDs here on purpose:
    // the scope sentences in this file's header are claims about a specific
    // corpus, and a corpus that grows without those claims being re-derived is
    // trap 20 (an honest scope generalised into a false one by a later edit).
    expect(fixtureFiles()).toHaveLength(12)
  })

  it('extracts a NON-ZERO, expected number of per-option entries', () => {
    // ⚠ THE POSITIVE CONTROL FOR EVERY ASSERTION BELOW. Without this, a
    // locator that matched nothing would make every `every(...)` below vacuously
    // true and the file would be green about no data at all (trap 13).
    expect(RAW_ENTRIES.length).toBe(38)
    expect(new Set(RAW_ENTRIES.map((e) => e.file)).size).toBe(10)
  })

  it('holds BOTH classes the corpus actually contains — present status AND absent status', () => {
    // ⭐ THE CONTRAST CONTROL, INSIDE THE CORPUS (trap 13e). An absence claim
    // needs a probe that is demonstrably discriminating, and "some entries have
    // a status, some do not" is that discrimination — read off real captures,
    // not constructed.
    const withStatus = RAW_ENTRIES.filter((e) => e.rawStatus !== undefined)
    const withoutStatus = RAW_ENTRIES.filter((e) => e.rawStatus === undefined)
    expect(withStatus).toHaveLength(34)
    expect(withoutStatus).toHaveLength(4)
    expect(new Set(withoutStatus.map((e) => e.file))).toEqual(
      new Set(['v5-analysis-result.staging-real-shape.json']),
    )
  })

  it('DECLARES THE CORPUS LIMIT: every captured status is "computed" — no failed, no partial', () => {
    // ⚠⚠ THIS TEST EXISTS TO STOP A FUTURE READER TREATING THIS FILE AS
    // EVIDENCE ABOUT THE FAILED DIRECTION. It is not. If a capture ever arrives
    // carrying 'failed' or 'partial' this REDs, and that RED is the signal to
    // widen the agreement assertions below and to correct this file's header —
    // not to relax the pin. A known gap recorded in the suite is honest; a gap
    // invisible to it is how a corpus silently starts certifying more than it
    // saw (trap 22f).
    expect(new Set(RAW_ENTRIES.map((e) => e.rawStatus))).toEqual(
      new Set(['computed', undefined]),
    )
  })

  it('DECLARES THE CORPUS LIMIT: status_reason is absent from every captured option', () => {
    // So no render path may gate its disclosure on `status_reason` being
    // present: on every payload we have ever seen, it is not.
    const withReason: string[] = []
    for (const file of fixtureFiles()) {
      const raw = readFileSync(join(FIXTURE_DIR, file), 'utf8')
      if (raw.includes('"status_reason"')) withReason.push(file)
    }
    expect(withReason).toEqual([])
    // Contrast control in the SAME sweep: a sibling key we KNOW the corpus
    // carries. Without it, `[]` is equally consistent with "the files did not
    // load" (trap 13e — a positive control must be plausible, not merely
    // present).
    const withStatusKey = fixtureFiles().filter((f) =>
      readFileSync(join(FIXTURE_DIR, f), 'utf8').includes('"status"'),
    )
    expect(withStatusKey.length).toBeGreaterThanOrEqual(9)
  })
})

describe('DIVERGENCE — the UI predicate vs the producer, over the live corpus', () => {
  /**
   * The REAL mapper, driven on the REAL captured blocks. Each entry is the
   * producer's own token beside what the predicate concluded after the full
   * mapper hop — so a field dropped in the mapper shows up as a disagreement
   * rather than being invisible.
   */
  const rows = (() => {
    const out: Array<{
      file: string
      optionId: string
      producerSaysComputed: boolean
      uiSaysComputed: boolean
      carriedStatus: unknown
    }> = []
    for (const file of fixtureFiles()) {
      const payload = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8'))
      const blocks: Record<string, unknown>[] = []
      collectAnalysisBlocks(payload, blocks)
      for (const block of blocks) {
        const report = mapV5AnalysisToReport(block as unknown as AnalysisResultBlock)
        const probs = (report.option_probabilities ?? {}) as Record<
          string,
          ResultsOptionProbability
        >
        const enrichment = block.enrichment as Record<string, unknown>
        for (const entry of enrichment.option_comparison as Record<string, unknown>[]) {
          const optionId =
            typeof entry.option_id === 'string' ? entry.option_id : String(entry.id ?? '')
          const mapped = probs[optionId]
          if (mapped === undefined) continue
          out.push({
            file,
            optionId,
            // THE PRODUCER'S ANSWER, read off the raw capture — deliberately
            // NOT through the mapper, so the two sides of this comparison come
            // from genuinely different reads.
            producerSaysComputed: narrowOptionComputeStatus(entry.status) !== 'failed',
            uiSaysComputed: optionComputationProducedResult(mapped.status),
            carriedStatus: mapped.status,
          })
        }
      }
    }
    return out
  })()

  it('drove a NON-ZERO, expected number of options through the real mapper', () => {
    // The same rule as above, one hop later: an empty `rows` would make every
    // agreement assertion below vacuous.
    expect(rows.length).toBe(38)
  })

  it('THE MAPPER NO LONGER DROPS THE FIELD — status survives the rebuild', () => {
    // ⭐ THE REGRESSION PIN AT THE HEART OF THIS CHANGE. Before it, the V5
    // mapper rebuilt each option key by key and `status` — present on 34 of
    // these 38 captured entries — did not survive. Bound by COUNT and by the
    // exact carried value, not by "some option somewhere has a status".
    const carried = rows.filter((r) => r.carriedStatus !== undefined)
    expect(carried).toHaveLength(34)
    expect(new Set(carried.map((r) => r.carriedStatus))).toEqual(new Set(['computed']))
    // And the four legacy-shape entries stay ABSENT: absent in, absent out.
    // A `?? 'computed'` default in the mapper would turn this 4 into 0.
    expect(rows.filter((r) => r.carriedStatus === undefined)).toHaveLength(4)
  })

  it('the UI predicate and the producer agree on EVERY captured option', () => {
    const disagreements = rows.filter((r) => r.producerSaysComputed !== r.uiSaysComputed)
    // Reported with identities, not as a bare count, so a failure names the
    // option and the capture rather than sending the reader hunting.
    expect(
      disagreements.map((d) => `${d.file}#${d.optionId}`),
    ).toEqual([])
  })

  it('and the agreement is on TRUE, not on two empty sets', () => {
    // ⚠ `producerSaysComputed !== uiSaysComputed` is satisfiable by both sides
    // saying `false` for everything — i.e. by a predicate that suppresses the
    // entire live wire. That would be catastrophic and the equality test above
    // could not see it. This is the assertion that makes the agreement mean
    // something (trap 13b: ask what would have to be true for the guard to pass
    // while the property fails, then write THAT case).
    expect(rows.every((r) => r.uiSaysComputed)).toBe(true)
    expect(rows.filter((r) => r.uiSaysComputed)).toHaveLength(38)
  })
})
