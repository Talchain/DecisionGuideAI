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

import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Activity, AlertTriangle, ChevronDown, ChevronUp, FlaskConical, Layers, Scale, X, type LucideIcon } from 'lucide-react'
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
import { WhatIfKey } from '../artefacts/WhatIfKey'
import { LENS_COPY, useCurrentPremortemWorksheet, type BarLens } from '../artefacts/lenses'
import type { GraphChangeTarget } from '../graphChanges/graphChangesView'
import { LABEL_LEGIBLE_ZOOM } from '../utils/zoomLegibility'

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
  premortemLegend: 'In front: what Olumi’s failure stories rest on. Open the key to read them.',
  whatChangesLegend: 'In front: what this Run is most sensitive to, with the links it moves with most drawn wider.',
} as const

const LENS_ICON: Readonly<Record<Exclude<BarLens, 'full'>, LucideIcon>> = {
  tradeoffs: Scale,
  rests_on: Layers,
  premortem: AlertTriangle,
  what_changes: Activity,
  what_if: FlaskConical,
}

/** Never a dead press: with no conversation to send it to, say so (the action bar's own words). */
function askAndReveal(request: Parameters<typeof askAi>[0]): void {
  const result = askAi(request)
  if (result === 'sent') revealOlumiSurface()
  if (result === 'none') {
    window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ACTION_BAR_COPY.noConversation, level: 'warning' } }))
  }
}

/** "If it failed": the worksheet, or what it is and the one way to ask for it. Folded: the legend, while the stories are held. */
function PremortemKey({ folded }: { folded: boolean }) {
  const worksheet = useCurrentPremortemWorksheet()
  const viewer = useIsViewer()
  // The pre-mortem press exists only on a Run it can read (`actionRegistry.ts`): before one, the ask would reach Olumi as
  // a chat question and no worksheet could come back (verifier, staging fe4e4b9d), so the lens says why instead.
  const canAsk = useCanvasStore(s => typedPressIdOf('pre_mortem', askAiStage(s)) !== undefined)
  if (worksheet) return folded
    ? <p data-testid="premortem-legend" className={`${typography.panelBody} text-text-body`}>{LENS_KEY_COPY.premortemLegend}</p>
    : <PreMortemWorksheet />
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
function WhatChangesKey({ folded }: { folded: boolean }) {
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

  if (folded) {
    return (
      <div data-testid="lens-info-robustness" data-folded="" className="space-y-2">
        <p className={`${typography.panelBody} text-text-body`}>{LENS_KEY_COPY.whatChangesLegend}</p>
        {fragileNotChecked
          ? <p data-testid="lens-key-fragile-not-checked" className={`${typography.panelMeta} text-text-light`}>{LENS_KEY_COPY.fragileNotChecked}</p>
          : null}
      </div>
    )
  }

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
 * The key card's place: just above the band (so it never covers the band's other occupants), inside the band's own
 * side padding, in the corner that covers less of the model. Measured when the lens opens or unfolds, and when the
 * window, the band or the dock changes size; never on a pan, so the card does not jump while the user works.
 */
function useKeyCardPlacement(card: HTMLElement | null, lens: string, folded: boolean): { left: number; bottom: number } | null {
  const [place, setPlace] = useState<{ left: number; bottom: number } | null>(null)
  // The lens's focus decides which cards the key must clear, so a new focus (another option) re-measures.
  const focus = useCanvasStore((s) => s.lens._dimmedNodeIds)
  useLayoutEffect(() => {
    if (!card || typeof window === 'undefined') return
    const measure = () => {
      const band = document.querySelector(OVERLAY_BAND_SELECTOR)
      if (!band) return
      const box = band.getBoundingClientRect()
      const cs = getComputedStyle(band)
      const height = card.getBoundingClientRect().height
      const y = box.top - KEY_CARD_GAP - height
      const leftX = box.left + (parseFloat(cs.paddingLeft) || 0)
      // The card stands ABOVE the band, so on the right it clears the dock, not the band's pill gutter (the minimised
      // Olumi pill's corner lives in the band's own row). Measured at 1280: the gutter put the right slot over the goal.
      const rightX = window.innerWidth - measureDockInset() - KEY_CARD_GAP - KEY_CARD_WIDTH
      const cards = inFocusCardRects()
      const side = rightX > leftX
        ? keyCardSide({ x: leftX, y, w: KEY_CARD_WIDTH, h: height }, { x: rightX, y, w: KEY_CARD_WIDTH, h: height }, cards)
        : 'left'
      const next = { left: side === 'left' ? leftX : rightX, bottom: window.innerHeight - box.top + KEY_CARD_GAP }
      setPlace((held) => (held && held.left === next.left && held.bottom === next.bottom ? held : next))
    }
    measure()
    window.addEventListener('resize', measure)
    // The band's side padding follows the dock (its width, expanded or rail), which is not a window resize.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    // The card itself too: picking a figure makes it taller, and the corner that covers less can change.
    for (const el of [card, document.querySelector(OVERLAY_BAND_SELECTOR), document.querySelector('aside[aria-label="Outputs dock"]')]) {
      if (el && ro) ro.observe(el)
    }
    return () => {
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [card, lens, folded, focus])
  return place
}


/**
 * How the model moves so no card in front stands under the key: into the room above the key, or beside it, whichever
 * keeps the model larger; shifted as little as it can be, and zoomed out only when it does not fit, never below
 * `minScale` (where the cards would stop showing their labels: some cover is the lesser loss). `area` is where cards can
 * be read (under the top bar, above the band, clear of the dock). Screen points map `p -> p * scale + (dx, dy)`. null
 * when nothing is covered. Pure, for the spec.
 */
export function keyCardMove(key: Rect, cards: readonly Rect[], area: Rect, minScale: number): { dx: number; dy: number; scale: number } | null {
  if (cards.length === 0 || !cards.some((card) => overlapArea(key, card) > 0)) return null
  const left = Math.min(...cards.map((c) => c.x))
  const top = Math.min(...cards.map((c) => c.y))
  const bounds = { x: left, y: top, w: Math.max(...cards.map((c) => c.x + c.w)) - left, h: Math.max(...cards.map((c) => c.y + c.h)) - top }
  const keyOnRight = key.x + key.w / 2 > area.x + area.w / 2
  const rooms: Rect[] = [
    { x: area.x, y: area.y, w: area.w, h: key.y - KEY_CARD_GAP - area.y },
    keyOnRight
      ? { x: area.x, y: area.y, w: key.x - KEY_CARD_GAP - area.x, h: area.h }
      : { x: key.x + key.w + KEY_CARD_GAP, y: area.y, w: area.x + area.w - (key.x + key.w + KEY_CARD_GAP), h: area.h },
  ]
  const into = (at: number, size: number, from: number, room: number) =>
    at < from ? from - at : at + size > from + room ? from + room - (at + size) : 0
  const placed = (c: Rect, m: { dx: number; dy: number; scale: number }) => ({ x: c.x * m.scale + m.dx, y: c.y * m.scale + m.dy, w: c.w * m.scale, h: c.h * m.scale })
  const coverOf = (m: { dx: number; dy: number; scale: number }) => cards.reduce((sum, c) => sum + overlapArea(key, placed(c, m)), 0)
  const onScreen = (m: { dx: number; dy: number; scale: number }) => cards.every((c) => {
    const r = placed(c, m)
    return r.x >= area.x - 1 && r.y >= area.y - 1 && r.x + r.w <= area.x + area.w + 1 && r.y + r.h <= area.y + area.h + 1
  })
  // The baseline is the plain lift: up, as far as the cards under the key, never past the room above the top card. Any
  // other move must cover less AND keep every card on screen, so a move never leaves more under the key than the lift.
  const under = cards.filter((c) => overlapArea(key, c) > 0)
  const lift = Math.max(0, Math.min(Math.max(...under.map((c) => c.y + c.h)) - key.y + KEY_CARD_GAP, top - area.y))
  let best = { dx: 0, dy: -lift, scale: 1 }
  let bestCover = coverOf(best)
  let moved = false
  for (const room of rooms) {
    if (room.w <= 0 || room.h <= 0) continue
    const scale = Math.min(1, Math.max(minScale, Math.min(room.w / bounds.w, room.h / bounds.h)))
    // Scaled about the model's own centre, then shifted the least distance into the room.
    const cx = bounds.x + bounds.w / 2
    const cy = bounds.y + bounds.h / 2
    const move = {
      dx: cx * (1 - scale) + into(cx + (bounds.x - cx) * scale, bounds.w * scale, room.x, room.w),
      dy: cy * (1 - scale) + into(cy + (bounds.y - cy) * scale, bounds.h * scale, room.y, room.h),
      scale,
    }
    const cover = coverOf(move)
    // Fewer card pixels under the key; between two rooms that cover the same, the larger zoom.
    if (onScreen(move) && (cover < bestCover || (moved && cover === bestCover && scale > best.scale))) { best = move; bestCover = cover; moved = true }
  }
  return best.dy === 0 && best.dx === 0 && best.scale === 1 ? null : best
}

/**
 * When the key opens over the model, the model moves out from under it (`keyCardMove`), once per lens and per fold.
 * The user asked for the lens, so the move is theirs; panning after that is never undone or fought.
 */
function useMakeRoomForKey(card: HTMLElement | null, place: { left: number; bottom: number } | null, lens: string, folded: boolean): void {
  useEffect(() => {
    if (!card || !place) return
    const frame = requestAnimationFrame(() => {
      const band = document.querySelector(OVERLAY_BAND_SELECTOR)
      if (!band) return
      const r = card.getBoundingClientRect()
      const box = band.getBoundingClientRect()
      const cs = getComputedStyle(band)
      const x = box.left + (parseFloat(cs.paddingLeft) || 0)
      const y = TOP_PILL_BOTTOM_PX + KEY_CARD_GAP
      const area = { x, y, w: window.innerWidth - measureDockInset() - KEY_CARD_GAP - x, h: box.top - KEY_CARD_GAP - y }
      // The canvas zoom as drawn; the move never takes it under the zoom where cards drop their labels.
      const viewport = document.querySelector('.react-flow__viewport')
      const zoom = viewport ? new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a || 1 : 1
      const move = keyCardMove({ x: r.left, y: r.top, w: r.width, h: r.height }, inFocusCardRects(), area, LABEL_LEGIBLE_ZOOM / zoom)
      if (move) panCanvasBy(move.dx, move.dy, move.scale)
    })
    return () => cancelAnimationFrame(frame)
    // Once per lens and per fold: never on a pan, which the user owns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, place?.left, place?.bottom, lens, folded])
}

/** The stale sentence's element inside the panel (see the header). */
export const LENS_INFO_STALE_TESTID = 'lens-info-stale'

/** Main panel — the key card of the lens on screen. */
export function LensInfoPanel() {
  const lensMode = useCanvasStore(s => isGraphLensEnabled() ? s.lens.active : 'full')
  const hasRun = useCanvasStore(s => s.results.status === 'complete' && !!s.results.report)
  const setLens = useCanvasStore(s => s.setLens)
  // ⭐ LEGEND FIRST (Reasoning Canvas plan, step 4; Paul 20 Oct: lenses "a duplication of the right-hand panel"). The lens
  // is what it draws on the graph, so every key opens folded to ONE line saying what its marks mean ("Rests on": its
  // attention sentence; "Trade-offs": the option it shows, with its stepper); the detail is one press away. "Rests on"
  // unfolds when a figure is picked.
  const [folded, setFolded] = useState(true)
  const picked = usePickedKey()
  useEffect(() => { setFolded(true) }, [lensMode])
  useEffect(() => { if (picked !== null) setFolded(false) }, [picked])

  const wants = lensMode === 'tradeoffs' || lensMode === 'rests_on' || lensMode === 'premortem' || lensMode === 'what_changes'
    || lensMode === 'what_if'
  // The stale cue's own predicate — never a restated rule (see the header).
  const modelChangedSinceRun = useModelChangedSinceRun()
  // ⚠ THIS PANEL'S OLD `bottom: 48; left: 12` SAT ON TOP OF THE VIEWPORT-CONTROLS
  // TOOLBAR (`fixed; left: 12; bottom: 12; z-index: 1100`, ~150px tall) — a
  // collision that was in no register row. The band's left padding clears the
  // toolbar by construction, so the panel no longer has to guess.
  const { granted, target } = useOverlayCell('bottom-left', 'lens-info-panel', wants)
  const [card, setCard] = useState<HTMLElement | null>(null)
  const place = useKeyCardPlacement(card, lensMode, folded)
  useMakeRoomForKey(card, place, lensMode, folded)

  if (!wants || !granted) return null

  const Icon = LENS_ICON[lensMode]
  // Only "What would change" shows Run figures, so only it carries the cards' `Last run · ` prefix.
  const title = lensMode === 'what_changes' && modelChangedSinceRun && hasRun
    ? `${LAST_RUN_PREFIX}${LENS_COPY.label[lensMode]}`
    : LENS_COPY.label[lensMode]
  let content: ReactNode
  if (lensMode === 'tradeoffs') content = <TradeOffsKey folded={folded} />
  else if (lensMode === 'rests_on') content = <RestsOnKey folded={folded} />
  else if (lensMode === 'premortem') content = <PremortemKey folded={folded} />
  else if (lensMode === 'what_if') content = <WhatIfKey folded={folded} />
  else content = hasRun ? <WhatChangesKey folded={folded} /> : <p className={`${typography.panelBody} text-text-body`}>{LENS_COPY.needsRun}</p>

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
        maxHeight: 'min(52vh, 460px)',
        animation: 'thinkingModeIn 200ms cubic-bezier(0.0, 0, 0.2, 1) both',
      }}
    >
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
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
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
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
