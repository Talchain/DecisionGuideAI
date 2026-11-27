import { create } from 'zustand'
import { runWhatIf, type WhatIfVariant } from '../../whatif'

export type TrialStep = `trial-${number}`
type Trial = { step: TrialStep; words: string; tried: number | null; variant: WhatIfVariant }
type Scope = { sid: string; base: number; record: string }
type History = { trials: readonly Trial[]; pending: boolean }

export const useStressTrials = create<{ histories: ReadonlyMap<string, History> }>()(() => ({ histories: new Map() }))
export const stressTrialKey = ({ sid, base, record }: Scope) => JSON.stringify([sid, base, record])

function putHistory(key: string, history: History) {
  useStressTrials.setState(({ histories }) => ({ histories: new Map(histories).set(key, history) }))
}

export async function tryStressValue(scope: Scope, typed: string, isCurrent: () => boolean): Promise<{ step: TrialStep } | { notice: string } | null> {
  const { sid, base, record } = scope
  const key = stressTrialKey(scope)
  const previous = useStressTrials.getState().histories.get(key)
  if (previous?.pending) return null
  let trials = previous?.trials ?? []
  putHistory(key, { trials, pending: true })
  try {
    const variant = await runWhatIf(sid, base, record, typed)
    if (!isCurrent() || variant === null) return null
    const notice = variant.stopped ?? variant.blocked
    if (notice !== null) return { notice }
    const edit = variant.edits.find(({ quantity }) => quantity === record)
    if (!edit?.words) return null

    // Core's input facts serve a point as `likely`. A range with bounds alone gives no point to mark.
    const input = variant.facts?.map(({ about }) => about as (typeof about & {
      quantity?: string; olumi?: boolean; likely?: number
    }) | undefined).find((about) => about?.kind === 'input' && about.quantity === record && about.olumi === false)
    const tried = typeof input?.likely === 'number' && Number.isFinite(input.likely) ? input.likely : null
    const step: TrialStep = `trial-${trials.length}`
    trials = [...trials, { step, words: edit.words, tried, variant }]
    return { step }
  } finally {
    putHistory(key, { trials, pending: false })
  }
}
