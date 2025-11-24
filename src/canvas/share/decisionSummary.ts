import type { ScenarioFraming } from '../store/scenarios'
import type { StoredRun } from '../store/runHistory'

type OutcomeUnits = 'currency' | 'percent' | 'count'

interface OutcomeBands {
  p10: number | null
  p50: number | null
  p90: number | null
  units: OutcomeUnits
  unitSymbol?: string
}

export interface DecisionSummaryInput {
  framing: ScenarioFraming | null
  lastResultHash: string | null
  lastRunAt: string | null
  lastRunSeed: string | null
  lastRun: StoredRun | null
}

function extractOutcomeBandsFromRun(run: StoredRun | null): OutcomeBands | null {
  if (!run) return null

  const units: OutcomeUnits = (run.report?.results?.units as OutcomeUnits) ?? 'percent'
  const unitSymbol = run.report?.results?.unitSymbol

  const bands = (run.report as any)?.run?.bands
  if (bands) {
    return {
      p10: bands.p10 ?? null,
      p50: bands.p50 ?? null,
      p90: bands.p90 ?? null,
      units,
      unitSymbol,
    }
  }

  const results = run.report?.results
  if (!results) {
    return {
      p10: null,
      p50: null,
      p90: null,
      units,
      unitSymbol,
    }
  }

  return {
    p10: results.conservative ?? null,
    p50: results.likely ?? null,
    p90: results.optimistic ?? null,
    units,
    unitSymbol,
  }
}

function formatOutcomeValue(value: number | null, units: OutcomeUnits, unitSymbol?: string): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    const absolute = Math.abs(value)
    const prefix = value < 0 ? '-' : ''
    if (absolute >= 1_000_000) {
      return `${prefix}${symbol}${(absolute / 1_000_000).toFixed(1)}M`
    }
    if (absolute >= 1_000) {
      return `${prefix}${symbol}${(absolute / 1_000).toFixed(1)}K`
    }
    return `${prefix}${symbol}${absolute.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'count') {
    const absolute = Math.abs(value)
    const prefix = value < 0 ? '-' : ''
    if (absolute >= 1_000_000) {
      return `${prefix}${(absolute / 1_000_000).toFixed(1)}M`
    }
    if (absolute >= 1_000) {
      return `${prefix}${(absolute / 1_000).toFixed(1)}K`
    }
    return `${prefix}${absolute.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }

  return `${value.toFixed(1)}%`
}

function formatScenarioRunTime(iso: string | null): string {
  if (!iso) return 'Unknown'

  const safe = iso.trim()
  if (!safe) return 'Unknown'
  if (safe.length >= 16) {
    const base = safe.slice(0, 16)
    return base.replace('T', ' ')
  }
  return safe
}

function getHashSnippet(hash?: string | null): string {
  if (!hash) {
    return 'Unknown'
  }
  const safe = String(hash)
  return safe.length > 8 ? `${safe.slice(0, 8)}…` : safe
}

export function formatDecisionSummary(input: DecisionSummaryInput): string {
  const { framing, lastResultHash, lastRunAt, lastRunSeed, lastRun } = input

  const lines: string[] = []

  if (framing?.title) {
    lines.push(`Decision: ${framing.title}`)
  }

  if (framing?.goal) {
    lines.push(`Goal: ${framing.goal}`)
  }

  if (framing?.timeline) {
    lines.push(`Time horizon: ${framing.timeline}`)
  }

  const hasRunMeta = Boolean(lastResultHash || lastRunAt || lastRunSeed || lastRun)

  if (hasRunMeta) {
    const parts: string[] = []
    const timeText = formatScenarioRunTime(lastRunAt ?? null)
    if (timeText !== 'Unknown') {
      parts.push(timeText)
    }
    if (lastRunSeed) {
      parts.push(`seed ${lastRunSeed}`)
    }
    if (lastResultHash) {
      parts.push(`run ${getHashSnippet(lastResultHash)}`)
    }

    if (parts.length > 0) {
      lines.push(`Last analysed: ${parts.join(', ')}`)
    } else {
      lines.push('Last analysed: This decision has been analysed, but run metadata is incomplete.')
    }
  } else if (framing) {
    lines.push('This decision has not yet been analysed.')
  } else {
    lines.push('This decision has not yet been framed or analysed.')
  }

  const bands = extractOutcomeBandsFromRun(lastRun)

  if (bands) {
    const p10Text = formatOutcomeValue(bands.p10, bands.units, bands.unitSymbol)
    const p50Text = formatOutcomeValue(bands.p50, bands.units, bands.unitSymbol)
    const p90Text = formatOutcomeValue(bands.p90, bands.units, bands.unitSymbol)

    const allMissing = p10Text === '—' && p50Text === '—' && p90Text === '—'

    if (allMissing) {
      lines.push('Outcome bands are not available for the last run.')
    } else {
      lines.push(`Most likely outcome: ${p50Text} (p10: ${p10Text}, p90: ${p90Text})`)
    }
  } else if (hasRunMeta) {
    lines.push('Outcome bands are not available for the last run.')
  }

  return lines.join('\n')
}
