/**
 * V12 LAYERS MENU: a layers button for the left floating menu (`LeftSidebar` `layers` slot) that opens a small list, and a small floating panel for the
 * layer on. Production's lens list for power users, drawn from core's View only (`layers.ts`). Chrome words are the layers' names and the table's column
 * heads; everything about the scenario is the View's, verbatim. Olumi's own contributions stay Olumi's: a figure's author line is core's words.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { OkIcon } from '../../look/icons'
import { Hover, HoverButton } from '../../look/Hover'
import { useAnchoredTip } from '../../look/Tip'
import Tooltip from '../../../components/Tooltip'
import styles from '../../../components/layout/CanvasFloatingToolbar.module.css'
import { typography } from '../../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../../canvas/layers'
import { MENU_ROW, MENU_SEPARATOR, MENU_SHELL } from '../../look/menu'
import { useViewStore } from '../../store'
import { useCanvasStore } from '../../../canvas/store'
import { edgeIdOf } from '../../../canvas/contextMenu/laneMenu'
import { isBaseline } from '../contract'
import type { View, ViewModel } from '../../client'
import { MENU_EXCLUSIVE_EVENT } from '../../../components/layout/LeftSidebar'
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
/** Where the menu and a layer's panel stand: beside the rail, on the chrome menus' layer. */
const at = `absolute left-full top-0 ml-3 nodrag nopan ${CANVAS_LAYER_CLASS.chromeMenu}`
const pop = `${at} rounded-lg border border-panel-border bg-panel p-3 shadow-2 ${typography.viewPanelBody}`

export function LensesMenu(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const layer = useActiveLayer()
  const level = useLevel()
  const [menu, setMenu] = useState(false)
  const [panel, setPanel] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const entries = layerEntries(view)

  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => { if (root.current !== null && !root.current.contains(e.target as Node)) setMenu(false) }
    const exclusive = (e: Event) => { if ((e as CustomEvent).detail !== LENSES_TESTID) setMenu(false) }
    document.addEventListener('pointerdown', away)
    window.addEventListener(MENU_EXCLUSIVE_EVENT, exclusive)
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener(MENU_EXCLUSIVE_EVENT, exclusive) }
  }, [menu])

  if (view === null || view.model === null) return null
  const on = layer !== 'full'
  const choose = (id: LayerId) => { chooseLayer(id); setMenu(false); setPanel(id !== 'full') }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { if (menu || panel) e.preventDefault(); setMenu(false); setPanel(false); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1
    items[next]?.focus()
    e.preventDefault()
  }

  return (
    <div ref={root} className="relative nodrag nopan" onKeyDown={onKey} data-testid={LENSES_TESTID}>
      <Tooltip content={NO_LAYER_LABEL}>
        <button type="button" className={on ? styles.iconButtonActive : styles.iconButton} aria-label={NO_LAYER_LABEL} aria-haspopup="menu" aria-expanded={menu} aria-pressed={on}
          data-testid={`${LENSES_TESTID}-button`}
          onClick={() => { setPanel(false); setMenu((m) => { if (!m) window.dispatchEvent(new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: LENSES_TESTID })); return !m }) }}>
          <OkIcon id="lenses" decorative inherit />
        </button>
      </Tooltip>
      {menu ? (
        <div role="menu" aria-label={NO_LAYER_LABEL} className={`${at} ${MENU_SHELL} w-[240px]`} data-testid={`${LENSES_TESTID}-menu`}>
          {/* Paul, 18 Nov: Simple | Detailed lives here, with the other ways to look at the model, not in a panel of its own at the canvas foot. */}
          <div role="group" className="space-y-2" aria-label={LEVEL_WORDS.group} data-testid="view-simple-switch" data-level={level}>
            <p role="presentation" className={`${typography.viewPanelMeta} text-text-light`}>{LEVEL_WORDS.group}</p>
            <div className="divide-y divide-panel-border">
              {([['simple', LEVEL_WORDS.simple, LEVEL_WORDS.simpleTitle, showSimple], ['working', LEVEL_WORDS.detailed, LEVEL_WORDS.detailedTitle, showWholeModel]] as const).map(([id, label, title, go]) => (
                <HoverButton key={id} type="button" role="menuitemradio" aria-checked={level === id} words={title} data-testid={id === 'simple' ? 'view-level-simple' : 'view-level-detailed'} onClick={() => { go(); setMenu(false) }}
                  className={`flex ${MENU_ROW} w-full cursor-pointer items-center text-left text-text-body hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 ${level === id ? 'bg-panel-hover font-medium' : ''}`}>
                  <span className="min-w-0 truncate">{label}</span>
                </HoverButton>
              ))}
            </div>
          </div>
          {entries.length <= 1 ? null : <div role="separator" className={MENU_SEPARATOR} />}
          {entries.length <= 1 ? null : entries.map((e, i) => (
            <div key={e.id} role="none">
              {i > 0 && entries[i - 1]!.kind !== e.kind ? <div role="separator" className={MENU_SEPARATOR} /> : null}
              <button type="button" role="menuitemradio" aria-checked={e.id === layer} data-layer={e.id} onClick={() => choose(e.id)}
                className={`flex ${MENU_ROW} w-full cursor-pointer items-center text-left text-text-body hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 ${e.id === layer ? 'bg-panel-hover font-medium' : ''}`}>
                <span className="min-w-0 truncate">{e.label}</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {panel && on ? <LayerPanel view={view} layer={layer} onClose={() => setPanel(false)} /> : null}
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
      <button type="button" aria-label="Close" onClick={onClose} className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm hover:bg-panel-hover focus-visible:outline focus-visible:outline-2">
        <OkIcon id="cancel-close" decorative inherit />
      </button>
    </div>
  )
}

export const LINK_LEGEND = '? sign not settled. n/a: the View holds no sign. Dashed: doubted.'

/** One link's row: a keyboard stop that selects the link (Enter, Space, press), its words through the one Tip. It owns the hook a map cannot, and the scroll-into-view ref a Hover cannot take. */
function LinkTableRow({ index, edgeId, role, words, on, onSelect, className, children }: { index: number; edgeId: string; role: string | undefined; words: string | undefined; on: boolean; onSelect: () => void; className: string; children: ReactNode }): JSX.Element {
  const { handlers, tip, describedBy, dismiss } = useAnchoredTip(words)
  return (
    <>
      <tr data-edge={index} data-edge-id={edgeId} data-role={role} tabIndex={0} aria-selected={on} aria-describedby={describedBy}
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
 * selects the link, and a link selected on the canvas marks its row. Core's own words (headings, author, strength) are as the View sends them.
 */
function LinkTable({ model, rows }: { model: ViewModel; rows: readonly EdgeRow[] }): JSX.Element {
  const selected = useCanvasStore((s) => s.selection.edgeIds)
  const baseline = model.cards.filter((c) => isBaseline(c) && !model.links.some((l) => l.from === c.id || l.to === c.id))
  const select = (id: string) => useCanvasStore.getState().selectEdgeWithoutHistory(id)
  return (
    <div className="max-h-[50vh] overflow-auto">
      <table className="w-full border-collapse" data-testid={`${LENSES_TESTID}-edges`}>
        <thead><tr><th scope="col" className={th}>From</th><th scope="col" className={th}>To</th><th scope="col" className={th}>Sign</th><th scope="col" className={th}>Strength</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const id = edgeIdOf(model.links[r.index]!), on = selected.has(id)
            return (
              <LinkTableRow key={r.index} index={r.index} edgeId={id} role={r.role ?? undefined} words={r.hover} on={on} onSelect={() => select(id)}
                className={`cursor-pointer hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 ${on ? 'bg-panel-hover' : ''}`}>
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
    <div className={`${pop} ${wide ? 'w-[420px]' : 'w-[300px]'} max-h-[70vh] space-y-3 overflow-auto`} role="region" aria-label={title} data-testid={`${LENSES_TESTID}-panel`}>
      <Head title={title} tag={tag} count={count} onClose={onClose} />
      {body}
    </div>
  )
}

export { optionLayerId }
