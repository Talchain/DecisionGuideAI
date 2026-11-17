/**
 * "Keep as an idea" under an Olumi method reply (V12 Create). A small quiet action that calls `keepIdea` (ideas.ts). The words kept are Olumi's, and
 * the item stays Olumi's: the button's hover and its receipt say so. A refusal is core's own sentence; nothing is kept on a failure.
 */
import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TeamApiError } from '../../olumiCore/team/api'
import { useViewStore } from '../store'
import { isKept, keepIdea, PAST_VERSION } from './ideas'

export const KEEP_IDEA = 'Keep as an idea'
export const KEEP_IDEA_HOVER = 'Keeps this idea on your scenario. It is recorded as Olumi’s, kept by you.'
export const KEPT_IDEA = 'Kept. It stays Olumi’s idea.'

/** `inline`: beside one list item, as a small icon at the end of its line, shown on that item's hover or keyboard focus (DS: action icons on hover or
 *  focus; always shown where there is no hover). Paul, 16 Nov: a "Keep as an idea" row under every bullet was noise. Otherwise its own quiet row. */
export function KeepIdea({ sid, turn, text, inline = false, floor = false }: { sid: string; turn: number; text: string; inline?: boolean; /** `turn` is a floor reply's job (words-start CONTRACT 4). */ floor?: boolean }) {
  const [state, setState] = useState<{ s: 'idle' | 'busy' | 'kept' } | { s: 'said'; said: string }>({ s: 'idle' })
  const past = useViewStore((st) => st.at !== null)
  // Kept already (this press, or an earlier one the View holds): "Kept", never a second button for the same words from the same reply.
  const held = useViewStore((st) => isKept(st.view, turn, text))
  const go = async () => {
    setState({ s: 'busy' })
    try {
      await keepIdea({ sid, turn, text, floor })
      setState({ s: 'kept' })
      void useViewStore.getState().refresh()
    } catch (e) {
      setState({ s: 'said', said: e instanceof TeamApiError || e instanceof Error ? e.message : 'That did not go through. Nothing was kept.' })
    }
  }
  if (state.s === 'kept' || held) return inline
    ? <span role="status" className={`${typography.viewPanelMeta} ml-1 text-text-light`} data-testid="view-keep-idea-kept">{KEPT_IDEA}</span>
    : <p role="status" className={`${typography.viewPanelMeta} text-text-light`} data-testid="view-keep-idea-kept">{KEPT_IDEA}</p>
  if (inline) return (
    <span className="ml-1 inline-flex items-center gap-1 align-middle" data-testid="view-keep-idea">
      <button type="button" disabled={state.s === 'busy' || past} onClick={() => void go()} title={past ? PAST_VERSION : KEEP_IDEA_HOVER} aria-label={KEEP_IDEA} data-testid="view-keep-idea-button"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-text-light opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:cursor-not-allowed ${state.s === 'said' ? 'opacity-100' : ''}`}>
        <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>
      {state.s === 'said' ? <span role="alert" className={`${typography.viewPanelMeta} text-text-body`} data-testid="view-keep-idea-said">{state.said}</span> : null}
    </span>
  )
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="view-keep-idea">
      <button type="button" disabled={state.s === 'busy' || past} onClick={() => void go()} title={past ? PAST_VERSION : KEEP_IDEA_HOVER} data-testid="view-keep-idea-button"
        className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed`}>
        <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />{KEEP_IDEA}
      </button>
      {state.s === 'said' ? <span role="alert" className={`${typography.viewPanelMeta} text-text-body`} data-testid="view-keep-idea-said">{state.said}</span> : null}
    </div>
  )
}
