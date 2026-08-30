/**
 * Login page — owner password sign-in. That is the whole front door.
 *
 * ── 29 Aug 2026: THE TWO ROUTES THAT COULD NOT COMPLETE ARE GONE ───────────
 * Unattended team testing starts Monday. A colleague picks a route with nobody
 * beside them to say "not that one", so a route that cannot complete is not a
 * rough edge — it is a dead end with no recovery. Both removals were measured
 * at the DEPLOYED staging Supabase project, not inferred from config:
 *
 *   · "Send magic link" — the project has no SMTP, so the link is never
 *     delivered. This file's own header has said so since #667; the
 *     `send-failed` state existed only because of it.
 *
 *   · "Continue with Google" — `GET /auth/v1/settings` reports
 *     `"google": false`, and `GET /auth/v1/authorize?provider=google` answers
 *     `400 {"error_code":"validation_failed","msg":"Unsupported provider:
 *     provider is not enabled"}`.
 *
 *     ⚠ AND THE STATE WRITTEN TO CATCH THAT COULD NEVER FIRE. supabase-js
 *     resolves `signInWithOAuth` with `{error: null}` and navigates the
 *     browser ITSELF — the deployed bundle carries
 *     `Ub()&&!t.skipBrowserRedirect&&window.location.assign(r),{data:{…},error:null}`
 *     — so `handleGoogleClick` never saw an error, `oauth-failed` was
 *     unreachable, and the click EJECTED the user out of Olumi onto a raw JSON
 *     400 page. Worse than a dead button: it left the product.
 *
 * Nobody loses a way in. Account creation is open and auto-confirming at the
 * API (`disable_signup:false`, `mailer_autoconfirm:true`), so an owner is
 * provisioned without any email round-trip.
 *
 * The `expired-link` banner STAYS: links already sitting in an inbox can still
 * be clicked, and `/auth/callback` still routes them here.
 *
 * ── LINK-TRACK R1 item 7 (11 Aug 2026) ─────────────────────────────────────
 * Password sign-in is the PILOT'S auth route (ratified).
 *
 * The password form is deliberately minimal and deliberately INCOMPLETE:
 *   · NO sign-up. Owners are pre-provisioned; the absence of a self-serve
 *     path is a decision, not an oversight.
 *   · NO password reset. There is no SMTP to deliver one, and a reset control
 *     that cannot send an email is the guarantee-theatre this track exists to
 *     remove.
 *
 * The email field is associated with the password form by `form=`, so it has an
 * owner and implicit submission has somewhere to go (see below). It kept that
 * `form=` when the second route was removed: the association is what makes
 * `Enter` work, not a consequence of there having been two routes.
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
 * States: default → rate-limited → invalid-email → expired-link
 *         → password-submitting → password-failed → password-server-fault
 *         → password-signed-in
 * Shows identical message for invited and non-invited emails (prevents enumeration).
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { capturePendingGuestClaim } from '../../lib/pendingGuestClaim'
import { typography } from '../../styles/typography'

type PageState =
  | 'default'
  | 'rate-limited'
  | 'invalid-email'
  | 'expired-link'
  | 'password-submitting'
  | 'password-failed'
  | 'password-server-fault'
  | 'password-signed-in'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Is this failure OURS rather than a fact about the address?
 *
 * A 5xx is returned identically for every address, so naming it leaks nothing
 * — unlike a 400, which IS address-correlated and stays byte-identical for a
 * wrong password and an unknown address. The predicate is written against the
 * SPEC (5xx = server fault) rather than against the single failure mode in
 * hand, so a different server fault is classified correctly the first time it
 * appears.
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
  const { signInWithPassword, authenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pageState, setPageState] = useState<PageState>(() =>
    searchParams.get('error') === 'expired' ? 'expired-link' : 'default',
  )
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

  const handleEmailBlur = useCallback(() => {
    if (email && !EMAIL_RE.test(email)) {
      setPageState('invalid-email')
    } else if (pageState === 'invalid-email') {
      setPageState('default')
    }
  }, [email, pageState])

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

    // Record the guest model this visitor was working on, BEFORE routing.
    //
    // Ordering is load-bearing and the reason is easy to get backwards: signing
    // in does NOT disturb `olumi-canvas-current-scenario-id` — nothing on this
    // path writes it. What destroys it is the DESTINATION: `goToApp()` below
    // lands on a route that opens or creates a scenario, and both rewrite the
    // live pointer (`canvas/store.ts:4654`, `canvas/store/scenarios.ts:344`).
    // Capturing after navigation would read the wrong id, or none.
    //
    // Recording only. No claim is attempted, no request is sent, and a visitor
    // who never signs in never reaches this line — the guest path is untouched.
    // See `lib/pendingGuestClaim.ts` for why the copy is worth keeping on its
    // own: the guest row stays claimable indefinitely, so the id is the only
    // thing that can be lost.
    capturePendingGuestClaim()

    setSignedInHere(true)
    setPageState('password-signed-in')
  }, [email, password, signInWithPassword])

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
        ) : (
          /* ---- Default / invalid-email / rate-limited ---- */
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
                  disabled={pageState === 'password-submitting'}
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
                    disabled={pageState === 'password-submitting'}
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
                  disabled={pageState === 'password-submitting' || password.length === 0}
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
