/** Strict consumption and post-write verification for ordinary model mutations. */

import {
  ModelVersionMutationReceiptV1Schema,
  type ModelVersionMutationReceiptV1,
} from '../../v5/modelVersionMutationReceipt'
import {
  listModelVersions,
  type ListModelVersionsResult,
} from '../../adapters/cee/modelVersions'
import {
  fetchScenarioGraph,
  type ScenarioGraphResult,
} from '../../adapters/cee/scenarioGraph'
import { reconcileAppliedGraph } from '../utils/mergeAppliedGraph'

export const VERSION_HISTORY_REFRESH_EVENT = 'olumi:version-history-refresh'

export const MODEL_VERSION_RECEIPT_UNVERIFIED_COPY =
  'Olumi received an authoritative model receipt, but could not verify it against the shared model after the turn. Reload before relying on this change.'
export const MODEL_VERSION_RECEIPT_VERIFIED_COPY = 'The shared model was updated.'

export function modelVersionReceiptPresentation(
  verification: boolean | null,
  assistantText: string,
  hasAppliedGraphPatch = false,
): { content: string; suppressAppliedGraphPatch: boolean } {
  if (verification === false) {
    return {
      content: MODEL_VERSION_RECEIPT_UNVERIFIED_COPY,
      suppressAppliedGraphPatch: true,
    }
  }
  if (
    verification === true &&
    assistantText.trim().length === 0 &&
    !hasAppliedGraphPatch
  ) {
    return {
      content: MODEL_VERSION_RECEIPT_VERIFIED_COPY,
      suppressAppliedGraphPatch: false,
    }
  }
  return { content: assistantText, suppressAppliedGraphPatch: false }
}

export function readModelVersionMutationReceipt(
  raw: unknown,
): ModelVersionMutationReceiptV1 | null {
  const parsed = ModelVersionMutationReceiptV1Schema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export interface VerificationDependencies {
  list: typeof listModelVersions
  readGraph: typeof fetchScenarioGraph
}

interface ConsumptionDependencies extends VerificationDependencies {
  reconcile: typeof reconcileAppliedGraph
  signal: typeof signalVersionHistoryRefresh
}

const DEFAULT_DEPENDENCIES: VerificationDependencies = {
  list: listModelVersions,
  readGraph: fetchScenarioGraph,
}

export type ModelVersionReceiptConsumption =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'verified'; receipt: ModelVersionMutationReceiptV1 }
  | { status: 'unverified'; receipt: ModelVersionMutationReceiptV1 }

export async function consumeModelVersionMutationReceipt(
  raw: unknown,
  opts: {
    userId?: string | null
    expectedScenarioId?: string
    dependencies?: ConsumptionDependencies
  } = {},
): Promise<ModelVersionReceiptConsumption> {
  if (raw === undefined) return { status: 'absent' }
  const receipt = readModelVersionMutationReceipt(raw)
  if (receipt === null) return { status: 'invalid' }
  if (
    opts.expectedScenarioId !== undefined &&
    receipt.scenario_id !== opts.expectedScenarioId
  ) {
    return { status: 'invalid' }
  }
  const dependencies = opts.dependencies ?? {
    ...DEFAULT_DEPENDENCIES,
    reconcile: reconcileAppliedGraph,
    signal: signalVersionHistoryRefresh,
  }
  dependencies.reconcile(receipt)
  const verified = await verifyModelVersionMutationReceipt(receipt, {
    userId: opts.userId,
    dependencies,
  })
  if (verified) dependencies.signal(receipt)
  return { status: verified ? 'verified' : 'unverified', receipt }
}

export async function verifyModelVersionMutationReceipt(
  receipt: ModelVersionMutationReceiptV1,
  opts: {
    userId?: string | null
    dependencies?: VerificationDependencies
  } = {},
): Promise<boolean> {
  const dependencies = opts.dependencies ?? DEFAULT_DEPENDENCIES
  const [history, graph] = await Promise.all([
    dependencies.list(receipt.scenario_id, { userId: opts.userId }),
    dependencies.readGraph(receipt.scenario_id, { userId: opts.userId }),
  ])
  return receiptMatchesHistory(receipt, history) && receiptMatchesGraph(receipt, graph)
}

function receiptMatchesHistory(
  receipt: ModelVersionMutationReceiptV1,
  history: ListModelVersionsResult,
): boolean {
  if (history.status !== 'list' || history.contractVersion !== 'v2') return false
  if (history.currentVersionId !== receipt.version_id) return false
  const current = history.versions.find((version) => version.id === receipt.version_id)
  return current?.graphIdentityHash === receipt.full_hash
}

function receiptMatchesGraph(
  receipt: ModelVersionMutationReceiptV1,
  graph: ScenarioGraphResult,
): boolean {
  return (
    graph.status === 'graph' &&
    graph.identity?.value === receipt.full_hash &&
    graph.identity?.algorithm === receipt.hash_algorithm &&
    graph.identity?.projectionVersion === receipt.identity_projection_version &&
    graph.identity?.normaliserVersion === receipt.identity_normaliser_version &&
    graph.identity?.graphSchemaVersion === receipt.graph_schema_version
  )
}

export function signalVersionHistoryRefresh(
  receipt: Pick<ModelVersionMutationReceiptV1, 'scenario_id' | 'version_id'>,
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(VERSION_HISTORY_REFRESH_EVENT, {
      detail: { scenarioId: receipt.scenario_id, versionId: receipt.version_id },
    }),
  )
}
