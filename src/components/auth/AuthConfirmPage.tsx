/**
 * /auth/confirm: where every emailed auth link lands (invite, sign-in link,
 * password reset).
 *
 * The email templates (`supabase/templates/`) link here with
 * `?token_hash=…&type=…`, and this page verifies the token itself with
 * `verifyOtp`. Two reasons it is done here rather than by Supabase's redirect:
 *   · it completes in ANY browser. A PKCE `?code=` link only completes in the
 *     browser that requested it, and an invitee never requested anything;
 *   · the app uses a HashRouter, and a `#access_token=` fragment from the
 *     default redirect would collide with the router's own hash.
 * Mail scanners that pre-fetch links do not run this page's script, so they
 * cannot burn the one-time token.
 *
 * Flow:
 *   verifying → (invite | recovery) → choose a password → hub
 *   verifying → (magic link)        → hub
 *   verifying → failed              → "This link has expired" + email a new one
 *
 * Choosing a password is optional for an invitee ("Skip for now"): they can
 * always come back with an emailed sign-in link. For a reset it is the point,
 * so there is no skip.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { Check, KeyRound, Link2Off, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { runOriginatingSignIn, useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import AuthShell from './AuthShell'
import AuthField from './AuthField'
import AuthEmailSent from './AuthEmailSent'
import { primaryButton, secondaryButton, textLink } from './authStyles'
import { classifyEmailSend, isRateLimited, isServerFault } from './authErrors'

const OTP_TYPES: readonly EmailOtpType[] = ['invite', 'magiclink', 'recovery', 'email', 'signup', 'email_change']
const MIN_PASSWORD = 8
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Phase =
  | { kind: 'verifying' }
  | { kind: 'set-password'; reason: 'invite' | 'recovery'; email: string }
  | { kind: 'password-saved' }
  | { kind: 'email-change-half' }
  | { kind: 'email-changed'; email: string }
  | { kind: 'failed' }

function asOtpType(value: string | null): EmailOtpType | null {
  return value && (OTP_TYPES as readonly string[]).includes(value) ? (value as EmailOtpType) : null
}

export default function AuthConfirmPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { updatePassword, signInWithMagicLink } = useAuth()
  const ran = useRef(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'verifying' })

  const goToApp = useCallback(() => navigate('/', { replace: true }), [navigate])

  useEffect(() => {
    // React StrictMode runs effects twice in development; the token is
    // single-use, so a second verify would fail and show a false "expired".
    if (ran.current) return
    ran.current = true

    const tokenHash = searchParams.get('token_hash')
    const type = asOtpType(searchParams.get('type'))

    ;(async () => {
      if (!tokenHash || !type) {
        // A default-template link (PKCE `?code=` or `#access_token=`) is
        // consumed by supabase-js at boot. If that produced a session, there
        // is nothing left to do here.
        const { data } = await supabase.auth.getSession()
        if (data.session) goToApp()
        else setPhase({ kind: 'failed' })
        return
      }
      try {
        const { data, error } = await runOriginatingSignIn(() => supabase.auth.verifyOtp({ token_hash: tokenHash, type }))
        // SECURE EMAIL CHANGE (live setting): the FIRST of the two links is accepted with no session and no error
        // (Supabase answers "now confirm the other link"). That is a success, not an expired link.
        if (type === 'email_change' && !error && !data.session) {
          setPhase({ kind: 'email-change-half' })
          return
        }
        if (error || !data.session) {
          setPhase({ kind: 'failed' })
          return
        }
        if (type === 'invite' || type === 'recovery') {
          setPhase({ kind: 'set-password', reason: type, email: data.user?.email ?? '' })
          return
        }
        if (type === 'email_change') {
          setPhase({ kind: 'email-changed', email: data.user?.email ?? '' })
          return
        }
        goToApp()
      } catch {
        setPhase({ kind: 'failed' })
      }
    })()
  }, [searchParams, goToApp])

  if (phase.kind === 'verifying') {
    return (
      <AuthShell testId="auth-confirm-verifying">
        <div className="flex flex-col items-center gap-4 py-6 text-center" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-info" aria-hidden="true" />
          <p className={`${typography.body} text-text-light`}>Signing you in&hellip;</p>
        </div>
      </AuthShell>
    )
  }

  if (phase.kind === 'set-password') {
    return (
      <AuthShell testId="auth-confirm-set-password">
        <SetPasswordStep
          reason={phase.reason}
          email={phase.email}
          updatePassword={updatePassword}
          onDone={() => setPhase({ kind: 'password-saved' })}
          onSkip={goToApp}
        />
      </AuthShell>
    )
  }

  if (phase.kind === 'password-saved') {
    return (
      <AuthShell testId="auth-confirm-password-saved">
        <PasswordSaved onContinue={goToApp} />
      </AuthShell>
    )
  }

  if (phase.kind === 'email-change-half') {
    return (
      <AuthShell testId="auth-confirm-email-change-half">
        <EmailChangeStep
          title="One address confirmed"
          body="Now open the link we sent to your other address. Your sign-in email changes once both are confirmed."
          action="Back to Olumi"
          onContinue={goToApp}
        />
      </AuthShell>
    )
  }

  if (phase.kind === 'email-changed') {
    return (
      <AuthShell testId="auth-confirm-email-changed">
        <EmailChangeStep
          title="Email changed"
          body={phase.email ? `You now sign in to Olumi as ${phase.email}.` : 'Your new sign-in email is confirmed.'}
          action="Continue"
          onContinue={goToApp}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell testId="auth-confirm-failed">
      <ExpiredLink signInWithMagicLink={signInWithMagicLink} onPassword={() => navigate('/login', { replace: true })} />
    </AuthShell>
  )
}

// ---------------------------------------------------------------------------

function SetPasswordStep({
  reason,
  email,
  updatePassword,
  onDone,
  onSkip,
}: {
  reason: 'invite' | 'recovery'
  email: string
  updatePassword: (password: string) => Promise<{ error: unknown }>
  onDone: () => void
  onSkip: () => void
}) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD
  const isInvite = reason === 'invite'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (password.length < MIN_PASSWORD) return
    setSaving(true)
    setError(null)
    const { error: err } = await updatePassword(password)
    setSaving(false)
    if (err) {
      setError(
        isRateLimited(err)
          ? 'Please wait a moment before trying again.'
          : isServerFault(err)
            ? 'We couldn’t save your password. This is a problem on our side. Please try again shortly.'
            : 'That password can’t be used. Try a longer one, or one you haven’t used before.',
      )
      return
    }
    setPassword('')
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate data-testid="set-password-form">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-info/30 text-info">
        <KeyRound className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className={`${typography.h3} mt-5 text-text-header`}>
        {isInvite ? 'Welcome to Olumi' : 'Choose a new password'}
      </h1>
      <p className={`${typography.body} mt-1 text-text-light`}>
        {isInvite
          ? 'You’re in. Choose a password so you can sign straight back in next time.'
          : 'You’re signed in. Choose a new password to finish.'}
      </p>
      {email && (
        <p className={`${typography.bodySmall} mt-4 text-text-body`}>
          Signed in as <span className="font-medium text-text-header break-all">{email}</span>
        </p>
      )}

      <div className="mt-6">
        {/* Hidden username field so password managers file the new password
            against the right account. */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <AuthField
          id="new-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          autoFocus
          placeholder="Choose a password"
          value={password}
          onChange={e => {
            setPassword(e.target.value)
            if (error) setError(null)
          }}
          onBlur={() => setTouched(true)}
          disabled={saving}
          data-testid="new-password-input"
          error={
            error ?? (touched && tooShort ? `Use at least ${MIN_PASSWORD} characters.` : undefined)
          }
          errorTestId="set-password-error"
          hint={<PasswordLength length={password.length} />}
        />
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={saving || password.length < MIN_PASSWORD}
          className={primaryButton}
          data-testid="set-password-submit"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : isInvite ? (
            'Set password and continue'
          ) : (
            'Save new password'
          )}
        </button>
        {isInvite && (
          <button type="button" onClick={onSkip} className={textLink} data-testid="set-password-skip">
            Skip for now. I&rsquo;ll sign in with email links.
          </button>
        )}
      </div>
    </form>
  )
}

/** Quiet live feedback under the field: a check once the length is met. */
function PasswordLength({ length }: { length: number }) {
  const met = length >= MIN_PASSWORD
  return (
    <span className={`flex items-center gap-1.5 ${met ? 'text-success' : 'text-text-light'}`}>
      {met && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {met ? 'Good to go' : `At least ${MIN_PASSWORD} characters`}
    </span>
  )
}

function EmailChangeStep({ title, body, action, onContinue }: { title: string; body: string; action: string; onContinue: () => void }) {
  return (
    <div className="flex flex-col items-center text-center" aria-live="polite">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-success/30 text-success">
        <Check className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className={`${typography.h4} mt-5 text-text-header`}>{title}</h1>
      <p className={`${typography.body} mt-1 text-text-light`}>{body}</p>
      <button type="button" onClick={onContinue} className={`${primaryButton} mt-6`} data-testid="email-change-continue">
        {action}
      </button>
    </div>
  )
}

function PasswordSaved({ onContinue }: { onContinue: () => void }) {
  useEffect(() => {
    const t = setTimeout(onContinue, 1600)
    return () => clearTimeout(t)
  }, [onContinue])
  return (
    <div className="flex flex-col items-center text-center" aria-live="polite">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-success/30 text-success">
        <Check className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className={`${typography.h4} mt-5 text-text-header`}>Password saved</h1>
      <p className={`${typography.body} mt-1 text-text-light`}>Taking you to your workspace&hellip;</p>
      <button type="button" onClick={onContinue} className={`${primaryButton} mt-6`} data-testid="password-saved-continue">
        Continue
      </button>
    </div>
  )
}

function ExpiredLink({
  signInWithMagicLink,
  onPassword,
}: {
  signInWithMagicLink: (email: string) => Promise<{ error: unknown }>
  onPassword: () => void
}) {
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<'rate-limited' | 'server-fault' | null>(null)

  const send = async (address: string) => {
    const { error } = await signInWithMagicLink(address)
    const outcome = classifyEmailSend(error)
    if (outcome === 'sent') {
      setSent(true)
      return
    }
    setSent(false)
    setSendError(outcome)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setInvalid(true)
      return
    }
    setSending(true)
    setSendError(null)
    await send(trimmed)
    setSending(false)
  }

  if (sent) {
    return (
      <AuthEmailSent
        testId="confirm-new-link-sent"
        email={email.trim()}
        heading="Check your inbox"
        body="If {email} has access to Olumi, we’ve sent a fresh link that signs you straight in."
        onResend={() => send(email.trim())}
        onUseDifferentEmail={() => {
          setSent(false)
          setEmail('')
        }}
      />
    )
  }

  return (
    <form onSubmit={submit} noValidate data-testid="expired-link-form">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-warning/30 text-warning">
        <Link2Off className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className={`${typography.h3} mt-5 text-text-header`}>This link has expired</h1>
      <p className={`${typography.body} mt-1 text-text-light`}>
        Links from Olumi work once and expire after a while. Enter your email and we&rsquo;ll send you a fresh one.
      </p>
      <div className="mt-6">
        <AuthField
          id="expired-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            setInvalid(false)
            setSendError(null)
          }}
          disabled={sending}
          error={
            invalid
              ? 'Please enter a valid email address.'
              : sendError === 'rate-limited'
                ? 'Please wait a moment before trying again.'
                : sendError === 'server-fault'
                  ? 'We couldn’t send that email. This is a problem on our side. Please try again shortly.'
                  : undefined
          }
        />
      </div>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button type="submit" disabled={sending} className={primaryButton} data-testid="expired-send-link">
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending&hellip;
            </>
          ) : (
            'Email me a new link'
          )}
        </button>
        <button type="button" onClick={onPassword} className={secondaryButton}>
          Sign in with a password
        </button>
      </div>
    </form>
  )
}
