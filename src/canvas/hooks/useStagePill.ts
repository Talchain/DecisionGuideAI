/**
 * useStagePill — Stage pill display data for the TopBar (A.15)
 *
 * Returns the current decision lifecycle stage with label and border colour
 * for rendering the stage pill. Reads from the canvas store (hydrated from
 * Supabase or set by the orchestrator). Falls back to local derivation when
 * no explicit stage is set.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import type { ScenarioStage } from '../../types/scenario'

export interface StagePillData {
  stage: ScenarioStage
  label: string
  /** CSS variable value for the 2px border colour */
  borderColor: string
  /** Whether the value came from the store or was derived locally */
  source: 'store' | 'fallback'
}

const STAGE_LABELS: Record<ScenarioStage, string> = {
  frame: 'Frame',
  ideate: 'Ideate',
  evaluate: 'Evaluate',
  decide: 'Decide',
  optimise: 'Optimise',
}

// A.15: Border colours per stage group
// sand-200 = var(--border-default) for frame/ideate (Draft state)
// sky-500  = var(--info)           for evaluate/decide (Active state)
// mint-500 = var(--success)        for optimise (Complete state)
const STAGE_BORDER: Record<ScenarioStage, string> = {
  frame: 'var(--border-default, #EEE6D8)',
  ideate: 'var(--border-default, #EEE6D8)',
  evaluate: 'var(--info, #63ADCF)',
  decide: 'var(--info, #63ADCF)',
  optimise: 'var(--success, #67C89E)',
}

// UI-SEM-020: Stage derivation from canvas state
// Remove when orchestrator provides envelope.stage_indicator
export function deriveStageFromState(
  hasNodes: boolean,
  isComplete: boolean,
): ScenarioStage {
  if (!hasNodes) return 'frame'
  if (isComplete) return 'evaluate'
  return 'ideate'
}

export function useStagePill(): StagePillData {
  const currentStage = useCanvasStore((s) => s.currentStage)
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const resultsStatus = useCanvasStore((s) => s.results.status)

  return useMemo(() => {
    if (currentStage !== null) {
      if (import.meta.env.DEV) {
        console.debug('[useStagePill] source=store stage=%s', currentStage)
      }
      return {
        stage: currentStage,
        label: STAGE_LABELS[currentStage],
        borderColor: STAGE_BORDER[currentStage],
        source: 'store' as const,
      }
    }

    // UI-SEM-020: Fallback derivation
    const hasNodes = nodeCount > 0
    const isComplete = resultsStatus === 'complete'
    const derived = deriveStageFromState(hasNodes, isComplete)

    if (import.meta.env.DEV) {
      console.debug('[useStagePill] source=fallback stage=%s (nodes=%d, complete=%s)', derived, nodeCount, isComplete)
    }

    return {
      stage: derived,
      label: STAGE_LABELS[derived],
      borderColor: STAGE_BORDER[derived],
      source: 'fallback' as const,
    }
  }, [currentStage, nodeCount, resultsStatus])
}
