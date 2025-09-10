export type StrategyGoal = { id: string; title: string }
export type StrategyObjective = { id: string; title: string; goalId?: string }
export type StrategyKeyResult = { id: string; title: string; objectiveId?: string }
export type StrategyBlock = { id: string; title: string }

export type StrategySeed = {
  goals: StrategyGoal[]
  objectives: StrategyObjective[]
  keyResults: StrategyKeyResult[]
  strategyBlocks: StrategyBlock[]
}

// For this mock, we load a static seed for any decisionId.
import seedData from '@/sandbox/bridge/fixtures/strategy.seed.json'
import { isStrategyBridgeEnabled } from '@/lib/config'
import { isBoardDraft } from '@/sandbox/state/boardMeta'

export function loadSeed(_decisionId: string): StrategySeed {
  return seedData as StrategySeed
}

// Allow-listed patch contract for future write back
export type BridgePatch =
  | { linkKRToTile: { krId: string; tileId: string } }
  | { addRequiredDecision: { title: string } }

export function writeBack(decisionId: string, patch: BridgePatch): { ok: true } | { ok: false; reason: 'draft' } {
  // Safety: when bridge flag is disabled, act as a no-op
  if (!isStrategyBridgeEnabled()) return { ok: true }
  // Draft completeness: block writes while in Draft mode
  if (isBoardDraft(decisionId)) return { ok: false, reason: 'draft' }
  // Validate allow-listed keys; in a real impl we'd persist via API
  if ('linkKRToTile' in patch) {
    const { krId, tileId } = patch.linkKRToTile
    if (!krId || !tileId) throw new Error('Invalid linkKRToTile payload')
    return { ok: true }
  }
  if ('addRequiredDecision' in patch) {
    const { title } = patch.addRequiredDecision
    if (!title) throw new Error('Invalid addRequiredDecision payload')
    return { ok: true }
  }
  // TS type guards should prevent this, but keep a runtime guard
  throw new Error('Unknown patch contract')
}
