import { describe, it, expect } from 'vitest';
import { BoardState } from '../boardState';

// Verify that sourceHandle/targetHandle persist across reload via Yjs update

describe('BoardState - edge anchor persistence via Yjs updates', () => {
  it('persists source/target handles across reload', () => {
    const bs1 = new BoardState('anchor-board');
    const a = bs1.addNode('decision', 0, 0, 'A');
    const b = bs1.addNode('option', 100, 100, 'B');

    const addRes = bs1.addEdge({
      source: a.id,
      target: b.id,
      likelihood: 50,
      sourceHandle: 'right',
      targetHandle: 'left',
    });
    expect(addRes.error).toBeUndefined();

    const board1 = bs1.getBoard();
    const e1 = board1.edges[0];
    expect(e1.sourceHandle).toBe('right');
    expect(e1.targetHandle).toBe('left');

    // Serialize full state
    const update = bs1.getUpdate();

    // "Reload" into a new instance and apply update
    const bs2 = new BoardState('anchor-board-2');
    bs2.applyUpdate(update);

    const board2 = bs2.getBoard();
    expect(board2.edges.length).toBe(1);
    const e2 = board2.edges[0];
    expect(e2.sourceHandle).toBe('right');
    expect(e2.targetHandle).toBe('left');

    bs1.destroy();
    bs2.destroy();
  });
});
