import { BODY, META } from '../../../olumiCore/team/ui'
import { FRAME_LABELS, frameIsEmpty, frameOf, frameWordsOf } from './frame'

/** One member's whole view in their own words, as core's View gives it (`frame`, headed by `frame_words`). Nothing is added, ranked or reworded. */
export function FrameLines({ at, v }: { at: string; v: unknown }): JSX.Element | null {
  const f = frameOf(v)
  if (f === null || frameIsEmpty(f)) return null
  const w = frameWordsOf(v)
  const head = (k: keyof typeof FRAME_LABELS) => w[k] ?? FRAME_LABELS[k]
  const options = f.options ?? [], links = f.links ?? []
  return (
    <div className="grid gap-1" data-testid={`${at}-frame`}>
      {(f.question ?? '') !== '' && <p className={BODY} data-frame-part="question"><span className="text-text-header">{head('question')}</span>: {f.question}</p>}
      {(f.aim ?? '') !== '' && <p className={BODY} data-frame-part="aim"><span className="text-text-header">{head('aim')}</span>: {f.aim}</p>}
      {options.length > 0 && (
        <div data-frame-part="options"><p className={META}>{head('options')}</p>
          <ul className="m-0 grid list-none gap-0.5 p-0">{options.map((o, i) => <li key={i} className={`${BODY} break-words`}>{o}</li>)}</ul></div>
      )}
      {links.length > 0 && (
        <div data-frame-part="links"><p className={META}>{head('links')}</p>
          <ul className="m-0 grid list-none gap-0.5 p-0">{links.map((l, i) => <li key={i} className={`${BODY} break-words`}><span className="text-text-header">{l.from_label} to {l.to_label}</span>: {l.words}</li>)}</ul></div>
      )}
    </div>
  )
}
