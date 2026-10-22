/**
 * ⭐ WHAT IF (canvas scenario comparison, slice 1; DL GO 22 Oct 2026). The key card of the "What if" lens: hold ONE
 * different value for one factor, run it beside the saved model, and read each option's saved result next to its
 * what-if result. Nothing is saved: the press posts the held gesture to CEE's what-if route (`adapters/cee/whatIf.ts`),
 * which runs a copy of the model and writes nothing.
 *
 * ⛔ No saved-write path is reachable from here BY CONSTRUCTION (Codex AMEND risk 1): the value is typed in this card,
 *   never in a card's own value editor, so no editor opens, prefills or commits on blur.
 * ⛔ One scale rule (risk 2): the input shows what the card's editor shows (`resolveValueInputSeed`) and the gesture is
 *   built by the saved path's own builder (`buildFactorValueEditEvent`) and wire adapter (`adaptFactorValueEdit`).
 * ⛔ Results are CEE's words verbatim (its displays, its withheld sentences, its variation sentence). This card composes
 *   no words about a result, and never says "best", "winner" or "recommend".
 */
import { useEffect, useMemo, useState } from 'react'

import { getSessionIdentity } from '../../lib/supabase'
import { useIsViewer } from '../../lib/viewerMode'
import { typography } from '../../styles/typography'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { runWhatIf, type WhatIfOutcome } from '../../adapters/cee/whatIf'
import { adaptFactorValueEdit } from '../../v5/buildPayload'
import { buildFactorValueEditEvent, resolveValueInputSeed } from '../conversation/factorValueEdit'
import { figureText } from '../nodes/ProposalGhostLayer'
import { useCanvasStore } from '../store'
import { getObservedState } from '../utils/observedStateHelpers'
import { useWhatIfStore, type HeldWhatIf } from '../stores/whatIfStore'

export const WHAT_IF_COPY = {
  nothingSaved: 'What-if, nothing saved',
  legendEmpty: 'Pick a factor and try a different value. Nothing is saved.',
  legendHeld: (label: string, figure: string) => `What if ${label} were ${figure}? Nothing is saved.`,
  factor: 'Factor',
  value: 'What-if value',
  run: 'Run this what-if',
  running: 'Running the what-if…',
  clear: 'Clear',
  saved: 'Saved',
  whatIf: 'What if',
  provisional: 'Provisional',
  notPaired: 'Not confirmed like-for-like: these two runs may not have drawn the same samples, so a small difference may be noise.',
  staleBase: 'Your model changed since this what-if was set up. Run it again.',
  refused: "Olumi couldn't run this what-if on this model.",
  signIn: 'Sign in to run a what-if on this model.',
  unusable: 'The what-if could not run right now. Nothing was saved.',
  noFactors: 'This model has no factor with a value to try a different one for.',
} as const

interface FactorChoice { readonly id: string; readonly label: string; readonly saved: number; readonly unit: string }

const labelOf = (data: unknown): string => {
  const l = (data as { label?: unknown } | null)?.label
  return typeof l === 'string' ? l : ''
}

/**
 * Factors whose card shows a value IN ITS OWN UNIT: the figure the card's value editor would show. A factor whose only
 * figure is on the model's internal 0–1 scale is not offered (Codex #2902: `0.6` would read "0.6%" beside its unit while
 * meaning 60%); the card never shows that scale as a figure either.
 */
export function whatIfFactorChoices(nodes: readonly { id: string; type?: string; data: unknown }[]): FactorChoice[] {
  return nodes.flatMap((n) => {
    if (n.type !== 'factor') return []
    const { seed, inUserUnits } = resolveValueInputSeed(n.data)
    const label = labelOf(n.data)
    if (seed === undefined || !inUserUnits || label === '') return []
    const unit = getObservedState(n.data).unit
    return [{ id: n.id, label, saved: seed, unit: typeof unit === 'string' ? unit : '' }]
  })
}

/** The held change as CEE's what-if route takes it: the saved path's own gesture, held instead of sent. Null = unencodable. */
export function whatIfChangeOf(held: HeldWhatIf, nodeData: unknown): Record<string, unknown> | null {
  const event = buildFactorValueEditEvent({ nodeId: held.nodeId, typedValue: held.whatIf, nodeData })
  if (event === null) return null
  const wire = adaptFactorValueEdit(event.payload as Record<string, unknown>)
  return wire === null ? null : { ...wire }
}

/** The one sentence for an outcome that is not a result (refusal, sign-in, transport), or null for a result. */
export function whatIfNotice(outcome: WhatIfOutcome): string | null {
  if (outcome.status === 'ran') return null
  if (outcome.status === 'signInRequired') return WHAT_IF_COPY.signIn
  if (outcome.status === 'unusable') return WHAT_IF_COPY.unusable
  return outcome.reason === 'stale_base' ? WHAT_IF_COPY.staleBase : WHAT_IF_COPY.refused
}

/** A held change belongs to the model it was set up on: drop it when the scenario or the saved model moves. */
function useWhatIfStaysOnItsModel(): void {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const hash = useCanvasStore((s) => s.lastServerGraphHash)
  const held = useWhatIfStore((s) => s.held)
  const clear = useWhatIfStore((s) => s.clear)
  useEffect(() => {
    if (held !== null && (held.scenarioId !== scenarioId || held.baseGraphHash !== hash)) clear()
  }, [held, scenarioId, hash, clear])
  // Leaving the lens discards the what-if (session-only, never saved).
  useEffect(() => () => useWhatIfStore.getState().clear(), [])
}

function Cell({ cell }: { cell: { display: string | null; provisional: boolean; not_shown: string | null } }) {
  if (cell.display === null) return <span className="text-text-light">{cell.not_shown}</span>
  return (
    <span className="text-text-header">
      {cell.display}
      {cell.provisional && <span className={`${typography.panelMeta} ml-1 text-text-light`}>{WHAT_IF_COPY.provisional}</span>}
    </span>
  )
}

export function WhatIfKey({ folded }: { folded: boolean }) {
  useWhatIfStaysOnItsModel()
  const nodes = useCanvasStore((s) => s.nodes)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const hash = useCanvasStore((s) => s.lastServerGraphHash)
  const viewer = useIsViewer()
  const held = useWhatIfStore((s) => s.held)
  const run = useWhatIfStore((s) => s.run)
  const choices = useMemo(() => whatIfFactorChoices(nodes), [nodes])
  const [pickedId, setPickedId] = useState<string | null>(held?.nodeId ?? null)
  const picked = choices.find((c) => c.id === pickedId) ?? choices[0] ?? null
  const [typed, setTyped] = useState<string>(held ? String(held.whatIf) : '')
  // A draft belongs to the model it was typed on: a scenario switch or a saved change starts it afresh.
  useEffect(() => { setPickedId(null); setTyped('') }, [scenarioId, hash])
  // Any edit makes the shown result no longer the answer to what is on screen: drop it (a late answer is dropped too).
  const edit = (next: () => void) => { next(); if (useWhatIfStore.getState().held !== null || useWhatIfStore.getState().run.kind !== 'idle') useWhatIfStore.getState().clear() }

  if (folded) {
    return (
      <p data-testid="what-if-legend" className={`${typography.panelBody} text-text-body`}>
        {held ? WHAT_IF_COPY.legendHeld(held.label, figureText({ value: held.whatIf, unit: held.unit })) : WHAT_IF_COPY.legendEmpty}
      </p>
    )
  }
  if (picked === null) return <p data-testid="what-if-no-factors" className={`${typography.panelBody} text-text-body`}>{WHAT_IF_COPY.noFactors}</p>

  const value = Number(typed)
  const canRun = !viewer && scenarioId !== null && typed.trim() !== '' && Number.isFinite(value) && value !== picked.saved
    && run.kind !== 'running'

  const press = async () => {
    if (!canRun || scenarioId === null) return
    const next: HeldWhatIf = { scenarioId, baseGraphHash: hash, nodeId: picked.id, label: picked.label, saved: picked.saved, whatIf: value, unit: picked.unit }
    const store = useWhatIfStore.getState()
    store.hold(next)
    const change = whatIfChangeOf(next, nodes.find((n) => n.id === picked.id)?.data)
    const seq = useWhatIfStore.getState().start()
    if (change === null) { useWhatIfStore.getState().finish(seq, { status: 'refused', reason: 'unencodable' }); return }
    const identity = await getSessionIdentity()
    const outcome = await runWhatIf(scenarioId, { changes: [change], ...(hash === null ? {} : { base_graph_hash: hash }) }, identity)
    useWhatIfStore.getState().finish(seq, outcome)
  }

  const optionLabel = (id: string) => labelOf(nodes.find((n) => n.id === id && n.type === 'option')?.data) || null
  const outcome = run.kind === 'done' ? run.outcome : null
  const notice = outcome === null ? null : whatIfNotice(outcome)

  return (
    <div data-testid="what-if-key" className="space-y-3">
      <p className={`${typography.panelMeta} text-text-light`}>{WHAT_IF_COPY.nothingSaved}</p>
      <div className="flex flex-col gap-2">
        <label className={`${typography.panelMeta} flex flex-col gap-1 text-text-light`}>
          {WHAT_IF_COPY.factor}
          <select
            data-testid="what-if-factor"
            value={picked.id}
            onChange={(e) => { const id = e.target.value; edit(() => { setPickedId(id); setTyped('') }) }}
            className={`${typography.panelBody} rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body ${ACTION_FOCUS}`}
          >
            {choices.map((c) => <option key={c.id} value={c.id}>{`${c.label} (${figureText({ value: c.saved, unit: c.unit })})`}</option>)}
          </select>
        </label>
        <label className={`${typography.panelMeta} flex flex-col gap-1 text-text-light`}>
          {WHAT_IF_COPY.value}
          <span className="flex items-center gap-2">
            <input
              data-testid="what-if-value"
              type="number"
              inputMode="decimal"
              value={typed}
              placeholder={String(picked.saved)}
              onChange={(e) => { const v = e.target.value; edit(() => setTyped(v)) }}
              className={`${typography.panelBody} w-28 rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body ${ACTION_FOCUS}`}
            />
            {picked.unit !== '' && <span className={`${typography.panelBody} text-text-body`}>{picked.unit}</span>}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="what-if-run"
            disabled={!canRun}
            onClick={() => { void press() }}
            className={`${typography.panelBody} ${action('primary')} rounded-full px-3 py-1 disabled:opacity-50 ${ACTION_FOCUS}`}
          >
            {run.kind === 'running' ? WHAT_IF_COPY.running : WHAT_IF_COPY.run}
          </button>
          {held !== null && (
            <button
              type="button"
              data-testid="what-if-clear"
              onClick={() => { useWhatIfStore.getState().clear(); setTyped('') }}
              className={`${typography.panelBody} ${action('secondary')} rounded-full px-3 py-1 ${ACTION_FOCUS}`}
            >
              {WHAT_IF_COPY.clear}
            </button>
          )}
        </div>
      </div>
      {notice !== null && <p data-testid="what-if-notice" role="status" className={`${typography.panelBody} text-text-body`}>{notice}</p>}
      {outcome?.status === 'refused' && (outcome.nextStep !== undefined || outcome.questions !== undefined) && (
        <div data-testid="what-if-why" className={`${typography.panelBody} space-y-1 text-text-body`}>
          {outcome.nextStep !== undefined && <p>{outcome.nextStep}</p>}
          {outcome.questions !== undefined && <ul className="list-disc space-y-0.5 pl-4">{outcome.questions.map((q) => <li key={q}>{q}</li>)}</ul>}
        </div>
      )}
      {outcome?.status === 'ran' && (
        <div data-testid="what-if-result" className="space-y-2">
          {!outcome.paired && <p data-testid="what-if-not-paired" className={`${typography.panelMeta} text-text-light`}>{WHAT_IF_COPY.notPaired}</p>}
          <ul className="space-y-2">
            {outcome.options.flatMap((row) => {
              const label = optionLabel(row.option_id)
              if (label === null) return []
              return [(
                <li key={row.option_id} data-testid={`what-if-row-${row.option_id}`} className={`${typography.panelBody} space-y-0.5`}>
                  <p className="text-text-header">{label}</p>
                  <p><span className="text-text-light">{WHAT_IF_COPY.saved}: </span><Cell cell={row.saved} /></p>
                  <p><span className="text-text-light">{WHAT_IF_COPY.whatIf}: </span><Cell cell={row.what_if} /></p>
                  {row.variation_words !== null && <p className={`${typography.panelMeta} text-text-light`}>{row.variation_words}</p>}
                </li>
              )]
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
