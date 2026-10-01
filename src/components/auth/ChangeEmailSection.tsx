/**
 * Change the sign-in email, on Supabase's built-in flow (ACCOUNTS, DL 380e54 queue item 3).
 *
 * Secure email change is ON in the live auth config, so Supabase sends a confirmation link to BOTH the current and the
 * new address, and the email changes only once both are opened. Nothing here claims the change has happened: after a
 * request the section says where the links went, and a change still waiting (`user.new_email`) is shown as waiting.
 * The links land on `/auth/confirm` (type `email_change`), which says which half was confirmed.
 */
import { useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { typography } from '../../styles/typography'
import { isRateLimited, isServerFault } from './authErrors'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type State =
  | { kind: 'idle' }
  | { kind: 'editing'; value: string; error: string | null }
  | { kind: 'sending'; value: string }
  | { kind: 'sent'; to: string }

/** What the person is told when a request is refused. Never a raw server message. */
export function describeEmailChangeError(error: unknown): string {
  if (isRateLimited(error)) return 'Too many requests. Wait a minute, then try again.'
  if (isServerFault(error)) return 'We couldn’t send the confirmation just now. Try again shortly.'
  const code = (error as { code?: unknown } | null)?.code
  const msg = error instanceof Error ? error.message.toLowerCase() : String((error as { message?: unknown } | null)?.message ?? '').toLowerCase()
  if (code === 'email_exists' || msg.includes('already been registered') || msg.includes('already registered')) {
    return 'That address is already used by another account.'
  }
  return 'We couldn’t use that address. Check it and try again.'
}

const inputClass =
  'w-full rounded-lg border border-[rgba(38,38,38,0.12)] bg-panel px-3 py-2 text-text-body placeholder:text-text-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-shadow duration-fast'

export default function ChangeEmailSection({
  currentEmail,
  pendingEmail,
  requestEmailChange,
}: {
  currentEmail: string
  /** `user.new_email`: a change requested earlier and not yet confirmed from both inboxes. */
  pendingEmail: string | null
  requestEmailChange: (email: string) => Promise<{ error: unknown }>
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const submit = async (value: string) => {
    const next = value.trim()
    if (!EMAIL_RE.test(next)) {
      setState({ kind: 'editing', value, error: 'Enter a full email address, like name@company.com.' })
      return
    }
    if (next.toLowerCase() === currentEmail.trim().toLowerCase()) {
      setState({ kind: 'editing', value, error: 'That’s already your sign-in email.' })
      return
    }
    setState({ kind: 'sending', value })
    const { error } = await requestEmailChange(next)
    if (error) setState({ kind: 'editing', value, error: describeEmailChangeError(error) })
    else setState({ kind: 'sent', to: next })
  }

  return (
    <div className="mb-6" data-testid="change-email-section">
      <label htmlFor="email" className={`${typography.label} text-text-header block mb-1.5`}>
        Email
      </label>
      <div className="flex items-center gap-3">
        <input
          id="email"
          type="email"
          value={currentEmail}
          readOnly
          className={`w-full rounded-lg border border-[rgba(38,38,38,0.12)] bg-canvas px-3 py-2 ${typography.body} text-text-light cursor-not-allowed`}
        />
        {state.kind === 'idle' && (
          <button
            type="button"
            onClick={() => setState({ kind: 'editing', value: '', error: null })}
            className={`shrink-0 ${typography.bodySmall} text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded`}
            data-testid="change-email-start"
          >
            Change
          </button>
        )}
      </div>

      {state.kind === 'idle' && pendingEmail && (
        <p className={`${typography.bodySmall} mt-2 text-text-light`} data-testid="change-email-pending">
          A change to <span className="text-text-body">{pendingEmail}</span> is waiting. Open the confirmation link in
          both inboxes to finish it.
        </p>
      )}

      {(state.kind === 'editing' || state.kind === 'sending') && (
        <form
          className="mt-3 rounded-lg border border-[rgba(38,38,38,0.08)] bg-panel p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (state.kind === 'editing') void submit(state.value)
          }}
          noValidate
        >
          <label htmlFor="new-email" className={`${typography.label} text-text-header block mb-1.5`}>
            New email
          </label>
          <input
            id="new-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={state.value}
            disabled={state.kind === 'sending'}
            onChange={(e) => setState({ kind: 'editing', value: e.target.value, error: null })}
            placeholder="name@company.com"
            aria-invalid={state.kind === 'editing' && state.error !== null}
            aria-describedby="new-email-help"
            className={`${inputClass} ${typography.body}`}
            data-testid="change-email-input"
          />
          {state.kind === 'editing' && state.error ? (
            <p id="new-email-help" role="alert" className={`${typography.bodySmall} mt-2 text-danger`} data-testid="change-email-error">
              {state.error}
            </p>
          ) : (
            <p id="new-email-help" className={`${typography.bodySmall} mt-2 text-text-light`}>
              We’ll send a confirmation link to your current and your new address. Your sign-in email changes once both
              are confirmed.
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={state.kind === 'sending' || state.value.trim() === ''}
              className={`inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 ${typography.button} text-text-on-color transition-transform duration-fast hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50`}
              data-testid="change-email-submit"
            >
              {state.kind === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {state.kind === 'sending' ? 'Sending…' : 'Send confirmation'}
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: 'idle' })}
              disabled={state.kind === 'sending'}
              className={`${typography.bodySmall} text-text-body hover:text-text-header disabled:opacity-50`}
              data-testid="change-email-cancel"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {state.kind === 'sent' && (
        <div
          className="mt-3 flex items-start gap-3 rounded-lg border border-[rgba(38,38,38,0.08)] bg-panel p-4"
          role="status"
          data-testid="change-email-sent"
        >
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className={`${typography.body} text-text-header`}>Check both inboxes</p>
            <p className={`${typography.bodySmall} mt-1 text-text-body`}>
              We’ve sent a confirmation link to <span className="font-medium">{currentEmail}</span> and to{' '}
              <span className="font-medium">{state.to}</span>. You’ll sign in with the new address once both links are
              opened. Until then, keep using {currentEmail}.
            </p>
            <button
              type="button"
              onClick={() => void submit(state.to)}
              className={`${typography.bodySmall} mt-2 text-info hover:underline`}
              data-testid="change-email-resend"
            >
              Send the links again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
