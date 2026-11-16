/**
 * "Your kept ideas" in the Olumi panel (V12 Solo-Return): each idea the scenario holds, with where it came from, from the stored idea itself:
 * "Olumi's idea, from <the question it answered>" (the question is core's own menu words) and who kept it ("kept by you", or the person's name as
 * core gives it). Nothing is drawn with no ideas. The two provenance phrases are the board's fixed chrome; the idea's words are core's.
 */
import { Lightbulb } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useViewStore } from '../../store'
import { ideaMethodOf, keptIdeasOf, type KeptIdea } from '../ideas'
import type { View } from '../../client'

export const KEPT_IDEAS_HEADING = 'Your kept ideas'
export const olumisIdea = (method: string | null): string => (method === null ? 'Olumi’s idea' : `Olumi’s idea, from ${method}`)

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
    <section aria-label={KEPT_IDEAS_HEADING} className={`${typography.viewPanelBody} space-y-2`} data-testid="view-kept-ideas">
      <p className={`${typography.viewPanelHeading} text-text-header`}>{KEPT_IDEAS_HEADING}</p>
      <ul className="m-0 list-none space-y-2 p-0">
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
    </section>
  )
}
