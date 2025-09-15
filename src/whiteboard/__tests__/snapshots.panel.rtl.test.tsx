// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'

// Mock Canvas and CompareView to keep test lightweight
vi.mock('@/whiteboard/Canvas', () => {
  const React = require('react')
  return { Canvas: () => React.createElement('div', { 'data-testid': 'canvas-root' }) }
})
vi.mock('@/whiteboard/CompareView', () => {
  const React = require('react')
  return { __esModule: true, default: () => React.createElement('div', { 'data-testid': 'compare-view' }) }
})

import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

// Telemetry-first: inject a stable track spy via useTelemetry
const trackSpy = vi.fn()
vi.mock('@/lib/useTelemetry', () => ({ useTelemetry: () => ({ track: (...args: any[]) => trackSpy(...args) }) }))

function mount(route = '/decisions/demo/sandbox/combined', flags?: any) {
  const ui = (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
      </Routes>
    </MemoryRouter>
  )
  return renderSandbox(ui, flags)
}

describe('Snapshot Manager panel (flag OFF by default)', () => {
  let errSpy: any, warnSpy: any
  beforeEach(() => {
    localStorage.clear()
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    trackSpy?.mockClear?.()
  })
  afterEach(() => { localStorage.clear(); errSpy.mockRestore(); warnSpy.mockRestore() })

  it('create, rename, restore, delete emits telemetry (telemetry-first assertions)', async () => {
    mount('/decisions/demo/sandbox/combined', { sandbox: true, snapshotManager: true })

    const trigger = await screen.findByRole('button', { name: /snapshots/i })
    fireEvent.click(trigger)

    // Dialog opens
    const dialog = await screen.findByRole('dialog', { name: /snapshots/i })
    expect(dialog).toBeTruthy()

    // Create
    const createBtn = within(dialog).getByRole('button', { name: /create snapshot/i })
    fireEvent.click(createBtn)

    await waitFor(() => {
      const names = (trackSpy.mock?.calls || []).map((c: any[]) => c[0])
      if (!names.includes('sandbox_snapshot_create')) throw new Error('no create telemetry')
    })

    // Reopen to refresh list rendering
    fireEvent.click(trigger) // close
    fireEvent.click(trigger) // open
    const dialog2 = await screen.findByRole('dialog', { name: /snapshots/i })
    // There should be at least one actionable item now; get the one with Rename
    const renameBtn = await within(dialog2).findByRole('button', { name: /rename/i })
    const item = renameBtn.closest('li') as HTMLElement
    expect(item).toBeTruthy()

    // Rename
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Renamed Foo')
    fireEvent.click(renameBtn)
    promptSpy.mockRestore()

    await waitFor(() => {
      const names = (trackSpy.mock?.calls || []).map((c: any[]) => c[0])
      if (!names.includes('sandbox_snapshot_rename')) throw new Error('no rename telemetry')
    })

    // Restore
    const restoreBtn = within(item).getByRole('button', { name: /restore/i })
    fireEvent.click(restoreBtn)

    await waitFor(() => {
      const names = (trackSpy.mock?.calls || []).map((c: any[]) => c[0])
      if (!names.includes('sandbox_snapshot_restore')) throw new Error('no restore telemetry')
    })
    // Undo banner should appear in page
    const undoBanner = await screen.findByText(/Restored\. Undo\?/i)
    expect(undoBanner).toBeInTheDocument()

    // Reopen popover to ensure dialog reference fresh
    const trigger2 = await screen.findByRole('button', { name: /snapshots/i })
    fireEvent.click(trigger2)
    const dialog3 = await screen.findByRole('dialog', { name: /snapshots/i })
    const itemsNow = within(dialog3).getAllByRole('listitem')
    const lastItem = itemsNow[itemsNow.length - 1]
    const deleteBtn = within(lastItem).getByRole('button', { name: /delete/i })
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      const names = (trackSpy.mock?.calls || []).map((c: any[]) => c[0])
      if (!names.includes('sandbox_snapshot_delete')) throw new Error('no delete telemetry')
    })
  })
})
