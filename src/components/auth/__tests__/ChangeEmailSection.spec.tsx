/**
 * Change email (ACCOUNTS queue item 3): Supabase's confirm-both-inboxes flow. Bound by test id and by the exact
 * argument sent, never by copy another state could also render.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChangeEmailSection, { describeEmailChangeError } from '../ChangeEmailSection'

const CURRENT = 'ada@olumi.test'

function setup(result: { error: unknown } = { error: null }, pendingEmail: string | null = null) {
  const requestEmailChange = vi.fn(async (_email: string) => result)
  render(<ChangeEmailSection currentEmail={CURRENT} pendingEmail={pendingEmail} requestEmailChange={requestEmailChange} />)
  return { requestEmailChange }
}
const open = () => fireEvent.click(screen.getByTestId('change-email-start'))
const type = (v: string) => fireEvent.change(screen.getByTestId('change-email-input'), { target: { value: v } })
const send = () => fireEvent.click(screen.getByTestId('change-email-submit'))

describe('ChangeEmailSection', () => {
  it('a valid new address is sent ONCE, trimmed; the section then names BOTH inboxes and claims no change yet', async () => {
    const { requestEmailChange } = setup()
    open(); type('  new@olumi.test '); send()
    const sent = await screen.findByTestId('change-email-sent')
    expect(requestEmailChange.mock.calls).toEqual([['new@olumi.test']])
    expect(sent.textContent).toContain(CURRENT)
    expect(sent.textContent).toContain('new@olumi.test')
    expect(sent.textContent).toContain(`keep using ${CURRENT}`)
    // The displayed sign-in email is unchanged: nothing has changed until both links are opened.
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(CURRENT)
  })

  it('an incomplete address and the current address are refused BEFORE any request', async () => {
    const { requestEmailChange } = setup()
    open(); type('not-an-email'); send()
    expect((await screen.findByTestId('change-email-error')).textContent).toMatch(/full email address/)
    type(' ADA@olumi.test'); send()
    expect((await screen.findByTestId('change-email-error')).textContent).toMatch(/already your sign-in email/)
    expect(requestEmailChange).not.toHaveBeenCalled()
  })

  it('a refused request keeps the form open with a plain sentence, never the raw server text', async () => {
    setup({ error: Object.assign(new Error('A user with this email address has already been registered'), { status: 422, code: 'email_exists' }) })
    open(); type('taken@olumi.test'); send()
    expect((await screen.findByTestId('change-email-error')).textContent).toBe('That address is already used by another account.')
    expect(screen.getByTestId('change-email-input')).toBeInTheDocument()
    expect(screen.queryByTestId('change-email-sent')).toBeNull()
  })

  it('the error sentences: rate limit, server fault, taken, anything else', () => {
    expect(describeEmailChangeError({ status: 429, message: 'x' })).toMatch(/^Too many requests/)
    expect(describeEmailChangeError({ status: 503, message: 'x' })).toMatch(/couldn’t send the confirmation just now/)
    expect(describeEmailChangeError({ status: 422, code: 'email_exists', message: 'x' })).toBe('That address is already used by another account.')
    expect(describeEmailChangeError(new Error('Unable to validate email address: invalid format'))).toBe('We couldn’t use that address. Check it and try again.')
  })

  it('"Send the links again" repeats the SAME request', async () => {
    const { requestEmailChange } = setup()
    open(); type('new@olumi.test'); send()
    fireEvent.click(await screen.findByTestId('change-email-resend'))
    await waitFor(() => expect(requestEmailChange.mock.calls).toEqual([['new@olumi.test'], ['new@olumi.test']]))
  })

  it('a change requested earlier and still unconfirmed (user.new_email) is shown as WAITING', () => {
    setup({ error: null }, 'later@olumi.test')
    expect(screen.getByTestId('change-email-pending').textContent).toContain('later@olumi.test')
  })

  it('CONTROL: with nothing pending, no waiting line', () => {
    setup()
    expect(screen.queryByTestId('change-email-pending')).toBeNull()
  })
})
