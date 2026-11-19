/**
 * UI-9 (DL 11 Nov): the version shown beside the one before it (`model.run.since`, science surface 3, SCI-6) drawn in the Compare tab, the
 * existing compare surface. Bound by identity: the section by the two versions' numbers, each line by its option and aim, each word at its
 * View path, each track's marks at core's own fractions. The real path: the A6 journey store (candidate-check 20261111-journey-ec692296,
 * three approved versions), served by olumi-core fd6728401c25c53ff9b7b9ea512168e8910dcdbc on a zero-call copy and read with GET only
 * (`view?schema=3&all=1`, latest and `at=2`), copied unedited. The two-change case (`sole` null) is core's own example from the science
 * owner's payload (SCI-6, "version 3 beside version 1"), since no served pair of versions differs in more than one figure.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))

import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { CoreCompareTab, SinceVersion, type Since } from '../compare'
import { SEPARATE_RUNS } from '../scenarioCompare'

const fixture = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/port/__tests__/fixtures', `${n}.view3.json`), 'utf8'))
const COMPARED = { versions: [], changes: [], results: [] }
const TWO_CHANGES: Since = {
  heading: 'Since the version before', from: { n: 1, label: 'version 1' }, to: { n: 3, label: 'version 3' },
  changed: [
    { id: 'cost_of_part_time_mechanic', label: 'Cost of part-time mechanic', whose: 'theirs', was: 'theirs' },
    { id: 'weekly_repair_hours_available_changed_hire_a_part_time_mechanic', label: 'Hire a part-time mechanic: how many Weekly repair hours available', whose: 'theirs', was: 'olumi' },
  ],
  sole: null,
  lines: [{ option: 'hire_a_part_time_mechanic', aim: 'average_wait_for_a_repair_under_5_days_by_end_of_march', from: 0.6613, to: 0.0302, from_text: 'about 66%', to_text: 'about 3%',
    line: "Version comparison: the chance that 'Hire a part-time mechanic' meets 'Average wait for a repair under 5 days by end of March' read about 66% in version 1 and reads about 3% in version 3. The two versions differ in more than one respect, so no single change is credited." }],
}

const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  render(<SinceVersion since={view.model!.run!.since!} />)
}
beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  setTeamFetch((async (u: unknown) => new Response(JSON.stringify(String(u).includes('/compare') ? COMPARED : { versions: [] }), { status: 200 })) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); vi.unstubAllEnvs(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', at: null } as never) })
const at = (p: string) => [...document.querySelectorAll<HTMLElement>(`[data-view="${p}"]`)]

describe('Since the version before, under a save\'s receipt in the chat (SinceVersion), on the served A6 journey', () => {
  it('SI1: the latest version (3) beside version 2: core\'s heading, each option\'s line verbatim, and no track (two versions are separate runs)', () => {
    const view = fixture('ui9-a6-since-v3'), since = view.model!.run!.since!
    expect([view.version!.n, since.from.n, since.to.n, since.lines.length]).toEqual([3, 2, 3, 2]) // control: the field is served here
    show(view)
    const box = screen.getByTestId('core-compare-since')
    expect(box).toHaveAttribute('data-since-from', '2'); expect(box).toHaveAttribute('data-since-to', '3')
    expect(at('run.since.heading').map((e) => e.textContent)).toEqual([since.heading])
    expect([...box.querySelectorAll('[data-since-line]')].map((e) => e.getAttribute('data-since-line'))).toEqual(since.lines.map((l) => `${l.option}:${l.aim}`))
    since.lines.forEach((l, i) => {
      expect(at(`run.since.lines.${i}.line`).map((e) => e.textContent)).toEqual([l.line])
    })
    expect(since.lines.map((l) => l.from !== l.to || l.from_text !== l.to_text)).toEqual([false, false])
    expect([box.querySelectorAll('[data-compare-track]').length, box.querySelectorAll('[data-compare-key]').length]).toEqual([0, 0])
    // The heading says once that the two versions are separate runs (compare concept v3).
    expect([...box.querySelectorAll('[data-compare-runs]')].map((e) => [e.getAttribute('data-compare-runs'), e.textContent])).toEqual([['separate', SEPARATE_RUNS.label]])
    expect(within(box).queryByTestId('core-compare-since-changed')).toBeNull()
  })

  it('SI2: version 2, drawn from the history, says version 2 beside version 1, in its own words (the field of the version shown)', () => {
    const view = fixture('ui9-a6-since-at2'), since = view.model!.run!.since!, latest = fixture('ui9-a6-since-v3').model!.run!.since!
    expect(since.lines[0]!.line).not.toBe(latest.lines[0]!.line) // control: the two versions say different things
    show(view)
    const box = screen.getByTestId('core-compare-since')
    expect([box.getAttribute('data-since-from'), box.getAttribute('data-since-to')]).toEqual(['1', '2'])
    expect(at('run.since.lines.0.line').map((e) => e.textContent)).toEqual([since.lines[0]!.line])
    // A line whose chance moved (about 48% to about 1%, control): core's line stands at rest with no track; the two versions are separate runs.
    const l = since.lines[0]!, row = box.querySelector<HTMLElement>(`[data-since-line="${l.option}:${l.aim}"]`)!
    expect([l.from_text, l.to_text]).toEqual(['about 48%', 'about 1%'])
    expect([row.textContent, row.querySelector('[data-compare-track]'), row.closest('details')]).toEqual([l.line, null, null])
    expect([...box.querySelectorAll('[data-compare-runs]')].map((e) => [e.textContent, e.getAttribute('title')])).toEqual([[SEPARATE_RUNS.label, SEPARATE_RUNS.title]])
  })

  it('SI3 (18 Nov redesign): the Compare tab no longer draws this card; it reads the same field into its own lists (compareTab.spec)', () => {
    const view = fixture('ui9-a6-since-v3')
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
    render(<CoreCompareTab />)
    expect(screen.queryByTestId('core-compare-since')).toBeNull()
    expect(screen.getByTestId('core-compare-tab')).toBeInTheDocument()
  })
})

describe('where core credits no single change (sole null)', () => {
  it('SI5: no reading draws a track, moved or not (separate runs); the label is drawn once wherever there are lines; CONTRAST: no lines, no label', () => {
    const same = { ...TWO_CHANGES.lines[0]!, option: 'carry_on', from: 0, to: 0, from_text: 'never met in this model', to_text: 'never met in this model', line: "Version comparison: the chance that 'Carry on' meets the aim reads never met in this model in both version 1 and version 3." }
    const { container, unmount } = render(<SinceVersion since={{ ...TWO_CHANGES, lines: [same] }} />)
    expect([container.querySelector('[data-since-line^="carry_on:"]')!.textContent, container.querySelectorAll('[data-compare-track]').length, container.querySelectorAll('[data-compare-track-key]').length]).toEqual([same.line, 0, 0])
    unmount()
    const both = render(<SinceVersion since={{ ...TWO_CHANGES, lines: [TWO_CHANGES.lines[0]!, same] }} />)
    expect([both.container.querySelectorAll('[data-compare-track]').length, both.container.querySelectorAll('[data-compare-runs="separate"]').length]).toEqual([0, 1])
    both.unmount()
    const none = render(<SinceVersion since={{ ...TWO_CHANGES, lines: [] }} />).container
    expect([none.querySelector('[data-testid="core-compare-since"]') !== null, none.querySelectorAll('[data-compare-runs]').length]).toEqual([true, 0])
  })
  it('SI6 (Paul, 18 Nov): readings that did not move are counted at rest and their lines are one press away; the moved one stays at rest; CONTRAST: none unmoved draws no fold', () => {
    const same = { ...TWO_CHANGES.lines[0]!, option: 'carry_on', from: 0, to: 0, from_text: 'never met in this model', to_text: 'never met in this model', line: 'LINE-SAME' }
    const { container, unmount } = render(<SinceVersion since={{ ...TWO_CHANGES, lines: [same, TWO_CHANGES.lines[0]!] }} movedFirst />)
    const fold = screen.getByTestId('core-compare-since-still')
    expect([fold.tagName, fold.hasAttribute('open'), fold.querySelector('summary')!.textContent]).toEqual(['DETAILS', false, '1 result did not move.'])
    expect(fold.querySelector('summary [data-fold-chevron="details"]'), 'polish 13: a chevron, not the native marker').not.toBeNull()
    expect([...fold.querySelectorAll('[data-view]')].map((e) => [e.getAttribute('data-view'), e.textContent])).toEqual([['run.since.lines.0.line', 'LINE-SAME']])
    expect(fold.contains(container.querySelector('[data-view="run.since.lines.1.line"]'))).toBe(false)
    unmount()
    render(<SinceVersion since={TWO_CHANGES} />)
    expect(screen.queryByTestId('core-compare-since-still')).toBeNull()
  })
  it('SI7: a number that drifts under the same words is not a move: its line is folded with the unmoved and draws no track', () => {
    const drift = { ...TWO_CHANGES.lines[0]!, from: 0.5004, to: 0.5031, from_text: 'about 50%', to_text: 'about 50%', line: 'LINE-DRIFT' }
    const { container } = render(<SinceVersion since={{ ...TWO_CHANGES, lines: [drift] }} />)
    expect([container.querySelectorAll('[data-compare-track]').length, screen.getByTestId('core-compare-since-still').querySelector('[data-view]')!.textContent]).toEqual([0, 'LINE-DRIFT'])
  })
  it('SI4: each changed figure is listed by id in core\'s words; with `sole` set the list is not drawn', () => {
    const { unmount } = render(<SinceVersion since={TWO_CHANGES} />)
    const list = screen.getByTestId('core-compare-since-changed')
    expect([...list.querySelectorAll('[data-since-changed]')].map((e) => [e.getAttribute('data-since-changed'), e.textContent, e.getAttribute('data-since-whose')]))
      .toEqual(TWO_CHANGES.changed.map((c) => [c.id, c.label, c.whose]))
    unmount()
    render(<SinceVersion since={{ ...TWO_CHANGES, sole: TWO_CHANGES.changed[1]!.id }} />)
    expect(screen.queryByTestId('core-compare-since-changed')).toBeNull()
  })
})
