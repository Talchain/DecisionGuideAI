// src/lib/reportSchema.ts
// Minimal, dependency-free schema guard for report JSON (v1)
// We keep this intentionally shallow and forwards-compatible.

export type ReportV1 = {
  // Accept either numeric or string version tag when present
  version: number | string
  // Legacy fields we currently render in the UI
  seed: number | string
  route: string
  startedAt: string
  finishedAt: string
  totals: Record<string, unknown>
  steps: Array<any>
  // Optional extra fields (tolerated)
  orgId?: string
  userId?: string
  traceId?: string
  confidence?: Record<string, unknown>
  // Forwards-compatible optional fields
  meta: Record<string, unknown>
  sections: Array<any>
  [k: string]: unknown
}

export function validateReportV1(input: unknown): { ok: true; data: ReportV1 } | { ok: false; error: string } {
  try {
    const r = input as any
    if (!r || typeof r !== 'object') return { ok: false, error: 'not_object' }

    // version is required and must be 1 or '1'
    if (r.version == null) return { ok: false, error: 'missing_version' }
    {
      const v = r.version
      const ok = v === 1 || v === '1'
      if (!ok) return { ok: false, error: 'bad_version' }
    }

    if (!(typeof r.route === 'string' && r.route.length > 0)) return { ok: false, error: 'missing_route' }
    if (!(r.startedAt && typeof r.startedAt === 'string')) return { ok: false, error: 'missing_startedAt' }
    if (!(r.finishedAt && typeof r.finishedAt === 'string')) return { ok: false, error: 'missing_finishedAt' }
    if (!(r.steps && Array.isArray(r.steps))) return { ok: false, error: 'missing_steps' }
    if (!(r.totals && typeof r.totals === 'object')) return { ok: false, error: 'missing_totals' }
    if (r.seed == null) return { ok: false, error: 'missing_seed' }

    // meta/sections are required but shallowly validated
    if (!(r.meta && typeof r.meta === 'object')) return { ok: false, error: 'missing_meta' }
    if (!(r.sections && Array.isArray(r.sections))) return { ok: false, error: 'missing_sections' }
    return { ok: true, data: r as ReportV1 }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}
