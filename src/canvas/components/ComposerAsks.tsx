/**
 * ⭐ WHAT OLUMI NEEDS, AND WHAT TO THINK ABOUT, ABOVE THE TEXT BOX (Paul's first screen, 27 Oct; a program board only).
 *
 *  · "To work out the chance, Olumi needs:": every node or link of the saved model that carries `user_questions` (its
 *    asked figures), in graph order, the first 3 and "N more". A press puts the question into the composer as context and
 *    focuses it, so the person types the answer after it and sends it as an ordinary message.
 *  · Up to 3 coaching questions: the decision node's `coaching_questions` (CEE), none when absent or empty. A press puts
 *    the question into the composer as a prompt.
 *
 * Two lists, never one: the first is data Olumi needs, the second is coaching.
 *
 * ⚠ READ FROM THE SAVED MODEL (`useSavedGraphRead`, read again after every applied turn), NEVER THE CANVAS. A later turn
 * reaches the canvas through `overlayNode`, which keeps every key the wire omits ("the canvas KEEPS keys the wire omits",
 * `mergeAppliedGraph.ts`), and CEE sends no `user_questions` key on a card with nothing asked (served reads), so an
 * answered figure would stay asked there. The saved model is the graph CEE holds now: an answered figure drops out with the
 * read that follows the answer. The canvas also keeps no link's `user_questions` (`mapDraftEdgeToCanvas` keeps named
 * fields only); the read keeps both.
 */
import { useMemo, useState } from 'react'

import { typo } from '../../styles/typography'
import { CHIP_CLASS } from '../../v5/blocks/chipClass'
import { PANEL_LIST_STACK } from '../conversation/panelLists'
import { useSavedGraphRead } from '../nodes/shared/savedGraph'
import { isProgramGraph } from '../nodes/shared/savedModelProgram'
import { cardMark } from '../nodes/shared/cardMarks'

export const FIGURES_HEADING = 'To work out the chance, Olumi needs:'
/** The composer's placeholder while either list shows. */
export const ASKS_PLACEHOLDER = 'Answer a question above, or tell me what I got wrong'
export const figuresMoreLabel = (n: number): string => `${n} more`

const FIGURES_FOLDED = 3
const COACHING_MAX = 3

export interface ComposerAsks {
  /** Each asked figure's question once, in graph order (the nodes, then the links). */
  readonly figures: readonly { readonly key: string; readonly question: string }[]
  /** At most three of the decision node's coaching questions, in CEE's order. */
  readonly coaching: readonly string[]
}

const NO_ASKS: ComposerAsks = { figures: [], coaching: [] }

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null)
const questionsOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap((q) => (typeof q === 'string' && q.trim() !== '' ? [q.trim()] : [])) : []

/** The two lists from a saved graph; none off a program graph. */
export function composerAsksOf(graph: unknown): ComposerAsks {
  if (!isProgramGraph(graph)) return NO_ASKS
  const g = rec(graph)
  const nodes = (Array.isArray(g?.nodes) ? g.nodes : []).map(rec)
  const edges = (Array.isArray(g?.edges) ? g.edges : []).map(rec)
  const seen = new Set<string>()
  const figures = [...nodes, ...edges].flatMap((el, i) => questionsOf(el?.user_questions).flatMap((question) => {
    if (seen.has(question)) return []
    seen.add(question)
    return [{ key: `${typeof el?.id === 'string' ? el.id : i}:${question}`, question }]
  }))
  const coaching = questionsOf(nodes.find((n) => n?.kind === 'decision')?.coaching_questions).slice(0, COACHING_MAX)
  return figures.length === 0 && coaching.length === 0 ? NO_ASKS : { figures, coaching }
}

/** The lists for the saved model on screen; none until its read answers, and none off a program board. */
export function useComposerAsks(): ComposerAsks {
  const read = useSavedGraphRead()
  const graph = read.status === 'read' ? read.graph : null
  return useMemo(() => composerAsksOf(graph), [graph])
}

export const composerAsksShow = (asks: ComposerAsks): boolean => asks.figures.length > 0 || asks.coaching.length > 0

const AskedIcon = cardMark('source-asked').Icon

export function ComposerAsksPanel({ asks, disabled, onPick, testIdBase }: {
  asks: ComposerAsks
  disabled: boolean
  /** Put this text into the composer and focus it. */
  onPick: (text: string) => void
  testIdBase: string
}) {
  const [allFigures, setAllFigures] = useState(false)
  if (!composerAsksShow(asks)) return null
  const more = asks.figures.length - FIGURES_FOLDED
  const figures = allFigures ? asks.figures : asks.figures.slice(0, FIGURES_FOLDED)
  return (
    <div className="flex flex-col gap-2 px-1 pb-2" data-testid={`${testIdBase}-asks`}>
      {asks.figures.length > 0 && (
        <section aria-label={FIGURES_HEADING} data-testid={`${testIdBase}-figures`}>
          <p className={typo('chatMeta', 'text-text-light mb-1')}>{FIGURES_HEADING}</p>
          <ul className={PANEL_LIST_STACK}>
            {figures.map((f) => (
              <li key={f.key}>
                {/* The question goes in as context: the person types the answer after it. */}
                <button type="button" disabled={disabled} onClick={() => onPick(`${f.question} `)} data-testid={`${testIdBase}-figure`}
                  className={typo('chatBody', 'inline-flex items-start gap-1.5 text-left text-text-body hover:text-info disabled:opacity-40')}>
                  <AskedIcon size={12} aria-hidden="true" className="mt-1 shrink-0 text-text-light" />
                  <span>{f.question}</span>
                </button>
              </li>
            ))}
          </ul>
          {more > 0 && !allFigures && (
            <button type="button" onClick={() => setAllFigures(true)} data-testid={`${testIdBase}-figures-more`}
              className={typo('chatMeta', 'mt-1 text-info hover:opacity-85')}>
              {figuresMoreLabel(more)}
            </button>
          )}
        </section>
      )}
      {asks.coaching.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid={`${testIdBase}-coaching`}>
          {asks.coaching.map((q) => (
            <button key={q} type="button" className={CHIP_CLASS} disabled={disabled} onClick={() => onPick(q)}
              data-testid={`${testIdBase}-coaching-question`}>
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
