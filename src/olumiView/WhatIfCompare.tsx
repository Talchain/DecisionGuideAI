/**
 * A what-if's result beside the saved model: each option's saved lines and its what-if lines, in core's row shape, drawn by the dock's own
 * `Row`. Shared by the What if lens's key card (ViewWhatIfKey.tsx) and V11's "Try <person>'s figure" in the dock (RevealDock.tsx); its
 * own module so the dock does not pull the canvas's overlay code into its import closure.
 */
import { useState } from 'react'
import { typography } from '../styles/typography'
import { WHAT_IF_COPY } from '../canvas/artefacts/whatIfCopy'
import type { ViewModel, ViewRow } from './client'
import { optionCards } from './layout'
import { Row } from './ViewChances'
import type { useWhatIf } from './whatif'

/** Each option's saved lines beside the copy's, under the option's heading from this View; core's words for why it did or did not move. */
export function Compare({ model, shown }: { model: ViewModel; shown: NonNullable<ReturnType<typeof useWhatIf.getState>['shown']> }) {
  const v = shown.variant, tried = new Map(v.rows.map((o) => [o.option_id, o.rows]))
  if (v.stopped !== null) return <p data-view="whatif.stopped">{v.stopped}</p>
  if (v.blocked !== null) return <p title={v.blocked} data-testid="view-whatif-key-blocked">{WHAT_IF_COPY.refused}</p>
  return (
    <div className="space-y-2" data-testid="view-whatif-key-compare">
      {v.moved || v.why_not === null ? null : <p className={typography.viewPanelMeta} data-view="whatif.why_not">{v.why_not}</p>}
      {v.most_likely === null ? null : <p title={v.most_likely.title} data-view="whatif.most_likely.text">{v.most_likely.text}</p>}
      {optionCards(model).map((card) => {
        const rows = tried.get(card.id)
        return rows === undefined ? null : (
          <div key={card.id} data-whatif-key-option={card.id}>
            <p className={`${typography.panelHeader} text-text-header`}>{card.heading}</p>
            <div className="flex gap-1"><span className="shrink-0 whitespace-nowrap text-text-light">{WHAT_IF_COPY.saved}: </span><div>{card.rows.map((row, i) => <Row key={i} card={card} row={row} i={i} />)}</div></div>
            <div className="flex gap-1"><span className="shrink-0 whitespace-nowrap text-text-light">{WHAT_IF_COPY.whatIf}: </span><div>{rows.map((row, i) => <Row key={i} card={{ ...card, id: `whatif.${card.id}` }} row={row} i={i} />)}</div></div>
          </div>
        )
      })}
    </div>
  )
}

type Shown = NonNullable<ReturnType<typeof useWhatIf.getState>['shown']>
type Chance = { readonly aim: string; readonly aimName: string; readonly value: string; readonly title: string }
const chancesOf = (rows: readonly ViewRow[]): Chance[] => rows.flatMap((r) => (r.kind === 'chance' ? [{ aim: r.aim_id, aimName: r.aim, value: r.value, title: r.title }] : []))

/**
 * V11 (change 4, "the option chances preview side by side"): for each aim, each option's saved chance and its chance on the copy, side by
 * side, in core's own words (`rows[].value`, the aim's name from the row). A chance core words differently on the copy is in the heavier
 * weight; nothing is coloured or dimmed. Core's most-likely line for the copy sits above, held to three lines with a way to read it whole.
 */
export function SideBySide({ model, shown }: { model: ViewModel; shown: Shown }): JSX.Element {
  const v = shown.variant
  const [whole, setWhole] = useState(false)
  if (v.stopped !== null) return <p data-view="whatif.stopped">{v.stopped}</p>
  if (v.blocked !== null) return <p title={v.blocked} data-testid="view-whatif-key-blocked">{WHAT_IF_COPY.refused}</p>
  const tried = new Map(v.rows.map((o) => [o.option_id, chancesOf(o.rows)]))
  const options = optionCards(model).filter((c) => tried.has(c.id))
  const aims = [...new Map(options.flatMap((c) => chancesOf(c.rows)).map((x) => [x.aim, x.aimName])).entries()]
  return (
    <div className="grid gap-4" data-testid="whatif-side-by-side">
      {v.moved || v.why_not === null ? null : <p className={typography.viewPanelMeta} data-view="whatif.why_not">{v.why_not}</p>}
      {v.most_likely === null ? null : (
        <div className="grid justify-items-start gap-1">
          <p title={v.most_likely.title} className={whole ? '' : 'line-clamp-3'} data-view="whatif.most_likely.text">{v.most_likely.text}</p>
          <button type="button" aria-expanded={whole} onClick={() => setWhole((w) => !w)} data-testid="whatif-lead-whole"
            className={`${typography.viewPanelMeta} cursor-pointer text-text-light underline underline-offset-2 hover:text-text-body`}>{whole ? 'Show less' : 'Show all'}</button>
        </div>
      )}
      {aims.map(([aim, aimName]) => (
        <div key={aim} className="grid gap-2" data-side-by-side-aim={aim}>
          <div className={`${typography.viewPanelMeta} grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-text-light`}>
            <span>{aimName}</span><span>{WHAT_IF_COPY.saved} → {WHAT_IF_COPY.whatIf}</span>
          </div>
          {options.map((card) => {
            const saved = chancesOf(card.rows).find((x) => x.aim === aim), copy = tried.get(card.id)!.find((x) => x.aim === aim)
            if (saved === undefined || copy === undefined) return null
            const changed = saved.value !== copy.value
            return (
              <div key={card.id} className="grid gap-0.5" data-side-by-side-option={card.id} data-changed={changed || undefined}>
                <p className={`${typography.viewPanelMeta} line-clamp-2 text-text-header`} title={card.heading}>{card.heading}</p>
                <p className={`${typography.viewPanelMeta} tabular-nums ${changed ? 'font-semibold text-text-header' : 'text-text-body'}`}>
                  <span title={saved.title} data-side-by-side-saved="">{saved.value}</span>
                  <span aria-hidden="true"> → </span><span className="sr-only">, {WHAT_IF_COPY.whatIf}: </span>
                  <span title={copy.title} data-side-by-side-copy="">{copy.value}</span>
                </p>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
