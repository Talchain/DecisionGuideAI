/**
 * S-G — "Decisions from before you signed in". Guest work that sign-in did NOT copy automatically is offered here, and
 * nothing happens to it until the user chooses. Rows bind by scenario id: which id was sent to the copy route, which
 * offer row left the list, which id the list-refresh event names.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

const auth = vi.hoisted(() => ({ user: { id: 'user-1' } as { id: string } | null, authenticated: true }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user, authenticated: auth.authenticated }) }))
vi.mock('../../../lib/persistenceActive', () => ({
  isPersistenceActive: (authenticated: boolean, user: { id: string } | null) => authenticated && user !== null,
}))
vi.mock('../../../lib/storedSupabaseSession', () => ({ hasStoredSupabaseSession: () => false }))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'user-1', accessToken: 'eyJ.tok.sig' }) }))
const mockRequest = vi.fn()
vi.mock('../../../services/guestCopyService', () => ({ requestGuestCopy: (...args: unknown[]) => mockRequest(...args) }))

import { GuestWorkOfferBanner, GUEST_WORK_OFFER_COPY } from '../GuestWorkOfferBanner'
import { GUEST_WORK_KEY, readGuestWork } from '../../../lib/guestWork'
import { GUEST_COPIED_EVENT, type GuestCopiedDetail } from '../../../lib/guestCopyOnSignIn'
import { GUEST_STORAGE_CLAIM_PATTERNS } from '../../../test/guestStorageClaims'

const SEP28 = '657e63ef-f220-4fd5-9b4b-25e04334b3e4'
const OLDER = '9f8b7a6c-1234-4def-8abc-0123456789ab'
const COPY = '3b241101-e2bb-4255-8caf-4136c566a962'

function seed() {
  localStorage.setItem(GUEST_WORK_KEY, JSON.stringify([
    { id: SEP28, lastActiveAt: Date.parse('2026-09-28T13:06:28Z'), label: 'Personal assistant or an AI assistant?' },
    { id: OLDER, lastActiveAt: null, label: null },
  ]))
}

const row = (id: string) => screen.getAllByTestId('guest-work-offer').find((el) => el.getAttribute('data-scenario-id') === id)

let events: GuestCopiedDetail[] = []
const onCopied = (e: Event) => { events.push((e as CustomEvent<GuestCopiedDetail>).detail) }

beforeEach(() => {
  localStorage.clear()
  auth.user = { id: 'user-1' }
  auth.authenticated = true
  mockRequest.mockReset()
  events = []
  window.addEventListener(GUEST_COPIED_EVENT, onCopied)
})
afterEach(() => {
  window.removeEventListener(GUEST_COPIED_EVENT, onCopied)
})

describe('GuestWorkOfferBanner', () => {
  it('lists each offered decision by its first typed line, or as an earlier visit; nothing is sent until the user chooses', () => {
    seed()
    render(<GuestWorkOfferBanner />)

    expect(screen.getByText(GUEST_WORK_OFFER_COPY.heading)).toBeTruthy()
    expect(within(row(SEP28) as HTMLElement).getByText('Personal assistant or an AI assistant?')).toBeTruthy()
    expect(within(row(SEP28) as HTMLElement).getByText('Last worked on 28 Sep')).toBeTruthy()
    expect(within(row(OLDER) as HTMLElement).getByText(GUEST_WORK_OFFER_COPY.unnamed)).toBeTruthy()
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('Add → copies THAT decision with the session token, refreshes the list, and the offer leaves', async () => {
    seed()
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY, created: true })
    render(<GuestWorkOfferBanner />)

    fireEvent.click(within(row(SEP28) as HTMLElement).getByText(GUEST_WORK_OFFER_COPY.add))

    await waitFor(() => expect(events).toEqual([{ sourceScenarioId: SEP28, scenarioId: COPY, created: true }]))
    expect(mockRequest).toHaveBeenCalledWith(SEP28, 'eyJ.tok.sig')
    expect(readGuestWork().map((e) => e.id)).toEqual([OLDER])
    expect(row(SEP28)).toBeUndefined()
  })

  it('Not mine → the offer leaves, and NO copy is requested', () => {
    seed()
    render(<GuestWorkOfferBanner />)

    fireEvent.click(within(row(OLDER) as HTMLElement).getByText(GUEST_WORK_OFFER_COPY.decline))

    expect(mockRequest).not.toHaveBeenCalled()
    expect(readGuestWork().map((e) => e.id)).toEqual([SEP28])
    expect(row(OLDER)).toBeUndefined()
  })

  it('a transient failure KEEPS the offer and says to try again', async () => {
    seed()
    mockRequest.mockResolvedValue({ kind: 'retry_later', reason: 'http_503' })
    render(<GuestWorkOfferBanner />)

    fireEvent.click(within(row(SEP28) as HTMLElement).getByText(GUEST_WORK_OFFER_COPY.add))

    await waitFor(() => expect(within(row(SEP28) as HTMLElement).getByText(GUEST_WORK_OFFER_COPY.retry)).toBeTruthy())
    expect(readGuestWork().map((e) => e.id).sort()).toEqual([SEP28, OLDER].sort())
    expect(events).toEqual([])
  })

  it('a decision that can never be copied leaves the list with a plain note', async () => {
    seed()
    mockRequest.mockResolvedValue({ kind: 'not_copyable' })
    render(<GuestWorkOfferBanner />)

    fireEvent.click(within(row(SEP28) as HTMLElement).getByText(GUEST_WORK_OFFER_COPY.add))

    await waitFor(() => expect(screen.getByText(GUEST_WORK_OFFER_COPY.gone)).toBeTruthy())
    expect(row(SEP28)).toBeUndefined()
    expect(readGuestWork().map((e) => e.id)).toEqual([OLDER])
  })

  it('renders nothing when there is nothing to offer, or for a guest', () => {
    const { container, rerender } = render(<GuestWorkOfferBanner />)
    expect(container.innerHTML).toBe('')

    seed()
    auth.user = null
    auth.authenticated = false
    rerender(<GuestWorkOfferBanner key="guest" />)
    expect(container.innerHTML).toBe('')
  })

  it('its words make no claim about where a guest’s work is stored (the estate-wide guard’s patterns)', () => {
    for (const text of Object.values(GUEST_WORK_OFFER_COPY)) {
      for (const pattern of GUEST_STORAGE_CLAIM_PATTERNS) expect(text).not.toMatch(pattern)
      expect(text).not.toMatch(/\b(best|winner|recommend|leader|ahead|beats)\b/i)
    }
  })
})
