/**
 * ROADMAP 2.638 S2 — CONFIRMED-VALUE DISCLOSURE (P4, human–AI collaboration).
 *
 * Three defects, all measured at pristine `fa1f99f1`, all on DEPLOYED-MOUNTED
 * surfaces (mount census in the lane report; `preAnalysisV3=1`,
 * `USE_INSPECTOR_V2` hardcoded true, model tab unflagged):
 *
 *   D1  `provenanceToPill('user_set')` returns NULL — the one node-level
 *       provenance value that says a human owns the number has no pill, while
 *       the two AI-owned values both do.
 *   D2  `getExtractionLabel('user_confirmed')` returns **'Estimated by Olumi'**
 *       (default arm) — a value the user explicitly confirmed is labelled as
 *       the machine's guess, on three live inspector panels.
 *   D3  `SourceProvenancePill source="user_confirmed"` renders **'Not set'**
 *       (CONFIG miss → FALLBACK) and `mapSourceToDisplay('user_confirmed')`
 *       leaks the raw wire literal — on the live Model tab.
 *
 * And the blur the consent witness saw (ROADMAP 2.663): **confirmed and edited
 * are different claims** — edited = the human supplied a number; confirmed =
 * the human ratified the number that was already there. The client store is
 * the ONLY place that distinction survives: CEE's `set_factor_value` stamps
 * `observed_state.source = USER_EDIT_SOURCE = 'user_override'` for BOTH acts
 * (`canonicalise-value-ops.ts:280`, applied `set-factor-value.ts:421`, read at
 * CEE staging `d5b64246`), so no echoed `value_source` can tell them apart.
 *
 * SCOPE HONESTY, pinned here so the copy cannot drift into an effect claim:
 * confirming records WHO STANDS BEHIND the number. It does not change the
 * maths (that is S4, Neil-gated). Every string asserted below is a STATUS.
 */

import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

import { provenanceToPill } from '../../components/pre-analysis/provenanceUtils'
import { getExtractionLabel, getProvenanceLabel } from '../../ui/inspector-v2/inspectorStrings'
import { SourceProvenancePill } from '../../components/model-tab/SourceProvenancePill'
import { mapSourceToDisplay } from '../../components/model-tab/utils'

describe('2.638 S2 · D1 — the node-level confirmation pill renders', () => {
  it('provenanceToPill("user_set") returns a pill, not null', () => {
    const pill = provenanceToPill('user_set')
    expect(pill).not.toBeNull()
    expect(pill!.label).toBe('Set by you')
  })

  it('leaves the two producer pills exactly as they were', () => {
    expect(provenanceToPill('from_brief')).toEqual({
      label: 'From brief',
      borderClass: 'border-success/30',
    })
    expect(provenanceToPill('ai_inferred')).toEqual({
      label: 'AI estimate',
      borderClass: 'border-info/30',
    })
    expect(provenanceToPill(undefined)).toBeNull()
  })
})

describe('2.638 S2 · D2 — the inspector stops calling a confirmed value an Olumi estimate', () => {
  it('getExtractionLabel("user_confirmed") says confirmed, never "Estimated by Olumi"', () => {
    expect(getExtractionLabel('user_confirmed')).toBe('Confirmed by you')
  })

  it('getExtractionLabel distinguishes confirmed from edited', () => {
    expect(getExtractionLabel('user_override')).toBe('Set by you')
    expect(getExtractionLabel('user_confirmed')).not.toBe(getExtractionLabel('user_override'))
  })

  it('getProvenanceLabel stops leaking the raw wire literal for a confirmed value', () => {
    const label = getProvenanceLabel('user_confirmed')
    expect(label).toBe('Confirmed by you')
    expect(label).not.toContain('user_confirmed')
  })

  it('leaves the pre-existing extraction labels byte-identical', () => {
    expect(getExtractionLabel(undefined)).toBe('Estimated by Olumi')
    expect(getExtractionLabel('brief_extraction')).toBe('From your brief')
    expect(getExtractionLabel('user')).toBe('Set by you')
    expect(getExtractionLabel('user_calibration')).toBe('Set by you')
    expect(getExtractionLabel('something_else')).toBe('Estimated by Olumi')
  })
})

describe('2.638 S2 · D3 — the Model tab stops rendering a confirmed value as "Not set"', () => {
  it('SourceProvenancePill("user_confirmed") reads confirmed, not "Not set"', () => {
    render(<SourceProvenancePill source="user_confirmed" />)
    expect(screen.getByText('Confirmed by you')).toBeInTheDocument()
    expect(screen.queryByText('Not set')).toBeNull()
  })

  it('SourceProvenancePill("user_override") reads edited — a different claim', () => {
    render(<SourceProvenancePill source="user_override" />)
    expect(screen.getByText('User edited')).toBeInTheDocument()
    expect(screen.queryByText('Confirmed by you')).toBeNull()
  })

  it('mapSourceToDisplay stops leaking the raw literal for the user-owned sources', () => {
    expect(mapSourceToDisplay('user_confirmed')).toBe('Confirmed by you')
    expect(mapSourceToDisplay('user_override')).toBe('User edited')
    expect(mapSourceToDisplay('user_assumption')).toBe('Your assumption')
  })

  it('leaves the pre-existing Model-tab copy byte-identical', () => {
    expect(mapSourceToDisplay('brief_extraction')).toBe('From brief')
    expect(mapSourceToDisplay('cee_inference')).toBe('AI estimate')
    expect(mapSourceToDisplay('user')).toBe('User edited')
    expect(mapSourceToDisplay(undefined)).toBeNull()
  })
})
