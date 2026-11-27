/**
 * The key's link lines and marks, drawn inside the ONE key, "How to read this" (ViewLegend), opened from the left foot menu (Paul, 17 Nov: "Shouldn't
 * we just improve the key that's in the left-hand bottom menu?"; the always-on bottom-right pill is gone). Row 1: a line sample for each link role
 * present on the canvas (and "doubted", "not settled" where such a link is drawn), each with core's own words from `model.key` (ids effect, input,
 * size, doubted, unsettled, measures, target); only the items core sends are drawn. Row 2, present-only (panel-visual L1, L2, L4): the dotted reason line, the alert and proposal halos under a line, and the six midpoint direction marks in the registry's ids and words. Row 3: Olumi's mark and a person's mark (fixed notation chrome).
 */
import { useEffect, useMemo, useState } from 'react'
import { ICONS, OkIcon, type IconId } from '../../look/icons'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import type { View, ViewLink, ViewModel } from '../../client'
import { cardLinks, drawnModelOf, linkByOlumi } from '../../layout'
import { useViewStore } from '../../store'
import { boardOf } from '../../canvas'
import { levelOf, useSimpleLevel } from '../simpleStore'
import { useInputsOpen } from './foldStore'
import { linkRole } from '../contract'
import { firstDraft as firstDraftOf, linkLook } from '../fields/fields'
import { DOUBT_DASH, EFFECT_STROKES, EDGE_NEUTRAL, LINK_STYLES, linkAlertStyle, linkStyle } from '../links/styles'
import { typography } from '../../../styles/typography'
import { OlumiMark } from '../cards/marks'

// The key's line samples use the canvas's role styles.
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
  measures: fromStyle(LINK_STYLES.measures),
  target: fromStyle(LINK_STYLES.target),
}
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

export type KeyUnderlay = 'dotted' | 'halo-alert' | 'halo-proposed'
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
    if (d.mark !== null) marks.add(d.mark)
    if (d.dotted) underlays.add('dotted')
    if (link.alert) underlays.add('halo-alert')
    if ((link.proposed || linkByOlumi(model, link.from, link.to)) && !first) underlays.add('halo-proposed')
  }
  return { underlays, marks }
}

/** The pill's row-1 items: core's key items (in its order) whose id this pill draws and that stand on the canvas. */
export const keyLinesOf = (model: ViewModel): { id: KeyLineId; text: string }[] => {
  const present = keyPresent(model)
  return (model.key ?? []).flatMap((k) => ((KEY_LINE_IDS as readonly string[]).includes(k.id) && present.has(k.id as KeyLineId) ? [{ id: k.id as KeyLineId, text: k.text }] : []))
}

function LineSample({ id, sample, doubt = false }: { id: KeyLineId | string; sample?: Sample; doubt?: boolean }) {
  // The canvas's own small mark for a direction not settled (canvas/edges/ViewLinkEdge MARK_ID, registry `link-unknown`), never a "?" text glyph.
  if (id === 'unsettled') return <span aria-hidden="true" data-key-sample="unsettled" className={`${typography.viewPanelMeta} grid h-4 w-4 place-items-center leading-none ok-key-unsettled`}><OkIcon id={KEY_MARK_IDS.unknown} size={14} decorative inherit /></span>
  const s = sample ?? SAMPLES[id]!
  return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={id}>
      <path d={s.end === 'arrow' ? 'M6 1V12' : s.end === 'dot' ? 'M6 1V11' : 'M6 1V15'} stroke={s.stroke} strokeWidth={s.w} strokeDasharray={doubt ? DOUBT_DASH : s.dash ?? undefined} fill="none" />
      {s.end === 'arrow' ? <path d="M2 9 6 14 10 9" stroke={s.stroke} strokeWidth={s.w} fill="none" /> : null}
      {s.end === 'dot' ? <circle cx="6" cy="13" r="2.5" fill={s.stroke} /> : null}
    </svg>
  )
}

/** A line under a halo or a dotted line, as the canvas draws them: the halo is the underlay, the line keeps its own direction colour and arrow. */
function UnderlaySample({ kind }: { kind: KeyUnderlay }) {
  if (kind === 'dotted') return <svg width="12" height="16" aria-hidden="true" data-key-sample="dotted"><path d="M6 1V15" stroke={EDGE_NEUTRAL} strokeWidth={LINK_STYLES.effect.width} className="ok-key-dotted" fill="none" /></svg>
  const s = fromStyle(LINK_STYLES.effect), stroke = EFFECT_STROKES.increases
  return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={kind} className="ok-key-underlay">
      <path d="M6 1V13" className={kind === 'halo-alert' ? 'ok-link-halo ok-link-halo-alert' : 'ok-link-halo ok-link-halo-proposed'} />
      <path d="M6 1V12" stroke={stroke} strokeWidth={s.w} fill="none" />
      <path d="M2 9 6 14 10 9" stroke={stroke} strokeWidth={s.w} fill="none" />
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
  // Swatches stand only for links the board draws as themselves: on Simple a folded input's or a closed group's links run into a neutral group connector.
  const level = useSimpleLevel((s) => levelOf(useViewStore.getState().sid, s))
  const open = useInputsOpen((s) => s.open)
  const board = useMemo(() => (model === null ? null : boardOf(model, open).model), [model, open, level])
  if (view === null || model === null || board === null) return null
  const lines = keyLinesOf(model)
  const { underlays, marks } = keyExtrasOf(view)
  const first = firstDraftOf(view).firstDraft === true
  const drawn = cardLinks(board).map(({ link }) => ({
    ...drawnAs(link),
    doubt: !!link.doubt,
    alert: linkAlertStyle(link),
    proposed: !first && (link.proposed || linkByOlumi(model, link.from, link.to)),
  }))
  // Keep the existing artwork only where the board has a link with the same look.
  const hasPolarity = (sign: (typeof EFFECT_POLARITY)[number]['id'], doubt: boolean, alert = false, proposed = false) =>
    drawn.some((d) => d.direction === (sign === 'increases' ? 'raises' : 'lowers') && d.doubt === doubt
      && d.alert === (alert ? 'halo' : null) && d.proposed === proposed)
  const boardMarks = new Set(drawn.flatMap((d) => (d.mark === null ? [] : [d.mark])))
  const showUnsettled = boardMarks.has('unknown') && lines.some((l) => l.id === 'unsettled')
  // Words are core's key items where core sends one (reason, alert, olumi), else the registry's own (the marks); a sample core has no word for stands without one.
  const coreWord = (id: string) => (model.key ?? []).find((k) => k.id === id)?.text
  const UNDERLAYS: readonly { kind: KeyUnderlay; word: string | undefined }[] = [
    { kind: 'dotted', word: coreWord('reason') }, { kind: 'halo-alert', word: coreWord('alert') }, { kind: 'halo-proposed', word: coreWord('olumi') },
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
            ? <span key={l.id} className={item} data-key-item="effect">{l.text}{EFFECT_POLARITY.map((p) => <span key={p.id} className={item} data-key-polarity={p.id}>{hasPolarity(p.id, false) && <LineSample id="effect" sample={p.sample} />}{p.word}</span>)}</span>
            : l.id === 'doubted'
              // A doubted link keeps its direction colour and arrow and only takes the dash, as the canvas draws it (L4).
              ? <span key={l.id} className={item} data-key-item="doubted">{EFFECT_POLARITY.filter((p) => hasPolarity(p.id, true)).map((p) => <span key={p.id} data-key-polarity={p.id}><LineSample id="effect" sample={p.sample} doubt /></span>)}{l.text}</span>
              : <span key={l.id} className={item} data-key-item={l.id}>
                {(l.id === 'unsettled' ? showUnsettled : drawn.some((d) => d.styled?.role === l.id && !d.doubt && d.alert === null && !d.proposed))
                  && <LineSample id={l.id} />}{l.text}
              </span>)}
        </div>
      )}
      {underlays.size === 0 && marks.size === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="drawn">
          {UNDERLAYS.filter((u) => underlays.has(u.kind)).map((u) => <span key={u.kind} className={item} data-key-item={u.kind}>
            {/* The reason sample has no end. On the board the reason has an arrow, and doubt overrides its dots. */}
            {u.kind !== 'dotted' && hasPolarity('increases', false, u.kind === 'halo-alert', u.kind === 'halo-proposed')
              && <UnderlaySample kind={u.kind} />}{u.word}
          </span>)}
          {markWords.map((w) => (
            <span key={w} className={item} data-key-item="direction">
              {(Object.keys(KEY_MARK_IDS) as KeyMark[]).filter((m) => marks.has(m) && ICONS[KEY_MARK_IDS[m]].hover === w && boardMarks.has(m) && !(m === 'unknown' && showUnsettled)).map((m) => <span key={m} data-key-direction={m} className="inline-flex"><OkIcon id={KEY_MARK_IDS[m]} size={14} decorative /></span>)}{w}
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
