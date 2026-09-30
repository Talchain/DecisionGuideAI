/**
 * Accept an invitation and set a password — the invite-only front door.
 *
 * Route: /#/accept-invite?token_hash=<hash>&type=invite
 *        (type=recovery is accepted too: same page, used to reset a tester's password)
 *
 * ── WHY token_hash + verifyOtp, AND NOT THE STOCK INVITE LINK ──────────────
 * Supabase's stock invite link goes to /auth/v1/verify, which redirects back with
 * the session in the URL fragment (`#access_token=…`). That cannot land in this app,
 * for two independent reasons measured at the deployed bundle (30 Sep 2026):
 *   1. The app is a HashRouter, so any redirect target already carries a fragment
 *      (`/#/…`). GoTrue appends a SECOND `#`, and supabase-js's URL parser then reads
 *      `/auth/callback#access_token` as the key: no access token is found.
 *   2. The client is `flowType: 'pkce'` (src/lib/supabase.ts), and the bundled
 *      supabase-js rejects an implicit-grant URL under PKCE ("Not a valid PKCE flow url").
 * The token_hash pattern is the documented PKCE-safe route: the page itself calls
 * `verifyOtp({ token_hash, type })` and receives a session. The invite email template
 * (or an admin `generateLink`) must therefore point HERE with `token_hash`, not at
 * `{{ .ConfirmationURL }}`.
 *
 * ── THE TOKEN IS SINGLE-USE ────────────────────────────────────────────────
 * `verifyOtp` is called at most ONCE per mount (a ref guard survives React
 * StrictMode's double effect), and the token is scrubbed from the address bar
 * before the call, so a reload or a copied URL cannot replay it.
 *
 * No sign-up happens here. The account already exists: an admin invited it.
 * An address nobody invited never receives a token, so it never reaches this page.
 *
 * States: verifying → set-password → saving → (navigate to the workspace)
 *         link-invalid · unavailable · server-fault · save-failed
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { typography } from '../../styles/typography'

/** The only link types this page accepts. Anything else is not an invitation. */
export type AcceptLinkType = 'invite' | 'recovery'

type PageState =
  | 'verifying'
  | 'link-invalid'
  | 'unavailable'
  | 'server-fault'
  | 'set-password'
  | 'saving'
  | 'save-failed'

/** Client-side floor. The server's own policy still applies and its refusal is shown. */
export const MIN_PASSWORD_LENGTH = 8

export const ACCEPT_INVITE_PATH = '/accept-invite'

function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

/**
 * A 4xx from verify means THIS LINK is no good (expired, already used, malformed).
 * Anything else — 5xx, no status, a throw — is our fault, and saying "your link
 * expired" for it would send the tester to ask for a new invite that cannot help.
 */
function isLinkRejection(error: unknown): boolean {
  const status = statusOf(error)
  return status !== null && status >= 400 && status < 500
}

function parseType(raw: string | null): AcceptLinkType | null {
  return raw === 'invite' || raw === 'recovery' ? raw : null
}

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Captured ONCE, on first render: the address bar is scrubbed straight after,
  // and the re-render that follows must not read an empty URL as "no token".
  const initial = useRef<{ tokenHash: string | null; type: AcceptLinkType | null } | null>(null)
  if (initial.current === null) {
    initial.current = {
      tokenHash: searchParams.get('token_hash'),
      type: parseType(searchParams.get('type')),
    }
  }
  const linkType: AcceptLinkType = initial.current.type ?? 'invite'

  const [pageState, setPageState] = useState<PageState>('verifying')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const started = useRef(false)
  // Mount liveness, NOT per-effect cancellation: under StrictMode the verify
  // effect's cleanup runs once before the (guarded, skipped) re-run, so a
  // per-effect `cancelled` flag would drop the only verify result there is and
  // leave the tester on a spinner. A mounted ref is re-armed on the re-mount.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const { tokenHash, type } = initial.current ?? { tokenHash: null, type: null }
    if (!tokenHash || !type) {
      setPageState('link-invalid')
      return
    }

    // Scrub the single-use token from the address bar before using it.
    navigate(ACCEPT_INVITE_PATH, { replace: true })

    if (typeof supabase.auth.verifyOtp !== 'function') {
      setPageState('unavailable')
      return
    }

    ;(async () => {
      try {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        if (!mounted.current) return
        if (error) {
          setPageState(isLinkRejection(error) ? 'link-invalid' : 'server-fault')
          return
        }
        if (!data?.session) {
          // verify succeeded but minted no session: nothing to set a password on.
          setPageState('server-fault')
          return
        }
        setEmail(data.session.user?.email ?? null)
        setPageState('set-password')
      } catch {
        if (mounted.current) setPageState('server-fault')
      }
    })()
  }, [navigate])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (password.length < MIN_PASSWORD_LENGTH) {
        setFormError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
        return
      }
      if (password !== confirm) {
        setFormError('The two passwords don’t match.')
        return
      }
      setFormError(null)
      setPageState('saving')
      try {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          // The tester is already signed in here, so a 4xx says nothing about
          // which addresses exist — the server's own reason (e.g. a weak
          // password) is safe and useful to show.
          const status = statusOf(error)
          const message = error instanceof Error ? error.message : String(error)
          setFormError(
            status !== null && status >= 400 && status < 500 && message
              ? message
              : 'We couldn’t save your password. This is a problem on our side — please try again shortly.',
          )
          setPageState('save-failed')
          return
        }
        setPassword('')
        setConfirm('')
        navigate('/', { replace: true })
      } catch {
        setFormError('We couldn’t save your password. This is a problem on our side — please try again shortly.')
        setPageState('save-failed')
      }
    },
    [password, confirm, navigate],
  )

  const heading = linkType === 'recovery' ? 'Choose a new password' : 'Welcome to Olumi'
  const saving = pageState === 'saving'

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[400px] rounded-[20px] bg-panel p-6 shadow-1" data-testid="accept-invite">
        <h3 className={`${typography.h3} text-text-header mb-1`}>{heading}</h3>

        {pageState === 'verifying' && (
          <div className="mt-6 flex flex-col items-center gap-4 text-center" data-testid="accept-invite-verifying">
            <Loader2 className="h-8 w-8 animate-spin text-info" />
            <p className={`${typography.body} text-text-light`}>Checking your invitation…</p>
          </div>
        )}

        {pageState === 'link-invalid' && (
          <div className="mt-4" role="alert" data-testid="accept-invite-link-invalid">
            <p className={`${typography.body} text-text-body`}>
              This link has expired or has already been used. Ask your Olumi contact to send a new
              invitation.
            </p>
            <p className={`${typography.bodySmall} text-text-light mt-4`}>
              Already set a password? <Link to="/login" className="text-info underline">Sign in</Link>
            </p>
          </div>
        )}

        {pageState === 'unavailable' && (
          <p className={`${typography.body} text-text-body mt-4`} role="alert" data-testid="accept-invite-unavailable">
            Accepting invitations isn’t available in this build. Please ask your Olumi contact.
          </p>
        )}

        {pageState === 'server-fault' && (
          <p className={`${typography.body} text-text-body mt-4`} role="alert" data-testid="accept-invite-server-fault">
            We couldn’t check your invitation. This is a problem on our side, not with your link.
            Please try again shortly, or ask your Olumi contact.
          </p>
        )}

        {(pageState === 'set-password' || pageState === 'saving' || pageState === 'save-failed') && (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" data-testid="accept-invite-form">
            <p className={`${typography.body} text-text-light`}>
              {email ? (
                <>
                  You’re signed in as <span className="text-text-body">{email}</span>.{' '}
                </>
              ) : null}
              Choose a password. You’ll use it with this email to sign in next time.
            </p>
            <div>
              <label htmlFor="accept-invite-password" className="sr-only">New password</label>
              <input
                id="accept-invite-password"
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  setFormError(null)
                }}
                disabled={saving}
                data-testid="accept-invite-password"
                className={`w-full min-h-[44px] rounded-md border border-[rgba(38,38,38,0.16)] bg-panel px-4 py-3 ${typography.body} text-text-body placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-info/50`}
              />
            </div>
            <div>
              <label htmlFor="accept-invite-confirm" className="sr-only">Confirm new password</label>
              <input
                id="accept-invite-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirm}
                onChange={e => {
                  setConfirm(e.target.value)
                  setFormError(null)
                }}
                disabled={saving}
                data-testid="accept-invite-confirm"
                className={`w-full min-h-[44px] rounded-md border border-[rgba(38,38,38,0.16)] bg-panel px-4 py-3 ${typography.body} text-text-body placeholder:text-text-light focus:outline-none focus:ring-2 focus:ring-info/50`}
              />
              {formError && (
                <p className={`${typography.bodySmall} text-danger mt-1`} role="alert" data-testid="accept-invite-error">
                  {formError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={saving || password.length === 0 || confirm.length === 0}
              data-testid="accept-invite-submit"
              className={`${typography.button} flex items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-text-on-color shadow-1 transition-all duration-fast hover:bg-primary-hover disabled:bg-primary-disabled disabled:cursor-not-allowed`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Set password and continue'
              )}
            </button>
          </form>
        )}

        <p className={`${typography.bodySmall} text-text-light mt-6 text-center`}>
          This is an invite-only pilot.
        </p>
      </div>
    </div>
  )
}
