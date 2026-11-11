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
  render(<CoreCompareTab />)
}
beforeEach(() => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  setTeamFetch((async (u: unknown) => new Response(JSON.stringify(String(u).includes('/compare') ? COMPARED : { versions: [] }), { status: 200 })) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); vi.unstubAllEnvs(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', at: null } as never) })
const at = (p: string) => [...document.querySelectorAll<HTMLElement>(`[data-view="${p}"]`)]

describe('Since the version before, in the Compare tab, on the served A6 journey', () => {
  it('SI1: the latest version (3) beside version 2: core\'s heading, each option\'s line verbatim, and its two marks at core\'s fractions', () => {
    const view = fixture('ui9-a6-since-v3'), since = view.model!.run!.since!
    expect([view.version!.n, since.from.n, since.to.n, since.lines.length]).toEqual([3, 2, 3, 2]) // control: the field is served here
    show(view)
    const box = screen.getByTestId('core-compare-since')
    expect(box).toHaveAttribute('data-since-from', '2'); expect(box).toHaveAttribute('data-since-to', '3')
    expect(at('run.since.heading').map((e) => e.textContent)).toEqual([since.heading])
    expect([...box.querySelectorAll('[data-since-line]')].map((e) => e.getAttribute('data-since-line'))).toEqual(since.lines.map((l) => `${l.option}:${l.aim}`))
    since.lines.forEach((l, i) => {
      expect(at(`run.since.lines.${i}.line`).map((e) => e.textContent)).toEqual([l.line])
      const track = box.querySelector<HTMLElement>(`[data-since-line="${l.option}:${l.aim}"] [data-compare-track]`)!
      expect([track.getAttribute('data-first'), track.getAttribute('data-second')]).toEqual([String(Math.round(l.from * 100)), String(Math.round(l.to * 100))])
      expect(track.getAttribute('aria-label')).toBe(`${since.from.label}: ${l.from_text}; ${since.to.label}: ${l.to_text}`)
    })
    // The key names the two versions in core's words; the change is named in each line, so no separate list.
    expect([...box.querySelectorAll('[data-compare-key]')].map((e) => e.textContent)).toEqual([since.from.label, since.to.label])
    expect(within(box).queryByTestId('core-compare-since-changed')).toBeNull()
  })

  it('SI2: version 2, drawn from the history, says version 2 beside version 1, in its own words (the field of the version shown)', () => {
    const view = fixture('ui9-a6-since-at2'), since = view.model!.run!.since!, latest = fixture('ui9-a6-since-v3').model!.run!.since!
    expect(since.lines[0]!.line).not.toBe(latest.lines[0]!.line) // control: the two versions say different things
    show(view)
    const box = screen.getByTestId('core-compare-since')
    expect([box.getAttribute('data-since-from'), box.getAttribute('data-since-to')]).toEqual(['1', '2'])
    expect(at('run.since.lines.0.line').map((e) => e.textContent)).toEqual([since.lines[0]!.line])
    // A line whose chance moved: the hollow mark is version 1's (about 48%), the filled one version 2's (about 1%), never the other way.
    const l = since.lines[0]!, track = box.querySelector<HTMLElement>(`[data-since-line="${l.option}:${l.aim}"] [data-compare-track]`)!
    expect([l.from_text, l.to_text]).toEqual(['about 48%', 'about 1%'])
    expect([track.getAttribute('data-first'), track.getAttribute('data-second')]).toEqual(['48', '1'])
  })

  it('SI3: no field (a View without `since`), nothing is drawn and the rest of the tab is unchanged', () => {
    const view = fixture('ui9-a6-since-v3'), run = { ...view.model!.run! } as Record<string, unknown>
    delete run.since
    show({ ...view, model: { ...view.model!, run: run as never } })
    expect(screen.queryByTestId('core-compare-since')).toBeNull()
    expect(screen.getByTestId('core-compare-tab')).toBeInTheDocument()
  })
})

describe('where core credits no single change (sole null)', () => {
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
