/**
 * Login page — magic link + Google OAuth.
 *
 * States: default → submitting → link-sent → rate-limited → invalid-email → expired-link
 * Shows identical message for invited and non-invited emails (prevents enumeration).
 */

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'

type PageState = 'default' | 'submitting' | 'link-sent' | 'rate-limited' | 'invalid-email' | 'expired-link'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const { signInWithMagicLink, signInWithGoogle } = useAuth()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [pageState, setPageState] = useState<PageState>(() =>
    searchParams.get('error') === 'expired' ? 'expired-link' : 'default',
  )
  const [resendCooldown, setResendCooldown] = useState(0)

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
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')) {
        setPageState('rate-limited')
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
    await signInWithMagicLink(trimmed)
    setPageState('link-sent')
    setResendCooldown(60)
  }, [email, signInWithMagicLink])

  const handleGoogleClick = useCallback(async () => {
    await signInWithGoogle()
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

        {pageState === 'link-sent' ? (
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
              Enter your email to receive a sign-in link
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="login-email" className="sr-only">Email address</label>
                <input
                  id="login-email"
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
                  disabled={pageState === 'submitting'}
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

              <button
                type="submit"
                disabled={pageState === 'submitting'}
                className={`${typography.button} flex items-center justify-center gap-2 rounded-pill bg-primary px-6 py-3 text-text-on-color shadow-1 transition-all duration-fast hover:bg-primary-hover hover:-translate-y-px active:bg-primary-active active:translate-y-0 disabled:bg-primary-disabled disabled:cursor-not-allowed disabled:translate-y-0`}
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

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[rgba(38,38,38,0.16)]" />
              <span className={`${typography.bodySmall} text-text-light`}>or</span>
              <div className="h-px flex-1 bg-[rgba(38,38,38,0.16)]" />
            </div>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={pageState === 'submitting'}
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
