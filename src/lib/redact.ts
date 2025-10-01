// Privacy redactor: strips URL queries and redacts secrets in deep structures
// Secrets: authorization|token|apikey|api_key|secret|cookie (case-insensitive)

const SENSITIVE_KEY = /^(authorization|token|apikey|api[_-]?key|secret|cookie|set-cookie)$/i

function stripQuery(input: string): string {
  const s = String(input ?? '')
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s)
      u.search = ''
      return u.toString()
    }
  } catch {}
  const q = s.indexOf('?')
  if (q >= 0) {
    const sp = s.indexOf(' ', q)
    return sp >= 0 ? s.slice(0, q) + s.slice(sp) : s.slice(0, q)
  }
  return s
}

export function redact<T = any>(value: T): T {
  return _redact(value) as T
}

function _redact(value: any): any {
  if (value == null) return value
  const t = typeof value
  if (t === 'string') return stripQuery(value)
  if (t === 'number' || t === 'boolean' || t === 'bigint') return value
  if (Array.isArray(value)) return value.map(_redact)
  if (value instanceof Date || value instanceof RegExp) return value
  if (typeof value === 'object') {
    const out: any = Array.isArray(value) ? [] : {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = '[REDACTED]'
      } else if (typeof v === 'string') {
        out[k] = stripQuery(v)
      } else {
        out[k] = _redact(v)
      }
    }
    return out
  }
  try { return JSON.parse(JSON.stringify(value)) } catch { return undefined }
}
