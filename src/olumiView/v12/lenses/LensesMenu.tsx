/**
 * V12 LAYERS MENU: a layers button for the left floating menu (`LeftSidebar` `layers` slot) that opens a small list, and a small floating panel for the
 * layer on. Production's lens list for power users, drawn from core's View only (`layers.ts`). Chrome words are the layers' names and the table's column
 * heads; everything about the scenario is the View's, verbatim. Olumi's own contributions stay Olumi's: a figure's author line is core's words.
 */
import { controls } from '../../../styles/controls'
import { Fragment, useRef, useState, type ReactNode } from 'react'
import { OkIcon } from '../../look/icons'
import { Hover, HoverButton } from '../../look/Hover'
import { useAnchoredTip } from '../../look/Tip'
import { TOOLBAR_RAIL_ICON } from '../../look/toolbar'
import { typography } from '../../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../../canvas/layers'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../../look/Menu.tsx'
import { canvasChromeMenuBoundary } from '../../look/menu'
import { dismissMenuFromOpener } from '../../look/menuArbiter'
import { useEscapeLayer } from '../edit/escapeLayers'
import { useViewStore } from '../../store'
import { useCanvasStore } from '../../../canvas/store'
import { viewLinkDataOf } from '../../canvas'
import { isBaseline } from '../contract'
import type { View, ViewModel } from '../../client'
import {
  BASIS_LABEL, BASIS_ORDER, edgeTableOf, evidenceOf, figureCards, LAYER_LABEL, layerEntries, optionLayerId, optionOfLayer, SIGN_GLYPH, SIGN_WORDS,
  sensitiveAssumptionsOf, type Basis, type EdgeRow, type LayerId,
} from './layers'
import { chooseLayer, useActiveLayer } from './store'
import { showSimple, showWholeModel, useLevel } from '../simpleStore'

/** Fixed UI chrome: the level of detail, the first choice in this menu (Simple draws each card as visuals; Detailed draws each card's words). Both draw the whole model. */
export const LEVEL_WORDS = {
  group: 'Level of detail', simple: 'Simple', detailed: 'Detailed',
  simpleTitle: 'Visuals first: the whole model, with the words behind hover', detailedTitle: "The whole model with each card's words",
} as const

const NO_LAYER_LABEL = 'Layers'
export const LENSES_TESTID = 'v12-layers'
/** A layer's reading panel stands beside the rail. */
const at = `absolute left-full top-0 ml-3 nodrag nopan ${CANVAS_LAYER_CLASS.chromeMenu}`
const pop = `ok-float ${at} grid auto-rows-max grid-cols-1 ${typography.viewPanelBody}`

export function LensesMenu(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const layer = useActiveLayer()
  const level = useLevel()
  const [menu, setMenu] = useState(false)
  const [panel, setPanel] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const entries = layerEntries(view)
  const closePanel = () => { setPanel(false); trigger.current?.focus() }
  useEscapeLayer(panel && layer !== 'full' && view?.model != null, closePanel)

  if (view === null || view.model === null) return null
  const on = layer !== 'full'

  return (
    <div className="relative flex flex-col nodrag nopan" data-testid={LENSES_TESTID}>
      <HoverButton ref={trigger} words={NO_LAYER_LABEL} type="button" className={TOOLBAR_RAIL_ICON} aria-label={NO_LAYER_LABEL} aria-haspopup="menu" aria-expanded={menu} aria-pressed={on}
          data-testid={`${LENSES_TESTID}-button`}
          onClick={(event) => { if (!dismissMenuFromOpener(event.currentTarget)) { setPanel(false); setMenu(true) } }}>
        <OkIcon id="lenses" size={14} decorative inherit />
      </HoverButton>
      {menu && trigger.current && (
        <Menu anchor={trigger.current} label={NO_LAYER_LABEL} testId={`${LENSES_TESTID}-menu`}
          placement="right-start" gap={8} boundary={canvasChromeMenuBoundary} iconColumn={false} onClose={() => setMenu(false)}>
          <div role="group" className="space-y-2" aria-label={LEVEL_WORDS.group} data-testid="view-simple-switch" data-level={level}>
            <MenuLabel>{LEVEL_WORDS.group}</MenuLabel>
            <div className="divide-y divide-panel-border">
              <MenuItem id="simple" label={LEVEL_WORDS.simple} checked={level === 'simple'} tip={LEVEL_WORDS.simpleTitle}
                meta={{ 'data-testid': 'view-level-simple' }} onSelect={showSimple} />
              <MenuItem id="detailed" label={LEVEL_WORDS.detailed} checked={level === 'working'} tip={LEVEL_WORDS.detailedTitle}
                meta={{ 'data-testid': 'view-level-detailed' }} onSelect={showWholeModel} />
            </div>
          </div>
          {entries.length > 1 && <MenuSeparator />}
          {entries.length > 1 && entries.map((entry, index) => (
            <Fragment key={entry.id}>
              {index > 0 && entries[index - 1]!.kind !== entry.kind && <MenuSeparator />}
              <MenuItem id={entry.id} label={entry.label} checked={entry.id === layer} meta={{ 'data-layer': entry.id }}
                onSelect={() => { chooseLayer(entry.id); setPanel(entry.id !== 'full') }} />
            </Fragment>
          ))}
        </Menu>
      )}
      {panel && on ? <LayerPanel view={view} layer={layer} onClose={closePanel} /> : null}
    </div>
  )
}

const th = `${typography.viewPanelMeta} border-b border-panel-border px-2 py-2.5 text-left font-medium text-text-header`
const td = `${typography.viewPanelTabular} border-b border-panel-border px-2 py-2.5 align-top`

function Head({ title, tag = null, count = null, onClose }: { title: string; tag?: string | null; count?: string | null; onClose: () => void }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-panel-border">
      <h2 className={`${typography.viewPanelBody} min-w-0 flex-1 font-medium text-text-header`}>{title}</h2>
      {tag === null ? null : <span data-testid={`${LENSES_TESTID}-tag`} className={`${typography.viewPanelMeta} rounded-full border border-panel-border px-1.5 text-text-light`}>{tag}</span>}
      {count === null ? null : <span data-testid={`${LENSES_TESTID}-count`} className={`${typography.viewPanelMeta} text-text-light`}>{count}</span>}
      <HoverButton type="button" words="Close" aria-label="Close" onClick={onClose} className={`${controls.chipIcon} inline-flex cursor-pointer items-center justify-center hover:bg-panel-hover focus-visible:outline focus-visible:outline-2`}>
        <OkIcon id="cancel-close" size={14} decorative inherit />
      </HoverButton>
    </div>
  )
}

export const LINK_LEGEND = '? sign not settled. n/a: the View holds no sign. Dashed: doubted.'

/** One link's row: a keyboard stop that selects the link (Enter, Space, press), its words through the one Tip. It owns the hook a map cannot, and the scroll-into-view ref a Hover cannot take. */
function LinkTableRow({ index, edgeId, role, words, on, onSelect, className, children }: { index: number; edgeId: string | undefined; role: string | undefined; words: string | undefined; on: boolean; onSelect: () => void; className: string; children: ReactNode }): JSX.Element {
  const { handlers, tip, describedBy, dismiss } = useAnchoredTip(words)
  return (
    <>
      <tr data-edge={index} data-edge-id={edgeId} data-role={role} tabIndex={edgeId === undefined ? undefined : 0} aria-selected={on} aria-describedby={describedBy}
        ref={(el) => { if (on) el?.scrollIntoView?.({ block: 'nearest' }) }}
        onPointerEnter={handlers.onPointerEnter} onPointerLeave={handlers.onPointerLeave} onFocus={handlers.onFocus} onBlur={handlers.onBlur}
        onClick={() => { dismiss(); onSelect() }} onKeyDown={(e) => { handlers.onKeyDown(e); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
        className={className}>{children}</tr>
      {tip}
    </>
  )
}

/**
 * Every link as a row. A row and its link on the canvas are one selection, both ways, through the canvas's own store (`selection.edgeIds`): pressing a row
 * selects the link when it is drawn, and a link selected on the canvas marks its row. Core's own words (headings, author, strength) are as the View sends them.
 */
function LinkTable({ model, rows }: { model: ViewModel; rows: readonly EdgeRow[] }): JSX.Element {
  const selected = useCanvasStore((s) => s.selection.edgeIds)
  const edges = useCanvasStore((s) => s.edges)
  const edgeIds = new Map(edges.map((e) => [viewLinkDataOf(e)?.link, e.id]))
  const baseline = model.cards.filter((c) => isBaseline(c) && !model.links.some((l) => l.from === c.id || l.to === c.id))
  return (
    <div className="max-h-[50vh] overflow-auto">
      <table className="w-full border-collapse" data-testid={`${LENSES_TESTID}-edges`}>
        <thead><tr><th scope="col" className={th}>From</th><th scope="col" className={th}>To</th><th scope="col" className={th}>Sign</th><th scope="col" className={th}>Strength</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const id = edgeIds.get(model.links[r.index]), on = id !== undefined && selected.has(id)
            return (
              <LinkTableRow key={r.index} index={r.index} edgeId={id} role={r.role ?? undefined} words={r.hover} on={on} onSelect={() => { if (id !== undefined) useCanvasStore.getState().selectEdgeWithoutHistory(id) }}
                className={id === undefined ? '' : `cursor-pointer hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 ${on ? 'bg-panel-hover' : ''}`}>
                <td className={td}>{r.from}</td><td className={td}>{r.to}</td>
                <td className={td}>{r.sign === null ? <span data-edge-na>n/a</span> : <><span aria-hidden="true">{SIGN_GLYPH[r.sign]}</span> <span className={r.sign === 'unknown' ? '' : 'sr-only'}>{SIGN_WORDS[r.sign]}</span></>}{r.by !== null ? <span className={`${typography.viewPanelMeta} block`} data-edge-author>{r.by}</span> : null}{r.disputed ? <span className={`${typography.viewPanelMeta} block`}>Disputed</span> : null}</td>
                <td className={td}>{r.strength ?? ''}</td>
              </LinkTableRow>
            )
          })}
        </tbody>
      </table>
      <p className={`${typography.viewPanelMeta} mt-2 text-text-light`} data-testid={`${LENSES_TESTID}-legend`}>{LINK_LEGEND}{baseline.map((c) => ` ${c.heading} is the baseline and has no link of its own.`).join('')}</p>
    </div>
  )
}

/** Cards listed with the options each moves, or with a basis; the View's headings and author words as they are. */
function FigureList({ view, ids }: { view: View; ids: ReadonlyMap<string, readonly { id: string; heading: string }[]> }): JSX.Element {
  const model = view.model!
  return (
    <ul className="space-y-3">
      {[...ids].map(([id, options]) => {
        const c = model.cards.find((x) => x.id === id)!
        return (
          <li key={id} data-layer-row={id}>
            <p className="text-text-header">{c.heading}{c.figure !== null ? <Hover className={`${typography.viewPanelTabular} ml-2 text-text-body`} words={c.figure.title}>{c.figure.text}</Hover> : null}</p>
            {c.author != null ? <Hover as="p" className={`${typography.viewPanelMeta} ${c.author.by === 'olumi' || c.author.by === 'mixed' ? 'text-info' : 'text-text-body'}`} words={c.author.title}>{c.author.text}</Hover> : null}
            <p className={typography.viewPanelMeta}>{options.map((o) => o.heading).join(' · ')}</p>
          </li>
        )
      })}
    </ul>
  )
}

export function LayerPanel({ view, layer, onClose }: { view: View; layer: LayerId; onClose: () => void }): JSX.Element | null {
  const model = view.model
  if (model === null) return null
  const option = optionOfLayer(layer)
  let title: string = layer in LAYER_LABEL ? LAYER_LABEL[layer as keyof typeof LAYER_LABEL] : ''
  let body: JSX.Element | null = null
  let wide = false
  let tag: string | null = null
  let count: string | null = null

  if (option !== null) {
    const c = model.cards.find((x) => x.id === option)
    title = c?.heading ?? ''
    const words = c?.headline?.text ?? c?.driver?.text ?? null
    body = (
      <div className="space-y-3">
        {words === null ? null : <p className={typography.viewPanelMeta}>{words}</p>}
        <p className={typography.viewPanelMeta}>Cards this option sets, what each leads to, and what it rests on.</p>
      </div>
    )
  } else if (layer === 'sensitivity') {
    body = (
      <div className="space-y-3">
        {model.run !== null ? <Hover as="p" className={typography.viewPanelMeta} words={model.run.sensitivity.title}>{model.run.sensitivity.text}</Hover> : null}
        {model.cards.filter((c) => c.driver != null && c.status === null).map((c) => <p key={c.id} data-layer-row={c.id}><span className="text-text-header">{c.heading}</span><br /><Hover words={c.driver!.title}>{c.driver!.text}</Hover></p>)}
      </div>
    )
  } else if (layer === 'sensitive_assumptions') {
    body = <FigureList view={view} ids={sensitiveAssumptionsOf(model)} />
  } else if (layer === 'causal') {
    wide = true
    const rows = edgeTableOf(model)
    tag = 'Proposed'
    count = `${rows.length} of ${model.links.length} links`
    body = <LinkTable model={model} rows={rows} />
  } else if (layer === 'evidence') {
    const e = evidenceOf(view)
    const by = (b: Basis) => figureCards(model).filter((c) => e.basis.get(c.id) === b)
    body = (
      <div className="space-y-4">
        <p className={typography.viewPanelMeta} data-testid={`${LENSES_TESTID}-evidence-summary`}>{e.grounded} of {e.figures} figures rest on supporting evidence.{e.challenged > 0 ? ` ${e.challenged} ${e.challenged === 1 ? 'is' : 'are'} challenged by evidence.` : ''}{e.olumiLinks > 0 ? ` ${e.olumiLinks} links carry Olumi’s direction.` : ''}</p>
        {BASIS_ORDER.map((b) => {
          const items = by(b)
          return items.length === 0 ? null : (
            <section key={b} data-basis={b} className="space-y-2">
              <h3 className={`${typography.viewPanelMeta} font-medium text-text-header`}>{BASIS_LABEL[b]}</h3>
              <ul className="space-y-3">{items.map((c) => { const id = c.id; return <li key={id} data-layer-row={id}>{c.heading}{c.author != null ? <Hover className={`${typography.viewPanelMeta} ml-2 ${b === 'assumed' ? 'text-info' : b === 'challenged' ? 'text-text-header' : ''}`} words={c.author.title}>{c.author.text}</Hover> : null}</li> })}</ul>
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`${pop} ${wide ? 'w-[420px]' : 'w-[300px]'} max-h-[70vh] overflow-auto`} role="region" aria-label={title} data-testid={`${LENSES_TESTID}-panel`}>
      <Head title={title} tag={tag} count={count} onClose={onClose} />
      {body}
    </div>
  )
}

export { optionLayerId }
