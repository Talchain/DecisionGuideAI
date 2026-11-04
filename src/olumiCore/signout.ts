/**
 * Signing out on the olumi-core lane (DL 4 Nov): core's `POST /api/me/signout` clears this browser's cookie only. The person's link
 * still works and opens it again, and every other member stays signed in. Then nothing of this person's is kept in the page's memory.
 */
import { useViewStore } from '../olumiView/store'
import { useMe } from './me'
import { call, setPagePerson } from './team/api'

/** Signs this browser out of olumi-core; throws (a TeamApiError, in core's or the page's words) when it did not go through. */
export async function signOutOfOlumi(): Promise<void> {
  await call<{ signedOut: boolean }>('POST', '/api/me/signout', {})
  setPagePerson(null)
  useMe.setState({ me: null, status: 'ready' })
  useViewStore.setState(useViewStore.getInitialState(), true)
}
