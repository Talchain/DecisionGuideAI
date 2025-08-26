import { BoardState } from '../boardState';

describe('BoardState', () => {
  let boardState: BoardState;
  
  beforeEach(() => {
    boardState = new BoardState('test-board');
  });
  
  afterEach(() => {
    boardState.destroy();
  });
  
  it('should initialize with default values', () => {
    const board = boardState.getBoard();
    expect(board).toBeDefined();
    expect(board.nodes).toHaveLength(0);
    expect(board.edges).toHaveLength(0);
    expect(board.title).toBe('Untitled Board');
  });
  
  it('should add a node', () => {
    const node = boardState.addNode('decision', 100, 100, 'Test Node');
    expect(node).toBeDefined();
    
    const board = boardState.getBoard();
    expect(board.nodes).toHaveLength(1);
    expect(board.nodes[0].label).toBe('Test Node');
  });
  
  it('should add an edge', () => {
    const node1 = boardState.addNode('decision', 100, 100, 'Node 1');
    const node2 = boardState.addNode('option', 200, 200, 'Node 2');
    
    const edge = boardState.addEdge(node1.id, node2.id);
    expect(edge).toBeDefined();
    
    const board = boardState.getBoard();
    expect(board.edges).toHaveLength(1);
    expect(board.edges[0].source).toBe(node1.id);
    expect(board.edges[0].target).toBe(node2.id);
  });
  
  it('should update a node', () => {
    const node = boardState.addNode('decision', 100, 100, 'Original');
    boardState.updateNode(node.id, { label: 'Updated' });
    
    const updatedNode = boardState.getNode(node.id);
    expect(updatedNode?.label).toBe('Updated');
  });
  
  it('should delete a node and its edges', () => {
    const node1 = boardState.addNode('decision', 100, 100, 'Node 1');
    const node2 = boardState.addNode('option', 200, 200, 'Node 2');
    boardState.addEdge(node1.id, node2.id);
    
    boardState.deleteNode(node1.id);
    
    const board = boardState.getBoard();
    expect(board.nodes).toHaveLength(1);
    expect(board.edges).toHaveLength(0);
  });
});
