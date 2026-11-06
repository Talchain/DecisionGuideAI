import { Navigate, useLocation } from 'react-router-dom'
import { typography } from '../styles/typography'
import { coreLaneHasAccounts } from './lane'
import { NOTICES } from './notices'

/**
 * Where the lane lands after Sign out: nothing of the person's work is shown, only how to come back. After Delete my data
 * (src/olumiCore/DeleteMyDataDialog.tsx) it says so instead, because core has ended the private link and it no longer opens anything.
 * The terms and the privacy notice stay one press away. Off the lane it does not exist.
 */
export function SignedOut(): JSX.Element {
  // Only the page's own navigation after a completed deletion carries this (never the address), so no link can claim a deletion.
  const deleted = (useLocation().state as { deleted?: unknown } | null)?.deleted === true
  if (coreLaneHasAccounts()) return <Navigate to="/" replace />
  return (
    <main data-testid="olumi-core-signed-out" className="min-h-screen flex items-center justify-center bg-canvas p-8">
      <div className="max-w-md text-center">
        <h1 className={`${typography.h4} text-text-header`}>{deleted ? 'Your data is deleted' : 'You’re signed out'}</h1>
        <p className={`${typography.bodySmall} mt-2 text-text-body`}>
          {deleted ? 'Your private link no longer works. To use Olumi again, ask the person who invited you for a new link.' : 'Your private link opens it again.'}
        </p>
        <nav aria-label="Notices" className={`${typography.caption} mt-6 flex justify-center gap-4 text-text-light`} data-testid="olumi-core-notices">
          {NOTICES.map(({ label, href }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">{label}</a>
          ))}
        </nav>
      </div>
    </main>
  )
}
