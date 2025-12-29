import type { GraphHealth, ValidationIssue } from '../validation/types'

export interface HealthView {
  label: string
  detail: string
  /** Message reflecting current state */
  message: string
}

/**
 * Get health message based on score and issues
 * Brief: Critical issues should dominate messaging
 */
export function getHealthMessage(score: number, issues: ValidationIssue[]): string {
  const critical = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  if (critical.length > 0) {
    return `Fix ${critical.length} structural issue${critical.length !== 1 ? 's' : ''} before analysis`
  }

  if (score < 40) {
    return 'Add more detail for reliable assessment'
  }

  if (score < 70 || warnings.length > 0) {
    return 'Good foundation — review suggestions to improve'
  }

  return 'Well-structured model ready for analysis'
}

export function buildHealthStrings(graphHealth: GraphHealth | null | undefined): HealthView {
  if (!graphHealth) {
    return {
      label: 'Run analysis to check health',
      detail: 'No recent health check. Run diagnostics to analyse this graph.',
      message: 'Run analysis to check graph health',
    }
  }

  const totalIssues = graphHealth.issues.length
  const issuesPart = totalIssues > 0 ? ` • ${totalIssues} issues` : ''
  const message = getHealthMessage(graphHealth.score, graphHealth.issues)

  if (graphHealth.status === 'healthy') {
    return {
      label: 'Health: Good',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
      message,
    }
  }

  if (graphHealth.status === 'warnings') {
    return {
      label: 'Health: Warnings',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
      message,
    }
  }

  if (graphHealth.status === 'errors') {
    return {
      label: 'Health: Errors',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
      message,
    }
  }

  return {
    label: 'Run analysis to check health',
    detail: 'No recent health check. Run diagnostics to analyse this graph.',
    message: 'Run analysis to check graph health',
  }
}
