import { lazy, type ReactNode } from 'react'
import { Navigate, Route } from 'react-router-dom'
import { isOlumiCoreLane } from '../lane'

/**
 * The PoC account pages' routes on the olumi-core lane, given to AppPoC's one `<Routes>` as a fragment (`laneAccountRoutes()`), plus
 * the lane's home (`LaneHome`: My scenarios). Each is its own chunk. Off the lane none of them exists: each address goes home, where the
 * legacy app's own pages are.
 */
const SignInPage = lazy(() => import('./SignInPage'))
const SignUpPage = lazy(() => import('./SignUpPage'))
const JoinPage = lazy(() => import('./JoinPage'))
const MyScenariosPage = lazy(() => import('./MyScenariosPage'))
const OrganisationPage = lazy(() => import('./OrganisationPage'))
const AccountPage = lazy(() => import('./AccountPage'))

export const ACCOUNT_PATHS = { signIn: '/signin', signUp: '/signup', join: '/join/:token', organisation: '/organisation', account: '/account' } as const

function LaneOnly({ children }: { children: ReactNode }): JSX.Element {
  return isOlumiCoreLane() ? <>{children}</> : <Navigate to="/" replace />
}

/** Home: My scenarios on the lane; the page given (the legacy scenario list) off it. */
export function LaneHome({ otherwise }: { otherwise: ReactNode }): JSX.Element {
  return isOlumiCoreLane() ? <MyScenariosPage /> : <>{otherwise}</>
}

export function laneAccountRoutes(): JSX.Element {
  return (
    <>
      <Route path={ACCOUNT_PATHS.signIn} element={<LaneOnly><SignInPage /></LaneOnly>} />
      <Route path={ACCOUNT_PATHS.signUp} element={<LaneOnly><SignUpPage /></LaneOnly>} />
      <Route path={ACCOUNT_PATHS.join} element={<LaneOnly><JoinPage /></LaneOnly>} />
      <Route path={ACCOUNT_PATHS.organisation} element={<LaneOnly><OrganisationPage /></LaneOnly>} />
      <Route path={ACCOUNT_PATHS.account} element={<LaneOnly><AccountPage /></LaneOnly>} />
    </>
  )
}
