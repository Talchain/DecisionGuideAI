/**
 * What a result needs (design, 18 Nov): the tab's answer when no option has a chance yet (a qualitative or unsized model, the common case),
 * and, under the chart, what is not in the result yet. A short list in a fixed order of kinds (`needsOf`: what stops a chance, what the
 * chances wait on, a figure no one has given, Olumi's observation on a card), core's order inside each, each row core's own words and ONE
 * press: ✎ where core offers the figure's edit, else the card on the canvas (selected and centred). Five at rest; the rest behind one press.
 */
import { useState } from 'react'
import type { ViewModel } from '../client'
import { FigureEdit } from '../FigureEdit'
import { OkIcon, type IconId } from '../look/icons'
import { FoldChevron } from '../look/FoldChevron'
import { pressCard, ringFrom } from '../reasoning/tabRing'
import { useViewStore } from '../store'
import { recordReach, showRecord } from '../v12/showInWorkspace/show'
import { cardOf, needsOf, type Need } from './pick'
import { TYPE } from './type'
import { typography } from '../../styles/typography'

/** The list's chrome: its two headings (no chance yet / under a chance), and the fold. */
export const NEEDS_WORDS = { none: 'What a result needs', some: 'Not in the result yet', more: (n: number) => `Show ${n} more`, fewer: 'Show fewer' } as const
const ICON_OF: Record<Need['cls'], IconId> = { blocks: 'state-no-chance', waits: 'state-waits', size: 'state-not-sized', worth: 'worth-checking' }
const AT_REST = 5
const RING = 'analysis-needs'

export function ResultNeeds({ model, under = false }: { model: ViewModel; under?: boolean }) {
  const [all, setAll] = useState(false)
  useViewStore((s) => s.view) // the View decides which rows the workspace can show
  const needs = needsOf(model)
  if (needs.length === 0) return null
  // DL / Codex 19 Nov: Olumi's worth-checking findings come last in needsOf, so on a no-chance model with many blockers they were always folded
  // under "Show N more". They are read at rest, after the first AT_REST of the other rows; only those other rows fold.
  const worth = needs.filter((n) => n.cls === 'worth'), rest = needs.filter((n) => n.cls !== 'worth')
  const shown = all ? needs : [...rest.slice(0, AT_REST), ...worth]
  const folded = rest.length - AT_REST
  const title = under ? NEEDS_WORDS.some : NEEDS_WORDS.none
  return (
    <section className="space-y-1" data-testid="analysis-needs" data-needs-under={under ? 'chart' : 'alone'} aria-label={title} onMouseLeave={() => ringFrom(RING, [])}>
      <h3 className={`${typography.viewPanelHeading} m-0 text-text-header`}>{title}</h3>
      <ul className="m-0 list-none p-0">
        {shown.map((n) => {
          const card = cardOf(model, n.card)
          // A relation drawn as a link, a record behind a badge or a fold, a premise: shown as a reply's "Show in the workspace" shows it.
          const place = n.card !== null && recordReach(n.card) === 'show' ? n.card : null
          return (
            <li key={n.key} className={`${TYPE.body} flex items-center gap-1`} data-need={n.key} data-need-class={n.cls}>
              <button type="button" disabled={card === null && place === null} onClick={() => { if (place !== null) void showRecord(place); else if (card !== null) pressCard(card.id) }} onMouseEnter={() => ringFrom(RING, card === null ? [] : [card.id])}
                title={n.title} className="flex min-h-7 min-w-0 flex-1 items-center gap-2 rounded-sm px-1 text-left hover:bg-panel-hover disabled:cursor-default disabled:hover:bg-transparent">
                <OkIcon id={ICON_OF[n.cls]} size={14} decorative />
                <span className="min-w-0 flex-1 text-text-body" {...(n.at === null ? {} : { 'data-view': n.at })}>{n.text}</span>
              </button>
              {n.edit === null || card === null ? null : <FigureEdit id={card.id} edit={n.edit} place="analysis-need" glyph words={false} label={`Give a figure for ${card.heading}`} />}
            </li>
          )
        })}
      </ul>
      {folded <= 0 ? null : (
        <button type="button" onClick={() => setAll((a) => !a)} aria-expanded={all} className={`${TYPE.meta} inline-flex min-h-6 items-center gap-1 px-1 text-text-body hover:text-text-header`} data-testid="analysis-needs-more">
          <FoldChevron open={all} />{all ? NEEDS_WORDS.fewer : NEEDS_WORDS.more(folded)}
        </button>
      )}
    </section>
  )
}
