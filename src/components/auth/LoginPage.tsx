/**
 * Login page — owner password + magic link + Google OAuth.
 *
 * ── LINK-TRACK R1 item 7 (11 Aug 2026) ─────────────────────────────────────
 * Password sign-in is the PILOT'S auth route (ratified). Magic link is the
 * route that does not currently work: staging's Supabase project has no SMTP,
 * which is why the `send-failed` state exists on this page at all. A pilot
 * owner sent a link today lands on a form whose only controls are ones they
 * have no way to complete.
 *
 * The password form is deliberately minimal and deliberately INCOMPLETE:
 *   · NO sign-up. Owners are pre-provisioned; the absence of a self-serve
 *     path is a decision, not an oversight.
 *   · NO password reset. There is no SMTP to deliver one, and a reset control
 *     that cannot send an email is the guarantee-theatre this track exists to
 *     remove.
 *
 * The email field is SHARED by both routes. It sits outside both forms — a
 * second email input would be a second source of truth for the one value both
 * submissions send — and is associated with the PASSWORD form by `form=`, so
 * it has an owner and implicit submission has somewhere to go (see below).
 *
 * ── ROUND 2 (11 Aug 2026): THREE THINGS THIS PAGE GOT WRONG ────────────────
 * All three were measured by the #667 adversarial review, by execution.
 *
 * 1. THE SUCCESS PATH DEAD-ENDED. This file used to carry the comment "on
 *    success the AuthProvider's onAuthStateChange drives navigation". Nothing
 *    did: neither `handleAuthStateChange` nor `OptionalAuthProvider.adopt`
 *    navigates on sign-IN (the only `navigate()` calls in AuthContext are
 *    sign-OUT), and `/login` sits OUTSIDE `AuthGuard`, so no guard bounces an
 *    authenticated user away either. An owner who typed the CORRECT password
 *    got every control disabled, a "Signing in…" spinner, and no way out but a
 *    reload. Success now moves to `password-signed-in` and this page routes —
 *    automatically once the provider reports the session, and via an explicit
 *    Continue control that is always present, so there is no state in which the
 *    owner is stuck behind a promise nobody keeps.
 *
 * 2. SERVER FAULTS AND RATE LIMITS WERE REPORTED AS "your password didn't
 *    match". 400 (wrong password) and 400 (unknown address) are the
 *    enumeration surface and stay byte-identical. A 5xx, a 501 capability-absent
 *    build and a 429 are NOT address-correlated — they are returned the same for
 *    an address that exists and one that does not — so naming them leaks
 *    nothing, and the magic-link half of this same page has said so with its own
 *    `send-failed` state since #666. The 429 case was actively harmful: it
 *    blamed the credentials AND cleared the password, so a rate-limited owner
 *    retyped a correct password into more rate-limiting.
 *
 * 3. `Enter` IN THE EMAIL FIELD WAS A DEAD KEY. The field belonged to no form,
 *    so implicit submission had nothing to submit. It is now owned by the
 *    password form — the pilot's working route — via `form="owner-password-form"`.
 *
 * States: default → submitting → link-sent → rate-limited → invalid-email
 *         → expired-link → send-failed → oauth-failed
 *         → password-submitting → password-failed → password-server-fault
 *         → password-signed-in
 * Shows identical message for invited and non-invited emails (prevents enumeration).
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'

type PageState =
  | 'default'
  | 'submitting'
  | 'link-sent'
  | 'rate-limited'
  | 'invalid-email'
  | 'expired-link'
  | 'send-failed'
  | 'oauth-failed'
  | 'password-submitting'
  | 'password-failed'
  | 'password-server-fault'
  | 'password-signed-in'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Is this failure OURS rather than a fact about the address?
 *
 * The link-sent state exists to make a registered and an unregistered address
 * indistinguishable — that is worth protecting and is untouched here. But it
 * was catching everything, including a 500 from a Supabase project with no
 * SMTP configured, which is what staging returns today for an address that
 * DOES exist. Reporting that as "your link is on its way" is a lie the user
 * cannot detect and cannot act on.
 *
 * A 5xx is returned identically for every address, so naming it leaks nothing.
 * The predicate is written against the SPEC (5xx = server fault) rather than
 * against the single failure mode in hand, so a different server fault is
 * classified correctly the first time it appears.
 */
function isServerFault(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 500
}

function isRateLimited(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  if (status === 429) return true
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')
}

export default function LoginPage() {
  const { signInWithMagicLink, signInWithGoogle, signInWithPassword, authenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pageState, setPageState] = useState<PageState>(() =>
    searchParams.get('error') === 'expired' ? 'expired-link' : 'default',
  )
  const [resendCooldown, setResendCooldown] = useState(0)
  /**
   * A password sign-in on THIS page has just succeeded.
   *
   * The routing below is gated on this rather than on `authenticated` alone,
   * and that is load-bearing: in the guest posture `authenticated` is ALWAYS
   * true (OptionalAuthProvider hands every visitor the guest identity so the
   * PoC stays reachable), so redirecting on `authenticated` would make /login
   * unreachable for a guest who came here deliberately.
   */
  const [signedInHere, setSignedInHere] = useState(false)

  /**
   * Where an owner belongs after signing in. `AuthGuard` redirects with
   * `state: { from: location }`, so an owner deep-linked to a protected route
   * returns to it rather than to the root.
   */
  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  const goToApp = useCallback(() => {
    navigate(destination, { replace: true })
  }, [navigate, destination])

  /**
   * Route the owner into the app once the provider has actually adopted the
   * session. Waiting for `authenticated` rather than navigating straight off
   * the resolved promise avoids the race where AuthGuard has not yet seen the
   * session and bounces the owner back here — which would relocate the
   * dead-end rather than remove it. The Continue control below is the escape
   * if the session never lands, so no path ends in a spinner.
   */
  useEffect(() => {
    if (!signedInHere || !authenticated) return
    goToApp()
  }, [signedInHere, authenticated, goToApp])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleEmailBlur = useCallback(() => {
    if (email && !EMAIL_RE.test(email)) {
      setPageState('invalid-email')
    } else if (pageState === 'invalid-email') {
      setPageState('default')
    }
  }, [email, pageState])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setPageState('invalid-email')
      return
    }

    setPageState('submitting')
    const { error } = await signInWithMagicLink(trimmed)

    if (error) {
      if (isRateLimited(error)) {
        setPageState('rate-limited')
      } else if (isServerFault(error)) {
        // Ours, not theirs. Never dressed up as a sent link.
        setPageState('send-failed')
      } else {
        // Show generic link-sent for all other errors (including "user not found")
        // to prevent email enumeration.
        setPageState('link-sent')
        setResendCooldown(60)
      }
      return
    }

    setPageState('link-sent')
    setResendCooldown(60)
  }, [email, signInWithMagicLink])

  const handleResend = useCallback(async () => {
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) return
    setPageState('submitting')
    // The resend path used to ignore its result entirely, so a resend into a
    // broken mailer always claimed success — the same defect as the first send.
    const { error } = await signInWithMagicLink(trimmed)
    if (error && isServerFault(error)) {
      setPageState('send-failed')
      return
    }
    setPageState('link-sent')
    setResendCooldown(60)
  }, [email, signInWithMagicLink])

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setPageState('invalid-email')
      return
    }
    if (password.length === 0) return

    setPageState('password-submitting')
    const { error } = await signInWithPassword(trimmed, password)
    if (error) {
      // TWO QUESTIONS, TWO PREDICATES (CLAUDE.md trap 21). "Is this an
      // enumeration signal?" and "is this a server fault?" are different
      // questions, and the first version of this handler answered both with
      // one branch — so a 500, a 501 and a 429 were all reported to the owner
      // as "your password didn't match", which is false for all three.
      //
      // What stays byte-identical is the ENUMERATION SURFACE: a wrong password
      // and an unknown address are both Supabase 400 `Invalid login
      // credentials` and both land in `password-failed` with one sentence.
      // That is the only pair whose difference would reveal which addresses
      // exist. A 5xx, a 501 capability-absent build and a 429 are returned the
      // same way for an address that exists and one that does not, so naming
      // them tells an attacker nothing — which is precisely the reasoning the
      // magic-link half of this page has run on since #666 (`send-failed`).
      if (isRateLimited(error)) {
        // Deliberately does NOT clear the password: blaming the credentials
        // and wiping the field made a rate-limited owner retype a CORRECT
        // password into more rate-limiting.
        setPageState('rate-limited')
        return
      }
      if (isServerFault(error)) {
        // >= 500, which includes the 501 a build with no `signInWithPassword`
        // reports. Ours, not theirs, and never dressed up as a bad password.
        setPageState('password-server-fault')
        return
      }
      setPageState('password-failed')
      setPassword('')
      return
    }
    // Success. Hold the password in memory no longer than the request needs,
    // then hand the owner to the app (see the effect above: this page routes,
    // because nothing else does).
    setPassword('')
    setSignedInHere(true)
    setPageState('password-signed-in')
  }, [email, password, signInWithPassword])

  const handleGoogleClick = useCallback(async () => {
    // The result used to be discarded, so a disabled provider produced a button
    // that visibly did nothing whatsoever.
    const { error } = await signInWithGoogle()
    if (error) setPageState('oauth-failed')
  }, [signInWithGoogle])

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[400px] rounded-[20px] bg-panel p-6 shadow-1">
        {/* Expired-link banner */}
        {pageState === 'expired-link' && (
          <div className="mb-4 rounded-md bg-panel px-4 py-3 text-info">
            <p className={typography.bodySmall}>
              This sign-in link has expired. Please request a new one.
            </p>
          </div>
        )}

        <h3 className={`${typography.h3} text-text-header mb-1`}>Sign in to Olumi</h3>

        {pageState === 'password-signed-in' ? (
          /* ---- Signed in ----
             The owner IS signed in: Supabase returned no error. The effect
             above routes as soon as the provider adopts the session; this
             state is what they see in the meantime, and the Continue control
             is the escape hatch if adoption never happens — so the success
             path cannot dead-end again. */
          <div
            className="mt-6 flex flex-col items-center gap-4 text-center"
            data-testid="owner-password-signed-in"
          >
            <p className={`${typography.body} text-text-body`}>
              Signed in. Taking you to your workspace&hellip;
            </p>
            <button
              type="button"
              onClick={goToApp}
              data-testid="owner-password-continue"
              className={`${typography.button} rounded-pill bg-primary px-6 py-3 text-text-on-color shadow-1 transition-all duration-fast hover:bg-primary-hover`}
            >
              Continue
            </button>
          </div>
        ) : pageState === 'link-sent' ? (
          /* ---- Link-sent state ---- */
          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-panel">
              <Mail className="h-6 w-6 text-info" />
            </div>
            <p className={`${typography.body} text-text-body`}>
              If this email is registered, you'll receive a sign-in link shortly.
            </p>
            <button
              type="button"
              disabled={resendCooldown > 0}
              onClick={handleResend}
              className={`${typography.button} rounded-pill px-6 py-3 transition-all duration-fast ${
                resendCooldown > 0
                  ? 'cursor-not-allowed text-text-light'
                  : 'text-info hover:bg-info-light'
              }`}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend link'}
            </button>
          </div>
        ) : (
          /* ---- Default / submitting / invalid-email / rate-limited ---- */
          <>
            <p className={`${typography.body} text-text-light mb-6`}>
              Sign in with the password your Olumi contact gave you
            </p>

            {/* The email field is shared by BOTH routes, so it lives outside
                both forms — but it is OWNED by the password form via `form=`.
                Without an owner it belonged to no form, and implicit
                submission (Enter) had nothing to submit: a dead key, measured
                by the #667 review. The password form is the pilot's working
                route, so that is where Enter goes. */}
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="login-email" className="sr-only">Email address</label>
                <input
                  id="login-email"
                  form="owner-password-form"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (pageState === 'invalid-email' || pageState === 'rate-limited') {
                      setPageState('default')
                    }
                  }}
                  onBlur={handleEmailBlur}
                  disabled={pageState === 'submitting' || pageState === 'password-submitting'}
                  className={`w-full min-h-[44px] rounded-md border bg-panel px-4 py-3 ${typography.body} text-text-body placeholder:text-text-light transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-info/50 ${
                    pageState === 'invalid-email'
                      ? 'border-danger'
                      : 'border-[rgba(38,38,38,0.16)]'
                  }`}
                />
                {pageState === 'invalid-email' && (
                  <p className={`${typography.bodySmall} text-danger mt-1`}>
                    Please enter a valid email address.
                  </p>
                )}
                {pageState === 'rate-limited' && (
                  <p className={`${typography.bodySmall} text-danger mt-1`}>
                    Please wait a moment before trying again.
                  </p>
                )}
                {pageState === 'send-failed' && (
                  /* Deliberately says nothing about whether the address is
                     registered — this text is identical for every address, so
                     it cannot be used to enumerate accounts. */
                  <p className={`${typography.bodySmall} text-danger mt-1`} role="alert">
                    We couldn&rsquo;t send the sign-in email. This is a problem on our
                    side, not with your address &mdash; nothing was sent. Please try
                    again later or ask your Olumi contact.
                  </p>
                )}
                {pageState === 'oauth-failed' && (
                  /* ⚠ THE DIRECTION WORD IS LOAD-BEARING AND HAS NOW BEEN WRONG
                     TWICE. This message renders INSIDE the email-field div,
                     which closes above the password form — so BOTH controls it
                     points at are below it. Round 1 said "the email link above"
                     after that button moved below; round 2's correction then
                     said "the password form above", which was wrong the same
                     way. The container is `flex flex-col`, so DOM order IS
                     visual order, and the spec measures it with
                     `compareDocumentPosition` rather than reading this comment:
                     move either form and the pin REDs. */
                  <p
                    className={`${typography.bodySmall} text-danger mt-1`}
                    role="alert"
                    data-testid="oauth-failed-message"
                  >
                    We couldn&rsquo;t start Google sign-in. Please use the password
                    form or the email link below, or ask your Olumi contact.
                  </p>
                )}
              </div>

              {/* ---- Owner password sign-in: the pilot's working route ---- */}
              <form
                id="owner-password-form"
                onSubmit={handlePasswordSubmit}
                className="flex flex-col gap-4"
                data-testid="owner-password-form"
              >
                <div>
                  <label htmlFor="owner-password" className="sr-only">Password</label>
                  <input
                    id="owner-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (pageState === 'password-failed' || pageState === 'password-server-fault') {
                        setPageState('default')
                      }
                    }}
                    disabled={pageState === 'submitting' || pageState === 'password-submitting'}
                    data-testid="owner-password-input"
                    className={`w-full min-h-[44px] rounded-md border bg-panel px-4 py-3 ${typography.body} text-text-body placeholder:text-text-light transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-info/50 ${
                      pageState === 'password-failed'
                        ? 'border-danger'
                        : 'border-[rgba(38,38,38,0.16)]'
                    }`}
                  />
                  {pageState === 'password-failed' && (
                    /* Identical for a wrong password and an unregistered
                       address — Supabase answers both with the same 400, and
                       splitting them here would leak which addresses exist. */
                    <p
                      className={`${typography.bodySmall} text-danger mt-1`}
                      role="alert"
                      data-testid="owner-password-error"
                    >
                      That email and password didn&rsquo;t match. Check them, or ask
                      your Olumi contact.
                    </p>
                  )}
                  {pageState === 'password-server-fault' && (
                    /* NOT address-correlated: a 5xx and a 501 capability-absent
                       build are returned identically for an address that exists
                       and one that does not, so this sentence leaks nothing —
                       and unlike the copy above, it is TRUE. Says nothing about
                       the password, because the password is not the problem. */
                    <p
                      className={`${typography.bodySmall} text-danger mt-1`}
                      role="alert"
                      data-testid="owner-password-server-error"
                    >
                      We couldn&rsquo;t complete sign-in. This is a problem on our
                      side, not with your details. Please try again shortly, or ask
                      your Olumi contact.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={pageState === 'submitting' || pageState === 'password-submitting' || password.length === 0}
                  data-testid="owner-password-submit"
                  className={`${typography.button} flex items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-text-on-color shadow-1 transition-all duration-fast hover:bg-primary-hover hover:-translate-y-px active:bg-primary-active active:translate-y-0 disabled:bg-primary-disabled disabled:cursor-not-allowed disabled:translate-y-0`}
                >
                  {pageState === 'password-submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[rgba(38,38,38,0.16)]" />
              <span className={`${typography.bodySmall} text-text-light`}>or</span>
              <div className="h-px flex-1 bg-[rgba(38,38,38,0.16)]" />
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              data-testid="magic-link-form"
            >
              <button
                type="submit"
                disabled={pageState === 'submitting' || pageState === 'password-submitting'}
                className={`${typography.button} flex items-center justify-center gap-2 rounded-pill border border-[rgba(38,38,38,0.16)] bg-transparent px-6 py-3 text-text-body transition-all duration-fast hover:bg-panel-hover hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0`}
              >
                {pageState === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send magic link'
                )}
              </button>
            </form>

            <div className="h-4" />

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={pageState === 'submitting' || pageState === 'password-submitting'}
              className={`${typography.button} flex w-full items-center justify-center gap-2 rounded-pill border border-[rgba(38,38,38,0.16)] bg-transparent px-6 py-3 text-text-body transition-all duration-fast hover:bg-panel-hover hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0`}
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </>
        )}

        {/* Footer */}
        <p className={`${typography.bodySmall} text-text-light mt-6 text-center`}>
          This is an invite-only pilot.
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
