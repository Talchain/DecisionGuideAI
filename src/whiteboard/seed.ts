import { supabase } from '@/lib/supabase'

export type SeedResult = {
  doc: {
    meta: { decision_id: string; kind: 'sandbox' }
    shapes: any[]
    bindings: any[]
  }
}

// Helper: choose assumptions precedence
export function pickAssumptions(analysisData: any, decisionData: any): any[] {
  const frameAssumptions = analysisData?.frame?.assumptions
  const stepAssumptions = decisionData?.step_data?.assumptions
  if (Array.isArray(frameAssumptions)) return frameAssumptions
  if (Array.isArray(stepAssumptions)) return stepAssumptions
  return []
}

// Helper: create even split probabilities for N options
export function evenSplit(n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor((1000 / n)) // thousandths for precision
  const rem = 1000 - base * n
  const arr = Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0))
  return arr.map((x) => x / 1000)
}

export async function loadSeed(decisionId: string): Promise<SeedResult> {
  // Fetch decision title/description
  const { data: decision } = await (supabase as any)
    .from('decisions')
    .select('id, title, description')
    .eq('id', decisionId)
    .maybeSingle()

  // Fetch decision_analysis for assumptions
  const { data: analysisRow } = await (supabase as any)
    .from('decision_analysis')
    .select('analysis_data')
    .eq('decision_id', decisionId)
    .maybeSingle()

  // Optional legacy decision_data
  const { data: decisionDataRow } = await (supabase as any)
    .from('decision_data')
    .select('step_data')
    .eq('decision_id', decisionId)
    .maybeSingle()

  // Fetch options table if present
  const { data: optionsRows } = await (supabase as any)
    .from('options')
    .select('id, title, probability, decision_id')
    .eq('decision_id', decisionId)

  const assumptions = pickAssumptions(analysisRow?.analysis_data, decisionDataRow)

  const options = Array.isArray(optionsRows) ? optionsRows : []
  const probs = options.length > 0
    ? options.map((o: any) => typeof o.probability === 'number' ? o.probability : null)
    : evenSplit(2) // default two-way split

  // Build a minimal tldraw doc: one ScenarioTile + connectors
  const scenarioId = `scenario_${decisionId}`
  const shapes: any[] = [
    {
      id: scenarioId,
      type: 'scenario-tile',
      x: 0,
      y: 0,
      props: {
        title: decision?.title ?? 'Scenario',
        description: decision?.description ?? '',
        assumptions,
        status: 'draft',
      },
    },
  ]

  const bindings: any[] = []

  // Create connectors for options
  const usedProbs = options.length > 0 ? probs : evenSplit(Math.max(2, options.length || 2))
  const labels = options.length > 0 ? options.map((o: any) => o.title ?? 'Option') : ['Option A', 'Option B']

  labels.forEach((label, i) => {
    const id = `conn_${i}`
    shapes.push({
      id,
      type: 'probability-connector',
      x: 100 + i * 160,
      y: 0,
      props: {
        label,
        p: usedProbs[i] ?? 0.5,
        from: scenarioId,
        to: `${scenarioId}_out_${i}`,
        fromSide: 'right',
        toSide: 'left',
      },
    })
  })

  return {
    doc: {
      meta: { decision_id: decisionId, kind: 'sandbox' },
      shapes,
      bindings,
    },
  }
}
