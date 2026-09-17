/**
 * ⭐⭐ THE CARD MAY ONLY ASK FOR WHAT THE PRODUCER SENDS — pinned against the
 * repo's own captures rather than against a fixture I wrote.
 *
 * ⚠ THE CORPUS IS DERIVED IN-TEST, NOT COPIED. The staging golden path, the CEE
 * response fixtures and the starter captures are already in this repo; walking
 * them here means the table below cannot drift from them the way a pasted
 * snapshot would (CLAUDE.md trap 12 — the hand-maintained mirror). It also means
 * this file REDs the day CEE starts sending a quantity on a kind that has none,
 * which is the event that would make a whole card design buildable.
 *
 * ⛔ THE MEASUREMENT THAT REDIRECTED THIS WORK. This module was written for
 * `OutcomeNode` first — an outcome labelled "Monthly Recurring Revenue" printing
 * neither a value nor a unit is the most visible instance of the defect. Then
 * the corpus said outcomes carry `id`, `kind`, `label`, `provenance` and nothing
 * else, on 15 of 15. Wiring it there would have shipped a feature that never
 * renders. The assertions below keep that finding executable.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { nodeRecordedValue } from '../nodeRecordedValue'

const ROOT = resolve(__dirname, '../../../..')

/**
 * Every captured payload already committed to this repo.
 *
 * ⚠ `readdirSync`, NOT `globSync` — and this is not a style preference. The
 * first version used `node:fs`'s `globSync` inside a `try/catch`; it is absent
 * on this runtime, the catch swallowed it, and the walk silently read 22 nodes
 * instead of 78. Every assertion below still passed. Only the precondition's
 * COUNT caught it — a silent no-op wearing a successful transform, and a catch
 * that turns an instrument failure into a smaller corpus is the worst possible
 * place for one.
 */
function corpusFiles(): string[] {
  const out: string[] = []
  const golden = resolve(ROOT, 'src/test/fixtures/golden-path-staging-2026-04-05.json')
  if (existsSync(golden)) out.push(golden)
  const walkDir = (dir: string): void => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walkDir(full)
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full)
    }
  }
  walkDir(resolve(ROOT, 'tests/fixtures/cee-responses'))
  walkDir(resolve(ROOT, 'docs/evidence/starters'))
  return out
}

type WireNode = Record<string, unknown> & { kind?: string; type?: string; id?: string; label?: string }

function collectNodes(): WireNode[] {
  const seen = new Set<string>()
  const nodes: WireNode[] = []
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { for (const v of o) walk(v); return }
    if (!o || typeof o !== 'object') return
    const rec = o as WireNode
    const kind = (rec.kind ?? rec.type) as string | undefined
    if (typeof kind === 'string' && typeof rec.id === 'string' && typeof rec.label === 'string') {
      const key = `${kind}|${rec.id}|${rec.label}|${JSON.stringify(rec.observed_state ?? null)}`
      if (!seen.has(key)) { seen.add(key); nodes.push(rec) }
    }
    for (const v of Object.values(rec)) walk(v)
  }
  for (const f of corpusFiles()) {
    try { walk(JSON.parse(readFileSync(f, 'utf8'))) } catch { /* not a payload */ }
  }
  return nodes
}

/** The canvas shape: ingest passes `observed_state` through as `observedState`. */
const toCanvasData = (n: WireNode): Record<string, unknown> => ({
  label: n.label,
  category: n.category,
  display_value: n.display_value,
  ...(n.observed_state ? { observedState: n.observed_state } : {}),
})

const ofKind = (nodes: WireNode[], kind: string) => nodes.filter(n => (n.kind ?? n.type) === kind)

describe('nodeRecordedValue, against the payloads this repo has actually captured', () => {
  const nodes = collectNodes()

  it('PRECONDITION: the corpus loaded and carries every kind — without this every claim below is vacuous', () => {
    expect(nodes.length, 'no captured nodes were read; the assertions below would all pass on nothing').toBeGreaterThan(40)
    for (const kind of ['factor', 'option', 'risk', 'outcome', 'goal', 'decision']) {
      expect(ofKind(nodes, kind).length, `no ${kind} nodes in the corpus`).toBeGreaterThan(0)
    }
  })

  it('⭐ RISKS DO CARRY A RECORDED VALUE — the datum the risk card was not reading', () => {
    const risks = ofKind(nodes, 'risk')
    const answered = risks.filter(r => nodeRecordedValue(toCanvasData(r)) !== null)
    expect(answered.length, 'no risk in the corpus resolves a value; the RiskNode row would be dark').toBeGreaterThan(0)
    // Bound by identity, never by a value predicate another node could satisfy
    // (CLAUDE.md trap 19): this exact risk, this exact string.
    const timeToTarget = risks.find(r => r.label === 'Time to Reach Customer Target')
    expect(timeToTarget, 'precondition: the named risk is in the corpus').toBeTruthy()
    expect(nodeRecordedValue(toCanvasData(timeToTarget!))).toBe('12 months')
  })

  it('⛔ OUTCOMES AND DECISIONS CARRY NO QUANTITY AT ALL — so no card may be designed around one', () => {
    for (const kind of ['outcome', 'decision']) {
      const ns = ofKind(nodes, kind)
      const answered = ns.filter(n => nodeRecordedValue(toCanvasData(n)) !== null)
      expect(
        answered.map(n => n.label),
        `a ${kind} now resolves a value. The producer has changed: an ${kind} card can be given ` +
          'a recorded-value row, and the design record in output/node-system-20260917 is stale.',
      ).toEqual([])
    }
    // ⚠ THE CONTRAST THAT MAKES THE ZERO READABLE (CLAUDE.md trap 13e). Without
    // it, a broken walker that found nothing would pass this test perfectly.
    const factorsAnswered = ofKind(nodes, 'factor').filter(n => nodeRecordedValue(toCanvasData(n)) !== null)
    expect(factorsAnswered.length, 'contrast control dead: the reader resolves nothing anywhere, so the zeros above prove nothing').toBeGreaterThan(5)
  })

  it('⛔ A ZERO MAGNITUDE IS DECLINED — it is where the formatter mints sentences nobody sent', () => {
    // Found by running this module against the real payloads before shipping it.
    // `formatFactorDisplayValue`'s zero branches produce "No cost allocated" over
    // CEE's own "£400,000 budget cap", and "£0" over "No budget pressure
    // currently". Those cards render nothing today, so admitting them would make
    // an existing fabrication NEWLY VISIBLE on a surface that did not have it.
    const costAtZero = {
      label: 'Budget Overrun',
      display_value: '£400,000 budget cap',
      observedState: { raw_value: 0, unit: '£', value: 0, factor_type: 'cost', cap: 0 },
    }
    const bareZero = {
      label: 'Budget Overrun Risk',
      display_value: 'No budget pressure currently',
      observedState: { raw_value: 0, unit: '£', value: 0, cap: 0 },
    }
    expect(nodeRecordedValue(costAtZero)).toBeNull()
    expect(nodeRecordedValue(bareZero)).toBeNull()

    // ⚠ THE CONTRAST, IN THE SAME RUN. Without it this passes on a module that
    // returns null for everything, which is the failure mode it is guarding.
    expect(nodeRecordedValue({
      label: 'Time to Reach Customer Target',
      display_value: '12 months',
      observedState: { raw_value: 12, unit: 'months', value: 0.5, factor_type: 'time', cap: 24 },
    })).toBe('12 months')
  })

  it('returns null rather than a placeholder, so each caller owns what absence looks like', () => {
    expect(nodeRecordedValue(undefined)).toBeNull()
    expect(nodeRecordedValue(null)).toBeNull()
    expect(nodeRecordedValue({})).toBeNull()
    expect(nodeRecordedValue({ label: 'Bare risk' })).toBeNull()
  })

  it('is the shared formatter, not a second one — the same data yields the same string', async () => {
    // Derived, never a hand-written expectation: if the owner's rendering
    // changes, this follows it. A re-implementation here would diverge and this
    // is what would catch it.
    const { factorDisplayText } = await import('../../../utils/formatFactorDisplayValue')
    const risks = ofKind(nodes, 'risk').map(toCanvasData)
    const answered = risks.filter(d => nodeRecordedValue(d) !== null)
    expect(answered.length, 'precondition: something resolves, or the loop below asserts nothing').toBeGreaterThan(0)
    for (const d of answered) {
      expect(nodeRecordedValue(d)).toBe((factorDisplayText(d) ?? '').trim())
    }
  })
})
