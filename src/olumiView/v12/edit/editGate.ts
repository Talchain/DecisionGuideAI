/**
 * WHEN THE LANE MAY OFFER A SAVED EDIT (the same gate `model/editing.ts` keeps for the Model tab and the canvas editors): the person's own
 * page, the latest version, and an approved board core will take an edit on (`model.edit_base` set; core sets it null while a proposal is
 * held). While Olumi's change is held an edit is DISABLED, never made by quietly setting the change aside (reply 002 §4).
 * The reason is a sentence that already exists: core's `withdrawnHeld` for a held change, `TEAM_PAST_HELD` for an earlier version, and
 * `NOT_FOR_THIS_PAGE` for another person's page.
 */
import { modelEditNow } from '../../model/editing'
import { useViewStore } from '../../store'
import { isForThisPage, useMe } from '../../../olumiCore/me'
import { NOT_FOR_THIS_PAGE } from '../../../olumiCore/team/api'
import { TEAM_PAST_HELD } from '../../../olumiCore/team/writes'

export type EditGate =
  | { readonly ok: true; readonly sid: string; readonly base: number }
  | { readonly ok: false; readonly why: string; readonly held?: true }

export const NO_MODEL_YET = 'There is no saved model to change yet.'
export const CATCHING_UP = 'Olumi is catching up with the latest change. Try again in a moment.'
export const REVIEW_PROPOSAL_ROW = 'Review Olumi’s proposal'
export const REVIEW_CHANGES = 'Review the changes'
export const REVIEW_PROPOSAL = `${REVIEW_PROPOSAL_ROW}.`

export function editGateNow(): EditGate {
  const s = useViewStore.getState()
  if (s.sid === null || s.view === null) return { ok: false, why: NO_MODEL_YET }
  if (!isForThisPage(s.view, useMe.getState().me)) return { ok: false, why: NOT_FOR_THIS_PAGE }
  if (s.at !== null) return { ok: false, why: TEAM_PAST_HELD }
  const { sid, base, held } = modelEditNow()
  if (sid !== null && base !== null) return { ok: true, sid, base }
  if (held !== null) return { ok: false, why: s.view.model_words?.withdrawnHeld ?? held.heading, held: true }
  return { ok: false, why: s.error !== null || s.stale ? CATCHING_UP : NO_MODEL_YET }
}
