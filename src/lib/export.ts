// src/lib/export.ts
// Pure helpers for building transcript exports and a browser shim for downloads.

export type RunMeta = {
  status: 'done' | 'aborted' | 'limited' | 'error'
  startedAt: number
  finishedAt: number
  durationMs?: number
  estCost?: number
  seed?: string
  budget?: number
  model?: string
  route: 'critique' | 'ghost'
  sessionId: string
  org: string
}

export type TokenRec = { id: string; text: string }

export function buildPlainText(meta: RunMeta, fullText: string): string {
  const lines: string[] = []
  lines.push('DecisionGuideAI transcript')

  const cap = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1)
  lines.push(`Status: ${cap(meta.status)}`)
  if (typeof meta.durationMs === 'number') lines.push(`Duration: ${meta.durationMs}ms`)
  if (typeof meta.estCost === 'number') lines.push(`Cost: $${meta.estCost.toFixed(2)}`)
  if (meta.seed) lines.push(`Seed: ${meta.seed}`)
  if (typeof meta.budget === 'number') lines.push(`Budget: ${meta.budget}`)
  if (meta.model) lines.push(`Model: ${meta.model}`)
  lines.push(`Route: ${meta.route}`)
  lines.push(`Session: ${meta.sessionId}`)
  lines.push(`Org: ${meta.org}`)
  lines.push(`Started: ${new Date(meta.startedAt).toISOString()}`)
  lines.push(`Finished: ${new Date(meta.finishedAt).toISOString()}`)
  lines.push('')
  lines.push(fullText)
  return lines.join('\n')
}

export function buildJson(meta: RunMeta, tokens: TokenRec[], fullText: string): string {
  const payload = {
    meta,
    transcript: {
      text: fullText,
      tokens,
    },
  }
  return JSON.stringify(payload, null, 2)
}

// Markdown transcript with front-matter style header
export function buildMarkdown(opts: {
  status: 'done' | 'aborted' | 'limited' | 'error'
  dateISO: string
  sessionId?: string
  org?: string
  seed?: string | number
  budget?: number
  model?: string
  costUSD?: number
  text?: string
  tokens?: string[]
}): string {
  const headerLines: string[] = ['---']
  const pushIf = (label: string, value: unknown) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      headerLines.push(`${label}: ${String(value)}`)
    }
  }
  pushIf('status', opts.status)
  pushIf('date', opts.dateISO)
  pushIf('sessionId', opts.sessionId)
  pushIf('org', opts.org)
  pushIf('seed', opts.seed)
  pushIf('budget', typeof opts.budget === 'number' ? opts.budget : undefined)
  pushIf('model', opts.model)
  pushIf('costUSD', typeof opts.costUSD === 'number' ? opts.costUSD : undefined)
  headerLines.push('---', '')

  const body = (opts.text && opts.text.length)
    ? opts.text
    : ((opts.tokens && opts.tokens.length) ? opts.tokens.join('') : '*No transcript.*')

  return headerLines.join('\n') + body
}

// Helper to build a local-time filename for Markdown export
export function buildMarkdownFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  return `critique-${y}${m}${d}-${hh}${mm}.md`
}

// Browser-only shim to trigger a file download
export function triggerDownload(filename: string, mime: string, data: string): void {
  try {
    const blob = new Blob([data], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {}
}
