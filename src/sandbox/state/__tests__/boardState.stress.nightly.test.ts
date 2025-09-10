import { describe, it, expect } from 'vitest';
import { BoardState } from '../boardState';

// Nightly Stress test: create many nodes/edges and ensure no ID collisions

const run = process.env.NIGHTLY === '1' ? describe : describe.skip
run('BoardState stress - UUID uniqueness (nightly)', () => {
  it('creates 5,001 nodes and 5,000 edges with unique IDs', () => {
    const bs = new BoardState('stress-board');

    const nodeIds = new Set<string>();
    const NODES = 5001;

    for (let i = 0; i < NODES; i++) {
      const n = bs.addNode('decision', i, i, `Node ${i}`);
      expect(nodeIds.has(n.id)).toBe(false);
      nodeIds.add(n.id);
    }

    const edgeIds = new Set<string>();
    const EDGES = NODES - 1; // chain

    // chain edges node[i] -> node[i+1]
    const board = bs.getBoard();
    for (let i = 0; i < EDGES; i++) {
      const res = bs.addEdge(board.nodes[i].id, board.nodes[i + 1].id);
      expect(res.error).toBeUndefined();
      expect(res.id).toBeTruthy();
      expect(edgeIds.has(res.id)).toBe(false);
      edgeIds.add(res.id);
    }

    expect(nodeIds.size).toBe(NODES);
    expect(edgeIds.size).toBe(EDGES);

    bs.destroy();
  }, 30_000);
});
