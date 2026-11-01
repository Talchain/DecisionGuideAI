import { heldOf, heldWords } from './model'
import { useTeamStore } from './store'
import { CardMark } from '../../canvas/nodes/shared/CardMark'

/**
 * The question card's mark for a round in progress: a lock and "2 of 3 views held" (design plan, step 3). It reads the current round
 * from the scenario view's `members`, `waiting` and `reveal`, never `views.length`. Absent when nobody has given a view yet, when
 * the round has been revealed, and off the olumi-core lane (nothing reads the store there).
 */
export function TeamHeldMark(): JSX.Element | null {
  const scenario = useTeamStore((s) => s.scenario)
  if (!scenario) return null
  const held = heldOf(scenario)
  if (!held || held.given === 0) return null
  return <CardMark id="views-held" testId="views-held-mark" words={heldWords(held)} caption={`${held.given}/${held.of}`} description="Each view stays private until the team reveals them together." />
}
