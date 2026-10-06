/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE INVITATION THAT RESOLVES A WITHHELD GOAL CHANCE (DL 0df0e1 #87 6006078553; Wording c6
 * 6 Oct). Rendered only from the `invite` CEE wrote on its own withhold record (`readGoalChanceInvite`); otherwise nothing.
 *
 *  · `state_goal_direction` — c6's sentence and two buttons, "At least {target}" / "At most {target}". Each writes the SAME
 *    figure and unit with that direction through the existing goal-target door (`proposeGoalTarget` → `goal_target_edit`,
 *    CEE's approved-card writer, which holds the direction on the goal). Neither button re-runs: the user re-runs.
 *  · `state_goal_target` — c6's sentence above the existing target door itself (`SuccessTargetLine`), unchanged.
 *
 * What a click did is reported exactly as the Model strip's target door reports it (`ANALYSIS_NEW_COPY.successTarget`,
 * `goalTargetSettlementNotice`): never an outcome the authority did not answer.
 */
import { useCanvasStore } from '../../../canvas/store'
import { useModelEditAuthority } from '../../../canvas/hooks/useModelEditAuthority'
import { useShowToastSafe } from '../../../canvas/ToastContext'
import { goalTargetSettlementNotice } from '../../../canvas/conversation/goalTargetEdit'
import { SuccessTargetLine } from '../analysisNew/sections/SuccessTargetLine'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNew/analysisNewCopy'
import { formatGoalTarget } from '../utils/formatGoalTarget'
import { GOAL_CHANCE_INVITE, type GoalChanceInvite as Invite } from './readGoalChanceInvite'

export interface GoalChanceInviteProps {
  invite: Invite | null
  /** The goal's display label, or null ("your goal", unquoted — c6). */
  goalLabel: string | null
}

const BUTTON =
  'rounded-md border border-info/40 px-2.5 py-1 text-info hover:bg-info/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info'

export function GoalChanceInvite({ invite, goalLabel }: GoalChanceInviteProps) {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const authority = useModelEditAuthority(invite?.goalNodeId ?? null)
  const showToast = useShowToastSafe()
  if (invite === null) return null

  const onSendSettled = (...[settlement, detail]: Parameters<typeof goalTargetSettlementNotice>) => {
    const notice = goalTargetSettlementNotice(settlement, detail)
    if (notice !== null) showToast(notice, settlement === 'refused' ? 'error' : 'warning')
  }

  if (invite.kind === 'state_goal_direction') {
    const target = formatGoalTarget(invite.value, invite.unit, 'level')
    if (target === null) return null
    const choose = (direction: 'at_least' | 'at_most') => {
      const outcome = authority.proposeGoalTarget(String(invite.value), invite.unit, scenarioId, direction, { onSendSettled })
      showToast(outcome === 'dispatched' ? COPY.successTarget.dispatched : COPY.successTarget.notEncodable)
    }
    return (
      <div data-testid="goal-chance-invite" data-invite-kind={invite.kind} className="flex flex-col gap-2 py-2 text-sm">
        <p data-testid="goal-chance-invite-text">{GOAL_CHANCE_INVITE.direction(target)}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="goal-chance-invite-at-least" className={BUTTON} onClick={() => choose('at_least')}>
            {GOAL_CHANCE_INVITE.atLeast(target)}
          </button>
          <button type="button" data-testid="goal-chance-invite-at-most" className={BUTTON} onClick={() => choose('at_most')}>
            {GOAL_CHANCE_INVITE.atMost(target)}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="goal-chance-invite" data-invite-kind={invite.kind} className="flex flex-col gap-1 py-2 text-sm">
      <p data-testid="goal-chance-invite-text">{GOAL_CHANCE_INVITE.target(goalLabel)}</p>
      <SuccessTargetLine
        goalNodeId={invite.goalNodeId}
        divider={false}
        variant="reasoning"
        onCommitOutcome={(outcome) =>
          showToast(
            outcome === 'dispatched'
              ? COPY.successTarget.dispatched
              : outcome === 'local_only'
                ? COPY.successTarget.changedLocally
                : outcome === 'no_unit'
                  ? COPY.successTarget.noUnit
                  : outcome === 'not_a_number'
                    ? COPY.successTarget.notANumber
                    : COPY.successTarget.notEncodable,
          )
        }
        onSendSettled={onSendSettled}
        testId="goal-chance-invite-target"
      />
    </div>
  )
}
