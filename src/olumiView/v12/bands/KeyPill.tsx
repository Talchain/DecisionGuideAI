/**
 * V12 key pill: always visible on the canvas, two rows. Row 1: a line sample for each link role present on the canvas (and "doubted", "not
 * settled" where such a link is drawn), each with core's own words from `model.key` (ids effect, input, size, doubted, unsettled, measures,
 * target); only the items core sends are drawn. Row 2: Olumi's mark and a person's mark (fixed notation chrome: Olumi's adapted vocabulary).
 * "How to read this" (ViewLegend) stays as the popover.
 */
import { useEffect, useState } from 'react'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import type { ViewModel } from '../../client'
import { cardLinks, drawnModelOf } from '../../layout'
import { useViewStore } from '../../store'
import { linkRole } from '../contract'
import { DOUBT_DASH, EFFECT_STROKES, LINK_STYLES } from '../links/styles'
import { typography } from '../../../styles/typography'
import { OlumiMark } from '../cards/marks'

// The key's line samples are the canvas's own line styles (links/styles.ts), so the key can never say what the lines do not.
type Sample = { stroke: string; dash: string | null; end: 'arrow' | 'dot' | 'none'; w: number }
const fromStyle = (s: (typeof LINK_STYLES)[keyof typeof LINK_STYLES]): Sample => ({ stroke: s.stroke, dash: s.dash, end: s.end, w: s.width })
/** An effect's polarity samples: the canvas's effect line in the direction colours it is drawn in (links/styles.ts EFFECT_STROKES). */
export const EFFECT_POLARITY = [
  { id: 'increases', word: 'increases', sample: { ...fromStyle(LINK_STYLES.effect), stroke: EFFECT_STROKES.increases } },
  { id: 'decreases', word: 'decreases', sample: { ...fromStyle(LINK_STYLES.effect), stroke: EFFECT_STROKES.decreases } },
] as const
const SAMPLES: Readonly<Record<string, Sample>> = {
  effect: fromStyle(LINK_STYLES.effect),
  input: fromStyle(LINK_STYLES.input),
  size: fromStyle(LINK_STYLES.size),
  doubted: { ...fromStyle(LINK_STYLES.effect), stroke: EFFECT_STROKES.neutral, dash: DOUBT_DASH, end: 'none' },
  measures: fromStyle(LINK_STYLES.measures),
  target: fromStyle(LINK_STYLES.target),
}
/** The key ids this pill draws as line samples; `unsettled` draws the board's "?" mark. */
export const KEY_LINE_IDS = ['effect', 'input', 'size', 'doubted', 'unsettled', 'measures', 'target'] as const
type KeyLineId = (typeof KEY_LINE_IDS)[number]

/** Which key items stand on the canvas now: a link of that role (a modelled effect for `effect`), a doubted link, a link whose direction is not settled. */
export function keyPresent(model: ViewModel): ReadonlySet<KeyLineId> {
  const out = new Set<KeyLineId>()
  for (const { link } of cardLinks(drawnModelOf(model))) {
    const role = linkRole(link), causal = (link as { causal?: { sign?: string } | null }).causal ?? null
    if (role === 'effect' || (role === null && causal !== null)) out.add('effect')
    if (role === 'input' || role === 'size' || role === 'measures' || role === 'target') out.add(role)
    if (link.doubt) out.add('doubted')
    if (causal?.sign === 'unknown') out.add('unsettled')
  }
  return out
}

/** The pill's row-1 items: core's key items (in its order) whose id this pill draws and that stand on the canvas. */
export const keyLinesOf = (model: ViewModel): { id: KeyLineId; text: string }[] => {
  const present = keyPresent(model)
  return (model.key ?? []).flatMap((k) => ((KEY_LINE_IDS as readonly string[]).includes(k.id) && present.has(k.id as KeyLineId) ? [{ id: k.id as KeyLineId, text: k.text }] : []))
}

function LineSample({ id, sample }: { id: KeyLineId | string; sample?: Sample }) {
  if (id === 'unsettled') return <span aria-hidden="true" data-key-sample="unsettled" className={`${typography.viewPanelMeta} grid h-4 w-4 place-items-center rounded-full border-[1.5px] font-medium leading-none`} style={{ borderColor: EFFECT_STROKES.neutral }}>?</span>
  const s = sample ?? SAMPLES[id]!
  return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={id}>
      <path d={s.end === 'arrow' ? 'M6 1V12' : s.end === 'dot' ? 'M6 1V11' : 'M6 1V15'} style={{ stroke: s.stroke }} strokeWidth={s.w} strokeDasharray={s.dash ?? undefined} strokeLinecap={s.dash === '1 4' ? 'round' : undefined} fill="none" />
      {s.end === 'arrow' ? <path d="M2 9 6 14 10 9" style={{ stroke: s.stroke }} strokeWidth={s.w} fill="none" /> : null}
      {s.end === 'dot' ? <circle cx="6" cy="13" r="2.5" style={{ fill: s.stroke }} /> : null}
    </svg>
  )
}

/** The gap kept between the key and the Simple/Detailed toggle (and the canvas edges): 12 px, the canvas chrome's one gap. */
const CHROME_GAP = 12
/** The Simple/Detailed row the canvas places at the bottom centre (ViewCanvas): the key stands to its right and never over it. */
const FOOT_TOGGLE_SELECTOR = '[data-testid="view-foot-toggle"]'
/** The narrowest room beside the toggle row that holds the key's widest item on one line. */
const KEY_MIN_ROW = 360
/** Room kept clear at the canvas's bottom-left for the zoom controls. */
const ZOOM_ROOM = 190

/** The dock's inset from the window's right edge, kept current (the dock opens, closes and resizes without the window moving). */
function useDockInset(): number {
  const [inset, setInset] = useState(measureDockInset)
  useEffect(() => {
    const read = () => setInset(measureDockInset())
    read()
    const t = setInterval(read, 500)
    window.addEventListener('resize', read)
    return () => { clearInterval(t); window.removeEventListener('resize', read) }
  }, [])
  return inset
}

/** The room right of the toggle row, up to the canvas's right edge, kept current: the key is no wider, so it wraps rather than cover the toggle. */
function useRoomRight(inset: number): number | null {
  const [room, setRoom] = useState<number | null>(null)
  useEffect(() => {
    const read = () => {
      const toggle = document.querySelector(FOOT_TOGGLE_SELECTOR)?.getBoundingClientRect()
      const pane = document.querySelector('[data-testid="view-canvas-root"]')?.getBoundingClientRect()
      if (!toggle || !pane || toggle.width === 0) { setRoom(null); return }
      const next = Math.max(160, Math.floor(pane.right - inset - CHROME_GAP - (toggle.right + CHROME_GAP)))
      setRoom((held) => (held === next ? held : next))
    }
    read()
    const t = setInterval(read, 500)
    window.addEventListener('resize', read)
    return () => { clearInterval(t); window.removeEventListener('resize', read) }
  }, [inset])
  return room
}

export function KeyPill() {
  const model = useViewStore((s) => s.view?.model ?? null)
  const inset = useDockInset()
  const room = useRoomRight(inset)
  // Where the room beside the toggle row is too narrow for the key's widest item (the effect with its two directions), the key sits on its own
  // row above the toggle, clear of the zoom controls, instead of spilling over the toggle (seen at 1232 wide, 16 Nov).
  const above = room !== null && room < KEY_MIN_ROW
  // Progressive disclosure (Paul, 16 Nov): where the canvas is too narrow for the key beside the toggle row, the key is one small "Key" button
  // on that row and opens on hover, focus or press; where there is room it is drawn whole.
  const [open, setOpen] = useState(false)
  if (model === null) return null
  const lines = keyLinesOf(model)
  const item = 'flex items-center gap-1.5'
  const body = (
    <>
      {lines.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="lines">
          {lines.map((l) => l.id === 'effect'
            // The effect shows its direction colours: core's own words, then the two fixed notation words (UI chrome) beside their samples.
            ? <span key={l.id} className={item} data-key-item="effect">{l.text}{EFFECT_POLARITY.map((p) => <span key={p.id} className={item} data-key-polarity={p.id}><LineSample id="effect" sample={p.sample} />{p.word}</span>)}</span>
            : <span key={l.id} className={item} data-key-item={l.id}><LineSample id={l.id} />{l.text}</span>)}
        </div>
      )}
      <div className="flex items-center gap-3" data-key-row="marks">
        <span className={item} data-key-item="olumi-mark">
          <OlumiMark words="Olumi's estimate" size={12} />Olumi&apos;s
        </span>
        <span className={item} data-key-item="person-mark">
          <svg viewBox="0 0 24 24" role="img" aria-label="A person's figure" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12, flex: 'none' }}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>a person&apos;s
        </span>
      </div>
    </>
  )
  const box = `flex flex-row flex-wrap items-center justify-end gap-x-4 gap-y-1 rounded-xl border border-panel-border bg-panel px-3 py-2 ${typography.viewPanelMeta} font-normal text-text-light whitespace-nowrap`
  if (above) return (
    <div data-testid="view-key-pill" data-key-folded="" className="pointer-events-none absolute z-[1100]" style={{ right: inset + CHROME_GAP, bottom: CHROME_GAP }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" data-testid="view-key-open" aria-expanded={open} onClick={() => setOpen(!open)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className={`pointer-events-auto inline-flex h-9 items-center rounded-full border border-panel-border bg-panel px-3 ${typography.viewPanelMeta} font-medium text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>Key</button>
      {open ? <div role="group" aria-label="Key" className={`absolute bottom-full right-0 mb-2 w-max ${box}`} style={{ maxWidth: `calc(100vw - ${inset + 2 * CHROME_GAP + ZOOM_ROOM}px)` }}>{body}</div> : null}
    </div>
  )
  return (
    // One line where the canvas is wide enough (both groups side by side), wrapping where it is not. The canvas reserves the key's height
    // (computeFitPadding KEY_PILL_SELECTOR), so cards are laid out above it, never under it.
    <div role="group" aria-label="Key" data-testid="view-key-pill" style={{ right: inset + CHROME_GAP, bottom: CHROME_GAP, maxWidth: room ?? `calc(50% - ${inset + 2 * CHROME_GAP}px)` }}
      className={`pointer-events-none absolute z-[1100] ${box}`}>
      {body}
    </div>
  )
}
