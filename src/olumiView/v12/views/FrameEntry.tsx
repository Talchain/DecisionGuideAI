import { useState } from 'react'
import { Button } from '../../../components/ui/Button'
import type { View } from '../../client'
import { TeamApiError } from '../../../olumiCore/team/api'
import { useDraft } from '../../../olumiCore/team/drafts'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from '../../../olumiCore/team/writes'
import { Lock } from 'lucide-react'
import { BODY, CARD, FIELD, META } from '../../../olumiCore/team/ui'
import { nonEmpty } from '../../tipping'
import { useViewStore } from '../../store'
import { EMPTY_FRAME, FRAME_LABELS, frameBody, frameIsEmpty, frameOf, frameSupport, giveFrameView, type FrameDraft } from './frame'
import { FrameLines } from './FrameLines'

/**
 * "My whole view, in words": a private view with the question as the member sees it, their aim or measure, up to 5 options and up to 5
 * links, all in their own words. It is posted as the additive `frame` on the same `POST …/views` as a plain view, against the current version,
 * and stays private to them until a reveal. A part they leave blank is not sent: silence is "not expressed", never agreement. Core's refusals
 * are drawn as core words them. Folded away until asked for, so the plain private-view box stays the one thing on screen.
 */
/** Said only when the saved View comes back with no frame: honest, and nothing typed is lost. Chrome words, nothing about the scenario. */
export const NOT_KEPT = 'Your words were saved, but this version of Olumi did not keep the parts. What you typed is still here.'

/** Sprint-MyView board, fixed chrome (not about the scenario). */
export const MYVIEW_WORDS = {
  heading: 'Your view, private until revealed', options: 'Options you would consider (up to 5)', fromModel: 'From the shared model',
  note: 'Private until everyone has added theirs, then revealed together.', asks: 'Olumi asks', askOnly: 'Only you see this until the reveal',
} as const

/** The shared model's own option titles (live options of the version on screen), offered as editable suggestions; never anyone's view. */
export const optionSuggestions = (view: View, max: number): string[] =>
  (view.model?.cards ?? []).filter((c) => c.family === 'option' && c.status === null && c.heading.trim() !== '').map((c) => c.heading).slice(0, max)

export function FrameEntry({ sid, view, onWrote, defaultOpen = false }: { sid: string; view: View; onWrote: () => Promise<boolean>; defaultOpen?: boolean }): JSX.Element | null {
  const key = `${sid}:viewframe`                  // its own write key, so a frame give never attaches to the plain view's in-flight write
  const [text, setText, dropText] = useDraft(`${sid}:viewframe:text`, '')
  const [d, setD, dropD] = useDraft<FrameDraft>(`${sid}:viewframe`, EMPTY_FRAME)
  const [open, setOpen] = useState(defaultOpen)
  const [ask, setAsk] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useWriteLocked(key), sending = useWriteSending(key)
  const plainSending = useWriteSending(`${sid}:view`)   // still one view write at a time: the plain box's write holds this one
  const version = view.version?.n ?? null
  // Core only reads a frame when it sends `collab.frame_words`; for any other core a frame would be dropped without a word, so none is offered.
  const support = frameSupport(view)
  // A frame is about a version of the model; with none yet, there is nothing to hold a whole view against.
  if (version === null || support === null) return null
  const { words, limits: LIM } = support
  const head = (k: 'question' | 'aim' | 'options' | 'links') => words[k] ?? FRAME_LABELS[k]
  const held = busy || sending || locked || plainSending
  // Option rows: the person's own once they have touched them, else the shared model's option titles as suggestions they can edit or clear.
  const suggested = optionSuggestions(view, LIM.options)
  const rows = d.options.length > 0 ? d.options : suggested
  // The suggestions alone are not a view: a part the person wrote (or reworded) is what makes this a whole view. Silence is not agreement: an
  // option row still exactly the shared model's own title is never sent as this person's position; only rows they typed or reworded go.
  const own = rows.filter((o) => !suggested.includes(o))
  const frame = frameBody(d, LIM) === null ? null : frameBody({ ...d, options: own }, LIM)
  const set = (p: Partial<FrameDraft>) => { setD({ ...d, options: rows, ...p }); if (error) setError(null) }
  // Olumi's own question (core's words) has its own private box; what is typed there goes with the view's words, private until the reveal.
  const prompt = view.collab.private_view_prompt
  const asking = nonEmpty(prompt)
  const words_ = [text.trim(), ask.trim()].filter((t) => t !== '').join('\n\n')
  const give = async () => {
    if (frame === null) return
    setBusy(true); setError(null)
    try {
      const saved = await runWrite(key, { op: true }, { text: words_, version, frame }, (op) => giveFrameView(sid, words_, version, frame, op))
      await onWrote()
      // Kept only once core's own View shows the frame back: a 201 with no frame on the View means this core did not keep it, and what was typed stays.
      const mine = useViewStore.getState().view?.collab.mine
      if (mine !== undefined && !mine.some((v) => v.id === saved.contribution && !frameIsEmpty(frameOf(v)))) { setError(NOT_KEPT); return }
      dropText(); dropD(); setAsk(''); setOpen(false)
    } catch (e) { setError(e instanceof TeamApiError ? e.message : view.team_words.failed) } finally { setBusy(false) }
  }
  if (!open) {
    return <button type="button" data-testid="frame-open" onClick={() => setOpen(true)}
      className={`${META} inline-flex min-h-[24px] cursor-pointer items-center self-start underline underline-offset-2 hover:text-text-body`}>{words.heading ?? 'Say my whole view in my own words'}</button>
  }
  const L = ({ t, children }: { t: string; children: JSX.Element | JSX.Element[] }) => <label className={`${META} grid gap-0.5`}><span className="text-text-header">{t}</span>{children}</label>
  return (
    <div className="grid gap-2" data-testid="frame-entry">
      <h3 className={`${BODY} font-medium text-text-header`} data-testid="frame-heading">{MYVIEW_WORDS.heading}</h3>
      <L t={view.collab.placeholder}>
        <textarea data-testid="frame-text" className={`${FIELD} min-h-[56px]`} value={text} disabled={held} onChange={(e) => { setText(e.target.value); if (error) setError(null) }} />
      </L>
      <L t={head('question')}><textarea data-testid="frame-question" className={`${FIELD} min-h-[56px]`} maxLength={LIM.question} value={d.question} disabled={held} onChange={(e) => set({ question: e.target.value })} /></L>
      <L t={head('aim')}><textarea data-testid="frame-aim" className={`${FIELD} min-h-[56px]`} maxLength={LIM.aim} value={d.aim} disabled={held} onChange={(e) => set({ aim: e.target.value })} /></L>
      <div className="grid gap-1" data-testid="frame-options">
        <span className={`${META} text-text-header`}>{words.options ?? MYVIEW_WORDS.options}</span>
        {rows.map((o, i) => (
          <div key={i} className="grid gap-0.5">
            <input type="text" aria-label={`${head('options')} ${i + 1}`} data-testid={`frame-option-${i}`} className={FIELD} maxLength={LIM.option} value={o} disabled={held}
              onChange={(e) => set({ options: rows.map((x, j) => (j === i ? e.target.value : x)) })} />
            {/* Marked while it is still the shared model's own title; once reworded it is the person's own. */}
            {suggested.includes(o) && <span className={META} data-testid={`frame-option-${i}-from-model`}>{MYVIEW_WORDS.fromModel}</span>}
          </div>
        ))}
        {rows.length < LIM.options && <div><Button size="sm" variant="secondary" data-testid="frame-option-add" disabled={held} onClick={() => set({ options: [...rows, ''] })}>Add an option</Button></div>}
      </div>
      <div className="grid gap-1.5" data-testid="frame-links">
        <span className={`${META} text-text-header`}>{head('links')}</span>
        {d.links.map((l, i) => {
          const at = (p: Partial<FrameDraft['links'][number]>) => set({ links: d.links.map((x, j) => (j === i ? { ...x, ...p } : x)) })
          return (
            <div key={i} className="grid gap-1" data-testid={`frame-link-${i}`}>
              <input type="text" aria-label="From" placeholder="From" data-testid={`frame-link-${i}-from`} className={FIELD} value={l.from_label} disabled={held} onChange={(e) => at({ from_label: e.target.value })} />
              <input type="text" aria-label="To" placeholder="To" data-testid={`frame-link-${i}-to`} className={FIELD} value={l.to_label} disabled={held} onChange={(e) => at({ to_label: e.target.value })} />
              <input type="text" aria-label="In your words" placeholder="In your words" data-testid={`frame-link-${i}-words`} className={FIELD} maxLength={LIM.link_words} value={l.words} disabled={held} onChange={(e) => at({ words: e.target.value })} />
            </div>
          )
        })}
        {d.links.length < LIM.links && <div><Button size="sm" variant="secondary" data-testid="frame-link-add" disabled={held} onClick={() => set({ links: [...d.links, { from_label: '', to_label: '', words: '' }] })}>Add a link</Button></div>}
      </div>
      {asking && (
        <div className={CARD} data-testid="frame-olumi-asks">
          <p className={`${META} text-text-header`}><span data-testid="frame-olumi-asks-label">{MYVIEW_WORDS.asks}</span>: <span data-testid="frame-olumi-asks-prompt">{prompt}</span></p>
          <textarea aria-label={prompt ?? MYVIEW_WORDS.asks} data-testid="frame-olumi-ask" className={`${FIELD} min-h-[56px]`} value={ask} disabled={held} onChange={(e) => { setAsk(e.target.value); if (error) setError(null) }} />
          <p className={`${META} flex items-center gap-1.5`} data-testid="frame-olumi-ask-private"><Lock aria-hidden="true" className="h-3 w-3 flex-none" />{MYVIEW_WORDS.askOnly}</p>
        </div>
      )}
      {words.note && <p className={META} data-testid="frame-note">{words.note}</p>}
      <p className={`${META} flex items-center gap-1.5`} data-testid="frame-private-note"><Lock aria-hidden="true" className="h-3 w-3 flex-none" />{MYVIEW_WORDS.note}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" data-testid="frame-give" disabled={held || words_ === '' || frame === null} onClick={() => void give()}>{view.team_words.views.give}</Button>
        <button type="button" data-testid="frame-close" disabled={held} onClick={() => setOpen(false)} className={`${META} inline-flex min-h-[24px] cursor-pointer items-center underline underline-offset-2 hover:text-text-body`}>Close</button>
        {!held && (words_ === '' ? <span className={META} data-testid="frame-give-why">Write your view first</span> : frame === null ? <span className={META} data-testid="frame-give-why">Say at least one part in your own words</span> : null)}
      </div>
      {locked ? <p role="alert" data-testid="frame-error" className="text-danger m-0">{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="frame-error" className="text-danger m-0">{error}</p>}
    </div>
  )
}

/** The member's own private views' frames (`collab.mine[].frame`), drawn as core gives them, marked private. Only ever this viewer's own. */
export function MyFrames({ view }: { view: View }): JSX.Element | null {
  const mine = view.collab.mine.filter((v) => !frameIsEmpty(frameOf(v)))
  if (mine.length === 0) return null
  return (
    <div className="grid gap-1.5" data-testid="frame-mine">
      {mine.map((v) => (
        <div key={v.id} className="grid gap-1" data-testid={`frame-mine-${v.id}`}>
          <p className={META}>{view.team_words.views.private}</p>
          <FrameLines at={`frame-mine-${v.id}`} v={v} />
        </div>
      ))}
    </div>
  )
}
