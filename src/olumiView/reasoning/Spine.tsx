/**
 * The model at a glance, as an instrument (the redesign's spine: reasoning-redesign-SPEC.md §3 Z2 and §7). The crafted strip Paul liked
 * (6 Nov side by side) keeps its rows: the brief, each goal, and one mark per option, factor, risk and outcome in its canvas shape and
 * colour, with each row's count. Now every mark points into the model:
 *   - hover or focus a mark: its card is ringed on the canvas (ring.ts, the tab's own slot beside the chat's, so neither clears the other);
 *     the pointer and the keyboard each hold their own, so moving the pointer off never drops the ring of the mark that has focus;
 *   - press a mark, or a goal: the canvas selects and centres its card (`focusNodeById`); press it again to let it go;
 *   - the canvas's selection is followed back: the selected card's mark is pressed (an ink ring), whoever selected it;
 *   - press a row's label: every card of that kind is ringed; press it again to clear;
 *   - core's own pointer (`cards[].focus`) keeps Olumi's blue ring on its mark, as it does on its card;
 *   - one tab stop for the marks (a group; the row labels are tab stops of their own): the arrows move, Home and End jump, N and Shift+N
 *     step to the next card core flags (its pointer, a challenge, Olumi's own, a proposed change), and Esc (from a mark or a row label)
 *     lets go of the selection, a kind's ring and the pointer's; a key with Alt, Ctrl or Cmd is left to the browser.
 * Every word is core's (a card's heading names its mark for a reader); the labels and counts are the tab's own. Nothing is ranked or dimmed.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ViewCard, ViewModel } from '../client'
import { familyCards, glanceRows, type GlanceKind } from '../layout'
import { attCards } from '../ring'
import type { REASONING_LABELS } from '../ViewReasoning'
import { Clamped } from './parts'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { useCanvasStore } from '../../canvas/store'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'

type Labels = typeof REASONING_LABELS
/** A brief longer than this is held to two lines at rest (about 50 characters a line at 14px in the dock's narrowest column). */
const BRIEF_CLAMP_CHARS = 100
const TEST_ID: Record<GlanceKind, string> = { option: 'options', factor: 'factors', risk: 'risks', outcome: 'outcomes' }
const LABEL = `${typography.viewPanelMeta} flex w-20 shrink-0 items-center gap-1.5 text-text-light`
/** Where N steps to: a card core points the person at, challenges, marks as Olumi's, or proposes to add or change. */
export const flagged = (c: ViewCard): boolean => c.focus || c.challenged || c.olumi !== null || c.change != null

export function Spine({ model, brief, labels }: { model: ViewModel; brief: string | null; labels: Labels }) {
  const goals = familyCards(model, ['goal']), rows = glanceRows(model)
  const order: ViewCard[] = [...goals, ...rows.flatMap((r) => r.cards)]
  const label: Record<GlanceKind, string> = { option: labels.options, factor: labels.factors, risk: labels.risks, outcome: labels.outcomes }
  const selected = useCanvasStore((s) => s.selection.nodeIds)
  const [hover, setHover] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [family, setFamily] = useState<GlanceKind | null>(null)
  const [active, setActive] = useState(0)
  const marks = useRef<(HTMLButtonElement | null)[]>([])
  const at = Math.min(active, Math.max(order.length - 1, 0))

  // The tab's ring: the kind whose row is pressed, the mark under the pointer, and the mark with keyboard focus. Cleared when the tab goes.
  const ringed = new Set([...(family === null ? [] : rows.find((r) => r.kind === family)?.cards ?? []).map((c) => c.id), ...[hover, focus].filter((x): x is string => x !== null)])
  const key = [...ringed].join('\n')
  useEffect(() => { attCards(key === '' ? [] : key.split('\n')) }, [key])
  useEffect(() => () => attCards([]), [])

  const press = (id: string) => { if (selected.has(id)) useCanvasStore.getState().clearSelection(); else focusNodeById(id) }
  const go = (i: number) => {
    if (order.length === 0) return
    const k = ((i % order.length) + order.length) % order.length
    setActive(k)
    marks.current[k]?.focus()
  }
  const step = (dir: 1 | -1) => {
    for (let n = 1; n <= order.length; n++) {
      const k = (((at + dir * n) % order.length) + order.length) % order.length
      if (flagged(order[k]!)) { go(k); return }
    }
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLElement) || e.altKey || e.ctrlKey || e.metaKey) return
    const onMark = e.target.dataset['glanceMark'] !== undefined, onLabel = e.target.dataset['glanceFamily'] !== undefined
    if (!onMark && !(onLabel && e.key === 'Escape')) return
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': go(at + 1); break
      case 'ArrowLeft': case 'ArrowUp': go(at - 1); break
      case 'Home': go(0); break
      case 'End': go(order.length - 1); break
      case 'n': case 'N': step(e.shiftKey ? -1 : 1); break
      case 'Escape': useCanvasStore.getState().clearSelection(); setFamily(null); setHover(null); break
      default: return
    }
    e.preventDefault()
  }
  // One mark (or a goal's heading): one tab stop between them all, its card's heading for a reader, pressed while its card is selected.
  const pointer = (c: ViewCard) => {
    const i = order.indexOf(c), sel = selected.has(c.id)
    return {
      ref: (el: HTMLButtonElement | null) => { marks.current[i] = el },
      type: 'button' as const, tabIndex: i === at ? 0 : -1, 'aria-pressed': sel, 'data-glance-mark': c.id,
      // A state ring (the selection's ink, core's pointer in blue) sits on the mark; keyboard focus adds its ring with a gap, so the two
      // never read as one.
      ring: `focus-visible:ring-offset-2 ${sel ? 'ring-2 ring-text-header' : c.focus ? 'ring-2 ring-info' : ''}`,
      onClick: () => press(c.id),
      onMouseEnter: () => setHover(c.id), onMouseLeave: () => setHover((h) => (h === c.id ? null : h)),
      onFocus: () => { setActive(i); setFocus(c.id) }, onBlur: () => setFocus((f) => (f === c.id ? null : f)),
    }
  }

  return (
    <div data-testid="view-reasoning-glance" className="space-y-1.5" role="group" aria-label={labels.glance} onKeyDown={onKey}>
      {brief === null ? null : (
        <div className="flex items-baseline gap-2"><span className={LABEL}><NodeShapeIndicator nodeKind="decision" size={10} />{labels.brief}</span><span className="min-w-0" title={brief}><Clamped long={brief.length > BRIEF_CLAMP_CHARS} labels={labels} testId="view-reasoning-brief"><span data-view="brief">{brief}</span></Clamped></span></div>
      )}
      {goals.map((g) => {
        const { ring, ...p } = pointer(g)
        return (
          <div key={g.id} className="flex items-baseline gap-2">
            <span className={LABEL}><NodeShapeIndicator nodeKind="goal" size={10} />{labels.goal}</span>
            <button {...p} title={g.detail} data-glance-goal={g.id} className={`-mx-1 min-h-[24px] min-w-0 rounded px-1 text-left hover:bg-panel-hover ${ACTION_FOCUS} ${ring}`}>
              <span data-view={`${g.id}.heading`}>{g.heading}</span>
            </button>
          </div>
        )
      })}
      {/* As the crafted strip: the kind's canvas shape before its label, one mark per card in the canvas's own shape and colour (core's
          glyph kept for a reader, its heading on hover), and how many cards the row has, right-aligned. */}
      {rows.map(({ kind, cards }) => (
        <div key={kind} className="flex items-center gap-2" data-testid={`view-reasoning-glance-${TEST_ID[kind]}`}>
          <button type="button" aria-pressed={family === kind} data-glance-family={kind} onClick={() => setFamily((f) => (f === kind ? null : kind))}
            className={`${LABEL} min-h-[24px] rounded text-left hover:text-text-body ${ACTION_FOCUS} ${family === kind ? 'text-text-header' : ''}`}>
            <NodeShapeIndicator nodeKind={kind} size={10} />{label[kind]}
          </button>
          <span className="flex min-w-0 flex-1 flex-wrap items-center">
            {cards.map((c) => {
              const { ring, ...p } = pointer(c)
              return (
                <button key={c.id} {...p} title={c.heading} aria-label={c.heading} data-glance-card={c.id} data-glance-kind={kind}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-panel-hover ${ACTION_FOCUS} ${ring}`}>
                  <NodeShapeIndicator nodeKind={kind} size={10} /><span className="sr-only" data-view={`${c.id}.glyph`}>{c.glyph}</span>
                </button>
              )
            })}
          </span>
          <span className={`${typography.viewPanelMeta} shrink-0 tabular-nums text-text-light`} data-glance-count={kind}>{cards.length}</span>
        </div>
      ))}
    </div>
  )
}
