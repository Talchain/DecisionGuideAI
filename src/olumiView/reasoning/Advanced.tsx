/**
 * The Reasoning tab's one depth switch (the redesign's Advanced toggle: reasoning-redesign-SPEC.md §4). Off by default; on, it adds
 * grouped bays under the glance, one open at a time, each a closed row with its count, each body core's own lines drawn by the same
 * component the Analysis tab draws them with (`Tipping`, `Rests`, `Failure`, `SharpenCard`, without their own heading and box, since
 * the bay row is their title). A bay with nothing in it is not drawn. Nothing here words a model value: a bay's title is core's heading
 * where core gives one (`run.tipping_heading`, `run.rests_heading`, `run.failure_heading`) and the Analysis tab's own label otherwise.
 *
 * Each bay belongs to a canvas lens where the lane has one, so the bay and the canvas show one thing:
 *   - What would have to be true (tipping) → What would change (`what_changes`), only when that lens can be filled (as the lens bar);
 *   - Whose guesses (rests) → Rests on (`rests_on`);
 *   - If it failed and Sharpen set none: the If it failed lens sits behind "Write mine first" (`usePreMortemGate`), never opened from here.
 * Opening a bay sets its lens; closing it (or opening another, or turning Advanced off) puts the canvas back to the model only when the
 * lens is still the one the bay set. A lens pressed on the canvas opens its bay while Advanced is on. View only: a bay writes nothing.
 *
 * Remembered per viewer in `localStorage` (`olumi.reasoning.advanced`), read and written inside try/catch: a viewer convenience only,
 * and the tab draws correctly without it (off).
 */
import { useEffect, useRef, useState } from 'react'
import type { ViewModel } from '../client'
import { failureOf, restsOf, sharpenRowsOf, tippingOf } from '../layout'
import { useDrivers, useViewLens, type ViewLens } from '../lens'
import { Failure, Rests, SHARPEN_TITLE, SharpenCard, Tipping } from '../ViewChances'
import { SectionRow } from './parts'
import { TYPE } from '../port/type'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'

export const ADVANCED_KEY = 'olumi.reasoning.advanced'
export const ADVANCED_LABEL = 'Advanced'

function readAdvanced(): boolean {
  try { return globalThis.localStorage?.getItem(ADVANCED_KEY) === '1' } catch { return false }
}

/** The switch's state, remembered for this viewer; off where storage is missing or refuses. */
export function useAdvanced(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(readAdvanced)
  const set = (next: boolean) => {
    setOn(next)
    try { globalThis.localStorage?.setItem(ADVANCED_KEY, next ? '1' : '0') } catch { /* a viewer convenience only */ }
  }
  return [on, set]
}

/** The one pill: "Advanced", pressed while on. */
export function AdvancedToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} data-testid="view-reasoning-advanced"
      className={`${TYPE.meta} inline-flex min-h-[24px] items-center rounded-full border px-3 py-1 transition-colors duration-200 motion-reduce:transition-none ${on ? 'border-text-header bg-[var(--panel-tab-active-bg)] text-text-header' : 'border-panel-border text-text-light hover:text-text-body'} ${ACTION_FOCUS}`}>
      {ADVANCED_LABEL}
    </button>
  )
}

export type BayId = 'tipping' | 'rests' | 'failure' | 'sharpen'
type Bay = { id: BayId; title: string; view?: string; count: number; lens: ViewLens | null; body: JSX.Element }

/** The bays this View fills, in the design's order (Test it, Whose, Widen it), each with its count; none core sends nothing for. */
export function baysOf(model: ViewModel, canChange: boolean): Bay[] {
  const run = model.run ?? null
  const bays: Bay[] = []
  const t = tippingOf(run), r = restsOf(run), f = failureOf(run), s = sharpenRowsOf(model)
  if (t !== null && t.lines.length + t.silent.length > 0) bays.push({ id: 'tipping', title: t.heading, view: 'run.tipping_heading', count: t.lines.length + t.silent.length, lens: canChange ? 'what_changes' : null, body: <Tipping run={run} headed={false} /> })
  if (r !== null && r.lines.length > 0) bays.push({ id: 'rests', title: r.heading, view: 'run.rests_heading', count: r.lines.length, lens: 'rests_on', body: <Rests run={run} headed={false} /> })
  if (f !== null && f.lines.length > 0) bays.push({ id: 'failure', title: f.heading, view: 'run.failure_heading', count: f.lines.length, lens: null, body: <Failure run={run} headed={false} /> })
  if (s.length > 0) bays.push({ id: 'sharpen', title: SHARPEN_TITLE, count: s.length, lens: null, body: <SharpenCard model={model} headed={false} /> })
  return bays
}

/** The bays, while Advanced is on: one open at a time, in step with the canvas lens. */
export function AdvancedBays({ model }: { model: ViewModel }) {
  const canChange = useDrivers().size > 0
  const bays = baysOf(model, canChange)
  const [open, setOpen] = useState<BayId | null>(null)
  const lens = useViewLens((s) => s.lens)
  // The lens this tab set by opening a bay, so closing it gives the canvas back only what the tab itself took.
  const setBy = useRef<ViewLens | null>(null)
  const release = () => {
    if (setBy.current !== null && useViewLens.getState().lens === setBy.current) useViewLens.setState({ lens: 'full' })
    setBy.current = null
  }
  const press = (bay: Bay, next: boolean) => {
    release()
    if (!next) { setOpen(null); return }
    setOpen(bay.id)
    if (bay.lens !== null && useViewLens.getState().lens !== bay.lens) { setBy.current = bay.lens; useViewLens.setState({ lens: bay.lens }) }
  }
  // A lens pressed on the canvas opens its bay (never the reverse of a bay's own press: the lens is then already its own).
  useEffect(() => {
    const bay = bays.find((b) => b.lens !== null && b.lens === lens)
    if (bay !== undefined && open !== bay.id) { setBy.current = null; setOpen(bay.id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a lens change only
  }, [lens])
  // Turning Advanced off (or the tab going) gives the canvas back what a bay took.
  useEffect(() => () => release(), [])
  if (bays.length === 0) return null
  return (
    <div role="group" aria-label={ADVANCED_LABEL} data-testid="view-reasoning-bays" className="space-y-1">
      {bays.map((b) => (
        <SectionRow key={b.id} title={b.title} titleView={b.view} count={b.count} testId={`bay-${b.id}`} open={open === b.id} onOpenChange={(next) => press(b, next)}>
          <div className="max-h-[280px] overflow-y-auto olumi-scrollbar" data-bay={b.id} data-bay-lens={b.lens ?? undefined}>{b.body}</div>
        </SectionRow>
      ))}
    </div>
  )
}
