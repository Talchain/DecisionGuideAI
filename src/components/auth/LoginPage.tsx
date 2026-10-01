/**
 * Login page: the front door for invited people.
 *
 * ── 1 OCT 2026 (ACCESS & INVITES): THE EMAIL ROUTES ARE BACK ─────────────
 * Paul invites someone from the Supabase dashboard; the invite email links to
 * `/auth/confirm`, which signs them in and asks them to choose a password.
 * After that they come back here and either use that password or ask for a
 * one-time sign-in link. Both email routes ("Email me a sign-in link",
 * "Forgot password?") were removed on 29 Aug because the project had no SMTP,
 * so the email never arrived. They return now that custom SMTP is configured
 * (Paul, 1 Oct); a route that cannot complete must not be offered, so this
 * page should not ship ahead of the SMTP setting.
 *
 * Still deliberately absent:
 *   · Sign-up. The pilot is invite-only: magic links use
 *     `shouldCreateUser: false`, and accounts are created only by invitation.
 *   · Google. The provider is disabled, and supabase-js navigates the browser
 *     itself on `signInWithOAuth`, so a disabled provider ejects the user onto
 *     a raw JSON 400 (measured 29 Aug).
 *
 * ── ENUMERATION ───────────────────────────────────────────────────────────
 * A wrong password and an unknown address get ONE byte-identical sentence. A
 * requested link always leads to the same "Check your inbox" state, whether or
 * not the address has an account (`classifyEmailSend`). Only server faults and
 * rate limits, which are not address-correlated, are named.
 *
 * ── SUCCESS NEVER DEAD-ENDS (#667) ────────────────────────────────────────
 * After a password sign-in this page routes once the provider adopts the
 * session, and always shows a live Continue control in the meantime. Routing
 * is gated on `signedInHere`, not on `authenticated` alone: in the guest
 * posture `authenticated` is always true, and /login must stay reachable.
 *
 * The email field is owned by the password form via `form=`, so Enter in
 * either field signs in.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Info, Loader2, Mail } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import AuthShell from './AuthShell'
import AuthField from './AuthField'
import AuthEmailSent from './AuthEmailSent'
import { primaryButton, secondaryButton, textLink } from './authStyles'
import { classifyEmailSend, isRateLimited, isServerFault } from './authErrors'

type PageState =
  | 'default'
  | 'rate-limited'
  | 'invalid-email'
  | 'expired-link'
  | 'password-submitting'
  | 'password-failed'
  | 'password-server-fault'
  | 'password-signed-in'

type EmailFlow = 'idle' | 'sending-link' | 'sending-reset' | 'link-sent' | 'reset-sent'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const { signInWithPassword, signInWithMagicLink, requestPasswordReset, authenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [pageState, setPageState] = useState<PageState>(() =>
    searchParams.get('error') === 'expired' ? 'expired-link' : 'default',
  )
  const [emailFlow, setEmailFlow] = useState<EmailFlow>('idle')
  /** A server fault or rate limit on an emailed-link request. */
  const [emailSendError, setEmailSendError] = useState<'rate-limited' | 'server-fault' | null>(null)
  const [signedInHere, setSignedInHere] = useState(false)

  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  const goToApp = useCallback(() => {
    navigate(destination, { replace: true })
  }, [navigate, destination])

  useEffect(() => {
    if (!signedInHere || !authenticated) return
    goToApp()
  }, [signedInHere, authenticated, goToApp])

  const busy =
    pageState === 'password-submitting' || emailFlow === 'sending-link' || emailFlow === 'sending-reset'

  const handleEmailBlur = useCallback(() => {
    if (email && !EMAIL_RE.test(email.trim())) {
      setPageState('invalid-email')
    } else if (pageState === 'invalid-email') {
      setPageState('default')
    }
  }, [email, pageState])

  /** Validate the shared email field before any request; focus it if wrong. */
  const requireEmail = useCallback((): string | null => {
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setPageState('invalid-email')
      emailRef.current?.focus()
      return null
    }
    return trimmed
  }, [email])

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = requireEmail()
    if (!trimmed) return
    if (password.length === 0) return

    setEmailSendError(null)
    setPageState('password-submitting')
    const { error } = await signInWithPassword(trimmed, password)
    if (error) {
      if (isRateLimited(error)) {
        // Does NOT clear the password: a rate-limited owner must not retype a
        // correct password into more rate-limiting.
        setPageState('rate-limited')
        return
      }
      if (isServerFault(error)) {
        setPageState('password-server-fault')
        return
      }
      setPageState('password-failed')
      setPassword('')
      return
    }
    setPassword('')
    setSignedInHere(true)
    setPageState('password-signed-in')
  }, [requireEmail, password, signInWithPassword])

  const sendLink = useCallback(async (kind: 'link' | 'reset', address: string) => {
    setEmailSendError(null)
    setEmailFlow(kind === 'link' ? 'sending-link' : 'sending-reset')
    const { error } =
      kind === 'link' ? await signInWithMagicLink(address) : await requestPasswordReset(address)
    const outcome = classifyEmailSend(error)
    if (outcome === 'sent') {
      setPassword('')
      setPageState('default')
      setEmailFlow(kind === 'link' ? 'link-sent' : 'reset-sent')
      return
    }
    setEmailSendError(outcome)
    setEmailFlow('idle')
  }, [signInWithMagicLink, requestPasswordReset])

  const handleMagicLink = useCallback(() => {
    const trimmed = requireEmail()
    if (trimmed) void sendLink('link', trimmed)
  }, [requireEmail, sendLink])

  const handleForgotPassword = useCallback(() => {
    const trimmed = requireEmail()
    if (trimmed) void sendLink('reset', trimmed)
  }, [requireEmail, sendLink])

  // ── Check your inbox ────────────────────────────────────────────────────
  if (emailFlow === 'link-sent' || emailFlow === 'reset-sent') {
    const isReset = emailFlow === 'reset-sent'
    return (
      <AuthShell footer={<p>This is an invite-only pilot.</p>}>
        <AuthEmailSent
          testId={isReset ? 'reset-link-sent' : 'magic-link-sent'}
          email={email.trim()}
          heading="Check your inbox"
          body={
            isReset
              ? 'If {email} has an Olumi account, we’ve sent a link to choose a new password.'
              : 'If {email} has access to Olumi, we’ve sent a link that signs you straight in.'
          }
          onResend={async () => {
            const kind = isReset ? 'reset' : 'link'
            const { error } =
              kind === 'link'
                ? await signInWithMagicLink(email.trim())
                : await requestPasswordReset(email.trim())
            const outcome = classifyEmailSend(error)
            if (outcome !== 'sent') {
              setEmailSendError(outcome)
              setEmailFlow('idle')
            }
          }}
          onUseDifferentEmail={() => {
            setEmailFlow('idle')
            setEmail('')
            setTimeout(() => emailRef.current?.focus(), 0)
          }}
        />
      </AuthShell>
    )
  }

  // ── Signed in (password) ───────────────────────────────────────────────
  if (pageState === 'password-signed-in') {
    return (
      <AuthShell footer={<p>This is an invite-only pilot.</p>}>
        <div
          className="flex flex-col items-center gap-5 text-center"
          data-testid="owner-password-signed-in"
          aria-live="polite"
        >
          <Loader2 className="h-6 w-6 animate-spin text-info" aria-hidden="true" />
          <div>
            <h1 className={`${typography.h4} text-text-header`}>Signed in</h1>
            <p className={`${typography.body} mt-1 text-text-light`}>
              Taking you to your workspace&hellip;
            </p>
          </div>
          <button
            type="button"
            onClick={goToApp}
            data-testid="owner-password-continue"
            className={primaryButton}
          >
            Continue
          </button>
        </div>
      </AuthShell>
    )
  }

  // ── The form ───────────────────────────────────────────────────────────
  const emailError =
    pageState === 'invalid-email'
      ? 'Please enter a valid email address.'
      : pageState === 'rate-limited' || emailSendError === 'rate-limited'
        ? 'Please wait a moment before trying again.'
        : undefined

  return (
    <AuthShell footer={<p>This is an invite-only pilot. Need access? Ask your Olumi contact.</p>}>
      {pageState === 'expired-link' && (
        <div
          className="mb-6 flex items-start gap-3 rounded-md border border-info/30 bg-panel px-4 py-3"
          role="status"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
          <p className={`${typography.bodySmall} text-text-body`}>
            This sign-in link has expired or was already used. Enter your email below and we&rsquo;ll send a fresh one.
          </p>
        </div>
      )}

      <h1 className={`${typography.h3} text-text-header`}>Sign in to Olumi</h1>
      <p className={`${typography.body} mt-1 text-text-light`}>
        Welcome back. Pick up where you left off.
      </p>

      <div className="mt-8 flex flex-col gap-5">
        <AuthField
          ref={emailRef}
          id="login-email"
          label="Email"
          form="owner-password-form"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            if (pageState === 'invalid-email' || pageState === 'rate-limited' || pageState === 'expired-link') {
              setPageState('default')
            }
            if (emailSendError) setEmailSendError(null)
          }}
          onBlur={handleEmailBlur}
          disabled={busy}
          error={emailError}
        />

        <form
          id="owner-password-form"
          onSubmit={handlePasswordSubmit}
          className="flex flex-col gap-5"
          data-testid="owner-password-form"
          noValidate
        >
          <AuthField
            id="owner-password"
            label="Password"
            labelAction={
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={busy}
                className={textLink}
                data-testid="forgot-password"
              >
                {emailFlow === 'sending-reset' ? 'Sending…' : 'Forgot password?'}
              </button>
            }
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (pageState === 'password-failed' || pageState === 'password-server-fault') {
                setPageState('default')
              }
            }}
            disabled={busy}
            data-testid="owner-password-input"
            error={
              pageState === 'password-failed'
                ? 'That email and password didn’t match. Check them, or sign in with an email link instead.'
                : pageState === 'password-server-fault'
                  ? 'We couldn’t complete sign-in. This is a problem on our side, not with your details. Please try again shortly.'
                  : undefined
            }
            errorTestId={
              pageState === 'password-failed'
                ? 'owner-password-error'
                : pageState === 'password-server-fault'
                  ? 'owner-password-server-error'
                  : undefined
            }
          />

          <button
            type="submit"
            disabled={busy || password.length === 0}
            data-testid="owner-password-submit"
            className={primaryButton}
          >
            {pageState === 'password-submitting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in&hellip;
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-panel-border" />
          <span className={`${typography.caption} text-text-light`}>or</span>
          <span className="h-px flex-1 bg-panel-border" />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={busy}
            className={secondaryButton}
            data-testid="magic-link-submit"
          >
            {emailFlow === 'sending-link' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="h-4 w-4" aria-hidden="true" />
            )}
            Email me a sign-in link
          </button>
          {emailSendError === 'server-fault' && (
            <p className={`${typography.bodySmall} text-danger`} role="alert" data-testid="email-send-server-error">
              We couldn&rsquo;t send that email. This is a problem on our side. Please try again shortly.
            </p>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
