/**
 * Login UI half (3.4) — guest-draft import banner (one-time offer).
 *
 * Mounted on the scenario hub (post-login landing). Renders nothing unless
 * loginDraftImport says an offer is due; accept imports then navigates to
 * the new scenario; decline dismisses permanently.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

let mockAuth: { user: { id: string } | null; authenticated: boolean }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}))

const shouldOfferDraftImport = vi.fn()
const importGuestDraft = vi.fn()
const dismissDraftImport = vi.fn()
vi.mock('../../../lib/loginDraftImport', () => ({
  shouldOfferDraftImport: (...args: unknown[]) => shouldOfferDraftImport(...args),
  importGuestDraft: (...args: unknown[]) => importGuestDraft(...args),
  dismissDraftImport: (...args: unknown[]) => dismissDraftImport(...args),
}))

import { GuestDraftImportBanner } from '../GuestDraftImportBanner'

beforeEach(() => {
  mockNavigate.mockReset()
  shouldOfferDraftImport.mockReset()
  importGuestDraft.mockReset()
  dismissDraftImport.mockReset()
  mockAuth = { user: { id: 'user-1' }, authenticated: true }
})

describe('GuestDraftImportBanner', () => {
  it('renders nothing when no offer is due', () => {
    shouldOfferDraftImport.mockReturnValue(false)
    const { container } = render(<GuestDraftImportBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('offers to save the draft when due', () => {
    shouldOfferDraftImport.mockReturnValue(true)
    render(<GuestDraftImportBanner />)
    expect(screen.getByText(/save your draft to your account/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument()
  })

  it('accept: imports the draft then navigates to the new scenario', async () => {
    shouldOfferDraftImport.mockReturnValue(true)
    importGuestDraft.mockResolvedValue('scn-42')
    render(<GuestDraftImportBanner />)
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => {
      expect(importGuestDraft).toHaveBeenCalledWith('user-1')
      expect(mockNavigate).toHaveBeenCalledWith('/scenario/scn-42')
    })
  })

  it('decline: dismisses permanently and hides without importing', async () => {
    shouldOfferDraftImport.mockReturnValue(true)
    render(<GuestDraftImportBanner />)
    await userEvent.click(screen.getByRole('button', { name: /not now/i }))
    expect(dismissDraftImport).toHaveBeenCalledTimes(1)
    expect(importGuestDraft).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText(/save your draft to your account/i)).not.toBeInTheDocument()
    })
  })

  it('failed import surfaces an honest error and keeps the offer visible', async () => {
    shouldOfferDraftImport.mockReturnValue(true)
    importGuestDraft.mockRejectedValue(new Error('save failed'))
    render(<GuestDraftImportBanner />)
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => {
      expect(screen.getByText(/couldn't save your draft/i)).toBeInTheDocument()
    })
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
  })
})
