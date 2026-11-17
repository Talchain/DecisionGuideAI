/**
 * An opened kept idea (Codex 008e #2): selecting its card on the canvas shows its full words, where it came from (the reply, and core's menu question
 * where core says so) and who kept it, with two actions, "Develop this idea" and "Challenge this idea". Each puts a question carrying the idea's exact
 * words in the message box for the person to edit and send: nothing is sent here, no route is added, and the kept idea itself is never changed. It
 * works with a model, with a proposal pending and with no model at all. The idea's words and the names are core's; the labels are fixed notation.
 */
import { useCanvasStore } from '../../../canvas/store'
import { typography } from '../../../styles/typography'
import type { View } from '../../client'
import { prefillComposer } from '../../ViewChat'
import { useViewStore } from '../../store'
import { challengeQuestionOf, developQuestionOf, ideaMethodOf, ideaSourceSaidOf, keptIdeasOf, type KeptIdea } from '../ideas'
import { IDEA_PREFIX } from './bands'
import { VIEW_IDEA } from './BandNodes'

export const DEVELOP_IDEA = 'Develop this idea', CHALLENGE_IDEA = 'Challenge this idea', CLOSE_IDEA = 'Close'
/** Said where the message box takes words as a brief (core holds no model and no proposal): the question would start a brief, so the person is told. */

/** What the panel says about an idea, from the View: its source reply, core's menu question where there is one, and who kept it. */
export function ideaDetailOf(view: View, idea: KeptIdea): { source: string | null; method: string | null; keeper: string | null } {
  // Words-start CONTRACT 5: a floor idea's source is the visible floor reply (its job), a chat idea's the chat reply (its id), so it survives a reopen.
  const said = ideaSourceSaidOf(view, idea)
  const source = idea.sourceTurn === null ? null : said === null ? 'From a reply that is not in this conversation' : `From Olumi’s reply to “${said}”`
  const method = ideaMethodOf(view, idea)
  const keeper = idea.keptBy === null ? null : idea.keptBy.id === view.you_id ? 'Kept by you' : `Kept by ${idea.keptBy.name}`
  return { source, method, keeper }
}

export function IdeaPanel(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const nodeId = useCanvasStore((s) => s.nodes.find((n) => n.selected === true && n.type === VIEW_IDEA)?.id ?? null)
  const idea = view === null || nodeId === null ? undefined : keptIdeasOf(view).find((i) => IDEA_PREFIX + i.id === nodeId)
  if (view === null || nodeId === null || idea === undefined) return null
  const { source, method, keeper } = ideaDetailOf(view, idea)
  const ask = 'rounded-lg border border-panel-border px-2 py-1 text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info'
  return (
    <section aria-label="Kept idea" data-testid="view-idea-panel" data-idea={idea.id}
      className={`${typography.viewPanelBody} absolute bottom-16 left-16 z-[1250] max-h-[60%] w-[320px] max-w-[calc(100%-8rem)] space-y-2 overflow-y-auto rounded-md border border-panel-border bg-panel p-3 text-text-body`}>
      <p data-testid="view-idea-panel-text">{idea.text}</p>
      <div className={`${typography.viewPanelMeta} space-y-0.5 text-text-light`}>
        {idea.olumis ? <p data-testid="view-idea-panel-by">Olumi’s idea</p> : null}
        {source === null ? null : <p data-testid="view-idea-panel-source">{source}</p>}
        {method === null ? null : <p data-testid="view-idea-panel-method">{method}</p>}
        {keeper === null ? null : <p data-testid="view-idea-panel-keeper">{keeper}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ask} data-testid="view-idea-develop" onClick={() => prefillComposer(developQuestionOf(idea))}>{DEVELOP_IDEA}</button>
        <button type="button" className={ask} data-testid="view-idea-challenge" onClick={() => prefillComposer(challengeQuestionOf(idea))}>{CHALLENGE_IDEA}</button>
        <button type="button" className={`${ask} ml-auto border-transparent text-text-light`} data-testid="view-idea-close"
          onClick={() => useCanvasStore.getState().onNodesChange([{ type: 'select', id: nodeId, selected: false }])}>{CLOSE_IDEA}</button>
      </div>
    </section>
  )
}
