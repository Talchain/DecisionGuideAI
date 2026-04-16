import fs from 'node:fs'
import path from 'node:path'

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function summariseTurn(log) {
  const blocks = log.blocks.map((b) => b.type).join(', ') || '—'
  const chips = log.suggested_actions.length > 0
    ? log.suggested_actions.map((c) => `${c.label}(${c.action_type || 'no-type'})`).join(' | ')
    : '—'
  const tools = log.executed_tools.length > 0 ? log.executed_tools.join(', ') : '—'
  const flags = []
  if (log.flags.action_language_without_block) flags.push('ACTION_NO_BLOCK')
  if (log.flags.contains_html_or_code) flags.push('HTML_OR_CODE')
  if (!log.flags.graph_validity_pass) flags.push('GRAPH_INVALID')
  if (log.flags.orphaned_new_nodes.length > 0) flags.push(`ORPHANED(${log.flags.orphaned_new_nodes.length})`)
  const delta = log.graph_delta
  const deltaStr = `nodes:${delta.nodes_before}→${delta.nodes_after}` +
    (delta.added_node_ids.length ? ` +${delta.added_node_ids.length}` : '') +
    (delta.removed_node_ids.length ? ` −${delta.removed_node_ids.length}` : '') +
    `, edges:${delta.edges_before}→${delta.edges_after}` +
    (delta.added_edge_ids.length ? ` +${delta.added_edge_ids.length}` : '') +
    (delta.removed_edge_ids.length ? ` −${delta.removed_edge_ids.length}` : '')

  return [
    `### Turn ${log.turn} · \`${log.turn_type}\` · ${log.pass ? 'PASS' : 'FAIL'}`,
    ``,
    `- **Prompt:** ${log.message.replace(/\n/g, ' ')}`,
    `- **Assistant preview:** ${log.assistant_text_preview.replace(/\n/g, ' ') || '—'}`,
    `- **Tools (${log.tool_source}):** ${tools}`,
    `- **Model / Provider / Prompt:** ${log.model ?? '—'} / ${log.provider ?? '—'} / ${log.prompt_version ?? '—'}`,
    `- **Latency / Transport / Cache:** ${log.latency_ms}ms · ${log.transport ?? '—'} · cache_hit=${log.cache_hit === null ? 'unknown' : log.cache_hit}`,
    `- **Blocks:** ${blocks}`,
    `- **Chips:** ${chips}`,
    `- **Stage:** ${log.stage_indicator ?? '—'}`,
    `- **Graph delta:** ${deltaStr}`,
    delta.added_node_ids.length > 0 ? `  - added node ids: \`${delta.added_node_ids.join('`, `')}\`` : null,
    delta.removed_node_ids.length > 0 ? `  - removed node ids: \`${delta.removed_node_ids.join('`, `')}\`` : null,
    `- **Flags:** ${flags.length > 0 ? flags.join(', ') : 'clean'}`,
    log.failures.length > 0 ? `- **Failures:** ${log.failures.join(' · ')}` : null,
    ``,
  ].filter((x) => x !== null).join('\n')
}

function scenarioSection(result) {
  const status = result.pass ? '✅ PASS' : '❌ FAIL'
  const body = [
    `## ${result.name} — ${status}`,
    ``,
    result.failures.length > 0 ? `**Failures:** ${result.failures.join(' · ')}` : '',
    ``,
    ...result.logs.map(summariseTurn),
  ].filter(Boolean).join('\n')
  return body
}

function matrixTable(results) {
  const header = `| Scenario | Result | Turns | Failures |\n|---|---|---|---|`
  const rows = results.map((r) => {
    const res = r.pass ? '✅ PASS' : '❌ FAIL'
    const f = r.failures.length > 0 ? r.failures.join(' · ') : '—'
    return `| \`${r.name}\` | ${res} | ${r.logs.length} | ${f} |`
  })
  return [header, ...rows].join('\n')
}

export function buildMarkdown({ results, mode, startedAt, finishedAt }) {
  const passed = results.filter((r) => r.pass).length
  const total = results.length
  const lines = [
    `# Staging conversation eval — ${startedAt}`,
    ``,
    `- **Transport:** ${mode === 'stream' ? 'SSE (/orchestrate/v1/turn/stream)' : 'sync (/orchestrate/v1/turn)'}`,
    `- **Started:** ${startedAt}`,
    `- **Finished:** ${finishedAt}`,
    `- **Result:** ${passed}/${total} scenarios passed`,
    ``,
    `## Notes on assertions`,
    ``,
    `- \`executed_tools\` is derived from (in priority order): SSE \`tool_start\` events, \`envelope._diagnostic_trace.llm_calls[].tool_name\`, or synthesized from block ops + \`analysis_response\`. The source is recorded per turn.`,
    `- S1/S2 pass criteria (user) referenced \`add_option\`, \`adjust_edge_strength\`, \`add_factor\` — these are chip \`action_type\` values in the app, not orchestrator tool names. The script interprets them as patch-op intent: "structural" vs "calibration-only". The real orchestrator tool registry is \`draft_graph\`, \`edit_graph\`, \`run_analysis\`, \`explain_results\`, \`research_topic\`.`,
    `- \`action_language_without_block\` is a **hard fail** for S1, S2, and S3 (mutating scenarios).`,
    `- Graph integrity rule: every newly-added node (any kind) must have ≥1 incident edge after patch apply; orphaned new nodes fail the scenario.`,
    ``,
    `## Pass/fail matrix`,
    ``,
    matrixTable(results),
    ``,
    `## Per-scenario detail`,
    ``,
    ...results.map(scenarioSection),
  ]
  return lines.join('\n')
}

export function writeReports({ results, mode, startedAt, finishedAt, outDir }) {
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = ts()
  const jsonPath = path.join(outDir, `staging-eval-${stamp}.json`)
  const mdPath = path.join(outDir, `staging-eval-${stamp}.md`)

  const jsonPayload = {
    version: 1,
    mode,
    startedAt,
    finishedAt,
    env: {
      CEE_BASE_URL: process.env.CEE_BASE_URL ?? 'https://cee-staging.onrender.com',
      node: process.version,
    },
    scenarios: results,
  }
  fs.writeFileSync(jsonPath, JSON.stringify(jsonPayload, null, 2))
  fs.writeFileSync(mdPath, buildMarkdown({ results, mode, startedAt, finishedAt }))
  return { jsonPath, mdPath }
}

export function printConsole(results) {
  const rows = results.map((r) => ({
    scenario: r.name,
    result: r.pass ? 'PASS' : 'FAIL',
    turns: r.logs.length,
    failures: r.failures.length > 0 ? r.failures.join(' · ').slice(0, 80) : '—',
  }))
  // eslint-disable-next-line no-console
  console.table(rows)
  const pass = results.filter((r) => r.pass).length
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${pass}/${results.length} scenarios passed`)
}
