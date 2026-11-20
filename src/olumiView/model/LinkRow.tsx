/**
 * ONE LINK OF THE MODEL TAB (the crafted tab's Relationships row): from its card to its card in their own headings, with core's mark for
 * its kind or sign (◇ ⊢ ↝ +, after the last word, as the canvas draws it). Expert adds core's strength line; in Plain it shows while the
 * row is open, beside its detail's Change strength, so the action always names something on screen. The row's press opens its detail (its
 * two ends; its removal and its strength's editor where core offers them) and puts its first card in front on the canvas. Its row is
 * `linkRowOf` (what it joins); its View paths stay core's (`links.<i>…`).
 */
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { OkIcon } from '../look/icons'
import { useAnchoredTip } from '../look/Tip'
import { Hover } from '../look/Hover'
import type { ViewLink, ViewModel } from '../client'
import { FigureEditor, WithdrawnNote } from './editors'
import { useModelWords } from './editing'
import { LinkDetail } from './detail'
import { useModelTab } from './state'
import { linkEndPath } from './targets'

export function LinkRow({ model, link, i, row, from, to }: { model: ViewModel; link: ViewLink; i: number; row: string; from: string; to: string }) {
  const W = useModelWords()!
  const expert = useModelTab((s) => s.expert)
  const open = useModelTab((s) => s.open === row)
  const editing = useModelTab((s) => (s.editing?.row === row && s.editing.what === 'figure' ? s.editing : null))
  const receipt = useModelTab((s) => (s.receipt?.row === row ? s.receipt : null))
  const editingFigure = editing === null ? null : model.cards.find((c) => c.id === editing.quantity)?.figure?.edit ?? null
  const select = () => { useModelTab.getState().toggle(row); focusNodeById(link.from) }
  // The link's own words (core's `title`) are one hover: the pointer's rest anywhere on the row, and keyboard focus on its one stop, the line's button.
  const tip = useAnchoredTip(link.title === '' ? undefined : link.title)
  return (
    <li data-model-item={row}>
      <div data-model-link={row} data-open={open} onClick={select} onPointerEnter={tip.handlers.onPointerEnter} onPointerLeave={tip.handlers.onPointerLeave}
        className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors duration-fast hover:bg-panel-hover ${open ? 'ring-1 ring-inset ring-border-emphasis' : ''}`}>
        <span aria-hidden="true" className="flex w-4 flex-none justify-center text-text-light"><OkIcon id="model-relationship" size={14} decorative inherit /></span>
        <span className="min-w-0 flex-1">
          <button type="button" aria-expanded={open} aria-controls={open ? `model-detail-${row}` : undefined} data-model-select={row} data-model-link-line={row}
            aria-describedby={tip.describedBy} onFocus={tip.handlers.onFocus} onBlur={tip.handlers.onBlur} onKeyDown={tip.handlers.onKeyDown}
            onClick={(e) => { e.stopPropagation(); tip.dismiss(); select() }} className={`block min-h-[24px] w-full cursor-pointer break-words rounded-sm text-left text-text-header ${ACTION_FOCUS}`}>
            <span data-view={linkEndPath(model, link.from)}>{from}</span>
            <span role="img" aria-label={W.to} className="text-text-light"> → </span>
            <span data-view={linkEndPath(model, link.to)}>{to}</span>
            {link.label !== '' ? <span className="text-text-light">{' '}<span data-view={`links.${i}.label`}>{link.label}</span></span> : null}
          </button>
          {(expert || open) && link.effect != null ? (
            <Hover words={link.effect.title} className={`${typography.viewPanelMeta} mt-0.5 block tabular-nums text-text-light`} data-view={`links.${i}.effect.text`}>{link.effect.text}</Hover>
          ) : null}
          {receipt === null ? null : (
            <span role={receipt.tone === 'failed' ? 'alert' : 'status'} className={`${typography.viewPanelMeta} mt-0.5 block ${receipt.tone === 'failed' ? 'text-danger' : 'text-text-light'}`}
              data-model-saved={receipt.tone === 'saved' ? row : undefined} data-model-failed={receipt.tone === 'failed' ? row : undefined}>{receipt.words}</span>
          )}
        </span>
      </div>
      {tip.tip}
      {editing === null ? null : editingFigure !== null ? (
        <div className="pb-2 pl-8 pr-2"><FigureEditor key={editing.quantity} mine={editing} edit={editingFigure} /></div>
      ) : <div className="pb-2 pl-8 pr-2"><WithdrawnNote mine={editing} /></div>}
      {open ? <LinkDetail model={model} link={link} row={row} /> : null}
    </li>
  )
}
