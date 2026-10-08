/**
 * AuthShell: the one frame every sign-in surface sits in (login, invite
 * acceptance, password reset, link expiry).
 *
 * One frame, so an invitee moving from the email to "set your password" to the
 * hub never sees the product change shape under them. Design System v5:
 * canvas surface, a standalone card (20px radius, shadow-1, 32px padding,
 * §6.2/§8.4), Inter type tokens, and the brand logo as the only ornament.
 */

import type { ReactNode } from 'react'
import { typography } from '../../styles/typography'

interface AuthShellProps {
  children: ReactNode
  /** Quiet line under the card. Defaults to the invite-only statement. */
  footer?: ReactNode
  testId?: string
}

export default function AuthShell({ children, footer, testId }: AuthShellProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12"
      data-testid={testId}
    >
      <a href="/" aria-label="Olumi home" className="mb-8 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info">
        <img src="/olumi-logo.png" alt="Olumi" className="h-9 w-auto" />
      </a>

      <main className="w-full max-w-[420px] motion-safe:animate-slideDown rounded-[20px] border border-panel-border bg-panel p-8 shadow-1">
        {children}
      </main>

      <div className={`${typography.bodySmall} mt-6 max-w-[420px] text-center text-text-light`}>
        {footer ?? (
          <p>This is an invite-only pilot. Need access? Ask your Olumi contact.</p>
        )}
      </div>
    </div>
  )
}
