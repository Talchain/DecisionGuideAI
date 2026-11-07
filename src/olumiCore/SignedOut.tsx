import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { typography } from '../styles/typography'
import { coreLaneHasAccounts } from './lane'
import { NOTICES } from './notices'

/**
 * Where the lane lands after Sign out: nothing of the person's work is shown, only how to come back. After Delete my data
 * (src/olumiCore/DeleteMyDataDialog.tsx) the address is `/signed-out?deleted=1`, so a reload keeps it, and the screen says only that the
 * data is deleted: never "Your private link opens it again", which is false once core has ended the link. The terms and the privacy
 * notice stay one press away. Off the lane it does not exist.
 */
export function SignedOut(): JSX.Element {
  const deleted = useSearchParams()[0].get('deleted') === '1'
  if (coreLaneHasAccounts()) return <Navigate to="/" replace />
  return (
    <main data-testid="olumi-core-signed-out" className="min-h-screen flex items-center justify-center bg-canvas p-8">
      <div className="max-w-md text-center">
        {deleted ? (
          <h1 className={`${typography.h4} text-text-header`}>Your data is deleted.</h1>
        ) : (
          <>
            <h1 className={`${typography.h4} text-text-header`}>You’re signed out</h1>
            <p className={`${typography.bodySmall} mt-2 text-text-body`}>Your private link opens it again.</p>
            {/* PoC accounts (src/olumiCore/accounts/): a person with an email and password signs back in here. */}
            <p className={`${typography.bodySmall} mt-2`}><Link to="/signin" className="text-info underline underline-offset-2 hover:no-underline" data-testid="olumi-core-signed-out-signin">Sign in with your email and password</Link></p>
          </>
        )}
        <nav aria-label="Notices" className={`${typography.caption} mt-6 flex justify-center gap-4 text-text-light`} data-testid="olumi-core-notices">
          {NOTICES.map(({ label, href }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">{label}</a>
          ))}
        </nav>
      </div>
    </main>
  )
}
