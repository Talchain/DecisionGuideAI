/**
 * JOIN-10 / SCI-12b (DL 11 Nov): a chance worked out beside a recorded dissent says so, in core's words (`model.cards[].disputed[].line`),
 * under that chance in the Analysis tab's option row (matched to the row by the aim's id) and in the option's block on the Reasoning tab.
 * Nothing is computed. Bound by identity: the card, the dissent record's id, the aim's id, the View path.
 * The real path: core's own `viewOf` at olumi-core e4972b973c0be7e5a208507a8c96462abcd3ab9c (SCI-12b; JOIN-10's View schema, sha256
 * c16ac4d5…) over the saved loop5-B workshop Full, run again in process exactly as core's `card-disputed.test.ts` does (runOnly, zero
 * calls), copied unedited as `fixtures/join10-loop5b-disputed.view3.json`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { Rack } from '../../reasoning/Rack'
import { viewOf } from './viewAt'

const SUNDAYS = 'open_on_sundays', DISSENT = 'jo_thinks_sunday_opening_would_only_spread_the_same_work_over_mo'
const AIM = 'average_repair_wait_under_5_days_by_end_of_march'
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const at = (p: string) => [...document.querySelectorAll<HTMLElement>(`[data-view="${p}"]`)]
const without = (view: View, alter: (d: NonNullable<View['model']>['cards'][number]) => void): View => {
  const v = structuredClone(view); for (const c of v.model!.cards) alter(c); return v
}

describe('a disputed chance, on the saved loop5-B workshop model (core\'s own read)', () => {
  const view = viewOf('core/join10-loop5b-disputed'), m = view.model!
  const sundays = m.cards.find((c) => c.id === SUNDAYS)!, d = sundays.disputed![0]!

  it('D0 control: only Open on Sundays carries the key, one dissent, about the aim its chance row is for', () => {
    expect(m.cards.filter((c) => c.disputed !== undefined).map((c) => c.id)).toEqual([SUNDAYS])
    expect([d.id, d.aims]).toEqual([DISSENT, [AIM]])
    expect(sundays.rows.filter((r) => r.kind === 'chance').map((r) => r.aim_id)).toEqual([AIM])
  })

  it('D1: in the Analysis tab, core\'s sentence is drawn once, verbatim, under Open on Sundays\' chance row for that aim', () => {
    ready(view); render(<PortAnalysisTab />)
    const drawn = at(`${SUNDAYS}.disputed.0.line`)
    expect(drawn.map((e) => [e.textContent, e.getAttribute('data-row-disputed')])).toEqual([[d.line, DISSENT]])
    // On the row of that option (its readout's path is on the same row), not on another option's.
    const row = drawn[0]!.parentElement!
    expect(row.querySelector(`[data-view^="${SUNDAYS}.rows."]`)).not.toBeNull()
    expect(document.querySelectorAll('[data-row-disputed]')).toHaveLength(1)
  })

  it('D2: on the Reasoning tab, the sentence is in Open on Sundays\' block, verbatim, and in no other option\'s', () => {
    ready(view); render(<Rack model={m} />)
    const block = document.querySelector<HTMLElement>(`[data-rack-option="${SUNDAYS}"]`)!
    expect([...block.querySelectorAll('[data-rack-disputed]')].map((e) => [e.getAttribute('data-rack-disputed'), e.textContent, e.getAttribute('data-view')]))
      .toEqual([[DISSENT, d.line, `${SUNDAYS}.disputed.0.line`]])
    expect(document.querySelectorAll('[data-rack-disputed]')).toHaveLength(1)
  })

  it('D3 contrast: the same model with no `disputed` key draws no such line on either tab', () => {
    const bare = without(view, (c) => { delete (c as { disputed?: unknown }).disputed })
    ready(bare); const a = render(<PortAnalysisTab />)
    expect(document.querySelectorAll('[data-row-disputed]')).toHaveLength(0)
    a.unmount(); render(<Rack model={bare.model!} />)
    expect(document.querySelectorAll('[data-rack-disputed]')).toHaveLength(0)
  })

  it('D4: a dissent that names another aim (altered here, said so) is not drawn under this aim\'s chance', () => {
    const other = without(view, (c) => { if (c.disputed) c.disputed = c.disputed.map((x) => ({ ...x, aims: ['another_aim'] })) })
    ready(other); render(<PortAnalysisTab />)
    expect(document.querySelectorAll('[data-row-disputed]')).toHaveLength(0)
  })
})
