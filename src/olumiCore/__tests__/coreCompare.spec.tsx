/**
 * Compare and Version history on the olumi-core lane (DL brief, 4 Nov): fed by core's stored versions and core's comparison
 * (olumi-core API.md v1.7), every word and mark core's. The catch row: on the lane the dock offers Compare, and a two-version
 * scenario's Compare tab draws core's change list; hiding the surface again (lane.ts CEE_ONLY_SURFACES) turns it red.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))

import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { CoreCompare, CoreCompareTab } from '../compare'
import { ComparePanel } from '../team/ComparePanel'
import { CoreVersions } from '../versions'
import { WhatChangedPanel } from '../../canvas/versions/WhatChangedPanel'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const withVersion = (n: number): View => ({ ...base, id: SID, version: { ...base.version!, id: 40 + n, n, label: `version ${n}` } })
// Core's answers, word for word as API.md v1.7 gives their shapes.
const COMPARED = {
  versions: [{ n: 1, at: '2026-11-04T08:00:00Z', proposedBy: 'Olumi', briefBy: 'Ada', approvedBy: 'Ada' }, { n: 2, at: '2026-11-04T09:00:00Z', proposedBy: 'Bea', briefBy: null, approvedBy: 'Ada' }],
  changes: [{ text: '+ figure: staff absence', detail: '2 to 10 ticket/week', mark: { glyph: '◆', title: 'Proposed by Olumi: typical absence' } },
    { text: '↻ figure: per specialist', detail: 'from 20 to 15', mark: null }],
  results: [{ kind: 'chance', option: 'hire', optionLabel: 'Add one specialist', aim: 'At least 100 a week', condition: null,
    before: { value: 'about 50% chance', title: 't1', olumi: null, chance: 0.5 }, after: { value: 'about 40% chance', title: 't2', olumi: { glyph: '◆', title: 'Rests on Olumi’s proposals' }, chance: 0.4 }, move: 'down' }],
}
const VERSIONS = { versions: [
  { id: 41, n: 1, at: '2026-11-04T08:00:00Z', by: 'Ada', proposal: 1, base: null, changes: { added: [], changed: [], removed: [], top: [] }, facts: [], form: {} },
  { id: 42, n: 2, at: '2026-11-04T09:00:00Z', by: 'Bea', proposal: 3, base: 41, changes: { added: [], changed: [], removed: [], top: [] }, facts: [], form: {} },
] }

let paths: string[] = []
beforeEach(() => {
  paths = []
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  setTeamFetch((async (u: unknown) => {
    const p = String(u); paths.push(p)
    return new Response(JSON.stringify(p.includes('/compare') ? COMPARED : p.includes('/versions') ? VERSIONS : useViewStore.getState().view), { status: 200 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: withVersion(2), status: 'ready', error: null, stale: false })
})
afterEach(() => { cleanup(); setTeamFetch(null); vi.unstubAllEnvs(); useViewStore.setState({ at: null }) })

describe('the catch row: Compare is on the lane and shows a two-version scenario\'s change list', () => {
  it('the dock offers Compare on the lane, and its tab draws core\'s change lines between version 1 and 2, marks and all', async () => {
    vi.resetModules()
    vi.doMock('../../flags', async (orig) => ({ ...(await orig<typeof import('../../flags')>()), isCompareTabEnabled: () => true, isAiPanelV2Enabled: () => true }))
    const { getOutputTabsForParity } = await import('../../canvas/components/OutputsDock')
    expect(getOutputTabsForParity().map((t) => t.id)).toContain('compare') // red if lane.ts hides 'compare' again
    vi.doUnmock('../../flags')
    render(<CoreCompareTab />)
    await waitFor(() => expect(screen.getByTestId('core-compare-sections')).toBeTruthy())
    expect(paths).toContain(`/api/scenarios/${SID}/compare?from=1&to=2`)
    const lines = [...screen.getByTestId('compare-changes').querySelectorAll('li')].map((l) => l.textContent)
    expect(lines).toEqual(['+ figure: staff absence 2 to 10 ticket/week ◆', '↻ figure: per specialist from 20 to 15'])
    expect(screen.getByLabelText('Proposed by Olumi: typical absence').textContent).toBe('◆') // Olumi's mark, its hover core's
    // A4: the chance on the previous slope, by core's label, earlier → now in core's words, Olumi's mark kept.
    expect(screen.getByTestId('compare-pair-chance-slope').querySelector('.sr-only')?.textContent).toBe('‘Add one specialist’ on ‘At least 100 a week’: earlier run about 50% chance, this run about 40% chance ◆')
  }, 120_000)
})

describe('the Compare tab', () => {
  it('with one approved version says a second is needed and reads nothing', () => {
    useViewStore.setState({ view: withVersion(1) })
    render(<CoreCompareTab />)
    expect(screen.getByTestId('core-compare-one')).toBeTruthy()
    expect(paths.filter((p) => p.includes('/compare'))).toEqual([])
  })
  it('a pair the person picks is read from core; the same version twice is refused here, as core refuses it', async () => {
    useViewStore.setState({ view: withVersion(3) })
    render(<CoreCompareTab />)
    await waitFor(() => expect(paths).toContain(`/api/scenarios/${SID}/compare?from=2&to=3`))
    fireEvent.change(screen.getByTestId('core-compare-from'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('core-compare-go'))
    await waitFor(() => expect(paths).toContain(`/api/scenarios/${SID}/compare?from=1&to=3`))
    fireEvent.change(screen.getByTestId('core-compare-from'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('core-compare-go'))
    expect(screen.getByTestId('core-compare-error').textContent).toBe('Pick two different versions.')
  })
})

// The panel's design language (Paul, 6 Nov side-by-side: native full-width selects and bare text lines): on the dock's Compare tab each list
// sits in the panel's card under a panel heading and the version pickers are compact; inside the Team tab's own section it stays inline.
describe('the Compare tab reads in the previous product\'s Compare layout (A4)', () => {
  it('catch: the two ends, one headline, the chance slope, then ruled sections for what changed and who; compact pickers; inline (no sections) where another section holds it', async () => {
    render(<CoreCompareTab />)
    await waitFor(() => expect(screen.getByTestId('core-compare-sections')).toBeTruthy())
    const sections = [...screen.getByTestId('core-compare-sections').querySelectorAll('[data-compare-section]')]
    expect(sections.map((p) => p.getAttribute('data-compare-section'))).toEqual(['headline', 'inputs', 'who'])
    expect(screen.getByTestId('compare-run-times').textContent).toMatch(/^Version 1.*Version 2/)
    expect(sections.slice(1).map((p) => p.querySelector('h4')?.textContent)).toEqual(['Changed between the two versions', 'Who proposed and approved'])
    expect(screen.getByTestId('compare-pair-chance-slope')).toBeTruthy()
    for (const t of ['core-compare-from', 'core-compare-to']) expect(screen.getByTestId(t).className, t).not.toContain('w-full')
    cleanup()
    // CONTRAST: the Team tab's compare, inside its own section, stays inline (its lists, no sections).
    render(<CoreCompare sid={SID} latest={2} id="team-compare" auto />)
    await waitFor(() => expect(screen.getByTestId('team-compare-out')).toBeTruthy())
    expect(screen.queryByTestId('core-compare-sections')).toBeNull()
    expect(screen.getByTestId('team-compare-out').querySelectorAll('[data-compare-part]').length).toBe(0)
  })
})

describe('Version history on the lane', () => {
  it('lists core\'s versions, newest first, with who approved each, and compares any two through core', async () => {
    render(<CoreVersions />)
    await waitFor(() => expect(screen.getAllByTestId('core-version-row')).toHaveLength(2))
    expect(paths).toContain(`/api/scenarios/${SID}/versions`)
    expect(screen.getByTestId('core-version-open-2').textContent).toMatch(/^Version 2 · .+ · approved by Bea$/)
    expect(screen.getByTestId('core-version-open-1').textContent).toMatch(/^Version 1 · .+ · approved by Ada$/)
    expect(screen.getAllByTestId('core-version-row').map((r) => r.getAttribute('data-version'))).toEqual(['2', '1'])
    fireEvent.click(screen.getByTestId('versions-compare-go'))
    await waitFor(() => expect(screen.getByTestId('versions-compare-changes')).toBeTruthy())
  })
  it('a version approved over another opens on its record: core\'s change card against that version, who proposed it, how the results moved', async () => {
    render(<CoreVersions />)
    fireEvent.click(await screen.findByTestId('core-version-open-2'))
    await waitFor(() => expect(screen.getByTestId('core-version-2-changes')).toBeTruthy())
    expect(paths).toContain(`/api/scenarios/${SID}/compare?from=1&to=2`) // version 2's base is id 41, version 1
    expect([...screen.getByTestId('core-version-2-changes').querySelectorAll('li')].map((l) => l.textContent))
      .toEqual(['+ figure: staff absence 2 to 10 ticket/week ◆', '↻ figure: per specialist from 20 to 15'])
    expect(screen.getByTestId('core-version-2-who').textContent).toBe('Proposed by Bea · approved by Ada')
    expect(screen.getByTestId('core-version-2-results').textContent).toBe('‘Add one specialist’ on ‘At least 100 a week’: about 50% chance → about 40% chance ◆ (down)')
    expect(screen.queryByTestId('core-version-2-versions')).toBeNull()
  })
  it('a version\'s record is against the version it was approved over, read from core\'s `base`, not the number before it', async () => {
    const three = { versions: [...VERSIONS.versions, { ...VERSIONS.versions[1]!, id: 43, n: 3, base: 41 }] }
    setTeamFetch((async (u: unknown) => { const p = String(u); paths.push(p); return new Response(JSON.stringify(p.includes('/compare') ? COMPARED : three), { status: 200 }) }) as unknown as typeof fetch)
    render(<CoreVersions />)
    fireEvent.click(await screen.findByTestId('core-version-open-3'))
    await waitFor(() => expect(paths).toContain(`/api/scenarios/${SID}/compare?from=1&to=3`))
    expect(paths.filter((p) => p.includes('/compare'))).toEqual([`/api/scenarios/${SID}/compare?from=1&to=3`])
  })
  it('the first version opens on who proposed it and its saved results, the earlier side of core\'s comparison with the next', async () => {
    const first = { ...COMPARED, versions: [{ n: 1, at: '2026-11-04T08:00:00Z', proposedBy: 'Olumi', briefBy: 'Ada', approvedBy: 'Ada' }, COMPARED.versions[1]] }
    setTeamFetch((async (u: unknown) => { const p = String(u); paths.push(p); return new Response(JSON.stringify(p.includes('/compare') ? first : VERSIONS), { status: 200 }) }) as unknown as typeof fetch)
    render(<CoreVersions />)
    fireEvent.click(await screen.findByTestId('core-version-open-1'))
    await waitFor(() => expect(screen.getByTestId('core-version-1-found')).toBeTruthy())
    expect(paths).toContain(`/api/scenarios/${SID}/compare?from=1&to=2`)
    expect(screen.getByTestId('core-version-1-who').textContent).toBe('Proposed by Olumi, from Ada\'s brief · approved by Ada')
    expect(screen.getByTestId('core-version-1-found').textContent).toBe('‘Add one specialist’ on ‘At least 100 a week’: about 50% chance')
    expect(screen.queryByTestId('core-version-1-changes')).toBeNull() // a core before API v1.10 serves no `lines`: no change card drawn
  })
  it('the first version\'s own change lines are core\'s `lines` (API v1.10), and each record links to its heading on the printable record', async () => {
    const LINES = [{ text: '+ option: Add one specialist', detail: '', mark: null, olumi: false }, { text: '+ figure: per specialist', detail: '10 to 30 ticket/week', mark: { glyph: '◆', title: 'Proposed by Olumi: from the brief' }, olumi: true }]
    const withLines = { versions: [{ ...VERSIONS.versions[0]!, lines: LINES }, { ...VERSIONS.versions[1]!, lines: COMPARED.changes }] }
    setTeamFetch((async (u: unknown) => { const p = String(u); paths.push(p); return new Response(JSON.stringify(p.includes('/compare') ? COMPARED : withLines), { status: 200 }) }) as unknown as typeof fetch)
    render(<CoreVersions />)
    fireEvent.click(await screen.findByTestId('core-version-open-1'))
    expect([...(await screen.findByTestId('core-version-1-changes')).querySelectorAll('li')].map((l) => l.textContent))
      .toEqual(['+ option: Add one specialist', '+ figure: per specialist 10 to 30 ticket/week ◆'])
    expect(screen.getByTestId('core-version-1-record-link').getAttribute('href')).toBe(`/s/${SID}/record#version-1`)
    // A later version's change card is core's comparison with the version it was approved over: drawn once, not again from `lines`.
    fireEvent.click(screen.getByTestId('core-version-open-2'))
    await waitFor(() => expect(screen.getAllByTestId('core-version-2-changes')).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('core-version-2-results')).toBeTruthy())
    expect(screen.getAllByTestId('core-version-2-changes')).toHaveLength(1)
  })
  it('a lone version opens on who approved it and reads no comparison', async () => {
    setTeamFetch((async (u: unknown) => { const p = String(u); paths.push(p); return new Response(JSON.stringify({ versions: [VERSIONS.versions[0]] }), { status: 200 }) }) as unknown as typeof fetch)
    useViewStore.setState({ view: withVersion(1) })
    render(<CoreVersions />)
    fireEvent.click(await screen.findByTestId('core-version-open-1'))
    expect(screen.getByTestId('core-version-1-who').textContent).toBe('Approved by Ada')
    expect(paths.filter((p) => p.includes('/compare'))).toEqual([])
  })
  it('must not change: reading the history leaves the version in use alone, marked as core labels it, and only reads', async () => {
    const before = useViewStore.getState().view, methods: string[] = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => { const p = String(u); paths.push(p); methods.push(init?.method ?? 'GET'); return new Response(JSON.stringify(p.includes('/compare') ? COMPARED : VERSIONS), { status: 200 }) }) as unknown as typeof fetch)
    render(<CoreVersions />)
    fireEvent.click(await screen.findByTestId('core-version-open-1'))
    fireEvent.click(screen.getByTestId('core-version-open-2'))
    await waitFor(() => expect(screen.getByTestId('core-version-2-changes')).toBeTruthy())
    const row = screen.getAllByTestId('core-version-row').find((r) => r.getAttribute('aria-current') === 'true')
    expect(row?.getAttribute('data-version')).toBe('2')
    expect(screen.getByTestId('core-version-open-2').getAttribute('title')).toBe('version 2')
    expect(useViewStore.getState().view).toBe(before)
    expect(useViewStore.getState().view?.version?.n).toBe(2)
    expect(methods.every((m) => m === 'GET')).toBe(true)
    expect(paths.filter((p) => p.includes('/view'))).toEqual([])
  })
  it('the panel on the lane is core\'s versions only: no local snapshot to save, none to compare', async () => {
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('core-versions')).toBeTruthy())
    expect(screen.queryByText('Save version')).toBeNull()
    expect(screen.queryByTestId('versions-vocabulary-disclosure')).toBeNull()
  })
  it('off the lane the panel is the local history as before', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    render(<WhatChangedPanel isOpen onClose={() => {}} />)
    expect(screen.queryByTestId('core-versions')).toBeNull()
    expect(screen.getByTestId('versions-vocabulary-disclosure')).toBeTruthy()
  })
})

describe('R1 review 2: Compare takes the latest approved version from core, not from the version drawn', () => {
  const THREE = { versions: [...VERSIONS.versions, { ...VERSIONS.versions[1]!, id: 43, n: 3, base: 42 }] }
  beforeEach(() => {
    setTeamFetch((async (u: unknown) => { const p = String(u); paths.push(p); return new Response(JSON.stringify(p.includes('/compare') ? COMPARED : THREE), { status: 200 }) }) as unknown as typeof fetch)
    useViewStore.setState({ view: withVersion(1), at: 1 }) // version 1 drawn on the canvas; core holds 3
  })
  it('the dock\'s Compare tab offers all three versions and reads 2 against 3', async () => {
    render(<CoreCompareTab />)
    await waitFor(() => expect(paths).toContain(`/api/scenarios/${SID}/compare?from=2&to=3`))
    expect(screen.queryByTestId('core-compare-one')).toBeNull()
    expect([...screen.getByTestId('core-compare-to').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['version 1', 'version 2', 'version 3'])
  })
  it('the Team tab\'s compare offers all three too', async () => {
    render(<ComparePanel sid={SID} view={withVersion(1)} />)
    fireEvent.click(await screen.findByText('Compare versions'))
    await waitFor(() => expect([...screen.getByTestId('team-compare-to').querySelectorAll('option')].map((o) => o.textContent)).toEqual(['version 1', 'version 2', 'version 3']))
  })
})

describe('R1 review 3: a comparison answered late never overwrites a newer one', () => {
  it('a slow 1–2 that lands after the auto-refresh\'s 2–3 is dropped, with its busy and error', async () => {
    let slow: ((r: Response) => void) | null = null
    setTeamFetch(((u: unknown) => {
      const p = String(u); paths.push(p)
      if (p.endsWith('from=1&to=2')) return new Promise<Response>((res) => { slow = res })
      return Promise.resolve(new Response(JSON.stringify({ ...COMPARED, changes: [{ text: '↻ figure: newer', detail: '', mark: null }] }), { status: 200 }))
    }) as unknown as typeof fetch)
    const { rerender } = render(<CoreCompare sid={SID} latest={2} id="x" auto />)
    await waitFor(() => expect(paths).toContain(`/api/scenarios/${SID}/compare?from=1&to=2`))
    rerender(<CoreCompare sid={SID} latest={3} id="x" auto />) // another member approved: the default pair moves to 2–3
    await waitFor(() => expect(screen.getByTestId('x-changes').textContent).toBe('↻ figure: newer'))
    await act(async () => { slow!(new Response(JSON.stringify(COMPARED), { status: 200 })) })
    expect(screen.getByTestId('x-changes').textContent).toBe('↻ figure: newer')
    expect((screen.getByTestId('x-go') as HTMLButtonElement).disabled).toBe(false)
  })
  it('an old answer that lands while the newer read is still on its way leaves the picker held', async () => {
    const held: Record<string, (r: Response) => void> = {}
    setTeamFetch(((u: unknown) => { const p = String(u); paths.push(p); return new Promise<Response>((res) => { held[p.slice(p.indexOf('from='))] = res }) }) as unknown as typeof fetch)
    const { rerender } = render(<CoreCompare sid={SID} latest={2} id="x" auto />)
    await waitFor(() => expect(held['from=1&to=2']).toBeDefined())
    rerender(<CoreCompare sid={SID} latest={3} id="x" auto />)
    await waitFor(() => expect(held['from=2&to=3']).toBeDefined())
    await act(async () => { held['from=1&to=2']!(new Response(JSON.stringify(COMPARED), { status: 200 })) })
    expect((screen.getByTestId('x-go') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByTestId('x-out')).toBeNull()
    await act(async () => { held['from=2&to=3']!(new Response(JSON.stringify(COMPARED), { status: 200 })) })
    expect((screen.getByTestId('x-go') as HTMLButtonElement).disabled).toBe(false)
  })
  it('a late failure of a superseded read says nothing', async () => {
    let slow: ((e: Error) => void) | null = null
    setTeamFetch(((u: unknown) => {
      const p = String(u); paths.push(p)
      if (p.endsWith('from=1&to=2')) return new Promise<Response>((_, rej) => { slow = rej })
      return Promise.resolve(new Response(JSON.stringify(COMPARED), { status: 200 }))
    }) as unknown as typeof fetch)
    const { rerender } = render(<CoreCompare sid={SID} latest={2} id="x" auto />)
    await waitFor(() => expect(slow).not.toBeNull())
    rerender(<CoreCompare sid={SID} latest={3} id="x" auto />)
    await waitFor(() => expect(screen.getByTestId('x-out')).toBeTruthy())
    await act(async () => { slow!(new TypeError('network')) })
    expect(screen.queryByTestId('x-error')).toBeNull()
    expect(screen.getByTestId('x-out')).toBeTruthy()
  })
})
