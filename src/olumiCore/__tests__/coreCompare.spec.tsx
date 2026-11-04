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
const withVersion = (n: number): View => ({ ...base, id: SID, version: { ...base.version!, id: 40 + n, n } })
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
    const rows = screen.getAllByTestId('core-version-row').map((r) => r.textContent)
    expect(rows[0]).toMatch(/^Version 2 · .+ · approved by Bea$/)
    expect(rows[1]).toMatch(/^Version 1 · .+ · approved by Ada$/)
    fireEvent.click(screen.getByTestId('versions-compare-go'))
    await waitFor(() => expect(screen.getByTestId('versions-compare-changes')).toBeTruthy())
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
