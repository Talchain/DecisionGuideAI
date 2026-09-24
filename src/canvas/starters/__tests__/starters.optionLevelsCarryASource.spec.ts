/**
 * ⭐ EVERY OPTION LEVEL A STARTER SHIPS CARRIES ITS RECORDED ORIGIN (OC-1, 24 Sep).
 *
 * Served witness (MANUAL-EDIT-PROOF-20260924.md, D2): on the Customer Data
 * Platform starter, editing `opt_segment → fac_annual_cost` ("£60k", the card's
 * "same as baseline" row) was refused by CEE with `invalid_existing_intervention`
 * — the level writer will not overwrite an entry with no stated origin (its
 * ruling: fix the writer's INPUT, never relax the writer). Connected traced the
 * stored cells to `{value: 0.5, display_value: "£60k"}` with no `source`, and
 * Canvas confirmed they ship that way in the starter's own
 * `analysis_ready.options[*].interventions` (#63 5806626648, 5806642204).
 *
 * The TRUE origin of a "same as baseline" level is the factor's own value: it is
 * that value, copied into the option. In these starters every such factor's
 * value is recorded as Olumi's inference (`observed_state.source:
 * cee_inference`), and the level vocabulary's word for that is `cee_hypothesis`
 * ("inferred by CEE based on context"). Nothing is invented: a level whose
 * factor is brief- or user-sourced would need that source instead, and the
 * second test pins the mapping so a future starter cannot be stamped blindly.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DATA = join(__dirname, '..', 'data')
const FILES = readdirSync(DATA).filter(f => f.endsWith('.draft.json'))
const LEVEL_SOURCES = new Set(['brief_extraction', 'user_specified', 'cee_hypothesis'])

type Cell = { value?: unknown; source?: string }
type Starter = {
  nodes: Array<{ id: string; data?: { observed_state?: { source?: string } }; observed_state?: { source?: string } }>
  analysis_ready?: { options?: Record<string, { interventions?: Record<string, Cell> }> | Array<{ id: string; interventions?: Record<string, Cell> }> }
}

function levels(s: Starter): Array<{ option: string; factor: string; cell: Cell }> {
  const raw = s.analysis_ready?.options ?? {}
  const entries = Array.isArray(raw) ? raw.map(o => [o.id, o] as const) : Object.entries(raw)
  return entries.flatMap(([option, o]) =>
    Object.entries(o.interventions ?? {}).map(([factor, cell]) => ({ option, factor, cell })))
}

describe('starter option levels carry a recorded source (OC-1)', () => {
  it('POSITIVE CONTROL: the starters are read and carry levels', () => {
    expect(FILES.length).toBe(5)
    const total = FILES.reduce((n, f) => n + levels(JSON.parse(readFileSync(join(DATA, f), 'utf8'))).length, 0)
    expect(total).toBeGreaterThan(50)
  })

  it.each(FILES)('%s — every analysis_ready option level has a source from the level vocabulary', (file) => {
    const s = JSON.parse(readFileSync(join(DATA, file), 'utf8')) as Starter
    const missing = levels(s).filter(l => !LEVEL_SOURCES.has(String(l.cell.source ?? '')))
      .map(l => `${l.option} → ${l.factor}`)
    expect(missing, `levels with no recorded origin — CEE refuses to overwrite them (invalid_existing_intervention)`).toEqual([])
  })

  it.each(FILES)('%s — a cee_hypothesis level mirrors a factor whose own value is Olumi-inferred (never stamped blindly)', (file) => {
    const s = JSON.parse(readFileSync(join(DATA, file), 'utf8')) as Starter
    const factorSource = new Map(s.nodes.map(n => [n.id, n.data?.observed_state?.source ?? n.observed_state?.source]))
    const wrong = levels(s)
      .filter(l => l.cell.source === 'cee_hypothesis' && factorSource.get(l.factor) !== 'cee_inference')
      .map(l => `${l.option} → ${l.factor} (factor source: ${String(factorSource.get(l.factor))})`)
    expect(wrong).toEqual([])
  })
})
