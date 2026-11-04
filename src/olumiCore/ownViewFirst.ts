/**
 * OWN VIEW FIRST (PILOT-PACK 1.1; DL 4 Nov): a member says what they think before Olumi's replies can anchor them. While core holds them
 * (the View's `gated`, olumi.view/3: no view of their own given yet, and not the writer of the brief), the dock opens on the Team tab at
 * the private-view box and no Olumi note is drawn. Who is held is core's rule alone, the one its own page uses, so the two never
 * disagree; nothing is worked out here. A View without the field (a core from before it) holds nobody.
 */
import type { View } from '../olumiView/client'
import { useViewStore } from '../olumiView/store'
import { isForThisPage, useMe } from './me'

/** Core holds this viewer until they have given or skipped their own view. */
export function ownViewPending(view: View): boolean {
  return view.gated === true
}

/** On the core lane: whether the person on this page owes their own view first. */
export function useOwnViewFirst(on: boolean): boolean {
  const view = useViewStore((s) => s.view)
  const me = useMe((s) => s.me)
  return on && view !== null && isForThisPage(view, me) && ownViewPending(view)
}
