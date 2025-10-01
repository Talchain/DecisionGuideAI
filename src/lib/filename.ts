// src/lib/filename.ts
export function formatDownloadName(
  base: string,
  opts: { seed?: string | number; model?: string; ext: string }
): string {
  const parts: string[] = [base]
  const seed = opts.seed != null && String(opts.seed).trim().length > 0 ? String(opts.seed).trim() : ''
  const model = typeof opts.model === 'string' && opts.model.trim().length > 0 ? opts.model.trim() : ''
  if (seed) parts.push(`seed-${sanitize(seed)}`)
  if (model) parts.push(`model-${sanitize(model)}`)
  const name = parts.join('_')
  const ext = opts.ext.startsWith('.') ? opts.ext.slice(1) : opts.ext
  return `${name}.${ext}`
}

function sanitize(s: string): string {
  // Replace anything not alnum, dash, dot with hyphen
  return s.replace(/[^A-Za-z0-9_.-]+/g, '-')
}
