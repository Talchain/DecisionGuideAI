/**
 * S5-STORAGE: Versioned Scenarios Storage Adapter
 *
 * Bridges the existing scenarios storage with the new versioned storage system.
 * Gradually migrates from legacy localStorage to versioned payloads.
 */

import type { Scenario } from './scenarios'
import {
  loadCanvasData,
  saveCanvasData,
  getStorageQuota,
  exportAsFile
} from '../persist/versionedStorage'
import type { CanvasDataV1 } from '../persist/types'

/**
 * Load scenarios using versioned storage
 * Falls back to legacy storage if migration hasn't occurred yet
 */
export async function loadScenariosVersioned(): Promise<{
  scenarios: Scenario[]
  currentScenarioId?: string
  quotaWarning?: string
}> {
  const result = loadCanvasData()

  if (!result.success) {
    console.warn('[scenariosVersioned] Failed to load:', result.error.message)
    return { scenarios: [] }
  }

  // Check quota and warn if high
  const quota = await getStorageQuota()
  let quotaWarning: string | undefined

  if (quota.percentage > 80) {
    quotaWarning = `Storage is ${quota.percentage.toFixed(1)}% full. Consider exporting your data.`
  }

  return {
    scenarios: result.data.scenarios || [],
    currentScenarioId: result.data.currentScenarioId,
    quotaWarning
  }
}

/**
 * Save scenarios using versioned storage
 * Handles quota exceeded by offering export fallback
 */
export async function saveScenariosVersioned(
  scenarios: Scenario[],
  currentScenarioId?: string
): Promise<{
  success: boolean
  error?: string
  quotaExceeded?: boolean
}> {
  const data: CanvasDataV1 = {
    scenarios,
    currentScenarioId
  }

  const result = await saveCanvasData(data)

  if (!result.success) {
    if (result.error.type === 'QUOTA_EXCEEDED') {
      console.error('[scenariosVersioned] Quota exceeded, offering export')
      // Offer export as fallback
      exportAsFile(data, `canvas-backup-${Date.now()}.json`)

      return {
        success: false,
        error: result.error.message,
        quotaExceeded: true
      }
    }

    return {
      success: false,
      error: result.error.message
    }
  }

  return { success: true }
}

/**
 * Check storage health and return warnings
 */
export async function checkStorageHealth(): Promise<{
  healthy: boolean
  percentage: number
  warnings: string[]
}> {
  const quota = await getStorageQuota()
  const warnings: string[] = []

  if (!quota.available) {
    warnings.push('Storage API unavailable')
    return { healthy: false, percentage: 100, warnings }
  }

  if (quota.percentage > 90) {
    warnings.push(`Storage critically full (${quota.percentage.toFixed(1)}%)`)
  } else if (quota.percentage > 80) {
    warnings.push(`Storage nearly full (${quota.percentage.toFixed(1)}%)`)
  }

  return {
    healthy: quota.percentage < 90,
    percentage: quota.percentage,
    warnings
  }
}
