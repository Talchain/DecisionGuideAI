/**
 * The owner's "Invite a colleague" dialog. The privacy row matters most: after
 * an invite the copy must say what happens IF they have an account, and never
 * claim an account exists, does not exist, or that anything was "sent".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const svc = vi.hoisted(() => ({
  listScenarioMembers: vi.fn(),
  shareScenario: vi.fn(),
  unshareScenario: vi.fn(),
}))
vi.mock('../../../services/scenarioSharingService', () => svc)

import { ShareDecisionDialog, SHARE_DIALOG_COPY } from '../ShareDecisionDialog'

const SID = '3b241101-e2bb-4255-8caf-4136c566a962'

function open() {
  return render(<ShareDecisionDialog scenarioId={SID} scenarioTitle="Pricing decision" onClose={vi.fn()} />)
}

beforeEach(() => {
  svc.listScenarioMembers.mockReset().mockResolvedValue({ ok: true, members: [] })
  svc.shareScenario.mockReset()
  svc.unshareScenario.mockReset()
})

describe('ShareDecisionDialog', () => {
  it('invites by email for THIS scenario, then shows the account-neutral confirmation and the new member', async () => {
    svc.shareScenario.mockResolvedValue({ ok: true })
    open()
    await waitFor(() => expect(svc.listScenarioMembers).toHaveBeenCalledWith(SID))
    svc.listScenarioMembers.mockResolvedValue({ ok: true, members: [{ email: 'ana@example.com', createdAt: 'x' }] })

    fireEvent.change(screen.getByTestId('share-decision-email'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByTestId('share-decision-invite'))

    await waitFor(() => expect(screen.getByTestId('share-decision-notice')).toHaveTextContent(SHARE_DIALOG_COPY.done))
    expect(svc.shareScenario).toHaveBeenCalledWith(SID, 'ana@example.com')
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument()
  })

  it('PRIVACY: no copy anywhere claims an account exists or not, or that anything was sent', async () => {
    svc.shareScenario.mockResolvedValue({ ok: true })
    open()
    fireEvent.change(screen.getByTestId('share-decision-email'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByTestId('share-decision-invite'))
    await screen.findByTestId('share-decision-notice')
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/\b(sent|no account|has an account|doesn't have|does not have|not found|invited user|email delivered)\b/i)
    expect(text).toMatch(/If they have an Olumi account/)
  })

  it.each([
    ['not_owner', /Only the owner/],
    ['bad_email', /valid email address/],
    ['member_cap', /limit of people/],
    ['unavailable', /Try again/],
  ])('a %s refusal shows its own message and keeps what was typed', async (failure, copy) => {
    svc.shareScenario.mockResolvedValue({ ok: false, failure })
    open()
    fireEvent.change(screen.getByTestId('share-decision-email'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByTestId('share-decision-invite'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(copy))
    expect(screen.getByTestId('share-decision-email')).toHaveValue('ana@example.com')
  })

  it('Remove revokes THAT member on THIS scenario and refreshes the list', async () => {
    svc.listScenarioMembers.mockResolvedValue({ ok: true, members: [{ email: 'ana@example.com', createdAt: 'x' }, { email: 'bo@example.com', createdAt: 'y' }] })
    svc.unshareScenario.mockResolvedValue({ ok: true, revoked: true })
    open()
    const removes = await screen.findAllByTestId('share-decision-revoke')
    svc.listScenarioMembers.mockResolvedValue({ ok: true, members: [{ email: 'bo@example.com', createdAt: 'y' }] })

    fireEvent.click(removes[0])

    await waitFor(() => expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument())
    expect(svc.unshareScenario).toHaveBeenCalledWith(SID, 'ana@example.com')
    expect(screen.getByText('bo@example.com')).toBeInTheDocument()
  })

  it('no members yet → says only you can see it', async () => {
    open()
    expect(await screen.findByText(SHARE_DIALOG_COPY.noMembers)).toBeInTheDocument()
  })
})
