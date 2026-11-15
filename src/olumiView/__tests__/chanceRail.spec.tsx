/**
 * UI-BRIEF-20261115 section 3: every option with a worked-out result on ONE shared 0..100% rail (its dot at core's served chance row, core's
 * range sentence as its whisker), highest first; the options with no result yet in one group with no rail, under core's own words; core's
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

describe('the shared chance rail', () => {
  it('R1 the rail holds the worked-out options, highest saved chance first, each at its served row and core\'s range; the rest are grouped under core\'s words', () => {
    const rail = chanceRailOf(RUN2.model)!
    expect(rail.rows.map((r) => [r.id, r.at, r.text, r.band === null ? null : [r.band.from, r.band.to]])).toEqual([
      [SEEK, 0.1842, 'about 18% chance', [0, 51]],
      [KEEP, 0, 'never met in this model', null],
    ])
    expect(rail.rest.map((r) => r.id)).toEqual([ANGEL, WIDEN, CUT])
    expect(rail.caption).toBe('No chance yet')
    // Core's challenge glyph (its key's, by id) where the saved badge names a challenge, and only there; titled with the badge's words.
    const key = RUN2.model!.key.find((k) => k.id === 'challenge')!
    const badgeTitle = (id: string) => RUN2.model!.cards.find((c) => c.id === id)!.badge!.title
    expect(rail.rest.map((r) => [r.id, r.challenge === null ? null : [r.challenge.glyph, r.challenge.title]])).toEqual([[ANGEL, [key.glyph, badgeTitle(ANGEL)]], [WIDEN, [key.glyph, badgeTitle(WIDEN)]], [CUT, null]])
  })
  it('R2 on the question bar: ONE track carries every dot and whisker on the 0..100 scale with quarter ticks; the unworked group has no track, no dot', () => {
    const el = drawQuestion(RUN2)
    const rail = el.querySelector('[data-chance-rail]')!
    expect(rail, 'mounted on the question bar').not.toBeNull()
    const tracks = rail.querySelectorAll('[data-chance-rail-track]')
    expect(tracks.length).toBe(1)
    const track = tracks[0]!
    expect([...track.querySelectorAll<HTMLElement>('[data-rail-dot]')].map((d) => [d.getAttribute('data-rail-dot'), d.style.left])).toEqual([[SEEK, '18.42%'], [KEEP, '0%']])
    expect([...track.querySelectorAll<HTMLElement>('[data-rail-whisker]')].map((w) => [w.getAttribute('data-rail-whisker'), w.style.left, w.style.width])).toEqual([[SEEK, '0%', '51%']])
    expect([...track.querySelectorAll<HTMLElement>('.ok-rail-tick')].map((t) => t.style.left)).toEqual(['25%', '50%', '75%'])
    expect(track.getAttribute('aria-label')).toContain(RUN2.model!.cards.find((c) => c.id === SEEK)!.headline!.range!)
    const rest = rail.querySelector('[data-rail-rest]')!
    expect([...rest.querySelectorAll('[data-rail-unworked]')].map((u) => u.getAttribute('data-rail-unworked'))).toEqual([ANGEL, WIDEN, CUT])
    expect(rest.querySelectorAll('[data-chance-rail-track], [data-rail-dot], [data-rail-whisker], .ok-track').length).toBe(0)
    expect(rest.querySelectorAll('[data-rail-caption]').length).toBe(1)
    // The line carries option names and core's challenge glyph only: no badge counts run into the names (DL, 15 Nov).
    const glyph = RUN2.model!.key.find((k) => k.id === 'challenge')!.glyph
    expect([...rest.querySelectorAll<HTMLElement>('[data-rail-challenge]')].map((b) => [b.getAttribute('data-rail-challenge'), b.textContent])).toEqual([[ANGEL, glyph], [WIDEN, glyph]])
    for (const c of RUN2.model!.cards.filter((x) => x.badge != null)) for (const w of [c.badge!.text, (c.badge as { face?: string }).face ?? '']) if (w !== '') expect(rest.textContent, w).not.toContain(w)
  })
})
