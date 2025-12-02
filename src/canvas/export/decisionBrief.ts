/**
 * N1: Decision Brief Export
 *
 * Generates print-ready HTML export of comparison analysis
 * Includes: title, timestamps, stats, edge diffs, rationale, hashes
 */

import type { StoredRun } from '../store/runHistory'
import { computeEdgeDiffs, type EdgeDiffRow } from '../compare/EdgeDiffTable'

export interface DecisionBriefData {
  title: string
  runA: StoredRun
  runB: StoredRun
  rationale?: string
}

/**
 * Export decision brief as HTML with print CSS
 * Downloads as file
 */
export function exportDecisionBrief(data: DecisionBriefData): void {
  const html = generateDecisionBriefHTML(data)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `decision-brief-${Date.now()}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate HTML for decision brief
 */
export function generateDecisionBriefHTML(data: DecisionBriefData): string {
  const { title, runA, runB, rationale } = data
  const edgeDiffs = computeEdgeDiffs(runA, runB, 5)
  const timestamp = new Date().toISOString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    /* Print CSS */
    @media print {
      @page {
        margin: 2cm;
        size: A4;
      }
      body {
        font-size: 11pt;
      }
      .no-print {
        display: none;
      }
      table {
        page-break-inside: avoid;
      }
      h1, h2, h3 {
        page-break-after: avoid;
      }
    }

    /* Base styles */
    body {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #ffffff;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #111827;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0.5rem;
    }

    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #4b5563;
    }

    .meta {
      color: #6b7280;
      font-size: 0.875rem;
      margin-bottom: 2rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin: 1.5rem 0;
    }

    .stat-card {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
      background: #f9fafb;
    }

    .stat-card h3 {
      margin-top: 0;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .stat-row:last-child {
      border-bottom: none;
    }

    .stat-label {
      font-weight: 500;
      color: #6b7280;
    }

    .stat-value {
      font-weight: 700;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      color: #111827;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.875rem;
    }

    th {
      background: #f3f4f6;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid #f3f4f6;
    }

    tr:hover {
      background: #f9fafb;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-added {
      background: #d1fae5;
      color: #065f46;
    }

    .badge-removed {
      background: #fee2e2;
      color: #991b1b;
    }

    .delta-positive {
      color: #059669;
      font-weight: 600;
    }

    .delta-negative {
      color: #dc2626;
      font-weight: 600;
    }

    .mono {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 0.875em;
    }

    .rationale {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 1rem;
      margin: 1.5rem 0;
      border-radius: 0.25rem;
    }

    .hash-section {
      margin-top: 2rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      font-size: 0.75rem;
    }

    .hash-row {
      display: flex;
      gap: 1rem;
      margin: 0.5rem 0;
    }

    .hash-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 80px;
    }

    .hash-value {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      color: #374151;
    }

    .print-btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-weight: 500;
      cursor: pointer;
      margin-bottom: 1rem;
    }

    .print-btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print Decision Brief</button>

  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    Generated: ${new Date(timestamp).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}
  </div>

  <h2>Probability Bands Comparison</h2>
  <div class="stats-grid">
    ${generateStatCard('Run A', runA)}
    ${generateStatCard('Run B', runB)}
  </div>

  <h2>Top 5 Edge Differences</h2>
  ${generateEdgeDiffTable(edgeDiffs)}

  ${rationale ? `<h2>Decision Rationale</h2><div class="rationale">${escapeHtml(rationale)}</div>` : ''}

  <div class="hash-section">
    <h3 style="margin-top: 0;">Reproducibility Information</h3>
    <div class="hash-row">
      <span class="hash-label">Run A Seed:</span>
      <span class="hash-value">${runA.seed}</span>
    </div>
    <div class="hash-row">
      <span class="hash-label">Run A Hash:</span>
      <span class="hash-value">${runA.hash || 'N/A'}</span>
    </div>
    <div class="hash-row">
      <span class="hash-label">Run B Seed:</span>
      <span class="hash-value">${runB.seed}</span>
    </div>
    <div class="hash-row">
      <span class="hash-label">Run B Hash:</span>
      <span class="hash-value">${runB.hash || 'N/A'}</span>
    </div>
  </div>
</body>
</html>`
}

function generateStatCard(label: string, run: StoredRun): string {
  const report = run.report

  // Prefer normalized bands from report.run when available, otherwise fall back to legacy results
  const p10 = report.run?.bands?.p10 ?? report.results?.conservative ?? null
  const p50 = report.run?.bands?.p50 ?? report.results?.likely ?? null
  const p90 = report.run?.bands?.p90 ?? report.results?.optimistic ?? null
  const units = report.results?.unitSymbol || report.results?.units || ''

  if (p10 == null || p50 == null || p90 == null) {
    return `<div class="stat-card">
      <h3>${escapeHtml(label)}</h3>
      <div style="color: #9ca3af; font-size: 0.875rem;">No data available</div>
    </div>`
  }

  return `<div class="stat-card">
    <h3>${escapeHtml(label)}</h3>
    <div class="stat-row">
      <span class="stat-label">p10 (Conservative):</span>
      <span class="stat-value">${p10.toFixed(1)} ${escapeHtml(units)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">p50 (Most Likely):</span>
      <span class="stat-value">${p50.toFixed(1)} ${escapeHtml(units)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">p90 (Optimistic):</span>
      <span class="stat-value">${p90.toFixed(1)} ${escapeHtml(units)}</span>
    </div>
  </div>`
}

function generateEdgeDiffTable(diffs: EdgeDiffRow[]): string {
  if (diffs.length === 0) {
    return '<p style="color: #9ca3af;">No edge differences found</p>'
  }

  const rows = diffs
    .map(
      (row) => `
    <tr>
      <td>
        ${
          row.status === 'added'
            ? '<span class="badge badge-added">+</span> '
            : row.status === 'removed'
            ? '<span class="badge badge-removed">−</span> '
            : ''
        }
        ${escapeHtml(row.from)} → ${escapeHtml(row.to)}
      </td>
      <td class="mono">
        ${
          row.runA
            ? `${row.runA.weight.toFixed(2)} / ${row.runA.belief.toFixed(2)}`
            : '—'
        }
      </td>
      <td class="mono">
        ${
          row.runB
            ? `${row.runB.weight.toFixed(2)} / ${row.runB.belief.toFixed(2)}`
            : '—'
        }
      </td>
      <td class="mono ${
        row.deltaWeight > 0
          ? 'delta-positive'
          : row.deltaWeight < 0
          ? 'delta-negative'
          : ''
      }">
        ${row.status === 'matched' ? `${row.deltaWeight > 0 ? '+' : ''}${row.deltaWeight.toFixed(3)}` : '—'}
      </td>
      <td style="font-size: 0.75rem;">
        ${row.runA?.provenance ? `A: ${escapeHtml(row.runA.provenance)}<br>` : ''}
        ${row.runB?.provenance ? `B: ${escapeHtml(row.runB.provenance)}` : ''}
        ${!row.runA?.provenance && !row.runB?.provenance ? '—' : ''}
      </td>
    </tr>
  `
    )
    .join('')

  return `<table>
    <thead>
      <tr>
        <th>Edge (From → To)</th>
        <th>Run A (w/b)</th>
        <th>Run B (w/b)</th>
        <th>Δw</th>
        <th>Provenance</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`
}

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
