/**
 * Unit tests for `normalizeHeadlineBanded` (Lane UI-W4, producer consumption).
 *
 * PLoT #200 emits `decision_brief.headline_banded` — the producer leg of the
 * UI's UI-SEM-060 leader-claim banding debt. The normaliser is the trust
 * boundary: it accepts EXACTLY the three producer band tokens plus a
 * non-empty leader id, fails closed to null on anything else, and never
 * partially fills. Same class as `normalizeAutoNoiseProvenance`.
 *
 * Wire shape (plot-lite-service src/types/decision-brief.ts,
 * BriefBandedHeadline): { text, band, leader_option_id, leader_label,
 * runner_up_option_id, runner_up_label, win_probability_gap,
 * robustness_gated, doctrine: 'provisional_doctrine_v0' }.
 */
import { describe, expect, it } from 'vitest'
import { normalizeHeadlineBanded } from '../types'

/** Bundle-shaped producer payload (mirrors PLoT BriefBandedHeadline). */
const WIRE_BANDED = {
  text: 'Option Alpha is clearly ahead of Option Beta.',
  band: 'clearly_ahead',
  leader_option_id: 'opt_alpha',
  leader_label: 'Option Alpha',
  runner_up_option_id: 'opt_beta',
  runner_up_label: 'Option Beta',
  win_probability_gap: 0.31,
  robustness_gated: false,
  doctrine: 'provisional_doctrine_v0',
}

describe('normalizeHeadlineBanded', () => {
  it('normalises a full producer payload (band + leader id + gated flag)', () => {
    expect(normalizeHeadlineBanded(WIRE_BANDED)).toEqual({
      band: 'clearly_ahead',
      leaderOptionId: 'opt_alpha',
      robustnessGated: false,
    })
  })

  it.each(['very_close', 'slightly_ahead', 'clearly_ahead'] as const)(
    'accepts producer band token %s',
    (band) => {
      expect(normalizeHeadlineBanded({ ...WIRE_BANDED, band })?.band).toBe(band)
    },
  )

  it('carries robustness_gated true verbatim (producer already downgraded the band)', () => {
    const n = normalizeHeadlineBanded({
      ...WIRE_BANDED,
      band: 'slightly_ahead',
      robustness_gated: true,
    })
    expect(n).toEqual({
      band: 'slightly_ahead',
      leaderOptionId: 'opt_alpha',
      robustnessGated: true,
    })
  })

  it('fails closed on an unknown band token — a future producer band is never guessed into copy', () => {
    expect(normalizeHeadlineBanded({ ...WIRE_BANDED, band: 'dominant' })).toBeNull()
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['non-object', 'clearly_ahead'],
    ['missing band', { ...WIRE_BANDED, band: undefined }],
    ['missing leader id', { ...WIRE_BANDED, leader_option_id: undefined }],
    ['empty leader id', { ...WIRE_BANDED, leader_option_id: '' }],
    ['non-string leader id', { ...WIRE_BANDED, leader_option_id: 42 }],
  ])('fails closed to null on %s', (_label, raw) => {
    expect(normalizeHeadlineBanded(raw)).toBeNull()
  })

  it('a missing robustness_gated does not suppress the band (strict read, defaults false)', () => {
    const rest: Record<string, unknown> = { ...WIRE_BANDED }
    delete rest.robustness_gated
    expect(normalizeHeadlineBanded(rest)).toEqual({
      band: 'clearly_ahead',
      leaderOptionId: 'opt_alpha',
      robustnessGated: false,
    })
  })

  it('ignores unknown additive producer fields', () => {
    const n = normalizeHeadlineBanded({ ...WIRE_BANDED, some_future_field: { nested: 1 } })
    expect(n).not.toBeNull()
    expect(Object.keys(n as object).sort()).toEqual([
      'band',
      'leaderOptionId',
      'robustnessGated',
    ])
  })
})
