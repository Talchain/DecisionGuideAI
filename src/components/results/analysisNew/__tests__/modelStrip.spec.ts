/**
 * "Your model so far" — what it reports, and the claim it must never make.
 *
 * The load-bearing test here is the LAST one. Everything else checks grouping;
 * that one checks that the strip cannot grow a provenance claim without a test
 * going red, which is the constraint the component exists under.
 */

import { describe, expect, it } from 'vitest'

import { buildModelStrip, MARK_CAP } from '../buildModelStrip'

const node = (id: string, type: string, label?: string) => ({
  id,
  type,
  data: label === undefined ? {} : { label },
})

describe('grouping and the header', () => {
  it('groups by kind, in the design order, with counts', () => {
    const strip = buildModelStrip([
      node('o1', 'option', 'Adopt Segment'),
      node('f1', 'factor', 'Annual cost'),
      node('r1', 'risk', 'Migration delay'),
      node('o2', 'option', 'Adopt RudderStack'),
      node('u1', 'outcome', 'GDPR compliance'),
    ])
    expect(strip.rows.map((r) => r.kind)).toEqual(['option', 'factor', 'risk', 'outcome'])
    expect(strip.rows.find((r) => r.kind === 'option')?.nodes).toHaveLength(2)
    expect(strip.total).toBe(5)
  })

  it('the goal is the header, never a row — it is a binary, not a set', () => {
    const strip = buildModelStrip([
      node('g1', 'goal', 'Replace CDP within budget'),
      node('o1', 'option', 'Adopt Segment'),
    ])
    expect(strip.goalLabel).toBe('Replace CDP within budget')
    expect(strip.rows.map((r) => r.kind)).not.toContain('goal')
  })

  it('falls back to the decision node when no goal node names the question', () => {
    const strip = buildModelStrip([
      node('d1', 'decision', 'Replace the customer data platform'),
      node('o1', 'option', 'Adopt Segment'),
    ])
    expect(strip.goalLabel).toBe('Replace the customer data platform')
  })

  /**
   * ⚠ An empty row is a CLAIM. "Risks 0" reads as "your model has no risks",
   * which is a finding; the truth is only that the kind is absent from the
   * canvas. Other surfaces on this panel exist to say what is missing.
   */
  it('drops kinds that are absent rather than rendering them at zero', () => {
    const strip = buildModelStrip([node('o1', 'option', 'Adopt Segment')])
    expect(strip.rows).toHaveLength(1)
    expect(strip.rows[0].kind).toBe('option')
  })

  it('an unrecognised node type is skipped, not guessed at', () => {
    const strip = buildModelStrip([node('x1', 'sticky-note', 'A note'), node('o1', 'option')])
    expect(strip.total).toBe(1)
  })

  it('a label that is merely the id is treated as no label, never leaked', () => {
    const strip = buildModelStrip([node('f_budget', 'factor', 'f_budget')])
    expect(strip.rows[0].nodes[0].label).toBe('')
  })
})

describe('the density threshold', () => {
  const factors = (n: number) =>
    Array.from({ length: n }, (_, i) => node(`f${i}`, 'factor', `Factor ${i}`))

  it('stays as individual marks at the cap', () => {
    const strip = buildModelStrip(factors(MARK_CAP))
    expect(strip.rows[0].overCap).toBe(false)
  })

  /**
   * ⚠ THIS CASE WAS NAMED "switches to a bar one past the cap" AND THE BAR IS
   * THE ONE THING THIS SURFACE MUST NEVER RENDER — it reads as a proportion of
   * a denominator nobody measured, and it was rejected in review. The code has
   * never drawn one; the name and its comment were the last places still
   * describing it, in the file a builder reads to learn what `overCap` means.
   * Renamed to what the flag actually does. See the note on `MARK_CAP`.
   */
  it('flags the row for capped display one past the cap, and keeps the exact count', () => {
    const strip = buildModelStrip(factors(MARK_CAP + 1))
    expect(strip.rows[0].overCap).toBe(true)
    // Every node survives the flag: the renderer draws the first `MARK_CAP` and
    // states how many it is withholding, so the count must stay complete.
    expect(strip.rows[0].nodes).toHaveLength(MARK_CAP + 1)
  })

  it('a realistic large model does not lose nodes', () => {
    const strip = buildModelStrip(factors(40))
    expect(strip.rows[0].nodes).toHaveLength(40)
    expect(strip.total).toBe(40)
  })
})

describe('⭐ the strip makes no provenance claim, and cannot grow one silently', () => {
  /**
   * The design draws these marks filled-or-hollow to say which inputs are the
   * user's and which are Olumi's. That distinction is NOT AVAILABLE:
   * `provenance_class` returns zero files in this repo, CEE can send an
   * intervention as a bare number carrying no source, and PLoT stamps
   * unrecognised values as `user_specified` (PR #353, open) — the strongest
   * claim of human authorship on a value Olumi invented.
   *
   * So the row model carries `id` and `label` and nothing else. If a later
   * change adds a provenance-ish field here, this test REDs and whoever added
   * it has to come and read the paragraph above before shipping a fill.
   */
  it('a strip node exposes an identity and a name — and no source, state or fill', () => {
    const strip = buildModelStrip([node('f1', 'factor', 'Annual cost')])
    expect(Object.keys(strip.rows[0].nodes[0]).sort()).toEqual(['id', 'label'])
  })

  it('every node of a kind is indistinguishable from every other', () => {
    const strip = buildModelStrip([
      node('f1', 'factor', 'Set by the user'),
      node('f2', 'factor', 'Invented by Olumi'),
    ])
    const [a, b] = strip.rows[0].nodes
    // Same shape, same fields — the only difference is identity and name.
    expect(Object.keys(a)).toEqual(Object.keys(b))
  })
})
