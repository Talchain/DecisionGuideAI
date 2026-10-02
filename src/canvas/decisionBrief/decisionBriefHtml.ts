/**
 * The decision brief as a standalone, printable HTML page (Print → "Save as PDF" makes the shareable file). Built
 * from the same model the panel renders; every string is escaped, and nothing is added that the model does not say.
 */
import type { BriefSource, DecisionBriefModel } from './buildDecisionBrief'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pill(source: BriefSource | null): string {
  return source ? ` <span class="src">${esc(source.label)}</span>` : ''
}

function list(items: string[], ordered = false): string {
  const tag = ordered ? 'ol' : 'ul'
  return `<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`
}

export function decisionBriefToHtml(brief: DecisionBriefModel): string {
  const title = brief.decision.label ?? 'Decision'
  const current = brief.run.status === 'current'
  const parts: string[] = []
  parts.push(`<h1>${esc(title)}</h1>`)
  parts.push(
    `<p class="meta">Saved model version ${esc(brief.version.shortVersion ?? 'not stated')}` +
      `${brief.run.computedAtText ? ` · latest Run ${esc(brief.run.computedAtText)}` : ''}</p>`,
  )
  if (brief.options.length > 0) parts.push(`<h2>Options</h2>${list(brief.options.map((o) => esc(o.label)))}`)
  if (brief.goal) {
    const target = brief.goal.targetText ? `: ${esc(brief.goal.targetText)}${pill(brief.goal.targetSource)}` : ''
    parts.push(`<h2>Goal</h2><p>${esc(brief.goal.label)}${target}</p>`)
  }
  if (brief.limits.length > 0) parts.push(`<h2>Limits</h2>${list(brief.limits.map((l) => `${esc(l.text)}${pill(l.source)}`))}`)
  parts.push(`<h2>Latest Run</h2><p>${esc(brief.run.statement)}</p>`)
  if (current && brief.chances.length > 0) {
    parts.push(
      list(
        brief.chances.map(
          (c) =>
            `<strong>${esc(c.optionLabel)}</strong>: ${esc(c.chanceText ?? c.withheldText ?? '')}` +
            (c.caveat ? `<br><span class="caveat">${esc(c.caveat)}</span>` : ''),
        ),
      ),
    )
  }
  if (current && brief.drivers.length > 0) {
    parts.push(`<h2>What drives the result most</h2>${list(brief.drivers.map((d) => esc(d.label)), true)}`)
  }
  if (brief.figures.length > 0) {
    parts.push(
      `<h2>Figures the model uses</h2>${list(brief.figures.map((f) => `${esc(f.label)}: ${esc(f.valueText)}${pill(f.source)}`))}`,
    )
  }
  if (brief.withheld.length > 0) parts.push(`<h2>Not shown, and what I need</h2>${list(brief.withheld.map((w) => esc(w.text)))}`)

  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(`Decision brief: ${title}`)}</title>
<style>
body{font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;max-width:760px;margin:0 auto;padding:32px 16px;line-height:1.55}
h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;font-weight:600;opacity:.72;margin:22px 0 6px}
.meta,.caveat{opacity:.72;font-size:13px;margin:0}.src{display:inline-block;border:1px solid currentColor;border-radius:999px;padding:0 8px;font-size:12px;margin-left:6px}
ul,ol{padding-left:20px;margin:0}li{margin:3px 0}
@media print{body{padding:0}@page{margin:18mm}}
</style></head><body>${parts.join('\n')}</body></html>`
}
