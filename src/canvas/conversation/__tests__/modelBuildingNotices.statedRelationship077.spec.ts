/**
 * ⭐ schemas 0.77.0 — `stated_relationship_not_used` (SPINE X8; olumi-schemas #88 → b0378e7f; DL 0df0e1 order:
 * DGAI → PLoT → CEE emits).
 *
 * A relationship THE USER STATED that the model could not use as written. Before 0.77.0 such a row could only be
 * counted as `relationship_not_used`, which every consumer reads as Olumi's ("Connections Olumi proposed…"), so the
 * user's own words were attributed to Olumi.
 *
 * READER-FIRST: the enum is closed and the schema strict, so on 0.76.0 a notice block carrying the member is REFUSED
 * whole (`extractModelBuildingNoticesSidecar` → null, the block quarantined). These rows go through the consumer's own
 * entry point with the vendored schema, and bind each row to its kind by identity.
 */
import { describe, expect, it } from 'vitest'
import { ModelBuildingNoticeKindSchema } from '@talchain/schemas/boundary'
import {
  describeModelBuildingNoticeKind,
  extractModelBuildingNoticesSidecar,
  modelBuildingNoticeAttribution,
  modelBuildingNoticeOutcome,
} from '../modelBuildingNotices'

const STATED = 'stated_relationship_not_used'
const WORDS = "Relationships you described that the model couldn't use as written"

const response = {
  model_building_notices: {
    total_count: 3,
    groups: [
      { kind: STATED, count: 2 },
      { kind: 'relationship_not_used', count: 1 },
    ],
    details_redacted: true,
  },
}

describe('0.77.0 — a relationship the user stated is the user\'s, never "Connections Olumi proposed"', () => {
  it('PRECONDITION: the vendored contract carries the member', () => {
    expect(ModelBuildingNoticeKindSchema.options).toContain(STATED)
  })

  it('a notice block carrying it is ADMITTED (on 0.76.0 the whole block was refused), each row bound to its kind', () => {
    const view = extractModelBuildingNoticesSidecar(response)
    expect(view).not.toBeNull()
    expect(view!.totalCount).toBe(3)
    const byKind = new Map(view!.rows.map((r) => [r.kind, r]))
    expect(byKind.get(STATED)).toEqual({ kind: STATED, count: 2, description: WORDS })
    expect(byKind.get('relationship_not_used')?.count).toBe(1)
  })

  it('its description, attribution and outcome: the user\'s words, user_stated, not in the model', () => {
    expect(describeModelBuildingNoticeKind(STATED)).toBe(WORDS)
    expect(WORDS).not.toMatch(/Olumi/)
    expect(modelBuildingNoticeAttribution(STATED)).toBe('user_stated')
    expect(modelBuildingNoticeOutcome(STATED)).toBe('absent')
  })

  it('CONTRAST: `relationship_not_used` stays Olumi-authored, in its own words', () => {
    expect(describeModelBuildingNoticeKind('relationship_not_used')).toMatch(/Olumi proposed/)
    expect(modelBuildingNoticeAttribution('relationship_not_used')).toBe('olumi_authored')
  })
})
