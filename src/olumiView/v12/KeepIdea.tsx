/**
 * "Keep as an idea" under an Olumi method reply (V12 Create). A small quiet action that calls `keepIdea` (ideas.ts). The words kept are Olumi's, and
 * the item stays Olumi's: the button's hover and its receipt say so. A refusal is core's own sentence; nothing is kept on a failure.
 */
import { useState } from 'react'
import { OkIconButton } from '../look/icons'
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
      {/* The icon reveals on its item's hover or focus (olumiLook.css `.ok-keep-inline`); its words come through the one Tip. */}
      <span className="ok-keep-inline" data-said={state.s === 'said' ? '' : undefined}>
        <OkIconButton id="idea-keep" tone="ghost" size={14} words={KEEP_IDEA} hover={past ? PAST_VERSION : KEEP_IDEA_HOVER} disabled={state.s === 'busy' || past} testid="view-keep-idea-button" onClick={() => void go()} />
      </span>
      {state.s === 'said' ? <span role="alert" className={`${typography.viewPanelMeta} text-text-body`} data-testid="view-keep-idea-said">{state.said}</span> : null}
    </span>
  )
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="view-keep-idea">
      {/* v10 review item 6: an icon in the reply's one row; its words are the name and, through the one Tip, the hover. */}
      <OkIconButton id="idea-keep" tone="ghost" size={14} words={KEEP_IDEA} hover={past ? PAST_VERSION : KEEP_IDEA_HOVER} disabled={state.s === 'busy' || past} testid="view-keep-idea-button" onClick={() => void go()} />
      {state.s === 'said' ? <span role="alert" className={`${typography.viewPanelMeta} text-text-body`} data-testid="view-keep-idea-said">{state.said}</span> : null}
    </div>
  )
}
