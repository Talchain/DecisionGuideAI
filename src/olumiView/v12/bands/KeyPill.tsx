/**
 * The key's link lines and marks, drawn inside the ONE key, "How to read this" (ViewLegend), opened from the left foot menu (Paul, 17 Nov: "Shouldn't
 * we just improve the key that's in the left-hand bottom menu?"; the always-on bottom-right pill is gone). Row 1: a line sample for each link role
 * present on the canvas (and "doubted", "not settled" where such a link is drawn), each with core's own words from `model.key` (ids effect, input,
 * size, doubted, unsettled, measures, target); only the items core sends are drawn. Row 2, present-only (panel-visual L1, L2, L4): the dotted reason line, the alert and proposal halos under a line, and the six midpoint direction marks in the registry's ids and words. Row 3: Olumi's mark and a person's mark (fixed notation chrome).
 */
import { useEffect, useId, useState } from 'react'
import { ICONS, OkIcon, type IconId } from '../../look/icons'
import { measureDockInset } from '../../../canvas/components/FloatingOlumiPanel'
import type { View, ViewLink, ViewModel } from '../../client'
import { cardLinks, drawnModelOf, linkByOlumi } from '../../layout'
import { useViewStore } from '../../store'
import { firstDraft as firstDraftOf } from '../fields/fields'
import { edgeLook, type EdgeLookState } from '../links/edgeLook'
import { EndMarker } from '../links/LinkEnds'
import { useDriverLink } from '../../lens'
import { useFocusPath } from './focusPath'
import { typography } from '../../../styles/typography'
import { OlumiMark } from '../cards/marks'

const SAMPLE_LINK: ViewLink = {
  kind: 'plain', from: '', to: '', label: '', title: '', records: [],
  doubt: false, alert: false, proposed: false, effect: null, remove: null, holds: null, causal: null,
}

export const EFFECT_POLARITY = [
  { id: 'increases', word: 'increases', direction: 'raises' },
  { id: 'decreases', word: 'decreases', direction: 'lowers' },
] as const
/** The key ids this pill draws as line samples; `doubted` is the effect line's own colours and arrow, dashed; `unsettled` draws the canvas's own not-settled mark. */
export const KEY_LINE_IDS = ['effect', 'input', 'size', 'doubted', 'unsettled', 'measures', 'target'] as const
type KeyLineId = (typeof KEY_LINE_IDS)[number]

/** The six midpoint direction marks, in the registry's ids (look/icons.tsx `link-*`), as the canvas draws them (ViewLinkEdge MARK_ID). */
export const KEY_MARK_IDS = { raises: 'link-raises', lowers: 'link-lowers', depends: 'link-depends', disputed: 'link-disputed', unknown: 'link-unknown', none: 'link-none' } as const satisfies Record<string, IconId>
export type KeyMark = keyof typeof KEY_MARK_IDS

/** Which key items stand on the canvas now: a modelled effect (a typed `causal` or a `direction`), a role's line, a doubted link, a link whose direction is not settled. */
export function keyPresent(model: ViewModel): ReadonlySet<KeyLineId> {
  const out = new Set<KeyLineId>()
  for (const { link } of cardLinks(drawnModelOf(model))) {
    const d = edgeLook({ link })
    if (d.modelled) out.add('effect')
    else if (d.styled !== null) out.add(d.styled.role as KeyLineId)
    if (link.doubt) out.add('doubted')
    if (d.direction === 'depends' || d.direction === 'disputed' || d.direction === 'unknown') out.add('unsettled')
  }
  return out
}

export type KeyUnderlay = 'dotted' | 'reason-alert' | 'halo-alert' | 'halo-proposed'
type UnderlayExample = EdgeLookState & { i: number }

/**
 * What else the canvas draws now (L1, L2, L4), present-only: a dotted reason line, the alert halo (core's orange), the proposal halo (Olumi's blue, never on a
 * first draft, R3), and which of the six midpoint direction marks stand on a line.
 */
export function keyExtrasOf(view: View) {
  const samples = new Map<KeyUnderlay, UnderlayExample>()
  const marks = new Set<KeyMark>()
  const model = view.model
  if (model != null) {
    const firstDraft = firstDraftOf(view).firstDraft === true
    for (const { link, i } of cardLinks(drawnModelOf(model))) {
      const state = { link, i, firstDraft, byOlumi: linkByOlumi(model, link.from, link.to) }
      const { mark, reasonAlert, dotted, halos } = edgeLook(state)
      if (mark !== null) marks.add(mark)
      if (reasonAlert) {
        const example = samples.get('reason-alert')
        // Show the dash when a challenged reason is also doubted, as on the capacity board.
        if (!example || (!example.link.doubt && link.doubt)) samples.set('reason-alert', state)
      } else if (dotted && !samples.has('dotted')) {
        samples.set('dotted', state)
      }
      for (const { kind } of halos) {
        const id = `halo-${kind}` as const
        if (!samples.has(id)) samples.set(id, state)
      }
    }
  }
  return { samples, underlays: new Set(samples.keys()), marks }
}

/** The pill's row-1 items: core's key items (in its order) whose id this pill draws and that stand on the canvas. */
export const keyLinesOf = (model: ViewModel): { id: KeyLineId; text: string }[] => {
  const present = keyPresent(model)
  return (model.key ?? []).flatMap((k) => ((KEY_LINE_IDS as readonly string[]).includes(k.id) && present.has(k.id as KeyLineId) ? [{ id: k.id as KeyLineId, text: k.text }] : []))
}

/** The miniature uses the board's line, halos and end marker over a short vertical path. */
export function KeyLinkSample({ id, state }: { id: string; state: EdgeLookState }) {
  const marker = useId()
  const { toneClass, lineClass, dash, end, halos } = edgeLook(state)
  const path = end === 'none' ? 'M6 1V15' : 'M6 1V12'
  return (
    <svg width="12" height="16" aria-hidden="true" data-key-sample={id} data-link-dash={dash ?? undefined} className={`ok-key-sample ${toneClass}`}>
      <defs><EndMarker id={marker} end={end} /></defs>
      {halos.map(({ kind, className }) => <path key={kind} data-link-halo-path={kind} d={path} className={className} />)}
      <path d={path} className={lineClass} fill="none" markerEnd={end === 'none' ? undefined : `url(#${marker})`} />
    </svg>
  )
}

function LineSample({ id, direction, doubt = false }: { id: Exclude<KeyLineId, 'doubted'>; direction?: ViewLink['direction']; doubt?: boolean }) {
  if (id === 'unsettled') return <span aria-hidden="true" data-key-sample="unsettled" className={`${typography.viewPanelMeta} grid h-4 w-4 place-items-center leading-none ok-key-unsettled`}><OkIcon id={KEY_MARK_IDS.unknown} size={14} decorative inherit /></span>
  return <KeyLinkSample id={id} state={{ link: { ...SAMPLE_LINK, role: id, direction, doubt } }} />
}

function UnderlaySample({ id, state }: { id: KeyUnderlay; state: UnderlayExample }) {
  const { link, i } = state
  const onPath = useFocusPath(({ path }) => path !== null && path.has(link.from) && path.has(link.to))
  const driver = useDriverLink(i)
  return <KeyLinkSample id={id} state={{ ...state, onPath, driver }} />
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
  const { samples, marks } = keyExtrasOf(view)
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
            ? <span key={l.id} className={item} data-key-item="effect">{l.text}{EFFECT_POLARITY.map((p) => <span key={p.id} className={item} data-key-polarity={p.id}><LineSample id="effect" direction={p.direction} />{p.word}</span>)}</span>
            : l.id === 'doubted'
              // A doubted link keeps its direction colour and arrow and only takes the dash, as the canvas draws it (L4).
              ? <span key={l.id} className={item} data-key-item="doubted">{EFFECT_POLARITY.map((p) => <span key={p.id} data-key-polarity={p.id}><LineSample id="effect" direction={p.direction} doubt /></span>)}{l.text}</span>
              : <span key={l.id} className={item} data-key-item={l.id}><LineSample id={l.id} />{l.text}</span>)}
        </div>
      )}
      {samples.size === 0 && marks.size === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-key-row="drawn">
          {UNDERLAYS.map(({ kind, word }) => {
            const state = samples.get(kind)
            return state && <span key={kind} className={item} data-key-item={kind}><UnderlaySample id={kind} state={state} />{word}</span>
          })}
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
