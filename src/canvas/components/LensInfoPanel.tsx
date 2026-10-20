/**
 * LensInfoPanel — the lens's KEY CARD (Paul, 18 Oct 2026: "Lenses on the model"; DL-3 answer 4: LensInfoPanel's
 * bottom-left slot, no new column).
 *
 * One card per lens, in the band's bottom-left cell: "Trade-offs" lists what one option gains and gives up along the
 * model's own links (`artefacts/TradeOffsKey.tsx`); "Rests on" lists the numbers the model carries
 * (`artefacts/RestsOnKey.tsx`); "If it failed" holds Olumi's pre-mortem stories, or the one way to ask for them;
 * "What would change" names what the selected Run is most sensitive to, from CEE's analysis only, and never a winner.
 *
 * Design system v5: the outside-panel surface (20px radius, full border, `shadow-2`), panel type tokens, no emoji, no
 * single-sided borders.
 *
 * ⭐ WHILE IT HOLDS THE SLOT, IT CARRIES THE STALE FACT (27 Sep 2026). The
 * whole-graph stale sentence (`AnalysisStateCue`, "Model changed · previous
 * findings shown as Last run") is the canvas foot, bottom-LEFT — the same slot
 * this panel holds, and this panel OUTRANKS it there (one slot, one occupant).
 * So the moment a lens opens, the foot line yields — and the Robustness view
 * then shows run figures ("What would change": sensitive assumptions, the
 * "focus on" edge, all from `results.report`). Without the lines below, a
 * changed-since-run model would show last-run figures with NO stale label: the
 * truth regression N3 (`OVERLAY_BAND_RIGHT_CELL_MIN`) exists to forbid — the
 * whole-graph stale cue must never be hidden by another occupant.
 *
 * On exactly the cue's own predicate (`useModelChangedSinceRun`, the one the
 * cards ask before `Last run ·`), the panel therefore
 *   · opens with the cue's sentence, verbatim — the occupant that takes the
 *     slot takes the fact with it, so the sentence is still said exactly once
 *     on the canvas (the foot line is not rendered while this panel holds the
 *     slot), in every lens mode, because the cards' labels it explains are
 *     still on screen in every mode; and
 *   · labels its own run-derived lens `Last run · What would change`, the cards'
 *     prefix, so "previous findings shown as Last run" is true of this panel's
 *     figures too. "Rests on" and "If it failed" read the model (the worksheet
 *     carries its own Run check), and take no label.
 * `AnalysisStateCue.band.spec.tsx` pins both, with the band arbitrating.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Layers, Scale, X, type LucideIcon } from 'lucide-react'
import { OVERLAY_BAND_SELECTOR, useOverlayCell } from './CanvasOverlayBand'
import { measureDockInset } from './FloatingOlumiPanel'
import { ANALYSIS_STATE_CUE_COPY } from './AnalysisStateCue'
import { useModelChangedSinceRun } from '../hooks/useModelChangedSinceRun'
import { panCanvasBy } from '../utils/focusHelpers'
import { TOP_PILL_BOTTOM_PX } from '../../components/layout/TopBar'
import { readFactorSensitivity } from '../hooks/useLensFilter'
import { LAST_RUN_PREFIX } from '../nodes/shared/metricVocabulary'
import { useCanvasStore } from '../store'
import { isGraphLensEnabled } from '../../flags'
import { useIsViewer } from '../../lib/viewerMode'
import { typography } from '../../styles/typography'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { PreMortemWorksheet } from '../../components/results/analysisNew/sections/PreMortemWorksheet'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { askAi, askAiStage } from '../conversation/askAi'
import { typedPressIdOf } from '../conversation/actionRegistry'
import { revealOlumiSurface } from '../conversation/revealOlumi'
import { ACTION_BAR_COPY } from '../conversation/actionBar/ActionBar'
import { RestsOnKey, usePickedKey } from '../artefacts/RestsOnKey'
import { TradeOffsKey } from '../artefacts/TradeOffsKey'
import { LENS_COPY, useCurrentPremortemWorksheet, type BarLens } from '../artefacts/lenses'
import type { GraphChangeTarget } from '../graphChanges/graphChangesView'

export const LENS_KEY_COPY = {
  close: 'Back to the model',
  fold: 'Fold the key',
  unfold: 'Open the key',
  premortemEmpty: 'Olumi has not imagined this model failing yet.',
  premortemWhat: 'It writes plausible ways each option could fail, each tied to what it rests on in the model, for you to challenge.',
  premortemAsk: 'Ask Olumi to imagine it failed',
  premortemNeedsRun: 'Olumi imagines failures from what a current Run shows. Run the analysis, then ask here.',
  fragileHeading: 'Links that could change how the options compare',
  sensitiveHeading: 'Factors the result moves with most',
  focusOn: 'If you could strengthen one relationship, focus on:',
  nothingMeasured: 'This Run measured nothing it is especially sensitive to.',
  fragileNotChecked: "Fragile links weren't checked on this Run.",
  modelRelative: 'These describe this model as it stands, not what to choose.',
} as const

const LENS_ICON: Readonly<Record<Exclude<BarLens, 'full'>, LucideIcon>> = {
  tradeoffs: Scale,
  rests_on: Layers,
  premortem: AlertTriangle,
  what_changes: Activity,
}

/** Never a dead press: with no conversation to send it to, say so (the action bar's own words). */
function askAndReveal(request: Parameters<typeof askAi>[0]): void {
  const result = askAi(request)
  if (result === 'sent') revealOlumiSurface()
  if (result === 'none') {
    window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ACTION_BAR_COPY.noConversation, level: 'warning' } }))
  }
}

/** "If it failed": the worksheet, or what it is and the one way to ask for it. */
function PremortemKey() {
  const worksheet = useCurrentPremortemWorksheet()
  const viewer = useIsViewer()
  // The pre-mortem press exists only on a Run it can read (`actionRegistry.ts`): before one, the ask would reach Olumi as
  // a chat question and no worksheet could come back (verifier, staging fe4e4b9d), so the lens says why instead.
  const canAsk = useCanvasStore(s => typedPressIdOf('pre_mortem', askAiStage(s)) !== undefined)
  if (worksheet) return <PreMortemWorksheet />
  return (
    <div data-testid="premortem-not-yet" className="space-y-3">
      <p className={`${typography.panelQuestion} text-text-header`}>{LENS_KEY_COPY.premortemEmpty}</p>
      <p className={`${typography.panelBody} text-text-body`}>{LENS_KEY_COPY.premortemWhat}</p>
      {viewer ? null : !canAsk ? (
        <p data-testid="premortem-needs-run" className={`${typography.panelBody} text-text-light`}>{LENS_KEY_COPY.premortemNeedsRun}</p>
      ) : (
        <button
          type="button"
          data-testid="premortem-ask"
          className={`${typography.panelBody} ${action('primary')} rounded-full px-3`}
          onClick={() => askAndReveal({ intent: 'pre-mortem' })}
        >
          {LENS_KEY_COPY.premortemAsk}
        </button>
      )}
    </div>
  )
}

interface ChangeRow { readonly key: string; readonly label: string; readonly target: GraphChangeTarget | null }

/**
 * "What would change": the selected Run's fragile links and its most sensitive factors, each a row that lights and
 * focuses its element. Model-relative attention only: no switch probability, no option named (see the fragile list's
 * own note), no recommendation.
 */
function WhatChangesKey() {
  const report = useCanvasStore(s => s.results.report)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const light = useCanvasLight()

  const { fragileList, sensitiveList, fragileNotChecked } = useMemo(() => {
    const reportAny = report as Record<string, unknown> | null | undefined
    const rob = reportAny?.robustness as Record<string, unknown> | undefined
    const rawFragile = (rob?.fragile_edges ?? []) as Array<Record<string, unknown>>
    const nodeMap = new Map(nodes.map(n => [n.id, (n.data as Record<string, unknown>)?.label as string ?? n.id]))

    // Presence branch (schemas 0.30.0, the same class #543 closed on the results surfaces): `switch_probability` ABSENT
    // means NOT COMPUTED — never zero — and `marginal_switch_probability` is a DIFFERENT Monte Carlo (P(flip | only this
    // edge varies)), never a fallback. Only a MEASURED switch probability earns a threshold pass on its own account; an
    // unmeasured edge the marginal MC evidences as fragile is listed after every measured edge.
    const list: Array<ChangeRow & { switchProb: number | undefined }> = []
    for (const fe of rawFragile) {
      const measuredRaw = (fe.switch_probability ?? fe.switchProbability) as number | undefined
      const measured = typeof measuredRaw === 'number' ? measuredRaw : undefined
      const marginal = (fe.marginal_switch_probability ?? fe.marginalSwitchProbability) as number | undefined
      const eligible = measured !== undefined ? measured > 0.3 : typeof marginal === 'number' && marginal > 0.3
      if (!eligible) continue
      const fromId = (fe.from_id ?? fe.fromId ?? fe.source) as string
      const toId = (fe.to_id ?? fe.toId ?? fe.target) as string
      const edgeId = (fe.edge_id ?? fe.edgeId) as string | undefined
      const edge = edges.find(e => e.id === edgeId) ?? edges.find(e => e.source === fromId && e.target === toId)
      list.push({
        key: `fragile:${edgeId ?? `${fromId}->${toId}`}`,
        label: `${nodeMap.get(fromId) ?? fromId} \u2192 ${nodeMap.get(toId) ?? toId}`,
        target: edge ? { kind: 'edge', id: edge.id } : null,
        switchProb: measured,
      })
    }
    // Measured desc; unmeasured last with producer order preserved (-Infinity is an ordering sentinel only and never
    // renders).
    list.sort((a, b) => {
      const av = typeof a.switchProb === 'number' ? a.switchProb : Number.NEGATIVE_INFINITY
      const bv = typeof b.switchProb === 'number' ? b.switchProb : Number.NEGATIVE_INFINITY
      return bv - av
    })

    const sensitivity = reportAny ? readFactorSensitivity(reportAny) : new Map<string, number>()
    const factors = nodes.filter(n => n.type === 'factor' && (sensitivity.get(n.id) ?? 0) > 0)
    factors.sort((a, b) => (sensitivity.get(b.id) ?? 0) - (sensitivity.get(a.id) ?? 0))
    const sensitiveList: ChangeRow[] = factors.slice(0, 3).map(n => ({
      key: `factor:${n.id}`, label: nodeMap.get(n.id) ?? n.id, target: { kind: 'node', id: n.id },
    }))
    // The engine says when it did not assess robustness: then an empty fragile list means "not checked", never "none"
    // (verifier, staging fe4e4b9d: `display_verdict: not_assessed`, `fragile_edges: []`, and the lens said nothing).
    return { fragileList: list, sensitiveList, fragileNotChecked: rob?.display_verdict === 'not_assessed' }
  }, [report, nodes, edges])

  const rows = (heading: string, items: readonly ChangeRow[], testid: string) => items.length === 0 ? null : (
    <section data-testid={testid} className="space-y-1">
      <h3 className={`${typography.panelMeta} text-text-light`}>{heading}</h3>
      <ul className="space-y-0.5">
        {items.map(item => {
          const link = canvasLinkOfTarget(item.target)
          return (
            <li key={item.key}>
              <button
                type="button"
                disabled={link === null}
                className={`${typography.panelBody} w-full truncate rounded-lg px-2 py-1 text-left text-text-body hover:bg-panel-hover disabled:hover:bg-transparent ${ACTION_FOCUS}`}
                title={item.label}
                onClick={() => link?.focus()}
                onMouseEnter={() => { if (link) light.on(link) }}
                onMouseLeave={light.off}
                onFocus={() => { if (link) light.on(link) }}
                onBlur={light.off}
              >
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )

  return (
    <div data-testid="lens-info-robustness" className="space-y-3">
      {fragileNotChecked
        ? <p data-testid="lens-key-fragile-not-checked" className={`${typography.panelBody} text-text-body`}>{LENS_KEY_COPY.fragileNotChecked}</p>
        : null}
      {!fragileNotChecked && fragileList.length === 0 && sensitiveList.length === 0
        ? <p className={`${typography.panelBody} text-text-body`}>{LENS_KEY_COPY.nothingMeasured}</p>
        : null}
      {/* #2747 re-scope 2 (DL ruling): each fragile link says its label only. Its switch probability ("62%") and the
          option it would switch "towards" are an option-comparative figure CEE does not serve or license, and read as
          a leader claim. Interim limit: robustness switch figures not shown in C; restore via a CEE-served, licensed
          robustness string (post-C). The list keeps the producer's order (measured first). */}
      {rows(LENS_KEY_COPY.fragileHeading, fragileList, 'lens-key-fragile')}
      {fragileList.length > 0 ? (
        <p className={`${typography.panelBody} text-text-body`}>
          {LENS_KEY_COPY.focusOn} <span className="text-text-header">{fragileList[0].label}</span>
        </p>
      ) : null}
      {rows(LENS_KEY_COPY.sensitiveHeading, sensitiveList, 'lens-key-sensitive')}
      <p className={`${typography.panelMeta} text-text-light`}>{LENS_KEY_COPY.modelRelative}</p>
    </div>
  )
}

const KEY_CARD_WIDTH = 320
const KEY_CARD_GAP = 8
/** The key never shrinks below this to clear the model: under it, the lift (`keyCardLift`) is the only remedy left. */
const KEY_CARD_MIN_HEIGHT = 160
/** The card's own height cap, before it yields to the model (`keyCardMaxHeight`). */
const KEY_CARD_MAX_HEIGHT = 460
/** The camera's glide (`registerPanBy`, 300 ms) plus a frame, then re-checked until the model is where it was sent. */
const GLIDE_SETTLE_MS = 350
const GLIDE_SETTLE_TRIES = 5
/** The canvas's vertical offset on screen, from its viewport transform; null when the canvas is not mounted. */
const viewportY = (): number | null => {
  const el = document.querySelector('.react-flow__viewport')
  return el && typeof DOMMatrixReadOnly !== 'undefined' ? new DOMMatrixReadOnly(getComputedStyle(el).transform).f : null
}
const KEY_CARD_REMEASURE = 'lens-key:remeasure'

interface Rect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
const overlapArea = (a: Rect, b: Rect): number =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/**
 * The cards on screen the key must keep clear of: every card the lens keeps in front. A card the lens has set aside
 * (dimmed) may sit under the key; a key over the very card a route starts from hid what the lens is about (Trade-offs
 * at 1280, 20 Oct 2026: the key covered "Pro plan price", where every route began).
 */
function inFocusCardRects(): Rect[] {
  const dimmed = useCanvasStore.getState().lens._dimmedNodeIds
  return [...document.querySelectorAll('.react-flow__node')]
    .filter((el) => !dimmed.has(el.getAttribute('data-id') ?? ''))
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    })
}

/**
 * Which bottom corner of the canvas the key card stands in: the left, unless the right covers less of the model.
 * Pure, so the rule is tested without a layout engine. `cards` are the model's cards on screen.
 */
export function keyCardSide(left: Rect, right: Rect, cards: readonly Rect[]): 'left' | 'right' {
  const covered = (r: Rect) => cards.reduce((sum, card) => sum + overlapArea(r, card), 0)
  return covered(right) < covered(left) ? 'right' : 'left'
}

/**
 * How tall the key may stand above `bottom` (its bottom edge) without covering a card in its column: up to the lowest
 * card that shares its width, never below KEY_CARD_MIN_HEIGHT, never above `cap`. When the model fills both corners
 * (1280 × 800, 20 Oct 2026: the Trade-offs key covered the goal), the key scrolls inside rather than hide the model.
 * Pure, for the spec.
 */
export function keyCardMaxHeight(column: { x: number; w: number }, bottom: number, cards: readonly Rect[], cap: number): number {
  const above = cards.filter((c) => Math.min(column.x + column.w, c.x + c.w) - Math.max(column.x, c.x) > 0 && c.y < bottom)
  const lowest = above.length === 0 ? -Infinity : Math.max(...above.map((c) => c.y + c.h))
  return Math.max(KEY_CARD_MIN_HEIGHT, Math.min(cap, bottom - KEY_CARD_GAP - lowest))
}

/**
 * The key card's place: just above the band (so it never covers the band's other occupants), inside the band's own
 * side padding, in the corner that covers less of the model. Measured when the lens opens or unfolds, and when the
 * window, the band or the dock changes size; never on a pan, so the card does not jump while the user works.
 *
 * When the key opens over the model, the model glides up out from under it, once per lens and per fold, as far as the
 * room above allows (the user asked for the lens, so the move is theirs; a pan after that is never undone or fought).
 * Then the key stands no taller than the room left above it (`keyCardMaxHeight`), scrolling inside, so it covers no
 * card the lens keeps in front.
 */
type KeyCardPlace = { readonly left: number; readonly bottom: number; readonly maxHeight: number }
function useKeyCardPlacement(card: HTMLElement | null, lens: string, folded: boolean): KeyCardPlace | null {
  const [place, setPlace] = useState<KeyCardPlace | null>(null)
  // The lens's focus decides which cards the key must clear, so a new focus (another option) re-measures.
  const focus = useCanvasStore((s) => s.lens._dimmedNodeIds)
  const liftedFor = useRef<string | null>(null)
  const settle = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(settle.current), [])
  useLayoutEffect(() => {
    // A closed key forgets its lift, so opening a lens again makes room again.
    if (!card) liftedFor.current = null
    if (!card || typeof window === 'undefined') return
    const measure = () => {
      const band = document.querySelector(OVERLAY_BAND_SELECTOR)
      if (!band) return
      const box = band.getBoundingClientRect()
      const cs = getComputedStyle(band)
      const cap = Math.min(KEY_CARD_MAX_HEIGHT, window.innerHeight * 0.52)
      // The key's own height before it yields to the model: its header plus everything its body holds.
      const height = Math.min(cap, [...card.children].reduce((h, el) => h + el.scrollHeight, 0))
      const foot = box.top - KEY_CARD_GAP
      const leftX = box.left + (parseFloat(cs.paddingLeft) || 0)
      // The card stands ABOVE the band, so on the right it clears the dock, not the band's pill gutter (the minimised
      // Olumi pill's corner lives in the band's own row). Measured at 1280: the gutter put the right slot over the goal.
      const rightX = window.innerWidth - measureDockInset() - KEY_CARD_GAP - KEY_CARD_WIDTH
      let cards = inFocusCardRects()
      const side = rightX > leftX
        ? keyCardSide({ x: leftX, y: foot - height, w: KEY_CARD_WIDTH, h: height }, { x: rightX, y: foot - height, w: KEY_CARD_WIDTH, h: height }, cards)
        : 'left'
      const left = side === 'left' ? leftX : rightX
      if (liftedFor.current !== `${lens}:${folded}`) {
        liftedFor.current = `${lens}:${folded}`
        const dy = keyCardLift({ x: left, y: foot - height, w: KEY_CARD_WIDTH, h: height }, cards, TOP_PILL_BOTTOM_PX + KEY_CARD_GAP)
        const from = viewportY()
        if (dy > 0 && panCanvasBy(0, -dy)) {
          cards = cards.map((c) => ({ ...c, y: c.y - dy }))
          // Measure once more where the glide actually ended: it can start late or be cut short by another camera move.
          let tries = 0
          const settled = () => {
            const y = viewportY()
            if (from !== null && y !== null && Math.abs(y - (from - dy)) > 1 && ++tries < GLIDE_SETTLE_TRIES) {
              settle.current = window.setTimeout(settled, GLIDE_SETTLE_MS)
            } else window.dispatchEvent(new Event(KEY_CARD_REMEASURE))
          }
          settle.current = window.setTimeout(settled, GLIDE_SETTLE_MS)
        }
      }
      const next = { left, bottom: window.innerHeight - box.top + KEY_CARD_GAP, maxHeight: keyCardMaxHeight({ x: left, w: KEY_CARD_WIDTH }, foot, cards, cap) }
      setPlace((held) => (held && held.left === next.left && held.bottom === next.bottom && held.maxHeight === next.maxHeight ? held : next))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener(KEY_CARD_REMEASURE, measure)
    // The band's side padding follows the dock (its width, expanded or rail), which is not a window resize.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    // The card itself too: picking a figure makes it taller, and the corner that covers less can change.
    for (const el of [card, document.querySelector(OVERLAY_BAND_SELECTOR), document.querySelector('aside[aria-label="Outputs dock"]')]) {
      if (el && ro) ro.observe(el)
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener(KEY_CARD_REMEASURE, measure)
      ro?.disconnect()
    }
  }, [card, lens, folded, focus])
  return place
}

/**
 * How far the model must rise so no card stands under the key: the overlap below the key's top edge, capped by the
 * room above the model (it never rises under the top bar). 0 when nothing is covered. Pure, for the spec.
 */
export function keyCardLift(key: Rect, cards: readonly Rect[], topLimit: number): number {
  const under = cards.filter((card) => overlapArea(key, card) > 0)
  if (under.length === 0 || cards.length === 0) return 0
  const need = Math.max(...under.map((card) => card.y + card.h)) - key.y + KEY_CARD_GAP
  const room = Math.min(...cards.map((card) => card.y)) - topLimit
  return Math.max(0, Math.min(need, room))
}

/** The stale sentence's element inside the panel (see the header). */
export const LENS_INFO_STALE_TESTID = 'lens-info-stale'

/** Main panel — the key card of the lens on screen. */
export function LensInfoPanel() {
  const lensMode = useCanvasStore(s => isGraphLensEnabled() ? s.lens.active : 'full')
  const hasRun = useCanvasStore(s => s.results.status === 'complete' && !!s.results.report)
  const setLens = useCanvasStore(s => s.setLens)
  // The key folds so the user can see the model under it; the lens stays on. "Rests on" opens folded to its one
  // attention sentence (its numbers are on the model) and unfolds when a figure is picked; the others open unfolded.
  const [folded, setFolded] = useState(lensMode === 'rests_on')
  const picked = usePickedKey()
  useEffect(() => { setFolded(lensMode === 'rests_on') }, [lensMode])
  useEffect(() => { if (picked !== null) setFolded(false) }, [picked])

  const wants = lensMode === 'tradeoffs' || lensMode === 'rests_on' || lensMode === 'premortem' || lensMode === 'what_changes'
  // The stale cue's own predicate — never a restated rule (see the header).
  const modelChangedSinceRun = useModelChangedSinceRun()
  // ⚠ THIS PANEL'S OLD `bottom: 48; left: 12` SAT ON TOP OF THE VIEWPORT-CONTROLS
  // TOOLBAR (`fixed; left: 12; bottom: 12; z-index: 1100`, ~150px tall) — a
  // collision that was in no register row. The band's left padding clears the
  // toolbar by construction, so the panel no longer has to guess.
  const { granted, target } = useOverlayCell('bottom-left', 'lens-info-panel', wants)
  const [card, setCard] = useState<HTMLElement | null>(null)
  const place = useKeyCardPlacement(card, lensMode, folded)

  if (!wants || !granted) return null

  const Icon = LENS_ICON[lensMode]
  // Only "What would change" shows Run figures, so only it carries the cards' `Last run · ` prefix.
  const title = lensMode === 'what_changes' && modelChangedSinceRun && hasRun
    ? `${LAST_RUN_PREFIX}${LENS_COPY.label[lensMode]}`
    : LENS_COPY.label[lensMode]
  let content: ReactNode
  if (lensMode === 'tradeoffs') content = <TradeOffsKey />
  else if (lensMode === 'rests_on') content = <RestsOnKey folded={folded} />
  else if (lensMode === 'premortem') content = <PremortemKey />
  else content = hasRun ? <WhatChangesKey /> : <p className={`${typography.panelBody} text-text-body`}>{LENS_COPY.needsRun}</p>

  // The card holds the band's bottom-left cell (so the foot line yields to it, and its stale sentence moves in here),
  // and stands just ABOVE the band (`useKeyCardPlacement`): the cell is too short and narrow for a key.
  const body = (
    <section
      ref={setCard}
      aria-label={LENS_COPY.label[lensMode]}
      data-testid="lens-info-panel"
      data-lens={lensMode}
      className="pointer-events-auto fixed flex flex-col rounded-[20px] border border-panel-border bg-panel shadow-2 transition-opacity duration-200 ease-out"
      style={{
        width: KEY_CARD_WIDTH,
        left: place?.left ?? 0,
        bottom: place?.bottom ?? 0,
        // Hidden until placed, so it never flashes in the wrong corner.
        opacity: place ? 1 : 0,
        maxHeight: place?.maxHeight ?? KEY_CARD_MAX_HEIGHT,
        animation: 'thinkingModeIn 200ms cubic-bezier(0.0, 0, 0.2, 1) both',
      }}
    >
      <header className={`flex items-center gap-2 px-4 ${folded && lensMode !== 'rests_on' ? 'py-2.5' : 'pb-2 pt-3'}`}>
        <Icon aria-hidden="true" className="h-4 w-4 flex-none text-text-light" />
        <h2 data-testid="lens-info-heading" className={`${typography.panelHeader} min-w-0 flex-1 text-text-header`}>{title}</h2>
        <button
          type="button"
          onClick={() => setFolded(f => !f)}
          aria-label={folded ? LENS_KEY_COPY.unfold : LENS_KEY_COPY.fold}
          aria-expanded={!folded}
          title={folded ? LENS_KEY_COPY.unfold : LENS_KEY_COPY.fold}
          data-testid="lens-info-fold"
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}
        >
          {folded ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setLens('full')}
          aria-label={LENS_KEY_COPY.close}
          title={LENS_KEY_COPY.close}
          data-testid="lens-info-close"
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>
      <div hidden={folded && lensMode !== 'rests_on'} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {/* The whole-graph stale sentence, carried while this panel displaces
            the foot line that normally says it. Same words, same live region. */}
        {modelChangedSinceRun && (
          <p
            data-testid={LENS_INFO_STALE_TESTID}
            role="status"
            aria-live="polite"
            className={`${typography.panelMeta} text-text-light`}
          >
            {ANALYSIS_STATE_CUE_COPY}
          </p>
        )}
        {content}
      </div>
    </section>
  )

  return target ? createPortal(body, target) : body
}
