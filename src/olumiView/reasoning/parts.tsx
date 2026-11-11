/**
 * The crafted Reasoning panel's own parts (Reasoning V2 prototype, `prototype/ReasoningPanelV3.tsx`), ported onto the olumi-core lane with
 * the R25 type roles (12 metadata, 14 reading) and the panel's action and icon tiers (`analysisNew/panelSurfaces.ts`):
 * - `ZoneTitle`: the zone's h3 (`ChallengeCard`'s `.section-title` row), its acts slot at the row's far end;
 * - `SectionRow`: `SectionShell`'s closed row (an icon box, the title, the count, the chevron), the one disclosure treatment for depth;
 * - `Door`: `ReasoningSignals`' "Assumptions and evidence" door (`action('disclose')`, a rotating chevron, the label), closed at rest;
 * - `SignalRow`: `pre-analysis-v3/sharpen/SignalRow`'s grid (a 16px mark column, the line, an end slot), at the crafted row's smaller
 *   reading size (12px, under the zone's 14px question), so the question stays the zone's one focus.
 * A closed region is unmounted, never hidden, so a reader never walks what a sighted reader cannot see (`DisclosureRow`'s rule). Every
 * open or closed region carries `data-disclosure`, so the audit reads it as disclosure. Nothing here words a model value: the labels are
 * the tab's own (`REASONING_LABELS`), the counts are how many rows are drawn, and every row's words come in from the caller.
 */
import { useId, useState, type ComponentType, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS, action, icon } from '../../components/results/analysisNew/panelSurfaces'
import { TYPE } from '../port/type'

type Glyph = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

/** A zone's heading, with its acts (if any) at the row's far end, as the crafted ChallengeCard's title row. */
export function ZoneTitle({ children, acts = null, testId }: { children: string; acts?: ReactNode; testId?: string }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <h3 className={`${typography.panelHeader} m-0 text-text-header`} data-testid={testId}>{children}</h3>
      {acts}
    </div>
  )
}

/** How many rows a disclosure holds: structure (a count of what is drawn), never a View value. */
function Count({ n, testId }: { n: number; testId?: string }) {
  return n > 0 ? <span className={`${TYPE.meta} shrink-0 tabular-nums text-text-light`} data-count data-testid={testId}>{n}</span> : null
}

/**
 * The crafted section row (`SectionShell`): heading wraps the button (the accordion pattern), an icon in a 24px box, the title, the count
 * and a chevron on the right; the region under it, unmounted while closed.
 */
export function SectionRow({ title, Icon, count, defaultOpen = false, testId, children }: { title: string; Icon?: Glyph; count: number; defaultOpen?: boolean; testId: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const region = useId()
  return (
    <section aria-label={title} data-testid={`view-reasoning-${testId}`} data-disclosure={open ? 'open' : 'closed'}>
      <h3 className="m-0">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? region : undefined} data-testid={`view-reasoning-${testId}-toggle`}
          className={`flex min-h-[24px] w-full items-center gap-3 rounded py-2 text-left hover:opacity-80 ${ACTION_FOCUS}`}>
          {Icon === undefined ? null : <span className="flex h-6 w-6 shrink-0 items-center justify-center"><Icon className={`${icon('row')} text-text-light`} aria-hidden={true} /></span>}
          <span className={`${typography.panelHeader} min-w-0 flex-1 text-text-header`}>{title}</span>
          <Count n={count} testId={`view-reasoning-${testId}-count`} />
          <ChevronRight className={`${icon('section')} shrink-0 text-text-light transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} aria-hidden={true} />
        </button>
      </h3>
      {open ? <div id={region} className="space-y-2 pb-2 pt-1" data-testid={`view-reasoning-${testId}-region`}>{children}</div> : null}
    </section>
  )
}

/** The crafted "Assumptions and evidence" door (`ReasoningSignals`, closed at rest): a quiet disclose act, its region under it. */
export function Door({ label, count, testId, children }: { label: string; count: number; testId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const region = useId()
  return (
    <section aria-label={label} data-testid={`view-reasoning-${testId}`} data-disclosure={open ? 'open' : 'closed'}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={open ? region : undefined} data-testid={`view-reasoning-${testId}-toggle`}
        className={`${TYPE.body} ${action('disclose')}`}>
        <ChevronRight className={`${icon('row')} shrink-0 text-text-light transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} aria-hidden={true} />
        <span>{label}</span>
        <Count n={count} />
      </button>
      {open ? <div id={region} className="mt-1" data-testid={`view-reasoning-${testId}-region`}>{children}</div> : null}
    </section>
  )
}

/**
 * A long line held to two lines at rest, with the crafted ChallengeCard's own "More" / "Less" text act beside it (its body clamp, Paul's
 * 30 Sep cut-back). Short lines are drawn whole with no act. The clamp is disclosure, never a cut: the region says so (`data-disclosure`),
 * and the whole line is one press away and on hover. `long` is the caller's measure of the line (a length, never a value).
 */
export function Clamped({ long, labels, children, testId, lines = 2 }: { long: boolean; labels: { more: string; less: string }; children: ReactNode; testId: string; lines?: 1 | 2 }) {
  const [open, setOpen] = useState(false)
  if (!long) return <>{children}</>
  return (
    <span className="block min-w-0" data-disclosure={open ? 'open' : 'closed'} data-testid={testId}>
      {/* `line-clamp-2` brings its own display (-webkit-box); a `block` beside it would win and undo the clamp. */}
      <span className={open ? 'block' : lines === 1 ? 'line-clamp-1' : 'line-clamp-2'}>{children}</span>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${TYPE.meta} ${action('text')}`} data-testid={`${testId}-more`}>
        {open ? labels.less : labels.more}
      </button>
    </span>
  )
}

/** One row in the crafted SignalRow grid: core's mark in the 16px column, the line, and an end slot (core's Olumi mark). */
export function SignalRow({ mark, children, end = null, title, ...data }: { mark: ReactNode; children: ReactNode; end?: ReactNode; title?: string } & Record<`data-${string}`, string>) {
  return (
    <div className={`${TYPE.meta} grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2 py-1`} title={title} {...data}>
      <span className="text-center text-text-light" aria-hidden="true">{mark}</span>
      <p className="m-0 min-w-0 text-text-body">{children}</p>
      {end === null ? <span aria-hidden="true" /> : <span className="shrink-0">{end}</span>}
    </div>
  )
}
