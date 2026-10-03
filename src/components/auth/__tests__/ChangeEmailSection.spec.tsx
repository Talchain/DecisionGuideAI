/**
 * Change email (ACCOUNTS queue item 3): Supabase's confirm-both-inboxes flow. Bound by test id and by the exact
 * argument sent, never by copy another state could also render.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ChangeEmailSection, { describeEmailChangeError, EMAIL_CHANGE_REFUSED } from '../ChangeEmailSection'

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
    expect((await screen.findByTestId('change-email-error')).textContent).toBe(EMAIL_CHANGE_REFUSED)
    expect(screen.getByTestId('change-email-input')).toBeInTheDocument()
    expect(screen.queryByTestId('change-email-sent')).toBeNull()
  })

  it('NO ENUMERATION: an address in use and an address Supabase rejects read BYTE-IDENTICALLY on screen', async () => {
    const shown: string[] = []
    const refusals = [
      Object.assign(new Error('A user with this email address has already been registered'), { status: 422, code: 'email_exists' }),
      Object.assign(new Error('Unable to validate email address: invalid format'), { status: 400, code: 'validation_failed' }),
      Object.assign(new Error('Email address "x@y.z" is invalid'), { status: 400, code: 'email_address_invalid' }),
    ]
    for (const error of refusals) {
      const { unmount } = render(<ChangeEmailSection currentEmail={CURRENT} pendingEmail={null} requestEmailChange={async () => ({ error })} />)
      fireEvent.click(screen.getByTestId('change-email-start'))
      fireEvent.change(screen.getByTestId('change-email-input'), { target: { value: 'someone@olumi.test' } })
      fireEvent.click(screen.getByTestId('change-email-submit'))
      shown.push((await screen.findByTestId('change-email-error')).textContent ?? '')
      unmount()
    }
    expect(new Set(shown).size).toBe(1)
    expect(shown[0]).toBe(EMAIL_CHANGE_REFUSED)
  })

  it('only status decides: rate limit (429) and server fault (5xx) have their own sentences; nothing else does', () => {
    expect(describeEmailChangeError({ status: 429, message: 'x' })).toMatch(/^Too many requests/)
    expect(describeEmailChangeError({ status: 503, message: 'x' })).toMatch(/couldn’t send the confirmation just now/)
    expect(describeEmailChangeError({ status: 422, code: 'email_exists', message: 'already been registered' })).toBe(EMAIL_CHANGE_REFUSED)
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
