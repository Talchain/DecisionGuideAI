/**
 * THE FIGURE PART OF THE OLDER LOOK'S INSPECTOR (Funding-Assumption board, proposed; the lane's one box draws `WhatItMoves` and its Value row itself): a slot for the figure's range chart, "What it moves", the person's own
 * figure and the two actions. Every word about the scenario is the View's; the chrome is the board's named labels. Olumi's estimate stays marked
 * as Olumi's, and the person's figure goes through the one set-figure path (`setFigure`), never a write of its own.
 */
import { controls } from '../../../styles/controls'
import type { CSSProperties } from 'react'
import { useState, type ReactNode } from 'react'
import { typography } from '../../../styles/typography'
import { Hover } from '../../look/Hover'
import { TeamApiError } from '../../../olumiCore/team/api'
import { isForThisPage, useMe } from '../../../olumiCore/me'
import type { ViewCard } from '../../client'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { SAVED_NOT_SHOWN, setFigure } from '../../FigureEdit'
import { triableCards } from '../../layout'
import { useViewStore } from '../../store'
import { useLaneInspector } from '../edit/inspectorStore'
import { figureRange, type FigureRange } from '../contract'
import { isSizeEdit } from '../edit/EditForm'
import { isOlumis } from '../lenses/layers'
import { openWhatIf } from './whatIfFocus'
import { movesOf } from './whatItMoves'
import { sampledChanceWords } from '../scale/chanceWords'

export const INSPECTOR_WORDS = {
  moves: 'What it moves', now: 'now', ifHigh: 'if high', ifLow: 'if low', yourFigure: 'Your figure', changeOlumi: "Change to your figure (was Olumi's estimate)",
  change: 'Change figure', ask: 'Ask Olumi', whatIf: 'What if', moved: 'Saved.',
} as const

const bar = 'h-1.5 rounded-full bg-option'
function Bar({ label, p }: { label: string; p: number }): JSX.Element {
  return (
    <div className="flex items-center gap-2" data-moves-bar={label}>
      <span className="w-12 flex-none text-text-light">{label}</span>
      <span className="relative h-1.5 flex-1 rounded-full bg-panel-border" aria-hidden="true"><span className={`absolute left-0 top-0 w-[var(--chart-width)] ${bar}`} style={{ '--chart-width': `${Math.max(0, Math.min(100, p * 100))}%` } as CSSProperties} /></span>
      <span className={`${typography.viewPanelTabular} w-20 flex-none text-right text-text-header`}>{sampledChanceWords(p)}</span>
    </div>
  )
}

export function WhatItMoves({ figure }: { figure: string }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const rows = model === null ? [] : movesOf(model, figure)
  if (rows.length === 0) return null
  return (
    <section aria-label={INSPECTOR_WORDS.moves} data-testid="inspector-moves" className="space-y-3">
      <h3 className={`${typography.viewPanelMeta} font-medium text-text-header`}>{INSPECTOR_WORDS.moves}</h3>
      {rows.map((r) => (
        <div key={r.id} data-moves-option={r.id} className="space-y-2">
          <p className="text-text-header">{r.option}</p>
          {r.high !== null && r.low !== null ? (
            <>{r.now === null ? null : <Bar label={INSPECTOR_WORDS.now} p={r.now} />}<Bar label={INSPECTOR_WORDS.ifHigh} p={r.high} /><Bar label={INSPECTOR_WORDS.ifLow} p={r.low} /></>
          ) : <p className={`${typography.viewPanelMeta} text-text-body`} data-testid="inspector-moves-words">{r.words}</p>}
        </div>
      ))}
    </section>
  )
}

/** The person's own figure: core's prompt labels the field, and what they type goes to core as typed. Offered only where core offers a plain figure edit. */
export function YourFigure({ card }: { card: ViewCard }): JSX.Element | null {
  const lane = isOlumiCoreLane()
  const sid = useViewStore((s) => s.sid), view = useViewStore((s) => s.view), me = useMe((s) => s.me)
  // The typed figure is kept in the one surface store while the panel is open or another surface takes its place, until it saves.
  const draftKey = `${sid}:inspector-figure:${card.id}`
  const [typed, setTypedNow] = useState(() => useLaneInspector.getState().drafts[draftKey]?.['typed'] ?? '')
  const setTyped = (x: string) => { setTypedNow(x); if (x === '') useLaneInspector.getState().forgetDraft(draftKey); else useLaneInspector.getState().setDraft(draftKey, { typed: x }) }
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const edit = card.figure?.edit ?? null
  const base = view?.model?.edit_base ?? null
  if (edit === null || isSizeEdit(edit) || sid === null || view === null || !isForThisPage(view, me)) return null
  const save = async () => {
    if (typed.trim() === '' || busy || base === null) return
    setBusy(true); setNote(null)
    try {
      const shown = await setFigure(sid, base, card.id, typed)
      setNote(shown ? { ok: true, text: INSPECTOR_WORDS.moved } : { ok: false, text: SAVED_NOT_SHOWN })
      if (shown) setTyped('')
    } catch (e) {
      setNote({ ok: false, text: e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.' })
    } finally { setBusy(false) }
  }
  return (
    <form className="grid gap-2" data-testid="inspector-your-figure" onSubmit={(e) => { e.preventDefault(); void save() }} onKeyDown={(e) => { if (e.key !== 'Escape') e.stopPropagation() }}>
      <Hover as="label" focusable={false} {...{ htmlFor: `inspector-figure-${card.id}` }} className={`${typography.viewPanelMeta} font-medium text-text-header`} words={edit.ask}>{INSPECTOR_WORDS.yourFigure}: {edit.prompt}</Hover>
      <input id={`inspector-figure-${card.id}`} data-testid="inspector-figure-typed" autoComplete="off" spellCheck={false} value={typed} disabled={busy}
        onChange={(e) => { setTyped(e.target.value); if (note !== null) setNote(null) }}
        className={`rounded-sm border border-field bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 ${lane ? 'focus-visible:ring-text-header' : 'focus-visible:ring-info/50'}`} />
      {note === null ? null : <p role={note.ok ? 'status' : 'alert'} data-testid="inspector-figure-note" className={`${typography.viewPanelMeta} ${note.ok ? 'text-text-body' : lane ? 'text-warning-ink' : 'text-danger'}`}>{note.text}</p>}
      {/* Drawn once the field has text: a Set beside an empty field read as a greyed second input (audit canvas-details-change-figure-twice-and-looks-disabled). Enter still saves. */}
      {typed.trim() === '' ? null : (
        <button type="submit" data-testid="inspector-figure-set" disabled={busy || base === null}
          className={`${lane ? controls.chipText : `${typography.viewPanelMeta} min-h-[32px] rounded-sm px-2`} cursor-pointer border border-panel-border text-left text-text-body hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-50`}>
          {isOlumis(card) ? INSPECTOR_WORDS.changeOlumi : INSPECTOR_WORDS.change}</button>
      )}
    </form>
  )
}

/**
 * `range` is the slot for the range chart (the scale lane's RangeBar): it is called with the card and its range in numbers, and only when the View
 * holds one. `onAsk` is the card's existing ask action; `onClose` runs after "What if" has opened.
 */
export function FigureInspector({ card, range, onAsk, onClose }: { card: ViewCard; range?: (card: ViewCard, r: FigureRange) => ReactNode; onAsk?: (() => void) | null; onClose?: () => void }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  if (model === null || card.figure === null) return null
  const r = figureRange(card)
  const canTry = triableCards(model).some((c) => c.id === card.id)
  const btn = `${isOlumiCoreLane() ? controls.chipText : `${typography.viewPanelMeta} min-h-[32px] rounded-sm px-2`} cursor-pointer border border-panel-border text-text-body hover:bg-panel-hover`
  return (
    <div className="space-y-3" data-testid="inspector-figure">
      {range === undefined || r === null ? null : <div data-testid="inspector-range">{range(card, r)}</div>}
      <WhatItMoves figure={card.id} />
      {/* The older look's own figure field. (The lane's box draws its Value row itself: v12/edit/LaneInspector.) */}
      <YourFigure key={card.id} card={card} />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Ask or try">
        {/* A control that cannot act is not drawn (a worked-out figure has no What if: triableCards leaves it out), never drawn dimmed with no reason. */}
        {onAsk == null ? null : <button type="button" data-testid="inspector-ask" onClick={() => onAsk()} className={btn}>{INSPECTOR_WORDS.ask}</button>}
        {!canTry ? null : <button type="button" data-testid="inspector-what-if" onClick={() => { openWhatIf(card.id); onClose?.() }} className={btn}>{INSPECTOR_WORDS.whatIf}</button>}
      </div>
    </div>
  )
}
