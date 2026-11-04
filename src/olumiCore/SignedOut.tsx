import { Navigate } from 'react-router-dom'
import { typography } from '../styles/typography'
import { coreLaneHasAccounts } from './lane'

/** Where the lane lands after Sign out: nothing of the person's work is shown, only how to come back. Off the lane it does not exist. */
export function SignedOut(): JSX.Element {
  if (coreLaneHasAccounts()) return <Navigate to="/" replace />
  return (
    <main data-testid="olumi-core-signed-out" className="min-h-screen flex items-center justify-center bg-canvas p-8">
      <div className="max-w-md text-center">
        <h1 className={`${typography.h4} text-text-header`}>You’re signed out</h1>
        <p className={`${typography.bodySmall} mt-2 text-text-body`}>Your private link opens it again.</p>
      </div>
    </main>
  )
}
