import { sanitizeString } from '@/sandbox/state/graphIO'
import type { Graph } from '@/domain/graph'
import { scoreGraph } from '@/domain/kr'

export type ReportHtmlOpts = {
  decisionTitle?: string | null
  decisionId: string
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

export function buildReportHtml(graph: Graph, opts: ReportHtmlOpts): string {
  const now = opts.now ?? Date.now()
  const decisionTitle = sanitizeString(opts.decisionTitle ?? '', 200) || `Decision ${sanitizeString(opts.decisionId, 64)}`
  const res = scoreGraph(graph)
  const scenario = Math.round(res.scenarioScore)
  const nodeCount = Object.keys(graph.nodes).length
  const edgeCount = Object.keys(graph.edges).length
  const top = topContributors(graph, 5)

  // Escape once via sanitizeString for user-provided fields
  const esc = (s: unknown, max = 200) => sanitizeString(String(s ?? ''), max)

  const topList = top.length
    ? top.map(t => `<li>${esc(t.title, 120)} — ${Math.round(t.score)}%</li>`).join('')
    : '<li>(none)</li>'

  const iso = formatISO(now)

  return (
    `<!DOCTYPE html>` +
    `<html lang="en">` +
      `<head>` +
        `<meta charset="utf-8" />` +
        `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
        `<title>${esc(decisionTitle, 200)}</title>` +
        `<style>` +
          `:root{color-scheme:light dark}` +
          `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;line-height:1.5;margin:24px}` +
          `h1{font-size:20px;margin:0 0 8px}` +
          `h2{font-size:14px;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#555}` +
          `ul{padding-left:20px}` +
          `.meta{color:#666;font-size:12px}` +
          `.pill{display:inline-block;padding:2px 6px;border:1px solid #ddd;border-radius:6px;background:#fafafa;font-size:12px}` +
        `</style>` +
      `</head>` +
      `<body>` +
        `<h1>${esc(decisionTitle, 200)}</h1>` +
        `<div class="meta">Generated ${esc(iso, 40)}</div>` +
        `<h2>Summary</h2>` +
        `<ul>` +
          `<li>Scenario score: ${scenario}%</li>` +
          `<li>Nodes: ${nodeCount}, Links: ${edgeCount}</li>` +
        `</ul>` +
        `<h2>Top contributors</h2>` +
        `<ul>${topList}</ul>` +
        `<h2>Provenance</h2>` +
        `<div>Exported from DecisionGuideAI Sandbox</div>` +
      `</body>` +
    `</html>`
  )
}
