/**
 * P0-2: Export Scenario to File
 *
 * Exports a scenario with metadata + graph as downloadable JSON file.
 * Format: `{scenarioName}.olumi.json`
 */

import type { Scenario } from '../store/scenarios'

export interface ScenarioExportData {
  format: 'olumi-scenario-v1'
  exportedAt: string
  scenario: {
    id: string
    name: string
    createdAt: number
    updatedAt: number
    source_template_id?: string
    source_template_version?: string
    last_result_hash?: string
  }
  graph: {
    nodes: any[]
    edges: any[]
  }
}

/**
 * Export scenario to downloadable JSON file
 */
export function exportScenario(scenario: Scenario): void {
  const data: ScenarioExportData = {
    format: 'olumi-scenario-v1',
    exportedAt: new Date().toISOString(),
    scenario: {
      id: scenario.id,
      name: scenario.name,
      createdAt: scenario.createdAt,
      updatedAt: scenario.updatedAt,
      source_template_id: scenario.source_template_id,
      source_template_version: scenario.source_template_version,
      last_result_hash: scenario.last_result_hash
    },
    graph: scenario.graph
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitiseFilename(scenario.name)}.olumi.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Sanitise scenario name for use as filename
 */
function sanitiseFilename(name: string): string {
  return name
    .replace(/[^a-z0-9\s\-_]/gi, '') // Remove special chars
    .replace(/\s+/g, '-')             // Replace spaces with hyphens
    .toLowerCase()
    .slice(0, 100) || 'scenario' // Fallback to 'scenario' if empty
}
