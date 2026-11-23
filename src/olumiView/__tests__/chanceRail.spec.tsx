/**
 * UI-BRIEF-20261115 section 3: every option with a worked-out result on ONE shared 0..100% rail (its dot at core's served chance row, core's
 * range sentence as its whisker), in the View's order; the options with no result yet in one group with no rail, under core's own words; core's
 * badge kept where it names a challenge. Bound by option id on the run-2 funding View (live, approved): one chance (0.1842, range "under 1%
 * … about 51%"), one fixed result (row 0, "never met in this model"), three with "No chance yet".
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { CoreCard } from '../previous/CoreCard'
import { QUESTION } from '../layout'
import { chanceRailOf } from '../railRows'
import { optionLetters } from '../v12/cards/letters'

const RUN2 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json'), 'utf8')) as View
const SEEK = 'seek_a_small_grant_or_short_bridging_loan', KEEP = 'keep_sending_cold_emails_and_seeking_warm_connections'
const ANGEL = 'approach_angel_investors_for_quicker_small_funding', WIDEN = 'widen_targeting_to_smaller_cheque_and_non_uk_investors', CUT = 'cut_monthly_spending_to_stretch_the_runway'
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const drawQuestion = (view: View): HTMLElement => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id: QUESTION, type: 'viewCard', data: { label: view.model!.question.text }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

/** The band's far end is the chance row's own `driver.high` (core's numbers), not the sentence's rounded "about 51%". */
const SEEK_DRIVER = (RUN2.model!.cards.find((c) => c.id === SEEK)!.rows.find((r) => r.kind === 'chance') as unknown as { driver: { low: number; high: number } }).driver
const SEEK_HIGH = SEEK_DRIVER.high

describe('the shared chance rail', () => {
  it('R1 the rail holds the worked-out options, in the View\'s own order, each at its served row and core\'s range; the rest are grouped under core\'s words', () => {
    const rail = chanceRailOf(RUN2.model)!
    expect(rail.rows.map((r) => [r.id, r.at, r.text, r.band === null ? null : [r.band.from, r.band.to]])).toEqual([
      [KEEP, 0, 'never met in this model', null],
      [SEEK, 0.1842, 'about 18% chance', [0, SEEK_HIGH * 100]],
    ])
    expect(rail.rest.map((r) => r.id)).toEqual([ANGEL, WIDEN, CUT])
    expect(rail.caption).toBe('No chance yet')
    // Core's challenge glyph (its key's, by id) where the saved badge names a challenge, and only there; titled with the badge's words.
    const key = RUN2.model!.key.find((k) => k.id === 'challenge')!
    const badgeTitle = (id: string) => RUN2.model!.cards.find((c) => c.id === id)!.badge!.title
    expect(rail.rest.map((r) => [r.id, r.challenge === null ? null : [r.challenge.glyph, r.challenge.title]])).toEqual([[ANGEL, [key.glyph, badgeTitle(ANGEL)]], [WIDEN, [key.glyph, badgeTitle(WIDEN)]], [CUT, null]])
  })
  // CHANGED BY DESIGN (Detailed redesign, Paul 17 Nov: each fact said once, marks not sentences; v12/detailed): the rail names each option by its letter
  // (its name is said on its own card), one lane per option in the View's order: a dot and core's range whisker where it has a result, its letter and core's words and no lane where it has none, core's number words at the right; no run-on line of names. R3's label column is gone with it.
  it('R2 on the question bar: one rail, a lane per option by its letter in the View\'s order; every dot and whisker on the 0..100 scale; an option with no result has no lane and no dot, only core\'s words; core\'s challenge mark kept', () => {
    const el = drawQuestion(RUN2)
    const rail = el.querySelector('[data-detailed-rail]')!
    expect(rail, 'mounted on the question bar').not.toBeNull()
    const letters = optionLetters(RUN2.model!)
    const opts = RUN2.model!.cards.filter((c) => c.family === 'option').map((c) => c.id)
    expect([...rail.querySelectorAll<HTMLElement>('[data-rail-row]')].map((r) => [r.getAttribute('data-rail-row'), r.querySelector('[data-letter-chip]')?.textContent])).toEqual(opts.map((id) => [id, letters.get(id)]))
    expect([...rail.querySelectorAll<HTMLElement>('[data-rail-dot]')].map((d) => [d.getAttribute('data-rail-dot'), d.style.getPropertyValue('--chart-x')])).toEqual([[KEEP, '0%'], [SEEK, '18.42%']])
    expect([...rail.querySelectorAll<HTMLElement>('[data-rail-whisker]')].map((w) => [w.getAttribute('data-rail-whisker'), w.style.getPropertyValue('--chart-x'), w.style.getPropertyValue('--chart-width')])).toEqual([[SEEK, `${SEEK_DRIVER.low * 100}%`, `${(SEEK_DRIVER.high - SEEK_DRIVER.low) * 100}%`]])
    const headOf = (id: string) => RUN2.model!.cards.find((c) => c.id === id)!.headline!.text
    for (const id of [ANGEL, WIDEN, CUT]) expect([id, rail.querySelector(`[data-rail-lane="${id}"]`), rail.querySelector(`[data-view="${id}.headline.text"]`)?.textContent]).toEqual([id, null, headOf(id)])
    expect(headOf(ANGEL), 'precondition: core\'s own words for an option with no result').toBe('No chance yet')
    for (const id of [KEEP, SEEK]) expect(rail.querySelector(`[data-rail-lane="${id}"]`), `CONTRAST: ${id} has a result, so it keeps its lane`).not.toBeNull()
    expect(rail.querySelector('.ok-dt-rail-lane-empty'), 'no empty track').toBeNull()
    expect(rail.querySelectorAll('[data-rail-rest], [data-rail-unworked]').length, 'no run-on line of names').toBe(0)
    for (const c of RUN2.model!.cards.filter((x) => x.family === 'option')) expect(rail.textContent, c.heading).not.toContain(c.heading)
    const glyph = RUN2.model!.key.find((k) => k.id === 'challenge')!.glyph
    expect([...rail.querySelectorAll<HTMLElement>('[data-rail-challenge]')].map((b) => [b.getAttribute('data-rail-challenge'), b.textContent])).toEqual([[ANGEL, glyph], [WIDEN, glyph]])
    // The challenge mark sits beside core's words in the row's value cell, never inside the words (so nothing that wraps or bounds them can cut it).
    expect([...rail.querySelectorAll<HTMLElement>('[data-rail-challenge]')].map((b) => [b.parentElement?.classList.contains('ok-dt-rail-val'), b.closest('[data-view$=".headline.text"]')])).toEqual([[true, null], [true, null]])
  })
})
