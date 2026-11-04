/**
 * Compare and Version history on the olumi-core lane (DL brief, 4 Nov): fed by core's stored versions and core's comparison
 * (olumi-core API.md v1.7), every word and mark core's. The catch row: on the lane the dock offers Compare, and a two-version
 * scenario's Compare tab draws core's change list; hiding the surface again (lane.ts CEE_ONLY_SURFACES) turns it red.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

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
import { CoreCompareTab } from '../compare'
import { CoreVersions } from '../versions'
import { WhatChangedPanel } from '../../canvas/versions/WhatChangedPanel'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const withVersion = (n: number): View => ({ ...base, id: SID, version: { ...base.version!, id: 40 + n, n, label: `version ${n}` } })
// Core's answers, word for word as API.md v1.7 gives their shapes.
const COMPARED = {
  versions: [{ n: 2, at: '2026-11-04T09:00:00Z', proposedBy: 'Bea', briefBy: null, approvedBy: 'Ada' }],
  changes: [{ text: '+ figure: staff absence', detail: '2 to 10 ticket/week', mark: { glyph: '◆', title: 'Proposed by Olumi: typical absence' } },
    { text: '↻ figure: per specialist', detail: 'from 20 to 15', mark: null }],
  results: [{ kind: 'chance', option: 'hire', optionLabel: 'Add one specialist', aim: 'At least 100 a week', condition: null,
    before: { value: 'about 50% chance', title: 't1', olumi: null }, after: { value: 'about 40% chance', title: 't2', olumi: { glyph: '◆', title: 'Rests on Olumi’s proposals' } }, move: 'down' }],
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
afterEach(() => { cleanup(); setTeamFetch(null); vi.unstubAllEnvs() })

describe('the catch row: Compare is on the lane and shows a two-version scenario\'s change list', () => {
  it('the dock offers Compare on the lane, and its tab draws core\'s change lines between version 1 and 2, marks and all', async () => {
    vi.resetModules()
    vi.doMock('../../flags', async (orig) => ({ ...(await orig<typeof import('../../flags')>()), isCompareTabEnabled: () => true, isAiPanelV2Enabled: () => true }))
    const { getOutputTabsForParity } = await import('../../canvas/components/OutputsDock')
    expect(getOutputTabsForParity().map((t) => t.id)).toContain('compare') // red if lane.ts hides 'compare' again
    vi.doUnmock('../../flags')
    render(<CoreCompareTab />)
    await waitFor(() => expect(screen.getByTestId('core-compare-out')).toBeTruthy())
    expect(paths).toContain(`/api/scenarios/${SID}/compare?from=1&to=2`)
    const lines = [...screen.getByTestId('core-compare-changes').querySelectorAll('li')].map((l) => l.textContent)
    expect(lines).toEqual(['+ figure: staff absence 2 to 10 ticket/week ◆', '↻ figure: per specialist from 20 to 15'])
    expect(screen.getByLabelText('Proposed by Olumi: typical absence').textContent).toBe('◆') // Olumi's mark, its hover core's
    expect(screen.getByTestId('core-compare-results').textContent).toBe('‘Add one specialist’ on ‘At least 100 a week’: about 50% chance → about 40% chance ◆ (down)')
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
    const first = { ...COMPARED, versions: [{ n: 1, at: '2026-11-04T08:00:00Z', proposedBy: 'Olumi', briefBy: 'Ada', approvedBy: 'Ada' }, COMPARED.versions[0]] }
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
