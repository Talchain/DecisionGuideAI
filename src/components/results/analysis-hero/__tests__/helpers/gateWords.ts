/**
 * Test-only (#2747 re-scope): the copy specs exercise WORDING, not authority, so they hand the copy the words the
 * authority gate would give a licensed figure (Ruling 4's wording of the licence's percent). Authority itself is pinned
 * by `canvas/runView/__tests__/chanceAuthorityGate.*` and the mounted Results / chat / Compare specs.
 */
import type { GoalChanceLicence } from '../../../utils/goalChanceLicence'
import { goalProbabilityWords } from '../../../utils/goalAnchorCopy'

export const gateWordsOf = (licence: GoalChanceLicence) => (id: string): string | null =>
  typeof licence.pctByOption[id] === 'number' ? goalProbabilityWords(`${licence.pctByOption[id]}%`) : null
