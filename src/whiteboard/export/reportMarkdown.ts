import { sanitizeString } from '@/sandbox/state/graphIO'
import type { Graph } from '@/domain/graph'
import { scoreGraph } from '@/domain/kr'

export type ReportOpts = {
  decisionTitle?: string | null
  decisionId: string
  focusName?: string | null
  now?: number
}

function formatISO(ts: number): string {
  try { return new Date(ts).toISOString() } catch { return '' }
}

function topContributors(graph: Graph, n = 5): Array<{ id: string; title: string; score: number }> {
  const res = scoreGraph(graph)
  const items = Object.entries(res.perNode).map(([id, score]) => {
    const title = graph.nodes[id]?.title || id
    return { id, title, score }
  })
  items.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
  return items.slice(0, n)
}

export function buildReportMarkdown(graph: Graph, opts: ReportOpts): string {
  const now = opts.now ?? Date.now()
  const decisionTitle = sanitizeString(opts.decisionTitle ?? '', 200) || `Decision ${sanitizeString(opts.decisionId, 64)}`
  const res = scoreGraph(graph)
  const scenario = Math.round(res.scenarioScore)
  const nodeCount = Object.keys(graph.nodes).length
  const edgeCount = Object.keys(graph.edges).length
  const focus = opts.focusName ? sanitizeString(opts.focusName, 120) : null
  const top = topContributors(graph, 5)

  const lines: string[] = []
  lines.push(`# ${decisionTitle}`)
  lines.push('')
  lines.push(`_Generated ${formatISO(now)}_`)
  lines.push('')
  lines.push('## Summary')
  lines.push(`- Scenario score: ${scenario}%`)
  lines.push(`- Nodes: ${nodeCount}, Links: ${edgeCount}`)
  if (focus) lines.push(`- Focus: ${focus}`)
  lines.push('')
  lines.push('## Top contributors')
  if (top.length === 0) {
    lines.push('- (none)')
  } else {
    for (const t of top) {
      lines.push(`- ${sanitizeString(t.title, 120)} — ${Math.round(t.score)}%`)
    }
  }
  lines.push('')
  lines.push('## Nodes & Links (counts)')
  lines.push(`- Node count: ${nodeCount}`)
  lines.push(`- Link count: ${edgeCount}`)
  lines.push('')
  lines.push('## Provenance')
  lines.push('- Exported from DecisionGuideAI Sandbox')
  lines.push('')
  return lines.join('\n')
}
