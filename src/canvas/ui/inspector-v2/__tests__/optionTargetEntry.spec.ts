/**
 * `optionTargetEntry` — which number an option-target field IS, and how typed
 * text becomes the model value. The mounted journey is pinned in
 * `OptionPanel.optionTargetRefusalIsSaid.spec.tsx`; this file pins the RULES,
 * including the two boundaries the journey cannot reach cheaply: the anchor
 * that disagrees with the cap, and the unit words the parser would otherwise
 * read as a timeframe.
 */
import { describe, it, expect } from 'vitest'
import {
  admitOptionTargetEntry,
  optionTargetEntrySeed,
  resolveOptionTargetEntryFrame,
  OPTION_TARGET_ENTRY_REFUSAL,
  typedMarkerDenotesRowUnit,
} from '../shared/optionTargetEntry'
import { normaliseRawFactorValue } from '../../../utils/observedStateHelpers'

/** The CDP starter's Annual Platform Cost, as witnessed on `a4434670`. */
const CDP_COST = { unit: '£', cap: 120000, observedValue: 0.5, observedRawValue: 60000 }

describe('the frame', () => {
  it('a £ factor with a cap and an anchor that agrees → amounts in £', () => {
    expect(resolveOptionTargetEntryFrame(CDP_COST)).toEqual({
      kind: 'user_units',
      unit: '£',
      unitKind: 'symbol',
      cap: 120000,
    })
  })

  it.each([
    ['no unit', { cap: 120000, observedValue: 0.5 }],
    ['a placeholder unit', { unit: 'scale', cap: 10, observedValue: 0.5 }],
    ['no cap', { unit: '£', observedValue: 0.5, observedRawValue: 60000 }],
    ['a cap of 1 (the card prints no unit either)', { unit: '£', cap: 1, observedValue: 0.5 }],
  ])('%s → the model scale, as before', (_label, input) => {
    expect(resolveOptionTargetEntryFrame(input)).toEqual({ kind: 'model_scale' })
  })

  it('⚠ an anchor that DISAGREES with the cap → the model scale: a typed £ would have two meanings', () => {
    // raw 5,000 at 0.1 implies a scale of 50,000; the cap says 10,000. The card
    // denormalises through the anchor, the one raw→model rule divides by the
    // cap, so £25,000 typed here would print back as a different figure.
    expect(
      resolveOptionTargetEntryFrame({ unit: '£', cap: 10000, observedValue: 0.1, observedRawValue: 5000 }),
    ).toEqual({ kind: 'model_scale' })
  })
})

describe('the seed', () => {
  it('shows the card\'s figure on a £ row', () => {
    const frame = resolveOptionTargetEntryFrame(CDP_COST)
    expect(optionTargetEntrySeed(0.5, frame, CDP_COST)).toBe('60,000')
  })

  it('keeps the exact, unrounded value on a model-scale row', () => {
    expect(optionTargetEntrySeed(0.37612, { kind: 'model_scale' }, {})).toBe('0.37612')
  })
})

describe('admission', () => {
  const frame = resolveOptionTargetEntryFrame(CDP_COST)

  it.each(['80000', '80,000', '£80,000', '80k', '£80k', ' £80k '])(
    '"%s" → the one raw→model rule, 80,000 / cap',
    (typed) => {
      expect(admitOptionTargetEntry(typed, frame, CDP_COST, 0.5)).toEqual({
        ok: true,
        value: normaliseRawFactorValue(80000, 120000),
      })
    },
  )

  it('a different currency symbol on a £ row is refused with the row\'s unit named', () => {
    expect(admitOptionTargetEntry('$80k', frame, CDP_COST, 0.5)).toEqual({
      ok: false,
      reason: OPTION_TARGET_ENTRY_REFUSAL.unitConflict('£'),
    })
  })

  it('past the cap names the range in the row\'s unit', () => {
    expect(admitOptionTargetEntry('150k', frame, CDP_COST, 0.5)).toEqual({
      ok: false,
      reason: 'Not saved · must be between £0 and £120,000 for this factor.',
    })
  })

  it('an unreadable entry names an example drawn from the row\'s own value', () => {
    expect(admitOptionTargetEntry('lots', frame, CDP_COST, 0.5)).toEqual({
      ok: false,
      reason: 'Not saved · not a number this row can read. Enter an amount such as £60,000.',
    })
  })

  it('"5 months" on a months row is the row\'s own unit, not a timeframe', () => {
    const months = { unit: 'months', cap: 12, observedValue: 0.25, observedRawValue: 3 }
    const f = resolveOptionTargetEntryFrame(months)
    expect(f).toMatchObject({ kind: 'user_units', unitKind: 'other' })
    expect(admitOptionTargetEntry('5 months', f, months, 0.25)).toEqual({ ok: true, value: 5 / 12 })
    expect(admitOptionTargetEntry('5', f, months, 0.25)).toEqual({ ok: true, value: 5 / 12 })
  })

  it('a free-text currency unit ("GBP/month") reads a typed £ as its own unit', () => {
    const price = { unit: 'GBP/month', cap: 200, observedValue: 0.295, observedRawValue: 59 }
    const f = resolveOptionTargetEntryFrame(price)
    expect(f).toMatchObject({ kind: 'user_units' })
    expect(admitOptionTargetEntry('£80', f, price, 0.295)).toEqual({ ok: true, value: 80 / 200 })
  })

  it('model scale: a plain number in [0,1] passes; anything else says why', () => {
    const m = { kind: 'model_scale' } as const
    expect(admitOptionTargetEntry('0.7', m, {}, 0.5)).toEqual({ ok: true, value: 0.7 })
    expect(admitOptionTargetEntry('1.5', m, {}, 0.5)).toEqual({
      ok: false,
      reason: OPTION_TARGET_ENTRY_REFUSAL.outOfRangeModelScale,
    })
    expect(admitOptionTargetEntry('70%', m, {}, 0.5)).toEqual({
      ok: false,
      reason: OPTION_TARGET_ENTRY_REFUSAL.unitOnModelScale,
    })
    expect(admitOptionTargetEntry('high', m, {}, 0.5)).toEqual({
      ok: false,
      reason: OPTION_TARGET_ENTRY_REFUSAL.unreadableModelScale,
    })
  })
})

describe('a typed unit marker is admitted only when it denotes the row’s own unit (Codex 5807449041)', () => {
  const frameFor = (unit: string, cap = 120_000) => {
    const f = resolveOptionTargetEntryFrame({ unit, cap })
    if (f.kind !== 'user_units') throw new Error(`fixture: ${unit} did not resolve to a user-unit row`)
    return f
  }
  const admit = (text: string, unit: string, cap = 120_000) =>
    admitOptionTargetEntry(text, frameFor(unit, cap), {}, cap / 2)

  it('⛔ `£80` on a `months` row is REFUSED — never committed as 80 months', () => {
    const r = admit('£80', 'months', 120)
    expect(r.ok).toBe(false)
  })

  it('⛔ `£80` on a `USD` row is REFUSED — never committed as 80 USD', () => {
    const r = admit('£80', 'USD')
    expect(r.ok).toBe(false)
  })

  it('✅ `£80` on a `£` row is admitted', () => {
    const r = admit('£80', '£')
    expect(r.ok).toBe(true)
  })

  it('✅ `£80` on the composite `GBP/month` row is admitted (£ ≡ GBP, the one stated equivalence)', () => {
    const r = admit('£80', 'GBP/month')
    expect(r.ok).toBe(true)
  })

  it('⛔ `$80` on the composite `GBP/month` row is refused', () => {
    expect(admit('$80', 'GBP/month').ok).toBe(false)
  })

  it('CONTRAST: a bare number is admitted on every one of those rows', () => {
    expect(admit('80', 'months', 120).ok).toBe(true)
    expect(admit('80', 'USD').ok).toBe(true)
    expect(admit('80', 'GBP/month').ok).toBe(true)
  })

  it('the pure predicate: % only on percent rows; symbols by identity or stated ISO equivalence', () => {
    expect(typedMarkerDenotesRowUnit('%', frameFor('%', 100))).toBe(true)
    expect(typedMarkerDenotesRowUnit('%', frameFor('£'))).toBe(false)
    expect(typedMarkerDenotesRowUnit('£', frameFor('%', 100))).toBe(false)
    expect(typedMarkerDenotesRowUnit('€', frameFor('EUR'))).toBe(true)
  })
})
