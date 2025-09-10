import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BoardState } from '../boardState';

describe('BoardState - edge guards and updates', () => {
  let bs: BoardState;

  beforeEach(() => {
    bs = new BoardState('guards-board');
  });

  afterEach(() => {
    bs.destroy();
  });

  it('rejects duplicate edges considering handles', () => {
    const a = bs.addNode('decision', 0, 0, 'A');
    const b = bs.addNode('option', 100, 100, 'B');

    // First edge (no handles)
    const e1 = bs.addEdge(a.id, b.id);
    expect(e1.error).toBeUndefined();

    // Duplicate with same (undefined) handles should be rejected
    const dup = bs.addEdge(a.id, b.id);
    expect(dup.error).toBeTruthy();

    // Edge with explicit different handles should be allowed
    const e2 = bs.addEdge({ source: a.id, target: b.id, likelihood: 50, sourceHandle: 'right', targetHandle: 'left' });
    expect(e2.error).toBeUndefined();

    // Duplicate same handles should now be rejected
    const dup2 = bs.addEdge({ source: a.id, target: b.id, likelihood: 50, sourceHandle: 'right', targetHandle: 'left' });
    expect(dup2.error).toBeTruthy();
  });

  it('rejects self-loops', () => {
    const a = bs.addNode('decision', 0, 0, 'A');
    const res = bs.addEdge(a.id, a.id);
    expect(res.error).toBeTruthy();
  });

  it('rejects back-edge creating a cycle', () => {
    const a = bs.addNode('decision', 0, 0, 'A');
    const b = bs.addNode('option', 100, 100, 'B');
    const c = bs.addNode('outcome', 200, 200, 'C');

    expect(bs.addEdge(a.id, b.id).error).toBeUndefined();
    expect(bs.addEdge(b.id, c.id).error).toBeUndefined();

    // C -> A would close the cycle A->B->C->A
    const cyc = bs.addEdge(c.id, a.id);
    expect(cyc.error).toBeTruthy();
  });

  it('updateEdge preserves handles unless explicitly changed', () => {
    const a = bs.addNode('decision', 0, 0, 'A');
    const b = bs.addNode('option', 100, 100, 'B');

    const eRes = bs.addEdge({ source: a.id, target: b.id, likelihood: 50, sourceHandle: 'right', targetHandle: 'left' });
    expect(eRes.error).toBeUndefined();

    const board1 = bs.getBoard();
    const edge = board1.edges[0];
    expect(edge.sourceHandle).toBe('right');
    expect(edge.targetHandle).toBe('left');

    // Update only likelihood; handles should remain
    const upd = bs.updateEdge(edge.id, { likelihood: 80 });
    expect(upd.success).toBe(true);

    const board2 = bs.getBoard();
    const edge2 = board2.edges[0];
    expect(edge2.likelihood).toBe(80);
    expect(edge2.sourceHandle).toBe('right');
    expect(edge2.targetHandle).toBe('left');

    // Now explicitly change handles
    const upd2 = bs.updateEdge(edge.id, { sourceHandle: 'top', targetHandle: 'bottom' });
    expect(upd2.success).toBe(true);

    const edge3 = bs.getBoard().edges[0];
    expect(edge3.sourceHandle).toBe('top');
    expect(edge3.targetHandle).toBe('bottom');
  });

  it('updateEdge rejects changing to a duplicate edge (including handles)', () => {
    const a = bs.addNode('decision', 0, 0, 'A');
    const b = bs.addNode('option', 100, 100, 'B');

    const e1 = bs.addEdge({ source: a.id, target: b.id, likelihood: 50, sourceHandle: 'left', targetHandle: 'right' });
    const e2 = bs.addEdge({ source: a.id, target: b.id, likelihood: 50, sourceHandle: 'right', targetHandle: 'left' });
    expect(e1.error).toBeUndefined();
    expect(e2.error).toBeUndefined();

    const board = bs.getBoard();
    const first = board.edges.find(e => e.sourceHandle === 'left');
    const second = board.edges.find(e => e.sourceHandle === 'right');
    expect(first && second).toBeTruthy();

    // Try to change first edge handles to match second
    const res = bs.updateEdge(first!.id, { sourceHandle: 'right', targetHandle: 'left' });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
