/**
 * The Reasoning tab's one home for its state (the redesign's head row: reasoning-redesign-SPEC.md §3, Z1). While the tab draws anything
 * but the latest approved model as it stands, one dashed strip above it says which, in words already said on this lane, with the way
 * back beside them. One state at a time, in this order:
 *   1. a proposal held: core's heading and the version it is on (`proposal.heading`, `.on`), the pair HeldProposalLine draws;
 *   2. an approved version looked at (`at`): the composer's own sentence, "Version n is on the canvas, as it was.", and its act, Back to
 *      the latest (`look(null)`). The number is `at`, the version the person chose, as the composer and the Team tab read it;
 *   3. a what-if shown on this version, by the one gate the what-if box draws by (`useWhatIfOn`): the box's own label, "What-if, not
 *      saved", and its own act, Clear, which drops it (nothing was saved, so nothing is undone). The box under it then draws no label of
 *      its own, so the state is said once.
 * A past View carries no proposal and nothing to try (core: `proposal` and `edit_base` are null at `at`), so at most one applies; the order
 * only settles a View that broke that. Nothing at rest, and nothing while the View is stale or a read failed: the block draws no tab then.
 * Dashed is a state, never a value (DS v5): the info border for Olumi's proposal, the light border for the person's own look or try.
 */
import { useViewStore } from '../store'
import { clearWhatIf } from '../whatif'
import { useWhatIfOn } from '../ViewChances'
import type { ViewModel } from '../client'
import { TYPE } from '../port/type'
import { action } from '../../components/results/analysisNew/panelSurfaces'

/** The strip's own words, each already said on this lane: the composer's way back (ViewChat.tsx), the what-if box's label and act. */
export const STATE_WORDS = { latest: 'Back to the latest', whatIf: 'What-if, not saved', clear: 'Clear' } as const
/** The composer's sentence for an approved version looked at (ViewChat.tsx, TeamTab.tsx), the number the person chose. */
export const pastLine = (n: number): string => `Version ${n} is on the canvas, as it was.`

const STRIP = `${TYPE.meta} flex min-h-[36px] items-center gap-2 rounded-lg border-[1.5px] border-dashed px-3 py-1 text-text-header`

export function StateStrip({ model }: { model: ViewModel }) {
  const proposal = useViewStore((s) => s.view?.proposal ?? null), at = useViewStore((s) => s.at)
  const whatIf = useWhatIfOn(model)
  if (proposal !== null) {
    return (
      <div className={`${STRIP} border-info`} role="status" data-testid="view-reasoning-state" data-state="proposal">
        <p className="m-0 min-w-0" data-testid="view-tabs-held-proposal"><span data-view-proposal="heading">{proposal.heading}</span> <span data-view-proposal="on">{proposal.on}</span></p>
      </div>
    )
  }
  if (at !== null) {
    return (
      <div className={`${STRIP} border-text-light`} role="status" data-testid="view-reasoning-state" data-state="past">
        <p className="m-0 min-w-0 flex-1" data-testid="view-reasoning-past">{pastLine(at)}</p>
        <button type="button" className={`${action('quiet')} shrink-0`} data-testid="view-reasoning-back" onClick={() => void useViewStore.getState().look(null)}>{STATE_WORDS.latest}</button>
      </div>
    )
  }
  if (whatIf !== null) {
    return (
      <div className={`${STRIP} border-text-light`} role="status" data-testid="view-reasoning-state" data-state="whatif">
        <p className="m-0 min-w-0 flex-1" data-testid="view-reasoning-whatif">{STATE_WORDS.whatIf}</p>
        <button type="button" className={`${action('quiet')} shrink-0`} data-testid="view-reasoning-whatif-clear" onClick={clearWhatIf}>{STATE_WORDS.clear}</button>
      </div>
    )
  }
  return null
}
