/**
 * OLUMI'S MOVES ON A CARD (contract section 8: "a card (on hover, selection or keyboard focus; five at most): the engine's four challenges on
 * that card ... and 'ask about this'"). A small pill at the card's top edge, above it (it never covers the title, never moves the card or
 * its links), in Olumi's blue ring. Cards at rest carry none of it: it shows while the card is selected, hovered or holds keyboard focus,
 * and Escape lets it go.
 *  - A challenge sends core's challenge on THIS card (ViewChat `challenge(kind, card, words)`), with the words a challenge chip sends today
 *    for that kind (registry `CHALLENGE_ASK`, built by askAi `buildAskAiQuestion` for the card as its kind asks: layout `askKindOf`). Named
 *    by the composer's own label for the same challenge. One that does not go through leaves its words in the message box, as the canvas's
 *    asks do, beside core's own sentence for why.
 *  - "Ask about this" puts the card's prefill in the composer (NodeCornerOlumi `askAboutOf`, through the canvas's ask registry): nothing sent.
 * Drawn only where the panel offers its own ways to test the model (`movesOffered`) and only on a card core holds.
 */
import type { KeyboardEvent, SyntheticEvent } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { buildAskAiQuestion } from '../../../canvas/conversation/askAi'
import { revealOlumiSurface } from '../../../canvas/conversation/revealOlumi'
import { canReceiveAsk, requestAsk } from '../../../canvas/ui/inspector-v2/askSemantic'
import { askAboutOf } from '../../../canvas/nodes/shared/NodeCornerOlumi'
import { COACHING_ICON_GLYPH } from '../../../canvas/nodes/shared/NodeCoachingIcon'
import { useViewStore } from '../../store'
import { askKindOf } from '../../layout'
import { CHALLENGE_KINDS, challenge, isAnswering, prefillComposer, useViewChat, type ChallengeKind } from '../../ViewChat'
import { CHALLENGE_ASK, CHALLENGE_ICON, challengeName, movesOffered } from './registry'

/** The words a challenge of `kind` on card `id` sends: the question the product's challenge chip asks of that card (askAi). */
export function challengeWordsOf(kind: ChallengeKind, id: string, family: string): string {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)
  return buildAskAiQuestion({ intent: CHALLENGE_ASK[kind], nodeIds: [id], node: { ...node, type: askKindOf(family) } }).question
}

const BUTTON = 'inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-text-body transition-colors duration-100 hover:bg-info/10 disabled:cursor-default disabled:text-text-light disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header'
/** A press on the pill is the pill's: the card under it neither drags nor takes the click. */
const own = (e: SyntheticEvent) => e.stopPropagation()

export function CardMoves({ id, selected }: { id: string; selected: boolean }): JSX.Element | null {
  const sid = useViewStore((s) => s.sid), view = useViewStore((s) => s.view), at = useViewStore((s) => s.at)
  const busy = useViewChat((s) => s.busy)
  const canAsk = useGuidanceStore(canReceiveAsk)
  if (!movesOffered(sid, view, at)) return null
  const card = view.model?.cards.find((c) => c.id === id)
  if (card === undefined) return null
  const held = busy || isAnswering(view)
  const press = (kind: ChallengeKind) => {
    const words = challengeWordsOf(kind, id, card.family), here = useViewStore.getState().uuid
    revealOlumiSurface()
    void challenge(kind, id, words).then((sent) => { if (!sent && useViewStore.getState().uuid === here) prefillComposer(words) })
  }
  const about = askAboutOf(card.heading)
  const AskIcon = COACHING_ICON_GLYPH.Icon
  // Escape lets the pill go: focus leaves it (a selected card keeps it, as its selection does).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Escape') (document.activeElement as HTMLElement | null)?.blur() }
  return (
    <div data-testid="card-moves" data-card={id} onKeyDown={onKeyDown} onPointerDown={own} onClick={own} onDoubleClick={own}
      // Above the card's top edge, at its right, clear of the kind marker on that edge; the bottom padding bridges the gap so the pointer can travel from the card to the pill. Counter-
      // scaled with the canvas's glyphs, so it keeps its size at any zoom.
      className={`nodrag nopan absolute bottom-full right-2 z-[5] pb-3 ${selected ? 'visible' : 'invisible [.react-flow__node:focus-within_&]:visible [.react-flow__node:hover_&]:visible'}`}
      style={{ transform: 'scale(var(--canvas-glyph-scale, 1))', transformOrigin: 'bottom right' }}>
      <div role="toolbar" aria-label="Ways to test the model" className="flex items-center gap-0.5 rounded-full border border-info/30 bg-panel p-0.5 shadow-1">
        {CHALLENGE_KINDS.map((kind) => {
          const Icon = CHALLENGE_ICON[kind], name = challengeName(kind)
          return (
            <button key={kind} type="button" data-challenge={kind} aria-label={name} title={name} disabled={held} onClick={() => press(kind)} className={BUTTON}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )
        })}
        {!canAsk ? null : (
          <button type="button" data-testid="card-moves-ask" aria-label={about.label} title={about.label}
            onClick={() => { requestAsk({ ...about, targetId: id, source: 'node-coaching-icon' }) }} className={BUTTON}>
            <AskIcon size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
