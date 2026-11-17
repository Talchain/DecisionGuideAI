/**
 * The key's link lines and marks, drawn inside the ONE key, "How to read this" (ViewLegend), opened from the left foot menu (Paul, 17 Nov: "Shouldn't
 * we just improve the key that's in the left-hand bottom menu?"; the always-on bottom-right pill is gone). Row 1: a line sample for each link role
 * present on the canvas (and "doubted", "not settled" where such a link is drawn), each with core's own words from `model.key` (ids effect, input,
 * size, doubted, unsettled, measures, target); only the items core sends are drawn. Row 2: Olumi's mark and a person's mark (fixed notation chrome).
 */
import { useEffect, useState } from 'react'
import { HelpCircle } from 'lucide-react'
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
    // One predicate with the canvas (ViewLinkEdge, R5): a link with a typed `causal` is drawn as a modelled effect whatever its role says; only a link
    // with none is drawn by its role (input, size, measures, target).
    const role = linkRole(link), causal = (link as { causal?: { sign?: string } | null }).causal ?? null
    if (causal !== null) out.add('effect')
    else if (role === 'input' || role === 'size' || role === 'measures' || role === 'target') out.add(role)
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
  // D4 (17 Nov): the canvas's own small icon for a direction not settled (canvas/edges/ViewLinkEdge VERDICTLESS_ICON), never a "?" text glyph.
  if (id === 'unsettled') return <span aria-hidden="true" data-key-sample="unsettled" className={`${typography.viewPanelMeta} grid h-4 w-4 place-items-center leading-none`} style={{ color: EFFECT_STROKES.neutral }}><HelpCircle size={14} strokeWidth={1.75} /></span>
  const s = sample ?? SAMPLES[id]!
  return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={id}>
      <path d={s.end === 'arrow' ? 'M6 1V12' : s.end === 'dot' ? 'M6 1V11' : 'M6 1V15'} style={{ stroke: s.stroke }} strokeWidth={s.w} strokeDasharray={s.dash ?? undefined} fill="none" />
      {s.end === 'arrow' ? <path d="M2 9 6 14 10 9" style={{ stroke: s.stroke }} strokeWidth={s.w} fill="none" /> : null}
      {s.end === 'dot' ? <circle cx="6" cy="13" r="2.5" style={{ fill: s.stroke }} /> : null}
    </svg>
  )
}

/** The dock's inset from the window's right edge, kept current (the dock opens, closes and resizes without the window moving). */
export function useDockInset(): number {
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

/** The key's lines and marks, for the one key (ViewLegend). Nothing is drawn with no model. */
export function KeyLines() {
  const model = useViewStore((s) => s.view?.model ?? null)
  if (model === null) return null
  const lines = keyLinesOf(model)
  const item = 'flex items-center gap-1.5'
  return (
    <div role="group" aria-label="Key" data-testid="view-key-lines" className={`flex flex-col items-start gap-y-1.5 ${typography.viewPanelMeta} font-normal text-text-light`}>
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
    </div>
  )
}
