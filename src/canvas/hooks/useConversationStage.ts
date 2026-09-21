/**
 * useConversationStage — the ONE derivation of "what does this user have?",
 * read by every surface that has to say so in its own words.
 *
 * ⚠ IT LIVES IN ITS OWN MODULE FOR A MEASURED REASON, not for tidiness. The
 * first cut put the ladder and both voices in `useStageAwarePlaceholder.ts`,
 * and two dock specs went RED immediately:
 *
 *     [vitest] No "useEmptyConversationInvitation" export is defined on the
 *     "../../hooks/useStageAwarePlaceholder" mock.
 *
 * Roughly twenty-five specs mock that module with a WHOLESALE factory to keep
 * the store and the trust hook out of a composer test. Every one of them would
 * have had to learn the name of a second export it does not care about — and
 * the next export after that, and the one after. That is the hand-maintained
 * mirror this estate keeps paying for (CLAUDE.md trap 12): the mocks would read
 * as current while going quietly stale.
 *
 * Patching the mocks was the obvious fix and it is the wrong one. The state is
 * not either voice, so it does not belong in the module named after one of
 * them. A spec that mocks the composer's placeholder now gets the REAL
 * invitation, which is also more honest: silencing one surface should not
 * silently decide what the other says.
 */
import { useCanvasStore, selectResultsStatus } from '../store'
import { useMayStalenessVoiceSpeak } from '../conversation/stalenessVoice'
import { useAnalysisTrust } from './useAnalysisTrust'
// ⚠ THE LEAF, NOT THE COMPONENT. `firstUsePlaceholder.ts` carries no imports
// of its own precisely so a shared string cannot drag a component's dependency
// graph across the dock's import boundary — see its header for the
// 54-violation measurement that put it there.
import { FIRST_USE_PLACEHOLDER } from '../components/firstUsePlaceholder'

/**
 * The five states the ladder below distinguishes, named so more than one voice
 * can speak from them.
 *
 * ⭐ THE LADDER IS EXTRACTED BECAUSE TWO SURFACES WERE CONTRADICTING EACH OTHER
 * IN ONE FRAME, and a whole-app screenshot is what caught it. With a model on
 * the canvas and no conversation yet, the Olumi tab's body said
 *
 *     "Describe the decision or challenge you're working through, any options
 *      you're weighing, and what a good outcome looks like."
 *
 * while the composer twenty pixels beneath it said "Ask about this model…" —
 * one invitation to describe a decision that was already drawn on screen, and
 * one that could see it. `OlumiTabBody` gated on `realMessageCount === 0`
 * alone; it had no way to know a model existed, because the only thing that
 * knew lived in this hook and returned a composer-shaped string.
 *
 * So the STATE is derived once and each surface renders its own voice from it.
 * Neither can drift, and adding a state without giving it both voices is a type
 * error.
 */
export type ConversationStage =
  /** Edited since the last run, and no higher staleness voice is already saying so. */
  | 'changed'
  /** A run the producer confirms is current. */
  | 'current'
  /** A run exists but freshness is cannot-confirm or absent — never claim "latest". */
  | 'analysed'
  /** A model on the canvas, nothing run yet. */
  | 'modelled'
  /** Nothing yet. */
  | 'empty'

/**
 * ⚠ ONE LADDER, AND ITS ORDER IS LOAD-BEARING. Do not add a second predicate
 * beside it (CLAUDE.md trap 21): a surface that wants different words wants a
 * different VOICE for the same state, not a different reading of the state.
 */
export function useConversationStage(): ConversationStage {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const freshness = useAnalysisTrust().semantic
  const mayNagAboutStaleness = useMayStalenessVoiceSpeak('placeholder')

  if (freshness === 'changed' && mayNagAboutStaleness) return 'changed'
  if (freshness === 'current') return 'current'
  if (resultsStatus === 'complete') return 'analysed'
  if (nodeCount > 0) return 'modelled'
  return 'empty'
}

/**
 * The PANEL voice for the same state — the sentence the Olumi tab shows while
 * the conversation is empty.
 *
 * ⚠ IT IS A SENTENCE, NOT THE COMPOSER'S STRING. "Ask about this model…" is an
 * ellipsis-trailing prompt written to sit inside a text box; as the only thing
 * in an otherwise blank panel it reads as a fragment. Same state, different
 * register — which is exactly why the state is derived once and the words are
 * chosen twice, rather than one surface borrowing the other's copy.
 *
 * ⛔ IT CLAIMS ONLY WHAT THE STAGE ESTABLISHES, and the 'analysed' line is the
 * one that had to be careful: that stage means a run COMPLETED but freshness is
 * cannot-confirm or absent, so it must not say "latest" or "ready" — the same
 * restraint the placeholder ladder already shows at that rung.
 *
 * ⚠ 'changed' DOES NOT BECOME A THIRD STALENESS VOICE. It is reachable only
 * when `useMayStalenessVoiceSpeak` has already permitted the placeholder to
 * mention it (L-42: one staleness communication per turn view); when a higher
 * surface is speaking, the ladder falls through and this says the neutral
 * thing, exactly as the composer does.
 *
 * ⚠ 'empty' RETURNS THE FIRST-USE CONSTANT UNCHANGED. A user who genuinely has
 * nothing on the canvas still gets the sentence the hero and the returning-user
 * spec both bind to; this adds the four cases that were missing, it does not
 * replace the one that was right.
 */
export function useEmptyConversationInvitation(): string {
  const stage = useConversationStage()
  switch (stage) {
    case 'changed':
      return 'Your model has changed since the last analysis. Ask Olumi what that means, or run it again.'
    case 'current':
      return 'Your analysis is ready. Ask Olumi about any part of it, or say what you would like to change.'
    case 'analysed':
      return 'Your analysis is on the Analysis tab. Ask Olumi about any part of it, or say what you would like to change.'
    case 'modelled':
      return 'Your model is on the canvas. Ask Olumi about any part of it, or say what you would like to change.'
    case 'empty':
      return FIRST_USE_PLACEHOLDER
  }
}
