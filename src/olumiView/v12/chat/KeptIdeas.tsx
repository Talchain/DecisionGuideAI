/**
 * "Your kept ideas" in the Olumi panel (V12 Solo-Return): each idea the scenario holds, with where it came from, from the stored idea itself:
 * "Olumi's idea, from <the question it answered>" (the question is core's own menu words) and who kept it ("kept by you", or the person's name as
 * core gives it). Nothing is drawn with no ideas. The two provenance phrases are the board's fixed chrome; the idea's words are core's.
 *
 * sx-panel (PANEL-SPEC 3, Codex 00:38:37Z): the Simple canvas draws each kept idea as its own card, so at rest the panel shows only the count, as
 * a closed disclosure; a press opens every idea, readable, with its provenance. It is never only a pointer: Detailed draws no idea cards
 * (canvas.ts extras), so the words must stay reachable here.
 */
import { Lightbulb } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useViewStore } from '../../store'
import { ideaMethodOf, keptIdeasOf, type KeptIdea } from '../ideas'
import type { View } from '../../client'

export const KEPT_IDEAS_HEADING = 'Your kept ideas'
export const olumisIdea = (method: string | null): string => (method === null ? 'Olumi’s idea' : `Olumi’s idea, from ${method}`)
/** The closed disclosure's line: a count before a list (contract §2). */
export const keptIdeasWords = (n: number): string => `${KEPT_IDEAS_HEADING} · ${n}`

/** The provenance lines of one idea: whose idea it is and where from, then who kept it. */
export function provenanceOf(view: View, idea: KeptIdea): string[] {
  const keeper = idea.keptBy === null ? null : idea.keptBy.id === view.you_id ? 'kept by you' : `kept by ${idea.keptBy.name}`
  return [...(idea.olumis ? [olumisIdea(ideaMethodOf(view, idea))] : []), ...(keeper === null ? [] : [keeper])]
}

export function KeptIdeas(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const ideas = keptIdeasOf(view)
  if (view === null || ideas.length === 0) return null
  return (
    <details aria-label={KEPT_IDEAS_HEADING} className={typography.viewPanelBody} data-testid="view-kept-ideas">
      <summary className={`${typography.viewPanelHeading} inline-flex min-h-[24px] cursor-pointer items-center gap-1.5 text-text-header`} data-testid="view-kept-ideas-summary">
        <Lightbulb className="h-3.5 w-3.5 flex-none text-text-light" strokeWidth={1.75} aria-hidden="true" />{keptIdeasWords(ideas.length)}
      </summary>
      <ul className="m-0 mt-2 list-none space-y-2 p-0">
        {ideas.map((i) => (
          <li key={i.id} className="flex items-start gap-1.5" data-testid="view-kept-idea" data-idea={i.id}>
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-none text-text-light" strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p data-testid="view-kept-idea-text">{i.text}</p>
              <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="view-kept-idea-from">{provenanceOf(view, i).join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}
