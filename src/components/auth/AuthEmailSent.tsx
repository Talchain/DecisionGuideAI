/**
 * "Check your inbox": shown after any emailed link is requested.
 *
 * The copy is conditional ("if … has access") on purpose: the page cannot know,
 * and must not reveal, whether the address has an account. Resend is offered
 * after a short cooldown so a missing email has an obvious next step without
 * inviting a burst of requests into Supabase's per-address rate limit.
 */

import { useEffect, useState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { typography } from '../../styles/typography'
import { secondaryButton, textLink } from './authStyles'

const RESEND_COOLDOWN_S = 60

interface AuthEmailSentProps {
  email: string
  heading: string
  body: string
  onResend: () => Promise<void>
  onUseDifferentEmail: () => void
  testId?: string
}

export default function AuthEmailSent({
  email,
  heading,
  body,
  onResend,
  onUseDifferentEmail,
  testId,
}: AuthEmailSentProps) {
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const resend = async () => {
    setResending(true)
    try {
      await onResend()
    } finally {
      setResending(false)
      setCooldown(RESEND_COOLDOWN_S)
    }
  }

  return (
    <div className="flex flex-col items-center text-center" data-testid={testId} aria-live="polite">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-info/30 text-info">
        <MailCheck className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className={`${typography.h4} mt-5 text-text-header`}>{heading}</h1>
      <p className={`${typography.body} mt-2 text-text-body`}>
        {body.split('{email}')[0]}
        <span className="font-medium text-text-header break-all">{email}</span>
        {body.split('{email}')[1]}
      </p>
      <p className={`${typography.bodySmall} mt-3 text-text-light`}>
        The link works once, so use the newest email. Check your spam folder if it hasn&rsquo;t arrived in a minute or two.
      </p>

      <div className="mt-6 flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className={secondaryButton}
          data-testid="auth-resend"
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending&hellip;
            </>
          ) : cooldown > 0 ? (
            `Resend in ${cooldown}s`
          ) : (
            'Resend link'
          )}
        </button>
        <button type="button" onClick={onUseDifferentEmail} className={textLink}>
          Use a different email
        </button>
      </div>
    </div>
  )
}
