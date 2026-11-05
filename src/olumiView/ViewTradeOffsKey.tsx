/**
 * THE TRADE-OFFS LENS ON THE CORE LANE (DL ruling 3, 5 Nov): the legacy lens's key card (its corner, its look, its label and icon) holding
 * a grid of each option against each aim, every cell that option card's own row for that aim (`rows[].aim_id`; core's chance, limit or
 * none row), in core's words, with core's title as hover and core's Olumi mark. Options and aims are core's cards, in core's order (the
 * options as the View lists them, the aims as their rows do). No word, number, sort or rank of DGAI's own: the grid sets core's findings
 * side by side, so the team sees what each option does on every aim at once; it never says which is better. View only: it writes nothing.
 */
import { X } from 'lucide-react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { OVERLAY_BAND_BOTTOM, OVERLAY_BAND_HEIGHT, OVERLAY_BAND_LEFT_PAD } from '../canvas/components/CanvasOverlayBand'
import { LENS_COPY, LENS_ICON } from '../canvas/artefacts/lenses'
import { LENS_KEY_COPY } from '../canvas/artefacts/lensKeyCopy'
import type { ViewCard, ViewModel } from './client'
import { optionCards } from './layout'
import { useViewLens } from './lens'
import { useViewStore } from './store'

const KEY_GAP = 8
const NBSP = ' '
type Row = ViewCard['rows'][number]

/** The aims the options are worked out against, in the order their rows give them: each by its card (core's heading), else the row's aim words. */
export function tradeOffAims(model: ViewModel): { id: string; heading: string }[] {
  const out: { id: string; heading: string }[] = []
  for (const o of optionCards(model)) for (const r of o.rows) {
    if (r.aim_id == null || out.some((a) => a.id === r.aim_id)) continue
    out.push({ id: r.aim_id, heading: model.cards.find((c) => c.id === r.aim_id)?.heading ?? ('aim' in r ? r.aim : r.aim_id) })
  }
  return out
}

function Cell({ option, aim }: { option: ViewCard; aim: string }): JSX.Element {
  const i = option.rows.findIndex((r) => r.aim_id === aim), row: Row | undefined = option.rows[i]
  const at = `${option.id}.rows.${i}`
  const mark = row === undefined || row.kind === 'none' || row.olumi === null ? null
    : <>{NBSP}<span title={row.olumi.title} aria-label={row.olumi.title} data-view={`${at}.olumi.glyph`}>{row.olumi.glyph}</span></>
  return (
    <td className={`${typography.panelBody} border border-panel-border px-2 py-1.5 align-top`} title={row?.title} data-view-row={row === undefined ? undefined : at}
      data-tradeoff-cell={`${option.id}.${aim}`}>
      {row === undefined ? null : row.kind === 'none' ? <span data-view={`${at}.text`}>{row.text}</span>
        : <span className={typography.panelTabular}>{row.kind === 'chance' && row.approx !== '' ? <span data-view={`${at}.approx`}>{row.approx}</span> : null}<span data-view={`${at}.value`}>{row.value}</span>{mark}</span>}
    </td>
  )
}

/** The grid itself: core's options down, core's aims across. */
export function TradeOffsGrid({ model }: { model: ViewModel }): JSX.Element {
  const options = optionCards(model), aims = tradeOffAims(model)
  return (
    <table className="w-full border-collapse text-left" data-testid="view-tradeoffs-grid">
      <thead>
        <tr>
          <td className="border border-panel-border" />
          {aims.map((a) => <th key={a.id} scope="col" className={`${typography.panelMeta} border border-panel-border px-2 py-1.5 align-bottom text-text-header`} data-tradeoff-aim={a.id}>{a.heading}</th>)}
        </tr>
      </thead>
      <tbody>
        {options.map((o) => (
          <tr key={o.id}>
            <th scope="row" className={`${typography.panelBody} border border-panel-border px-2 py-1.5 align-top text-text-header`} data-tradeoff-option={o.id}>{o.heading}</th>
            {aims.map((a) => <Cell key={a.id} option={o} aim={a.id} />)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The key card in the legacy lens's corner, shown while the Trade-offs lens is on and core's model has options. */
export function ViewTradeOffsKey(): JSX.Element | null {
  const on = useViewLens((s) => s.lens === 'tradeoffs')
  const model = useViewStore((s) => s.view?.model ?? null)
  if (!on || model === null || optionCards(model).length === 0) return null
  const Icon = LENS_ICON.tradeoffs
  return (
    <section aria-label={LENS_COPY.label.tradeoffs} data-testid="view-tradeoffs-key"
      className="pointer-events-auto absolute z-[1150] flex flex-col rounded-[20px] border border-panel-border bg-panel shadow-2"
      style={{ left: OVERLAY_BAND_LEFT_PAD, bottom: OVERLAY_BAND_BOTTOM + OVERLAY_BAND_HEIGHT + KEY_GAP, maxWidth: 'min(640px, calc(100vw - 480px))', maxHeight: 'min(52vh, 460px)' }}>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Icon aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
        <h2 className={`${typography.panelHeader} min-w-0 flex-1 text-text-header`}>{LENS_COPY.label.tradeoffs}</h2>
        <button type="button" onClick={() => useViewLens.setState({ lens: 'full' })} aria-label={LENS_KEY_COPY.close} title={LENS_KEY_COPY.close} data-testid="view-tradeoffs-key-close"
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}>
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4"><TradeOffsGrid model={model} /></div>
    </section>
  )
}
