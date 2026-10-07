/**
 * S-G — the guest-work ledger and the sign-in capture that reads it (`guestWork.ts`, `pendingGuestCopy.ts`).
 *
 * The rule under test: work from the last day is CAPTURED for the copy; older work and an un-ledgered pointer are
 * OFFERED; nothing pending is ever dropped; a boundary (sign-out, lapse) clears both. Rows bind by scenario id.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const auth = vi.hoisted(() => ({ stored: false }))
vi.mock('../storedSupabaseSession', () => ({ hasStoredSupabaseSession: () => auth.stored }))
vi.mock('../payload-trace-store', () => ({ recordRequestPayload: () => {}, recordResponsePayload: () => {} }))

import {
  GUEST_WORK_CAP,
  GUEST_WORK_KEY,
  RECENT_GUEST_WORK_MS,
  forgetGuestWork,
  isRecentGuestWork,
  noteGuestTurn,
  noteGuestWork,
  readGuestWork,
} from '../guestWork'
import {
  PENDING_GUEST_COPIES_KEY,
  PENDING_GUEST_COPY_KEY,
  SPENT_GUEST_POINTER_KEY,
  capturePendingGuestCopies,
  clearPendingGuestCopy,
  forgetPendingGuestCopyOnSignOut,
  readPendingGuestCopies,
} from '../pendingGuestCopy'
import { setPersistenceSessionActive } from '../persistenceSession'
import { USER_SCOPED_STORAGE_KEYS, sweepUserScopedStorage } from '../auth/userScopedKeys'
import { openV5TurnStream } from '../../v5/streamedTurnTransport'

const POINTER = 'olumi-canvas-current-scenario-id'
const A = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const B = '9f8b7a6c-1234-4def-8abc-0123456789ab'
const C = '3b241101-e2bb-4255-8caf-4136c566a962'
const T = Date.parse('2026-10-07T08:40:57Z')
const HOUR = 60 * 60 * 1000

beforeEach(() => {
  localStorage.clear()
  auth.stored = false
  setPersistenceSessionActive(false)
})
afterEach(() => {
  vi.restoreAllMocks()
  setPersistenceSessionActive(false)
})

describe('the ledger', () => {
  it('records a guest turn by scenario id, newest first, and keeps the FIRST typed message as the label', () => {
    noteGuestWork(A, 'Hire a tech lead or two developers?', T - 2 * HOUR)
    noteGuestWork(B, null, T - HOUR)
    noteGuestWork(A, 'a later message', T)

    expect(readGuestWork()).toEqual([
      { id: A, lastActiveAt: T, label: 'Hire a tech lead or two developers?' },
      { id: B, lastActiveAt: T - HOUR, label: null },
    ])
  })

  it('a signed-in page records NOTHING (stored session, or the persistence mirror)', () => {
    auth.stored = true
    noteGuestWork(A, 'x', T)
    auth.stored = false
    setPersistenceSessionActive(true)
    noteGuestWork(B, 'y', T)

    expect(readGuestWork()).toEqual([])
    expect(localStorage.getItem(GUEST_WORK_KEY)).toBeNull()
  })

  it('CONTRAST: the same calls on a guest page record both', () => {
    noteGuestWork(A, 'x', T)
    noteGuestWork(B, 'y', T)

    expect(readGuestWork().map((e) => e.id).sort()).toEqual([A, B].sort())
  })

  it('a turn labels the decision only when the user TYPED it (composer), never from a chip or an event', () => {
    noteGuestTurn({ kind: 'message', source: 'chip', scenario_id: A, message: 'Run the analysis' }, T)
    noteGuestTurn({ kind: 'message', source: 'composer', scenario_id: B, message: '  Should we   expand to Leeds? ' }, T)

    expect(readGuestWork().find((e) => e.id === A)?.label).toBeNull()
    expect(readGuestWork().find((e) => e.id === B)?.label).toBe('Should we expand to Leeds?')
  })

  it('a long first message is cut at a word, never mid-word', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')
    noteGuestWork(A, words, T)

    const label = readGuestWork()[0].label as string
    expect(label.endsWith('…')).toBe(true)
    expect(words.startsWith(label.slice(0, -1))).toBe(true)
    expect(words.charAt(label.length - 1)).toBe(' ')
  })

  it('ignores non-UUID ids and malformed storage; keeps at most the cap, newest', () => {
    noteGuestWork('scenario-1712345678901-ab12cd', null, T)
    expect(readGuestWork()).toEqual([])

    localStorage.setItem(GUEST_WORK_KEY, '{not json')
    expect(readGuestWork()).toEqual([])

    for (let i = 0; i < GUEST_WORK_CAP + 5; i += 1) {
      noteGuestWork(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, null, T + i)
    }
    const kept = readGuestWork()
    expect(kept).toHaveLength(GUEST_WORK_CAP)
    expect(kept[0].id).toBe(`00000000-0000-4000-8000-${String(GUEST_WORK_CAP + 4).padStart(12, '0')}`)
  })

  it('recent = within a day, either side of the clock', () => {
    expect(isRecentGuestWork({ id: A, lastActiveAt: T - RECENT_GUEST_WORK_MS, label: null }, T)).toBe(true)
    expect(isRecentGuestWork({ id: A, lastActiveAt: T - RECENT_GUEST_WORK_MS - 1, label: null }, T)).toBe(false)
    expect(isRecentGuestWork({ id: A, lastActiveAt: null, label: null }, T)).toBe(false)
  })
})

describe('the producer seam: the streamed turn transport records the guest turn', () => {
  const fetchImpl = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch
  const payload = { kind: 'message', turn_id: crypto.randomUUID(), scenario_id: A, message: 'Draft my model', turn_class: 'frame', stage: 'frame', source: 'composer' } as never

  it('guest: the scenario on the wire is recorded, with its typed label', async () => {
    ;(import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT = 'https://example.test/proxy/v5/turn'
    try {
      await openV5TurnStream(payload, { fetchImpl })
    } finally {
      delete (import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT
    }
    expect(readGuestWork().map((e) => [e.id, e.label])).toEqual([[A, 'Draft my model']])
  })

  it('CONTRAST: signed in, the same turn records nothing', async () => {
    auth.stored = true
    ;(import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT = 'https://example.test/proxy/v5/turn'
    try {
      await openV5TurnStream(payload, { fetchImpl })
    } finally {
      delete (import.meta.env as Record<string, unknown>).VITE_V5_ENDPOINT
    }
    expect(readGuestWork()).toEqual([])
  })
})

describe('capturePendingGuestCopies — at the guest → signed-in transition', () => {
  it('recent work is captured (and is no longer an offer); older work stays an OFFER', () => {
    noteGuestWork(A, 'today', T - HOUR)
    noteGuestWork(B, 'last week', T - 7 * 24 * HOUR)

    expect(capturePendingGuestCopies(T)).toEqual([A])
    expect(readPendingGuestCopies()).toEqual([A])
    expect(readGuestWork().map((e) => e.id)).toEqual([B])
  })

  it('a pointer the ledger never saw becomes an OFFER with an unknown age, never a capture', () => {
    localStorage.setItem(POINTER, C)

    expect(capturePendingGuestCopies(T)).toEqual([])
    expect(readGuestWork()).toEqual([{ id: C, lastActiveAt: null, label: null }])
  })

  it('a SPENT pointer (left by someone who signed out) is neither captured nor offered', () => {
    localStorage.setItem(POINTER, C)
    localStorage.setItem(SPENT_GUEST_POINTER_KEY, C)

    expect(capturePendingGuestCopies(T)).toEqual([])
    expect(readGuestWork()).toEqual([])
  })

  it('NEVER DROPPED: a v1 id and an earlier capture survive a later capture (union), and v1 is migrated', () => {
    localStorage.setItem(PENDING_GUEST_COPY_KEY, B)
    noteGuestWork(A, null, T - HOUR)

    expect(capturePendingGuestCopies(T)).toEqual([B, A])
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
    expect(JSON.parse(localStorage.getItem(PENDING_GUEST_COPIES_KEY) as string)).toEqual([B, A])

    noteGuestWork(C, null, T)
    expect(capturePendingGuestCopies(T)).toEqual([B, A, C])
  })

  it('storage refusing the write leaves the recent work in the ledger (offered), never lost', () => {
    noteGuestWork(A, null, T - HOUR)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })

    expect(capturePendingGuestCopies(T)).toEqual([])
    vi.restoreAllMocks()
    expect(readGuestWork().map((e) => e.id)).toEqual([A])
  })

  it('clearPendingGuestCopy(id) removes THAT id only', () => {
    noteGuestWork(A, null, T - HOUR)
    noteGuestWork(B, null, T - 2 * HOUR)
    capturePendingGuestCopies(T)

    clearPendingGuestCopy(A)

    expect(readPendingGuestCopies()).toEqual([B])
  })
})

describe('boundaries — never the next account’s', () => {
  it('sign-out drops everything pending AND offered, and marks the pointer spent', () => {
    noteGuestWork(A, null, T - HOUR)
    noteGuestWork(B, null, T - 9 * 24 * HOUR)
    localStorage.setItem(POINTER, C)
    capturePendingGuestCopies(T)

    forgetPendingGuestCopyOnSignOut()

    expect(readPendingGuestCopies()).toEqual([])
    expect(readGuestWork()).toEqual([])
    expect(localStorage.getItem(SPENT_GUEST_POINTER_KEY)).toBe(C)
  })

  it('the lapse/A→B sweep names the owners’ OWN keys and removes them', () => {
    expect(USER_SCOPED_STORAGE_KEYS).toEqual(expect.arrayContaining([GUEST_WORK_KEY, PENDING_GUEST_COPY_KEY, PENDING_GUEST_COPIES_KEY]))
    noteGuestWork(A, null, T)
    localStorage.setItem(PENDING_GUEST_COPIES_KEY, JSON.stringify([B]))
    localStorage.setItem(PENDING_GUEST_COPY_KEY, C)

    sweepUserScopedStorage()

    expect(localStorage.getItem(GUEST_WORK_KEY)).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_COPIES_KEY)).toBeNull()
    expect(localStorage.getItem(PENDING_GUEST_COPY_KEY)).toBeNull()
  })

  it('"Not mine" forgets one offer only', () => {
    noteGuestWork(A, null, T - 9 * 24 * HOUR)
    noteGuestWork(B, null, T - 8 * 24 * HOUR)

    forgetGuestWork(A)

    expect(readGuestWork().map((e) => e.id)).toEqual([B])
  })
})
