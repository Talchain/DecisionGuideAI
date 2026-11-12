/**
 * The Reasoning tab's one home for its state (the redesign's head row: reasoning-redesign-SPEC.md §3, Z1). While the tab draws anything
 * but the latest approved model as it stands, one dashed strip above it says which, in words already said on this lane, with the way
 * back beside them. One state at a time, in this order:
 *   1. a proposal held: core's heading and the version it is on (`proposal.heading`, `.on`), the pair HeldProposalLine draws;
 *   2. an approved version looked at (`at`): nothing yet. Core sends no sentence for that state, and this tab composes none (Codex on
 *      PR0, DL 7 Nov); the composer keeps its own way back. The state is still read, so a past version is never said to be a what-if;
 *   3. a what-if shown on this version, by the one gate the what-if box draws by (`useWhatIfOn`): the box's own label, "What-if, not
 *      saved", and its own act, Clear, which drops it (nothing was saved, so nothing is undone). The box under it then draws no label of
 *      its own, so the state is said once.
 * A past View carries no proposal and nothing to try (core: `proposal` and `edit_base` are null at `at`). A proposal and a what-if CAN be
 * on screen together: core holds a proposal back from a viewer who has not given their own view yet (view.ts `heldProposal`), serving
 * `proposal` while the canvas draws the approved version, whose `edit_base` stays set, so a what-if tried there stays shown. The strip
 * then says the proposal, and the what-if box keeps its own label and Clear: `useTabState` is the one answer both read, so the box goes
 * unlabelled only when the strip says the what-if. Nothing at rest, and nothing while the View is stale or a read failed (no tab then).
 * Dashed is a state, never a value (DS v5): the info border for Olumi's proposal, the light border for the person's own look or try.
 */
import { useViewStore } from '../store'
import { clearWhatIf } from '../whatif'
import { ProposalWords, useWhatIfOn } from '../ViewChances'
import type { ViewModel } from '../client'
import { TYPE } from '../port/type'
import { action } from '../../components/results/analysisNew/panelSurfaces'

/** The strip's own words, each already said on this lane: the composer's way back (ViewChat.tsx), the what-if box's label and act. */
export const STATE_WORDS = { whatIf: 'What-if, not saved', clear: 'Clear' } as const

const STRIP = `${TYPE.meta} flex min-h-[36px] items-center gap-2 rounded-lg border-[1.5px] border-dashed px-3 py-1 text-text-header`

/** The tab's one state, in the strip's order (a proposal held, a past version looked at, a what-if shown on this version), or null. */
export type TabState = 'proposal' | 'past' | 'whatif' | null
export function useTabState(model: ViewModel | null): TabState {
  const proposal = useViewStore((s) => s.view?.proposal ?? null), at = useViewStore((s) => s.at)
  const whatIf = useWhatIfOn(model)
  return proposal !== null ? 'proposal' : at !== null ? 'past' : whatIf !== null ? 'whatif' : null
}

/** The strip for the state the block read (`useTabState`), so the strip and the what-if box below it act on one answer. A past version
 * draws nothing until core sends that state's sentence. */
export function StateStrip({ state }: { state: TabState }) {
  const proposal = useViewStore((s) => s.view?.proposal ?? null)
  if (state === 'proposal' && proposal !== null) {
    return (
      <div className={`${STRIP} border-info`} role="status" data-testid="view-reasoning-state" data-state="proposal">
        <p className="m-0 min-w-0" data-testid="view-tabs-held-proposal"><ProposalWords p={proposal} /></p>
      </div>
    )
  }
  if (state === 'whatif') {
    return (
      <div className={`${STRIP} border-text-light`} role="status" data-testid="view-reasoning-state" data-state="whatif">
        <p className="m-0 min-w-0 flex-1" data-testid="view-reasoning-whatif">{STATE_WORDS.whatIf}</p>
        <button type="button" className={`${action('quiet')} shrink-0`} data-testid="view-reasoning-whatif-clear" onClick={clearWhatIf}>{STATE_WORDS.clear}</button>
      </div>
    )
  }
  return null
}
