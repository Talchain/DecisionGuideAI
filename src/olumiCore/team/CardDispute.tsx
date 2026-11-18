/**
 * WHERE YOU DIFFER, ON THE CARD IT IS ABOUT (experience review 18 Nov, job 4 and change 5). After two people reveal their views, core's
 * `GET …/differences` names, for a figure, the card it is about (`record`, also `cards`). That card carries one small mark; pressing it
 * opens the card's details with the difference said in core's words, so a team sees WHERE it differs, WHETHER that changes what the model
 * implies, and what would settle it, with each person's view kept apart, never merged and never chosen between:
 * - the mark: the registry's one icon; its name and hover are core's sentence for what the difference does (`status_text`);
 * - the details: core's sentence, each person's figure (`sides[].text`), each person's chance for each option (`options[].chances[].text`,
 *   as given; a chance a person's version withholds says core's words, its reason on hover) and what would settle it (`settle[].text`).
 * Surfaces step A: it is one section of the card's one box. The preview says the mark and core's sentence on one line, nothing to press; pinned, that
 * sentence is a fold's own row (open when the mark opened the details) over each person's figure, chance and what would settle it.
 * A difference core has not run (`not_run`, `pending`) says core's sentence alone: no figure and no chance is drawn for it.
 * Links and factors are CardDiffers' chips; the Team tab is unchanged. Nothing is composed here beyond naming whose chance a line is.
 */
import { ICONS, OkIcon } from '../../olumiView/look/icons'
import { useLaneInspector } from '../../olumiView/v12/edit/inspectorStore'
import { typography } from '../../styles/typography'
import { FOLD_SUMMARY, FoldChevron } from '../../olumiView/look/FoldChevron'
import { useRevealedDifferences } from './CardDiffers'
import type { Difference } from './differences'

const NONE: readonly Difference[] = []
/** A difference core did not run says its sentence only. */
const sayOnly = (d: Difference): boolean => d.status === 'not_run' || d.status === 'pending'

/** The revealed differences of figure kind whose record is this card, in core's order (one per aim). */
export function useFigureDiffers(card: string): readonly Difference[] {
  const data = useRevealedDifferences()
  if (data === null) return NONE
  const own = data.differences.filter((d) => (d.kind ?? 'figure') === 'figure' && d.record === card)
  return own.length === 0 ? NONE : own
}

/** The mark on the card a revealed difference is about: pressing it opens the card's details (the one details panel). */
export function CardDisputeMark({ card }: { card: string }): JSX.Element | null {
  const own = useFigureDiffers(card)
  if (own.length === 0) return null
  const words = [...new Set(own.map((d) => d.status_text))].join('\n')
  return (
    <button type="button" aria-label={words} title={words} data-differ-mark={card}
      onClick={(e) => { e.stopPropagation(); useLaneInspector.getState().show({ kind: 'details', target: { kind: 'card', id: card }, section: 'differ' }) }}
      className="nodrag pointer-events-auto inline-grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-panel-border bg-canvas text-text-body transition-colors duration-fast hover:border-text-header">
      <OkIcon id="revealed-difference" size={12} decorative />
    </button>
  )
}

/** "Where you differ", in the card's details: core's words for each aim the difference was run for. Nothing when none is about this card. */
export function WhereYouDiffer({ card, peek = false, open = false }: { card: string; /** The box's preview: core's sentence alone, three lines of it at most (it is whole in the pinned box). */ peek?: boolean; /** The difference mark opened these details: the fold starts open. */ open?: boolean }): JSX.Element | null {
  const own = useFigureDiffers(card)
  if (own.length === 0) return null
  const said = [...new Set(own.map((d) => d.status_text))].join(' ')
  const one = own.length === 1
  if (peek) return (
    <p className="m-0 flex items-start gap-1.5 text-text-body" data-testid="lane-differ-line"><OkIcon id="revealed-difference" size={12} decorative className="mt-0.5" /><span className="line-clamp-3 min-w-0 break-words">{said}</span></p>
  )
  return (
    <details open={open} aria-label={ICONS['revealed-difference'].hover} className="space-y-1" data-testid="lane-differ">
      <summary className={`${FOLD_SUMMARY} cursor-pointer items-start text-text-body`}><FoldChevron className="mt-0.5" /><OkIcon id="revealed-difference" size={12} decorative className="mt-0.5" />{one ? <span className="min-w-0 break-words" data-differ-status-text="">{said}</span> : <span className="min-w-0 break-words" data-differ-several="">{ICONS['revealed-difference'].hover}</span>}</summary>
      {own.map((d) => {
        const whose = (id: string) => d.sides.find((s) => s.holder_id === id)?.holder ?? ''
        return (
          <div key={`${d.record}|${d.goal}`} className="space-y-1" data-differ-entry={d.goal} data-differ-status={d.status}>
            {own.length > 1 && d.goal_label !== '' ? <p className={`${typography.viewPanelMeta} text-text-light`}>{d.goal_label}</p> : null}
            {one ? null : <p className="text-text-body" data-differ-status-text="">{d.status_text}</p>}
            {sayOnly(d) ? null : (
              <>
                <ul className="m-0 list-none space-y-0.5 p-0" data-differ-sides="">
                  {d.sides.map((s) => <li key={s.holder_id} className="text-text-body" title={s.title} data-differ-side={s.holder_id}>{s.text}</li>)}
                </ul>
                {d.options.map((o) => (
                  <div key={o.option} data-differ-option={o.option}>
                    <p className={`${typography.viewPanelMeta} text-text-light`}>{o.label}</p>
                    <ul className="m-0 list-none space-y-0.5 p-0">
                      {o.chances.map((c) => (
                        <li key={c.holder_id} className="text-text-body" title={c.withheld?.reason} data-differ-chance={c.holder_id}>
                          {whose(c.holder_id) === '' ? null : <>{whose(c.holder_id)}: </>}<span data-differ-chance-text="">{c.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {d.settle.length === 0 ? null : (
                  <ul className="m-0 list-none space-y-0.5 p-0" data-differ-settle="">
                    {d.settle.map((s, i) => <li key={i} className={`${typography.viewPanelMeta} text-text-light`}>{s.text}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        )
      })}
    </details>
  )
}
