/**
 * Login UI half (3.4) — one-time guest-draft import.
 *
 * The UI's localStorage half of guest-claim (the server half is CEE's
 * claim_guest_scenario RPC — service_role-only; the browser NEVER calls it).
 * Routes through the EXISTING authenticated create/persist path
 * (scenarioService.createScenario + saveGraph), no new persistence machinery.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const createScenario = vi.fn()
const saveGraph = vi.fn()

vi.mock('../../services/scenarioService', () => ({
  createScenario: (...args: unknown[]) => createScenario(...args),
  saveGraph: (...args: unknown[]) => saveGraph(...args),
}))

import {
  DRAFT_IMPORT_MARKER_KEY,
  shouldOfferDraftImport,
  dismissDraftImport,
  importGuestDraft,
} from '../loginDraftImport'

const REAL_USER = { id: '5b6f0f0e-2c1a-4b3d-9d1e-aaaaaaaaaaaa' }
const GUEST_USER = { id: 'guest' }

function seedDraft(nodes: unknown[] = [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Goal' } }]) {
  localStorage.setItem(
    'canvas-storage',
    JSON.stringify({ version: 1, timestamp: 1234567890, nodes, edges: [] }),
  )
}

function flagOn() {
  localStorage.setItem('feature.requireLogin', '1')
}

beforeEach(() => {
  localStorage.clear()
  createScenario.mockReset()
  saveGraph.mockReset()
})

afterEach(() => {
  localStorage.clear()
})

describe('shouldOfferDraftImport', () => {
  it('offers when: flag on + real authenticated user + draft exists + no marker', () => {
    flagOn()
    seedDraft()
    expect(shouldOfferDraftImport(REAL_USER, true)).toBe(true)
  })

  it('never offers when the flag is off (dark by default)', () => {
    seedDraft()
    expect(shouldOfferDraftImport(REAL_USER, true)).toBe(false)
  })

  it('never offers to the guest user', () => {
    flagOn()
    seedDraft()
    expect(shouldOfferDraftImport(GUEST_USER, true)).toBe(false)
  })

  it('never offers when unauthenticated or user is null', () => {
    flagOn()
    seedDraft()
    expect(shouldOfferDraftImport(REAL_USER, false)).toBe(false)
    expect(shouldOfferDraftImport(null, true)).toBe(false)
  })

  it('never offers when there is no stored draft', () => {
    flagOn()
    expect(shouldOfferDraftImport(REAL_USER, true)).toBe(false)
  })

  it('never offers an empty draft (zero nodes)', () => {
    flagOn()
    seedDraft([])
    expect(shouldOfferDraftImport(REAL_USER, true)).toBe(false)
  })

  it('is one-time: no re-offer after import or dismissal', () => {
    flagOn()
    seedDraft()
    localStorage.setItem(DRAFT_IMPORT_MARKER_KEY, 'imported')
    expect(shouldOfferDraftImport(REAL_USER, true)).toBe(false)
    localStorage.setItem(DRAFT_IMPORT_MARKER_KEY, 'dismissed')
    expect(shouldOfferDraftImport(REAL_USER, true)).toBe(false)
  })
})

describe('dismissDraftImport', () => {
  it('persists the dismissed marker', () => {
    dismissDraftImport()
    expect(localStorage.getItem(DRAFT_IMPORT_MARKER_KEY)).toBe('dismissed')
  })
})

describe('importGuestDraft', () => {
  it('creates a scenario via the existing path, saves the draft graph, marks imported, returns the id', async () => {
    seedDraft()
    createScenario.mockResolvedValue({ id: 'scn-1' })
    saveGraph.mockResolvedValue(undefined)

    const id = await importGuestDraft(REAL_USER.id)

    expect(id).toBe('scn-1')
    // createScenario(userId, eventId, title?) — real user id + a UUID event id
    expect(createScenario).toHaveBeenCalledTimes(1)
    const [userId, eventId] = createScenario.mock.calls[0]
    expect(userId).toBe(REAL_USER.id)
    expect(eventId).toMatch(/^[0-9a-f-]{36}$/)
    // The draft graph is persisted into the new row BEFORE any navigation,
    // so the /scenario/:id server-hydration loads the draft, not an empty graph.
    expect(saveGraph).toHaveBeenCalledTimes(1)
    const [scenarioId, graph] = saveGraph.mock.calls[0]
    expect(scenarioId).toBe('scn-1')
    expect((graph as { nodes: unknown[] }).nodes).toHaveLength(1)
    expect(localStorage.getItem(DRAFT_IMPORT_MARKER_KEY)).toBe('imported')
  })

  it('keeps the localStorage draft after import (never deletes user data)', async () => {
    seedDraft()
    createScenario.mockResolvedValue({ id: 'scn-1' })
    saveGraph.mockResolvedValue(undefined)
    await importGuestDraft(REAL_USER.id)
    expect(localStorage.getItem('canvas-storage')).not.toBeNull()
  })

  it('throws and sets NO marker when there is no draft to import', async () => {
    await expect(importGuestDraft(REAL_USER.id)).rejects.toThrow()
    expect(createScenario).not.toHaveBeenCalled()
    expect(localStorage.getItem(DRAFT_IMPORT_MARKER_KEY)).toBeNull()
  })

  it('does NOT mark imported when persistence fails (offer can retry)', async () => {
    seedDraft()
    createScenario.mockResolvedValue({ id: 'scn-1' })
    saveGraph.mockRejectedValue(new Error('save failed'))
    await expect(importGuestDraft(REAL_USER.id)).rejects.toThrow('save failed')
    expect(localStorage.getItem(DRAFT_IMPORT_MARKER_KEY)).toBeNull()
  })
})
