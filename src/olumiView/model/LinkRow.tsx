/**
 * ONE LINK OF THE MODEL TAB (the crafted tab's Relationships row): from its card to its card in their own headings. Plain shows the line;
 * Expert adds core's mark for its kind (◇ ⊢ ↝ +, after the last word, as the canvas draws it) and core's strength line. The row's press
 * opens its detail (its two ends; its strength's editor where core offers one) and puts its first card in front on the canvas.
 */
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { KIND_GLYPH } from '../../canvas/model-tab-v2/rowPresentation'
import type { ViewLink, ViewModel } from '../client'
import { FigureEditor } from './editors'
import { LinkDetail } from './detail'
import { useModelTab } from './state'

export function LinkRow({ model, link, i, from, to }: { model: ViewModel; link: ViewLink; i: number; from: string; to: string }) {
  const row = `links.${i}`
  const expert = useModelTab((s) => s.expert)
  const open = useModelTab((s) => s.open === row)
  const editing = useModelTab((s) => (s.editing?.row === row && s.editing.what === 'figure' ? s.editing : null))
  const saved = useModelTab((s) => (s.saved?.row === row ? s.saved.words : null))
  const editingFigure = editing === null ? null : model.cards.find((c) => c.id === editing.quantity)?.figure?.edit ?? null
  const select = () => { useModelTab.getState().toggle(row); focusNodeById(link.from) }
  return (
    <li data-model-item={row}>
      <div data-model-link={row} data-open={open} title={link.title} onClick={select}
        className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors duration-fast hover:bg-panel-hover ${open ? 'ring-1 ring-inset ring-border-emphasis' : ''}`}>
        <span aria-hidden="true" className="w-4 flex-none text-center text-text-light">{KIND_GLYPH.relationship}</span>
        <span className="min-w-0 flex-1">
          <button type="button" aria-expanded={open} aria-controls={`model-detail-${row}`} data-model-select={row}
            onClick={(e) => { e.stopPropagation(); select() }} className={`block w-full cursor-pointer break-words rounded-sm text-left text-text-header ${ACTION_FOCUS}`}>
            <span>{from}</span>
            <span aria-hidden="true" className="text-text-light"> → </span>
            <span>{to}</span>
            {expert && link.label !== '' ? <span className="text-text-light">{' '}<span data-view={`links.${i}.label`}>{link.label}</span></span> : null}
          </button>
          {expert && link.effect != null ? (
            <span className={`${typography.viewPanelMeta} mt-0.5 block tabular-nums text-text-light`} title={link.effect.title} data-view={`links.${i}.effect.text`}>{link.effect.text}</span>
          ) : null}
          {saved === null ? null : <span role="status" className={`${typography.viewPanelMeta} mt-0.5 block text-text-light`} data-model-saved={row}>{saved}</span>}
        </span>
      </div>
      {editing !== null && editingFigure !== null ? (
        <div className="pb-2 pl-8 pr-2"><FigureEditor key={editing.quantity} row={row} quantity={editing.quantity} edit={editingFigure} /></div>
      ) : null}
      {open ? <LinkDetail model={model} link={link} i={i} /> : null}
    </li>
  )
}
