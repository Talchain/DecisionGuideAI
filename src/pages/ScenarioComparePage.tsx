import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Minus, Plus, RefreshCw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as scenarioService from '../services/scenarioService'
import { fetchScenarioGraph, type ScenarioGraphResult } from '../adapters/cee/scenarioGraph'
import { leaderClaimWithholdingReason } from '../canvas/hydrate/applyScenarioAnalysisRead'
import { scenarioDisplayTitle } from '../canvas/domain/scenarioDisplayTitle'
import { getSessionIdentity } from '../lib/supabase'
import { scienceChangeText } from '../components/science/ScienceQuantity'
import type { ScenarioListItem, ScenarioRow } from '../types/scenario'
import { typography } from '../styles/typography'

type Item = { id?: string; label?: string; data?: Record<string, unknown>; source?: string; target?: string; from?: string; to?: string }
type Graph = { nodes: Item[]; edges: Item[] }
type Diff = { added: Item[]; removed: Item[]; changed: Array<{ left: Item; right: Item; matchedByName: boolean }> }
const graphOf = (row: ScenarioRow): Graph => { const graph = row.graph as { nodes?: unknown; edges?: unknown } | null; return { nodes: Array.isArray(graph?.nodes) ? graph.nodes as Item[] : [], edges: Array.isArray(graph?.edges) ? graph.edges as Item[] : [] } }
const value = (item: Item, key: string): unknown => item.data?.[key] ?? item[key as keyof Item]
const label = (item: Item): string => typeof value(item, 'label') === 'string' ? value(item, 'label') as string : 'Unnamed model item'
const nameKey = (item: Item): string => `${String(value(item, 'kind') ?? '')}:${label(item).trim().toLowerCase()}`
// IDENTITY. Stored nodes carry `id`. Stored EDGES DO NOT (real rows: `{ from, to, strength, effect_direction, … }`),
// so an edge is identified by its endpoints. Keying edges on a missing `id` made every edge collide on `undefined`.
const itemKey = (item: Item): string => typeof item.id === 'string' && item.id ? item.id : `${String(item.source ?? item.from ?? '')}→${String(item.target ?? item.to ?? '')}`
function diffItems(left: Item[], right: Item[], leftName: (item: Item) => string = nameKey, rightName: (item: Item) => string = nameKey): Diff { const byId = new Map(right.map(item => [itemKey(item), item])); const remaining = new Set(right); const removed: Item[] = []; const changed: Diff['changed'] = []; left.forEach(item => { const match = byId.get(itemKey(item)); if (match && remaining.has(match)) { remaining.delete(match); if (JSON.stringify(item) !== JSON.stringify(match)) changed.push({ left: item, right: match, matchedByName: false }) } else removed.push(item) }); removed.slice().forEach(item => { const match = [...remaining].find(candidate => rightName(candidate) === leftName(item)); if (match) { remaining.delete(match); removed.splice(removed.indexOf(item), 1); changed.push({ left: item, right: match, matchedByName: true }) } }); return { added: [...remaining], removed, changed } }
const endpointLabel = (id: string | undefined, graph: Graph): string => label(graph.nodes.find(node => node.id === id) ?? { id: '', label: id })
function edgeLabel(item: Item, graph: Graph): string { return `${endpointLabel(item.source ?? item.from, graph)} → ${endpointLabel(item.target ?? item.to, graph)}` }
// A stored link has no name of its own; two independently drafted models share a link when its ENDPOINTS share names.
const edgeName = (graph: Graph) => (item: Item): string => edgeLabel(item, graph).trim().toLowerCase()
const diffGraph = (a: Graph, b: Graph) => ({ nodes: diffItems(a.nodes, b.nodes), edges: diffItems(a.edges, b.edges, edgeName(a), edgeName(b)) })
const NO_RESULT = 'No current result for this scenario yet. Open it and run the analysis.'
const LOAD_FAILED = "Couldn't load this scenario's result"
const optionLabels = (result: unknown): string[] => { const rows = (result as { enrichment?: { option_comparison?: unknown } } | null)?.enrichment?.option_comparison; return Array.isArray(rows) ? rows.map(row => (row as { label?: unknown } | null)?.label).filter((item): item is string => typeof item === 'string' && item.trim() !== '') : [] }
/**
 * What one side's server read says, in plain words and with no figures.
 *
 * Every branch is a state the server AFFIRMED. Real reads (staging, 4 Oct 2026) include a current Run whose leader
 * claim is withheld with `leading_option_id: null`, and a stale Run with no result block: both used to read
 * "No current result", which was false for the first and unhelpful for the second. Only a read that did not answer
 * says it could not be loaded.
 */
export function resultFromRead(read: ScenarioGraphResult): string {
  if (read.status === 'absent') return NO_RESULT
  if (read.status === 'signInRequired') return "Sign in again to see this scenario's result."
  if (read.status !== 'graph') return LOAD_FAILED
  const state = read.analysisState
  if (!state) return NO_RESULT
  const kind = state.run_state.kind
  if (kind === 'running') return 'The analysis is running. Check back shortly.'
  if (kind === 'complete_stale') return 'The model has changed since it was last analysed. Open it and run the analysis again.'
  if (kind === 'blocked' || kind === 'refused') return 'The analysis could not run on this model. Open the scenario to see what it needs.'
  if (kind !== 'complete_current') return NO_RESULT
  const withheld = leaderClaimWithholdingReason(state)
  if (withheld === 'analysis_unusable') return "The last analysis can't be relied on. Open the scenario and run it again."
  const result = read.analysisResult as { summary?: unknown; leading_option_id?: unknown; enrichment?: { option_comparison?: Array<{ id?: unknown; label?: unknown }> } } | null
  const leader = !withheld && result && typeof result.leading_option_id === 'string' ? result.enrichment?.option_comparison?.find(item => item.id === result.leading_option_id) : undefined
  if (leader && typeof leader.label === 'string' && typeof result?.summary === 'string') return `${leader.label}: ${result.summary}`
  const labels = optionLabels(result)
  return `The analysis ran on the current model and does not single out a leading option.${labels.length ? ` It compared ${labels.join(', ')}.` : ''}`
}
function changedWords(left: Item, right: Item, graph: Graph, edge: boolean): string { if (edge) { const before = value(left, 'strength'); const after = value(right, 'strength'); const n = (x: unknown) => typeof x === 'number' ? x : x && typeof x === 'object' && typeof (x as { mean?: unknown }).mean === 'number' ? (x as { mean: number }).mean : undefined; const a = n(before); const b = n(after); if (a !== undefined && b !== undefined && a !== b) return `${edgeLabel(left, graph)} changed strength: ${scienceChangeText('strength', a, b) ?? 'changed'}`; return `${edgeLabel(left, graph)} changed` } return `${label(left)} changed` }
function Side({ row, result }: { row: ScenarioRow; result: string | undefined }) { const graph = graphOf(row); return <section className="rounded-[20px] bg-panel shadow-1 p-5" data-testid="comparison-side"><h2 className={`${typography.h3} text-text-header`}>{scenarioDisplayTitle(row) ?? 'Untitled scenario'}</h2><p className={`${typography.caption} text-text-light mt-1`}>{graph.nodes.length} model items, {graph.edges.length} links</p><h3 className={`${typography.label} text-text-header mt-5 border-t border-border-subtle pt-4`}>Current result</h3><p className={`${typography.body} text-text-body mt-2`} data-testid="comparison-result">{result ?? 'Loading this scenario’s result…'}</p></section> }
function DiffGroup({ label: heading, diff, graph, otherGraph, edge }: { label: string; diff: Diff; graph: Graph; otherGraph: Graph; edge: boolean }) { return <div><h3 className={`${typography.label} text-text-header`}>{heading}</h3><div className="mt-2 space-y-1">{diff.added.map(item => <p key={`a-${itemKey(item)}`}><Plus className="inline w-3 h-3" /> Added: {edge ? edgeLabel(item, otherGraph) : label(item)}</p>)}{diff.removed.map(item => <p key={`r-${itemKey(item)}`}><Minus className="inline w-3 h-3" /> Removed: {edge ? edgeLabel(item, graph) : label(item)}</p>)}{diff.changed.map(item => <p key={`c-${itemKey(item.left)}-${itemKey(item.right)}`}><RefreshCw className="inline w-3 h-3" /> {changedWords(item.left, item.right, graph, edge)}{item.matchedByName ? ' (matched by name)' : ''}</p>)}{!diff.added.length && !diff.removed.length && !diff.changed.length && <p>No differences.</p>}</div></div> }
export default function ScenarioComparePage() { const { id } = useParams<{ id: string }>(); const navigate = useNavigate(); const { user } = useAuth(); const [left, setLeft] = useState<ScenarioRow | null>(null); const [right, setRight] = useState<ScenarioRow | null>(null); const [items, setItems] = useState<ScenarioListItem[]>([]); const [results, setResults] = useState<Record<string, string>>({}); const [error, setError] = useState<string | null>(null)
 useEffect(() => { if (!id || !user?.id) return; Promise.all([scenarioService.loadScenario(id), scenarioService.listScenarios(user.id)]).then(([loaded, listed]) => { if (!loaded) throw new Error('Scenario not found.'); setLeft(loaded); setItems(listed.filter(item => item.id !== id && !item.is_archived)) }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load scenarios.')) }, [id, user?.id])
 useEffect(() => { setRight(null); setResults({}) }, [id])
 // THE SAME READ THE CANVAS PERFORMS (`useSavedScenarioRead`, `serverGraphHydration`): the user's access token goes
 // with it. CEE requires the user JWT on this route; a read without one resolves no owner and answers 404 "No readable
 // graph" for the user's OWN scenario (reproduced against staging, 4 Oct 2026: 404 without the token, 200 with it).
 useEffect(() => { if (!left || !right) return; const controller = new AbortController(); setResults({}); void (async () => { const identity = await getSessionIdentity().catch(() => ({ userId: null, accessToken: null })); const read = (scenarioId: string) => fetchScenarioGraph(scenarioId, { userId: identity.userId ?? user?.id, accessToken: identity.accessToken, signal: controller.signal }).catch((): ScenarioGraphResult => ({ status: 'unusable' })); const [a, b] = await Promise.all([read(left.id), read(right.id)]); if (!controller.signal.aborted) setResults({ [left.id]: resultFromRead(a), [right.id]: resultFromRead(b) }) })(); return () => controller.abort() }, [left, right, user?.id])
 const comparison = useMemo(() => left && right ? diffGraph(graphOf(left), graphOf(right)) : null, [left, right]); if (error) return <main className="p-8">{error}</main>; if (!left) return <main className="p-8">Loading comparison…</main>
 const changed = comparison ? comparison.nodes.added.concat(comparison.nodes.removed) : []; const counts = comparison ? { options: changed.filter(item => value(item, 'kind') === 'option').length, factors: changed.filter(item => value(item, 'kind') === 'factor').length, links: comparison.edges.added.length + comparison.edges.removed.length + comparison.edges.changed.length } : null
 return <main className="min-h-full bg-canvas p-6 md:p-8"><button type="button" onClick={() => navigate(`/scenario/${left.id}`)}><ArrowLeft className="inline w-4 h-4" /> Back to scenario</button><h1 className={`${typography.h2} text-text-header mt-6`}>Compare scenarios</h1><select aria-label="Scenario to compare" value={right?.id ?? ''} onChange={async event => { if (!event.target.value || event.target.value === left.id) return; setRight(await scenarioService.loadScenario(event.target.value)) }}><option value="">Choose another scenario</option>{items.map(item => <option key={item.id} value={item.id}>{scenarioDisplayTitle(item) ?? 'Untitled scenario'}</option>)}</select>{!right ? <p>Choose one of your scenarios to see the comparison.</p> : <><div className="grid gap-4 md:grid-cols-2 mt-6"><Side row={left} result={results[left.id]} /><Side row={right} result={results[right.id]} /></div>{comparison && <section data-testid="comparison-differences"><h2>Model differences</h2>{counts && <p data-testid="comparison-summary">{counts.options} options, {counts.factors} factors and {counts.links} links differ.</p>}<p>Matched by identity first, then by kind and name; unmatched items are added or removed.</p><DiffGroup label="Model items" diff={comparison.nodes} graph={graphOf(left)} otherGraph={graphOf(right)} edge={false} /><DiffGroup label="Links" diff={comparison.edges} graph={graphOf(left)} otherGraph={graphOf(right)} edge /></section>}</>}</main> }
