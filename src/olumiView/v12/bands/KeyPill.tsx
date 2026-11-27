/**
 * The key's link lines and marks, drawn inside the ONE key, "How to read this" (ViewLegend), opened from the left foot menu (Paul, 17 Nov: "Shouldn't
 * we just improve the key that's in the left-hand bottom menu?"; the always-on bottom-right pill is gone). Row 1: a line sample for each link role
 * present on the canvas (and "doubted", "not settled" where such a link is drawn), each with core's own words from `model.key` (ids effect, input,
 * size, doubted, unsettled, measures, target); only the items core sends are drawn. Row 2, present-only (panel-visual L1, L2, L4): the dotted reason line, the alert and proposal halos under a line, and the six midpoint direction marks in the registry's ids and words. Row 3: Olumi's mark and a person's mark (fixed notation chrome).
 */
import { useEffect, useState } from 'react'
import { ICONS, OkIcon, type IconId } from '../../look/icons'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import type { View, ViewLink, ViewModel } from '../../client'
import { cardLinks, drawnModelOf, linkByOlumi } from '../../layout'
import { useViewStore } from '../../store'
import { linkRole } from '../contract'
import { firstDraft as firstDraftOf, linkLook } from '../fields/fields'
import { EFFECT_STROKES, LINK_STYLES, linkAlertStyle, linkStyle, toneOf, type LinkStyle } from '../links/styles'
import { typography } from '../../../styles/typography'
import { OlumiMark } from '../cards/marks'

// The key's line samples are the canvas's own line styles (links/styles.ts), so the key can never say what the lines do not.
type Sample = Pick<LinkStyle, 'stroke' | 'end'>
/** An effect's polarity samples: the canvas's effect line in the direction colours it is drawn in (links/styles.ts EFFECT_STROKES). */
export const EFFECT_POLARITY = [
  { id: 'increases', word: 'increases', sample: { ...LINK_STYLES.effect, stroke: EFFECT_STROKES.increases } },
  { id: 'decreases', word: 'decreases', sample: { ...LINK_STYLES.effect, stroke: EFFECT_STROKES.decreases } },
] as const
/** The key ids this pill draws as line samples; `doubted` is the effect line's own colours and arrow, dashed; `unsettled` draws the canvas's own not-settled mark. */
export const KEY_LINE_IDS = ['effect', 'input', 'size', 'doubted', 'unsettled', 'measures', 'target'] as const
type KeyLineId = (typeof KEY_LINE_IDS)[number]

/** The six midpoint direction marks, in the registry's ids (look/icons.tsx `link-*`), as the canvas draws them (ViewLinkEdge MARK_ID). */
export const KEY_MARK_IDS = { raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends', disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none' } as const satisfies Record<string, IconId>
export type KeyMark = keyof typeof KEY_MARK_IDS

/**
 * How the canvas draws a link, by the SAME predicates as canvas/edges/ViewLinkEdge (R5, L2): a direction core sends (`link.direction`) else the typed sign's;
 * a link with a typed `causal` or a direction is a modelled effect whatever its role says; only one with neither is drawn by its role.
 */
function drawnAs(link: ViewLink) {
  const causal = (link as { causal?: { sign?: string } | null }).causal ?? null
  const look = linkLook(link)
  const direction = look.source === 'view' && look.direction !== null ? look.direction
    : causal?.sign === 'increases' ? 'raises' : causal?.sign === 'decreases' ? 'lowers' : causal?.sign === 'unknown' ? 'unknown' : null
  const mark: KeyMark | null = direction !== null ? direction : causal?.sign === 'none' ? 'none' : null
  const role = linkRole(link), style = linkStyle(link)
  const styled = causal === null && direction === null && style !== null && style.role !== 'effect' ? style : null
  const modelled = styled === null && (causal !== null || direction !== null)
  return { direction, mark, role, styled, modelled, dotted: styled === null && !modelled && (link.kind === 'reason' || role === 'reason') }
}

/** Which key items stand on the canvas now: a modelled effect (a typed `causal` or a `direction`), a role's line, a doubted link, a link whose direction is not settled. */
export function keyPresent(model: ViewModel): ReadonlySet<KeyLineId> {
  const out = new Set<KeyLineId>()
  for (const { link } of cardLinks(drawnModelOf(model))) {
    const d = drawnAs(link)
    if (d.modelled) out.add('effect')
    else if (d.styled !== null) out.add(d.styled.role as KeyLineId)
    if (link.doubt) out.add('doubted')
    if (d.direction === 'depends' || d.direction === 'disputed' || d.direction === 'unknown') out.add('unsettled')
  }
  return out
}

export type KeyUnderlay = 'dotted' | 'reason-alert' | 'halo-alert' | 'halo-proposed'
/**
 * What else the canvas draws now (L1, L2, L4), present-only: a dotted reason line, the alert halo (core's orange), the proposal halo (Olumi's blue, never on a
 * first draft, R3), and which of the six midpoint direction marks stand on a line.
 */
export function keyExtrasOf(view: View): { underlays: ReadonlySet<KeyUnderlay>; marks: ReadonlySet<KeyMark> } {
  const underlays = new Set<KeyUnderlay>(), marks = new Set<KeyMark>()
  const model = view.model
  if (model == null) return { underlays, marks }
  const first = firstDraftOf(view).firstDraft === true
  for (const { link } of cardLinks(drawnModelOf(model))) {
    const d = drawnAs(link)
    const alert = linkAlertStyle(link)
    if (d.mark !== null) marks.add(d.mark)
    if (alert === 'reason') underlays.add('reason-alert')
    else if (d.dotted) underlays.add('dotted')
    if (alert === 'halo') underlays.add('halo-alert')
    if ((link.proposed || linkByOlumi(model, link.from, link.to)) && !first) underlays.add('halo-proposed')
  }
  return { underlays, marks }
}

/** The pill's row-1 items: core's key items (in its order) whose id this pill draws and that stand on the canvas. */
export const keyLinesOf = (model: ViewModel): { id: KeyLineId; text: string }[] => {
  const present = keyPresent(model)
  return (model.key ?? []).flatMap((k) => ((KEY_LINE_IDS as readonly string[]).includes(k.id) && present.has(k.id as KeyLineId) ? [{ id: k.id as KeyLineId, text: k.text }] : []))
}

function LineSample({ id, sample, doubt = false }: { id: Exclude<KeyLineId, 'doubted'>; sample?: Sample; doubt?: boolean }) {
  // The canvas's own small mark for a direction not settled (canvas/edges/ViewLinkEdge MARK_ID, registry `link-unknown`), never a "?" text glyph.
  if (id === 'unsettled') return <span aria-hidden="true" data-key-sample="unsettled" className={`${typography.viewPanelMeta} grid h-4 w-4 place-items-center leading-none ok-key-unsettled`}><OkIcon id={KEY_MARK_IDS.unknown} size={14} decorative inherit /></span>
  const s = sample ?? LINK_STYLES[id]
  return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={id} className={`ok-key-sample ok-link-tone-${toneOf(s.stroke)}`}>
      <path d={s.end === 'arrow' ? 'M6 1V12' : s.end === 'dot' ? 'M6 1V11' : 'M6 1V15'} className={doubt ? 'ok-link-line ok-link-doubt' : 'ok-link-line'} fill="none" />
      {s.end === 'arrow' ? <path d="M2 9 6 14 10 9" className="ok-link-line" fill="none" /> : null}
      {s.end === 'dot' ? <circle cx="6" cy="13" r="2.5" className="ok-link-end" /> : null}
    </svg>
  )
}

/** A line under a halo or a dotted line, as the canvas draws them: the halo is the underlay, the line keeps its own direction colour and arrow. */
function UnderlaySample({ kind }: { kind: KeyUnderlay }) {
  if (kind === 'dotted' || kind === 'reason-alert') return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={kind} className="ok-key-sample ok-link-tone-neutral">
      <path d="M6 1V15" className={`ok-link-line ok-link-dotted${kind === 'reason-alert' ? ' ok-link-reason-alert' : ''}`} fill="none" />
    </svg>
  )
  return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={kind} className="ok-key-sample ok-key-underlay ok-link-tone-positive">
      <path d="M6 1V13" className={kind === 'halo-alert' ? 'ok-link-halo ok-link-halo-alert' : 'ok-link-halo ok-link-halo-proposed'} />
      <path d="M6 1V12" className="ok-link-line" fill="none" />
      <path d="M2 9 6 14 10 9" className="ok-link-line" fill="none" />
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
  const view = useViewStore((s) => s.view)
  const model = view?.model ?? null
  if (view === null || model === null) return null
  const lines = keyLinesOf(model)
  const { underlays, marks } = keyExtrasOf(view)
  // Words are core's key items where core sends one (reason, alert, olumi), else the registry's own (the marks); a sample core has no word for stands without one.
  const coreWord = (id: string) => (model.key ?? []).find((k) => k.id === id)?.text
  const UNDERLAYS: readonly { kind: KeyUnderlay; word: string | undefined }[] = [
    { kind: 'dotted', word: coreWord('reason') }, { kind: 'reason-alert', word: coreWord('alert') },
    { kind: 'halo-alert', word: coreWord('alert') }, { kind: 'halo-proposed', word: coreWord('olumi') },
  ]
  // The registry's words, said once where marks share them (depends, disputed and unknown all say "Direction not settled").
  const markWords = [...new Set((Object.keys(KEY_MARK_IDS) as KeyMark[]).filter((m) => marks.has(m)).map((m) => ICONS[KEY_MARK_IDS[m]].hover))]
  const item = 'flex items-center gap-1.5'
  return (
    <div role="group" aria-label="Key" data-testid="view-key-lines" className={`flex flex-col items-start gap-y-1.5 ${typography.viewPanelMeta} font-normal text-text-light`}>
      {lines.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="lines">
          {lines.map((l) => l.id === 'effect'
            // The effect shows its direction colours: core's own words, then the two fixed notation words (UI chrome) beside their samples.
            ? <span key={l.id} className={item} data-key-item="effect">{l.text}{EFFECT_POLARITY.map((p) => <span key={p.id} className={item} data-key-polarity={p.id}><LineSample id="effect" sample={p.sample} />{p.word}</span>)}</span>
            : l.id === 'doubted'
              // A doubted link keeps its direction colour and arrow and only takes the dash, as the canvas draws it (L4).
              ? <span key={l.id} className={item} data-key-item="doubted">{EFFECT_POLARITY.map((p) => <span key={p.id} data-key-polarity={p.id}><LineSample id="effect" sample={p.sample} doubt /></span>)}{l.text}</span>
              : <span key={l.id} className={item} data-key-item={l.id}><LineSample id={l.id} />{l.text}</span>)}
        </div>
      )}
      {underlays.size === 0 && marks.size === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="drawn">
          {UNDERLAYS.filter((u) => underlays.has(u.kind)).map((u) => <span key={u.kind} className={item} data-key-item={u.kind}><UnderlaySample kind={u.kind} />{u.word}</span>)}
          {markWords.map((w) => (
            <span key={w} className={item} data-key-item="direction">
              {(Object.keys(KEY_MARK_IDS) as KeyMark[]).filter((m) => marks.has(m) && ICONS[KEY_MARK_IDS[m]].hover === w).map((m) => <span key={m} data-key-direction={m} className="inline-flex"><OkIcon id={KEY_MARK_IDS[m]} size={14} decorative /></span>)}{w}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3" data-key-row="marks">
        <span className={item} data-key-item="olumi-mark">
          <OlumiMark words="Olumi's estimate" />Olumi&apos;s
        </span>
        <span className={item} data-key-item="person-mark">
          <OkIcon id="person-mark" size={14} words="A person's figure" inherit />a person&apos;s
        </span>
      </div>
    </div>
  )
}
