/**
 * Signing out on the olumi-core lane (DL 4 Nov): core's `POST /api/me/signout` clears this browser's cookie only. The person's link
 * still works and opens it again, and every other member stays signed in. Then nothing of this person's is kept in the page's memory.
 */
import { useViewStore } from '../olumiView/store'
import { forgetModelTab } from '../olumiView/model/state'
import { clearWhatIf } from '../olumiView/whatif'
import { useMe } from './me'
import { call, setPagePerson } from './team/api'
import { forgetAttempts } from './team/writes'
import { resetDrafts } from './team/drafts'
import { resetDoubts } from './team/ViewDoubts'
import { useModelNotice } from '../olumiView/notice'

/** Signs this browser out of olumi-core; throws (a TeamApiError, in core's or the page's words) when it did not go through. */
export async function signOutOfOlumi(): Promise<void> {
  await call<{ signedOut: boolean }>('POST', '/api/me/signout', {})
  forgetThisPerson()
}

/** Once core has signed this browser out (Sign out, or Delete my data): nothing of the person's is kept in the page's memory. */
export function forgetThisPerson(): void {
  setPagePerson(null)
  useMe.setState({ me: null, status: 'ready' })
  useViewStore.setState(useViewStore.getInitialState(), true)
  forgetModelTab() // the Model tab's drafts, open editors and receipts (Codex review-ui 3)
  resetDrafts()
  resetDoubts()
  clearWhatIf() // a figure they tried without saving, as they typed it
  forgetAttempts() // the requests of their unconfirmed writes, as they typed them (locks stay: DL 7 Nov)
  useModelNotice.setState({ notice: null }) // "Version n saved. Approved by <them>."
}
