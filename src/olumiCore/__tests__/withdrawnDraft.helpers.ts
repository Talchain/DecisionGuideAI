/** A CoreTurn body as the shim sends it, for the specs that apply one. */
export function turnBodyForTest(over: Record<string, unknown>): Record<string, unknown> {
  return {
    turn_id: 't-1', assistant_text: 'x', cards: [], notes: [], run: null, receipts: [], error: null,
    model: { revision: '48e2a1babc59ccfd', scenario_revision: 'c57ba8f34f877fa3bcce4de5c6f40c527f8578e821e04b0b9f4237baf2184d9f', graph: { nodes: [{ id: 'a', kind: 'factor', label: 'a', ref: 'F1' }], edges: [] } },
    ...over,
  }
}
