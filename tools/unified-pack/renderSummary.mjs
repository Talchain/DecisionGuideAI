// tools/unified-pack/renderSummary.mjs

const THRESHOLDS = {
  ui_layout_p95_ms: 150,
  engine_get_p95_ms: 600,
  claude_ttff_ms: 500,
  claude_cancel_ms: 150
}

/**
 * Renders SLO_SUMMARY.md markdown table.
 */
export function renderSLOSummary(slos) {
  const rows = [
    ['SLO Metric', 'Value', 'Threshold', 'Status'],
    ['---', '---', '---', '---']
  ]

  for (const [key, threshold] of Object.entries(THRESHOLDS)) {
    const value = slos[key]
    const valueStr = value === null ? 'N/A' : String(value)
    const status = value === null ? '⚠️' : (value <= threshold ? '✅' : '❌')
    rows.push([key, valueStr, String(threshold), status])
  }

  return rows.map(r => `| ${r.join(' | ')} |`).join('\n')
}

/**
 * Renders READY_BADGE.svg.
 * GREEN if all SLOs present and within thresholds.
 * AMBER if any SLO is null (pack missing).
 * RED if any SLO exceeds threshold.
 */
export function renderBadge(slos) {
  let status = 'READY'
  let color = '#4CAF50' // GREEN

  for (const [key, threshold] of Object.entries(THRESHOLDS)) {
    const value = slos[key]
    if (value === null) {
      status = 'INCOMPLETE'
      color = '#FF9800' // AMBER
      break
    }
    if (value > threshold) {
      status = 'FAILED'
      color = '#F44336' // RED
      break
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="20">
  <rect width="140" height="20" fill="${color}"/>
  <text x="70" y="14" font-family="Arial" font-size="12" fill="white" text-anchor="middle">${status}</text>
</svg>`
}