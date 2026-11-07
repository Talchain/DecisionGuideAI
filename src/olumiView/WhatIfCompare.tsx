/**
 * A what-if's result beside the saved model: each option's saved lines and its what-if lines, in core's row shape, drawn by the dock's own
 * `Row`. Shared by the What if lens's key card (ViewWhatIfKey.tsx) and V11's "Try <person>'s figure" in the dock (RevealDock.tsx); its
 * own module so the dock does not pull the canvas's overlay code into its import closure.
 */
import { typography } from '../styles/typography'
import { WHAT_IF_COPY } from '../canvas/artefacts/whatIfCopy'
import type { ViewModel } from './client'
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
