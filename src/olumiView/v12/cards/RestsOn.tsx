/**
 * What a card rests on (core's `premises[]`: its assumptions and conditions, core's glyph and words, core's source on hover), on the Simple face
 * (Codex 019, 18:19Z: a qualitative brief's two explicit assumptions were held on the aim and absent from the default canvas). One small
 * disclosure, "Rests on N", drawn on a qualitative model (no option, no figure: the assumptions ARE the picture) and open there; a model with
 * figures keeps them in the Rests on lens and the selected card's explanation (no extra line on every card). Olumi's premises carry Olumi's
 * mark. Nothing is reworded, reordered or dropped.
 */
import { controls } from '../../../styles/controls'
import { useState } from 'react'
import { FoldChevron } from '../../look/FoldChevron'
import { Hover } from '../../look/Hover'
import type { ViewCard } from '../../client'
import { typography } from '../../../styles/typography'
import { OlumiMark } from './marks'

export const RESTS_ON = (n: number): string => `Rests on ${n}`

export function RestsOn({ card, open: initial }: { card: ViewCard; open: boolean }): JSX.Element | null {
  const premises = card.premises ?? []
  const [open, setOpen] = useState(initial)
  if (premises.length === 0) return null
  return (
    <div className="nodrag grid min-w-0 gap-1" data-rests-on-card={card.id}>
      <button type="button" aria-expanded={open} data-testid={`rests-on-${card.id}`} onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={`${controls.chipText} inline-flex items-center gap-1 text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
        {RESTS_ON(premises.length)}<FoldChevron open={open} />
      </button>
      {open ? (
        <ul className="m-0 grid list-none gap-1 p-0" data-testid={`rests-on-${card.id}-list`}>
          {premises.map((p, i) => (
            <Hover as="li" key={p.id ?? i} words={p.title} className={`${typography.viewLabel} flex items-start gap-1 text-text-body`} data-view={`${card.id}.premises.${i}.text`}>
              {p.olumi != null ? <OlumiMark words={p.olumi.title} /> : <span aria-hidden="true" className="text-text-light">{p.glyph}</span>}
              <span className="min-w-0 break-words">{p.text}</span>
            </Hover>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
