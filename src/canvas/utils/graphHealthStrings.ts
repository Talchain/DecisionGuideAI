import type { GraphHealth } from '../validation/types'

export interface HealthView {
  label: string
  detail: string
}

export function buildHealthStrings(graphHealth: GraphHealth | null | undefined): HealthView {
  if (!graphHealth) {
    return {
      label: 'Run analysis to check health',
      detail: 'No recent health check. Run diagnostics to analyse this graph.',
    }
  }

  const totalIssues = graphHealth.issues.length
  const issuesPart = totalIssues > 0 ? ` • ${totalIssues} issues` : ''

  if (graphHealth.status === 'healthy') {
    return {
      label: 'Health: Good',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  if (graphHealth.status === 'warnings') {
    return {
      label: 'Health: Warnings',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  if (graphHealth.status === 'errors') {
    return {
      label: 'Health: Errors',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  return {
    label: 'Run analysis to check health',
    detail: 'No recent health check. Run diagnostics to analyse this graph.',
  }
}
