/**
 * ⭐ THE COMPOSER'S REASONING MOVES (Paul, 23 Oct 2026: "reintroduce the previous UI improvements we made to the AI
 * panel. It's the icons at the bottom of the panel").
 *
 * WHY THE UI OWNS THIS ROW. The 14 Oct icon row (`ActionBar`, six slots + ⋯) draws only what CEE sends as
 * `action_bar`, and the staging default (the core route) sends none: the core turn contract carries no bar
 * (CEE `orchestrator-v5/core-route/contract.ts`: "Never the legacy envelope"), and a core reopen carries none either
 * (CEE `assist.v1.scenario-graph.ts`, the PATH-B core rule). So on core the bar was never mounted. These four moves are
 * the vision's composer toolbar, defined here, and every press goes through the SAME press paths the canvas and the
 * Reasoning tab already use (`askAi` / `pressAction`): one chip turn, on whatever route the conversation is on.
 *
 * ⚠ NO FAKE CONTROLS. A move that cannot run says why, as its tooltip and accessible name, and sends nothing. There is
 * no Pre-mortem here (the "If it failed" lens is that move) and no "Sketch a view" (nothing in the product does it yet).
 * ⚠ THE DRAFT IS NEVER TOUCHED. A move sends Olumi's own question as a chip; whatever the person typed stays in the box.
 */
import { FlipVertical2, Globe, SearchX, Zap } from 'lucide-react'
import type { ComponentType } from 'react'

import Tooltip from '../../../components/Tooltip'
import { useCanvasStore } from '../../store'
import { ASK_BUSY_NOTICE, askAi } from '../askAi'
import { pressAction } from '../pressAction'

/** The card kinds a challenge note can sit beside (CEE `NOTE_NODE_KINDS`; a question card is never one). */
const CARD_KINDS: ReadonlySet<string> = new Set(['factor', 'option', 'goal', 'risk', 'constraint', 'outcome'])

export const COMPOSER_MOVES_COPY = {
  group: 'Reasoning moves',
  noModel: 'Build a model first, then Olumi can reason about it with you.',
  busy: ASK_BUSY_NOTICE,
} as const

type Glyph = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

interface ComposerMove {
  id: 'challenge' | 'opposite' | 'evidence_against' | 'outside_view'
  label: string
  /** What a press does, said once. */
  does: string
  Icon: Glyph
  /** The move is about ONE card the person selected; without one it says so and sends nothing. */
  needsCard?: string
  press: (cardId: string | null) => void
}

/** The vision's composer toolbar, in its order (upload sits before these, send after). */
export const COMPOSER_MOVES: readonly ComposerMove[] = [
  {
    id: 'challenge',
    label: 'Challenge an assumption',
    does: 'Olumi questions the assumption on the card you selected.',
    Icon: Zap,
    needsCard: 'Select one card on the canvas, then Olumi can challenge it.',
    press: (cardId) => { if (cardId) askAi({ intent: 'challenge', nodeIds: [cardId] }) },
  },
  {
    id: 'opposite',
    label: 'Consider the opposite',
    does: 'The strongest honest case against how this model reads now.',
    Icon: FlipVertical2,
    press: () => { pressAction('opposite_case') },
  },
  {
    id: 'evidence_against',
    label: 'Look for evidence against',
    does: 'What evidence or result would show the card you selected is wrong.',
    Icon: SearchX,
    needsCard: 'Select one card on the canvas, then Olumi can look for evidence against it.',
    press: (cardId) => { if (cardId) askAi({ intent: 'falsify', nodeIds: [cardId] }) },
  },
  {
    id: 'outside_view',
    label: 'Outside view',
    does: 'How situations like this usually turn out, and how yours differs.',
    Icon: Globe,
    press: () => { pressAction('outside_view') },
  },
]

/** The one card selected on the canvas, when exactly one card (and no link) is selected; else null. */
function selectedCardId(s: {
  selection?: { nodeIds?: ReadonlySet<string>; edgeIds?: ReadonlySet<string> }
  nodes?: ReadonlyArray<{ id: string; type?: string }>
}): string | null {
  const ids = s.selection?.nodeIds
  if (!ids || ids.size !== 1 || (s.selection?.edgeIds?.size ?? 0) > 0) return null
  const [id] = ids
  const node = s.nodes?.find((n) => n.id === id)
  return node?.type !== undefined && CARD_KINDS.has(node.type) ? node.id : null
}

export interface ComposerMovesProps {
  /** Olumi is answering: every move waits. */
  busy: boolean
  /** The test-id stem of the composer this row sits in. */
  testIdBase: string
}

export function ComposerMoves({ busy, testIdBase }: ComposerMovesProps) {
  const hasModel = useCanvasStore((s) => (s.nodes?.length ?? 0) > 0)
  const cardId = useCanvasStore(selectedCardId)

  return (
    <span role="group" aria-label={COMPOSER_MOVES_COPY.group} className="flex items-center gap-1" data-testid={`${testIdBase}-composer-moves`}>
      {COMPOSER_MOVES.map((move) => {
        const blocked = !hasModel ? COMPOSER_MOVES_COPY.noModel
          : busy ? COMPOSER_MOVES_COPY.busy
            : move.needsCard && cardId === null ? move.needsCard
              : null
        const name = `${move.label}: ${blocked ?? move.does}`
        return (
          <Tooltip key={move.id} asChild content={name}>
            <button
              type="button"
              aria-label={name}
              aria-disabled={blocked ? 'true' : undefined}
              onClick={() => { if (!blocked) move.press(cardId) }}
              data-testid={`${testIdBase}-composer-tool`}
              data-move={move.id}
              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-text-light focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
                blocked ? 'opacity-40 cursor-not-allowed' : 'hover:text-text-body hover:bg-panel-hover'
              }`}
            >
              <move.Icon className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
        )
      })}
    </span>
  )
}
