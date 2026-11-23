/**
 * THE TRADE-OFFS LENS ON THE CORE LANE (DL ruling 3, 5 Nov): a tray holding
 * a grid of each option against each aim, every cell that option card's own row for that aim (`rows[].aim_id`; core's chance, limit or
 * none row), in core's words, with core's title as hover and core's Olumi mark. Options and aims are core's cards, in core's order (the
 * options as the View lists them, the aims as their rows do). No word, number, sort or rank of DGAI's own: the grid sets core's findings
 * side by side, so the team sees what each option does on every aim at once; it never says which is better. View only: it writes nothing.
 */
import { GlyphMark, Hover, HoverButton } from './look/Hover'
import { OkIcon } from './look/icons'
import { TOOLBAR_ICON, TOOLBAR_TITLE, TOOLBAR_TRAY } from './look/toolbar'
import { typography } from '../styles/typography'
import { LENS_KEY_COPY } from '../canvas/artefacts/lensKeyCopy'
import type { ViewCard, ViewModel } from './client'
import { optionCards } from './layout'
import { useViewLens } from './lens'
import { useViewStore } from './store'

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
    : <>{NBSP}<GlyphMark mark={row.olumi} view={`${at}.olumi.glyph`} /></>
  return (
    <Hover as="td" className={`${typography.viewPanelBody} border border-panel-border px-2 py-2.5 align-top`} words={row?.title} data-view-row={row === undefined ? undefined : at}
      data-tradeoff-cell={`${option.id}.${aim}`}>
      {row === undefined ? null : row.kind === 'none' ? <span data-view={`${at}.text`}>{row.text}</span>
        : <span className={typography.viewPanelTabular}>{row.kind === 'chance' && row.approx !== '' ? <span data-view={`${at}.approx`}>{row.approx}</span> : null}<span data-view={`${at}.value`}>{row.value}</span>{mark}</span>}
    </Hover>
  )
}

/** The grid itself: core's options down, core's aims across. */
export function TradeOffsGrid({ model }: { model: ViewModel }): JSX.Element {
  const options = optionCards(model), aims = tradeOffAims(model)
  return (
    <table className="w-full border-collapse text-left" data-testid="view-tradeoffs-grid">
      <thead>
        <tr>
          <td className="border border-panel-border py-2.5" />
          {aims.map((a) => <th key={a.id} scope="col" className={`${typography.viewPanelMeta} border border-panel-border px-2 py-2.5 align-bottom text-text-header`} data-tradeoff-aim={a.id}>{a.heading}</th>)}
        </tr>
      </thead>
      <tbody>
        {options.map((o) => (
          <tr key={o.id}>
            <th scope="row" className={`${typography.viewPanelBody} border border-panel-border px-2 py-2.5 align-top text-text-header`} data-tradeoff-option={o.id}>{o.heading}</th>
            {aims.map((a) => <Cell key={a.id} option={o} aim={a.id} />)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Shown while the Trade-offs lens is on and core's model has options. */
export function ViewTradeOffsKey(): JSX.Element | null {
  const on = useViewLens((s) => s.lens === 'tradeoffs')
  const model = useViewStore((s) => s.view?.model ?? null)
  const label = useViewStore((s) => s.view?.lens_words.label.tradeoffs ?? null) // core's (N3)
  if (!on || model === null || label === null || optionCards(model).length === 0) return null
  return (
    <section aria-label={label} data-testid="view-tradeoffs-key"
      className={`${TOOLBAR_TRAY} w-fit max-w-[min(40rem,100%)]`}>
      <header className="flex items-center gap-2">
        <OkIcon id="lens-tradeoffs" size={14} decorative inherit className="flex-none text-text-light" />
        <h2 className={`${TOOLBAR_TITLE} min-w-0 flex-1`}>{label}</h2>
        <HoverButton type="button" onClick={() => useViewLens.setState({ lens: 'full' })} aria-label={LENS_KEY_COPY.close} words={LENS_KEY_COPY.close} data-testid="view-tradeoffs-key-close"
          className={TOOLBAR_ICON}>
          <OkIcon id="cancel-close" size={14} decorative inherit />
        </HoverButton>
      </header>
      <div className="min-h-0 flex-1 overflow-auto"><TradeOffsGrid model={model} /></div>
    </section>
  )
}
