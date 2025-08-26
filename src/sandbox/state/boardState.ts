import * as Y from 'yjs';
import * as React from 'react';

export interface Node {
  id: string;
  type: 'decision' | 'option' | 'outcome';
  x: number;
  y: number;
  label: string;
  data?: Record<string, unknown>;
}

export type Handle = 'left' | 'right' | 'top' | 'bottom';

export interface Edge {
  id: string;
  source: string;
  target: string;
  likelihood?: number;
  // Optional handles: persisted when provided; legacy edges may omit
  sourceHandle?: Handle;
  targetHandle?: Handle;
}

export interface Board {
  id: string;
  title: string;
  nodes: Node[];
  edges: Edge[];
  version: number;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  createdBy: string;
}

interface SnapshotMeta {
  id: string;
  name: string;
  timestamp: number;
  state: Uint8Array;
}

export class BoardState {
  private doc: Y.Doc;
  private nodes: Y.Array<Y.Map<unknown>>;
  private edges: Y.Array<Y.Map<unknown>>;
  private meta: Y.Map<unknown>;

  private snapshots: SnapshotMeta[] = [];

  constructor(boardId?: string) {
    this.doc = new Y.Doc();
    this.nodes = this.doc.getArray('nodes');
    this.edges = this.doc.getArray('edges');
    this.meta = this.doc.getMap('meta');

    if (!boardId) {
      this.initializeNewBoard();
    } else {
      this.loadBoard(boardId);
    }
  }

  private initializeNewBoard() {
    this.meta.set('id', `board_${Date.now()}`);
    this.meta.set('title', 'Untitled Board');
    this.meta.set('version', 1);
    this.meta.set('createdAt', new Date().toISOString());
    this.meta.set('updatedAt', new Date().toISOString());
    this.meta.set('isDraft', true);
    this.meta.set('createdBy', 'user'); // TODO: Replace with actual user ID
  }

  private async loadBoard(boardId: string) {
    // TODO: Load board data from the server
    // For now, initialize minimal metadata for existing boardId with sensible defaults
    this.meta.set('id', boardId);
    if (!this.meta.get('title')) this.meta.set('title', 'Untitled Board');
    if (!this.meta.get('version')) this.meta.set('version', 1);
    if (!this.meta.get('createdAt')) this.meta.set('createdAt', new Date().toISOString());
    if (!this.meta.get('updatedAt')) this.meta.set('updatedAt', new Date().toISOString());
    if (!this.meta.get('isDraft')) this.meta.set('isDraft', true);
    if (!this.meta.get('createdBy')) this.meta.set('createdBy', 'user');
  }

  // Graph validation helpers
  private hasEdge(sourceId: string, targetId: string): boolean {
    for (let i = 0; i < this.edges.length; i++) {
      const edge = this.edges.get(i);
      if (edge.get('source') === sourceId && edge.get('target') === targetId) {
        return true;
      }
    }
    return false;
  }

  private wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // Create a visited set to detect cycles
    const visited = new Set<string>();
    
    // Perform a depth-first search to detect cycles
    const hasCycle = (nodeId: string): boolean => {
      if (visited.has(nodeId)) return false;
      if (nodeId === sourceId) return true;
      
      visited.add(nodeId);
      
      // Get all outgoing edges from this node
      const outgoingEdges: Y.Map<unknown>[] = [];
      for (let i = 0; i < this.edges.length; i++) {
        const edge = this.edges.get(i);
        if (edge.get('source') === nodeId) {
          outgoingEdges.push(edge);
        }
      }
      
      // Check each outgoing edge for cycles
      for (const edge of outgoingEdges) {
        const target = edge.get('target') as string;
        if (hasCycle(target)) return true;
      }
      
      return false;
    };
    
    return hasCycle(targetId);
  }

  // Node operations (supports legacy signature)
  addNode(node: Omit<Node, 'id'>): Node;
  addNode(type: Node['type'], x: number, y: number, label: string): Node;
  addNode(arg1: any, arg2?: any, arg3?: any, arg4?: any): Node {
    const node: Omit<Node, 'id'> =
      typeof arg1 === 'string'
        ? { type: arg1 as Node['type'], x: arg2 as number, y: arg3 as number, label: arg4 as string }
        : (arg1 as Omit<Node, 'id'>);
    console.log('[DEBUG] addNode called');
    let nodeId = ''; let createdNode: Node | null = null;
    this.doc.transact(() => {
      const nodeMap = new Y.Map<unknown>();
      nodeId = `node_${Date.now()}`;
      Object.entries({ ...node, id: nodeId }).forEach(([key, value]) => {
        nodeMap.set(key, value);
      });
      this.nodes.push([nodeMap]);
      this.meta.set('updatedAt', new Date().toISOString());
      // Compose the created node object
      createdNode = { ...node, id: nodeId } as Node;
      console.log('[DEBUG] Node added in Yjs', nodeId);
    });
    console.log('[DEBUG] Board after addNode:', this.getBoard());
    if (!createdNode) throw new Error('Failed to create node');
    return createdNode;
  }

  updateNode(nodeId: string, updates: Partial<Node>): boolean {
    const nodeIndex = this.nodes.toArray().findIndex((n: Y.Map<unknown>) => n.get('id') === nodeId);
    if (nodeIndex === -1) return false;

    const node = this.nodes.get(nodeIndex);
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        node.set(key, value);
      }
    });
    
    return true;
  }

  deleteNode(nodeId: string): boolean {
    const nodeIndex = this.nodes.toArray().findIndex((n: Y.Map<unknown>) => n.get('id') === nodeId);
    if (nodeIndex === -1) return false;
    
    // Delete all edges connected to this node
    const edgesToDelete: number[] = [];
    for (let i = 0; i < this.edges.length; i++) {
      const edge = this.edges.get(i);
      if (edge.get('source') === nodeId || edge.get('target') === nodeId) {
        edgesToDelete.push(i);
      }
    }
    
    // Delete edges in reverse order to avoid index shifting issues
    for (let i = edgesToDelete.length - 1; i >= 0; i--) {
      this.edges.delete(edgesToDelete[i], 1);
    }
    
    // Delete the node
    this.nodes.delete(nodeIndex, 1);
    return true;
  }

  // Edge operations (supports legacy signature)
  addEdge(edge: Omit<Edge, 'id'>): { id: string; error?: string };
  addEdge(source: string, target: string): { id: string; error?: string };
  addEdge(arg1: any, arg2?: any): { id: string; error?: string } {
    const edge: Omit<Edge, 'id'> =
      typeof arg1 === 'string'
        ? { source: arg1 as string, target: arg2 as string, likelihood: 50 }
        : (arg1 as Omit<Edge, 'id'>);
    // Validate source and target nodes exist
    const sourceNode = this.nodes.toArray().find(n => n.get('id') === edge.source);
    const targetNode = this.nodes.toArray().find(n => n.get('id') === edge.target);
    
    if (!sourceNode || !targetNode) {
      return { id: '', error: 'Source or target node not found' };
    }
    
    // Prevent self-loops
    if (edge.source === edge.target) {
      return { id: '', error: 'Cannot create an edge from a node to itself' };
    }
    
    // Check if edge already exists
    if (this.hasEdge(edge.source, edge.target)) {
      return { id: '', error: 'An edge already exists between these nodes' };
    }
    
    // Check if adding this edge would create a cycle
    if (this.wouldCreateCycle(edge.source, edge.target)) {
      return { id: '', error: 'This connection would create a cycle in the graph' };
    }
    
    const edgeWithDefaults = {
      ...edge,
      likelihood: edge.likelihood ?? 50, // Default to 50 if not provided
      // sourceHandle/targetHandle pass-through if provided (undefined for legacy)
    };
    
    const edgeMap = new Y.Map<unknown>();
    const edgeId = `edge_${Date.now()}`;
    
    Object.entries({ ...edgeWithDefaults, id: edgeId }).forEach(([key, value]) => {
      edgeMap.set(key, value);
    });
    
    this.edges.push([edgeMap]);
    this.meta.set('updatedAt', new Date().toISOString());
    return { id: edgeId };
  }

  updateEdge(edgeId: string, updates: Partial<Edge>): { success: boolean; error?: string } {
    const edgeIndex = this.edges.toArray().findIndex((e: Y.Map<unknown>) => e.get('id') === edgeId);
    if (edgeIndex === -1) return { success: false, error: 'Edge not found' };

    const edge = this.edges.get(edgeIndex);
    const currentSource = edge.get('source') as string;
    const currentTarget = edge.get('target') as string;
    
    // Process updates
    const processedUpdates = { ...updates };
    
    // If updating likelihood, ensure it's within 0-100 range
    if ('likelihood' in processedUpdates && processedUpdates.likelihood !== undefined) {
      processedUpdates.likelihood = Math.max(0, Math.min(100, processedUpdates.likelihood));
    }
    
    // If source or target is being updated, we need to validate the new connection
    const newSource = processedUpdates.source !== undefined ? processedUpdates.source : currentSource;
    const newTarget = processedUpdates.target !== undefined ? processedUpdates.target : currentTarget;
    
    // Only validate if source or target is being changed
    if (newSource !== currentSource || newTarget !== currentTarget) {
      // Validate source and target nodes exist
      const sourceNode = this.nodes.toArray().find(n => n.get('id') === newSource);
      const targetNode = this.nodes.toArray().find(n => n.get('id') === newTarget);
      
      if (!sourceNode || !targetNode) {
        return { success: false, error: 'Source or target node not found' };
      }
      
      // Prevent self-loops
      if (newSource === newTarget) {
        return { success: false, error: 'Cannot create an edge from a node to itself' };
      }
      
      // Check if edge already exists (excluding the current edge)
      const existingEdge = this.edges.toArray().find((e: Y.Map<unknown>) => {
        const eId = e.get('id') as string;
        const eSource = e.get('source') as string;
        const eTarget = e.get('target') as string;
        return eId !== edgeId && eSource === newSource && eTarget === newTarget;
      });
      
      if (existingEdge) {
        return { success: false, error: 'An edge already exists between these nodes' };
      }
      
      // Check if this update would create a cycle
      if (this.wouldCreateCycle(newSource, newTarget)) {
        return { success: false, error: 'This connection would create a cycle in the graph' };
      }
    }
    
    // Ensure all updated fields are persisted in Yjs
    Object.entries(processedUpdates).forEach(([key, value]) => {
      if (value !== undefined) {
        edge.set(key, value); // Ensure all updated fields are persisted in Yjs
      }
    });
    
    this.meta.set('updatedAt', new Date().toISOString());
    return { success: true };
  }

  deleteEdge(edgeId: string): boolean {
    const edgeIndex = this.edges.toArray().findIndex((e: Y.Map<unknown>) => e.get('id') === edgeId);
    if (edgeIndex === -1) return false;
    
    this.edges.delete(edgeIndex, 1);
    this.meta.set('updatedAt', new Date().toISOString());
    return true;
  }

  // Board operations
  getNode(nodeId: string): Node | undefined {
    const node = this.nodes.toArray().find((n: Y.Map<unknown>) => n.get('id') === nodeId);
    if (!node) return undefined;
    return {
      id: node.get('id') as string,
      type: node.get('type') as 'decision' | 'option' | 'outcome',
      x: node.get('x') as number,
      y: node.get('y') as number,
      label: node.get('label') as string,
      data: node.get('data') as Record<string, unknown> | undefined,
    };
  }

  getBoard(): Board {
    const nodes = this.nodes.toArray().map((node: Y.Map<unknown>) => ({
      id: node.get('id') as string,
      type: node.get('type') as 'decision' | 'option' | 'outcome',
      x: node.get('x') as number,
      y: node.get('y') as number,
      label: node.get('label') as string,
      data: node.get('data') as Record<string, unknown> | undefined,
    }));

    const edges = this.edges.toArray().map((edge: Y.Map<unknown>) => ({
      id: edge.get('id') as string,
      source: edge.get('source') as string,
      target: edge.get('target') as string,
      likelihood: edge.get('likelihood') as number | undefined,
      sourceHandle: edge.get('sourceHandle') as Handle | undefined,
      targetHandle: edge.get('targetHandle') as Handle | undefined,
    }));

    const boardObj = {
      id: this.meta.get('id') as string,
      title: this.meta.get('title') as string,
      nodes,
      edges,
      version: this.meta.get('version') as number,
      createdAt: this.meta.get('createdAt') as string,
      updatedAt: this.meta.get('updatedAt') as string,
      isDraft: Boolean(this.meta.get('isDraft')),
      createdBy: this.meta.get('createdBy') as string,
    };
    console.log('[DEBUG] getBoard returning:', boardObj);
    return boardObj;
  }

  // Snapshot operations
  saveSnapshot(name?: string): string {
    const id = `snap_${Date.now()}`;
    const snapshot: SnapshotMeta = {
      id,
      name: name || `Snapshot ${this.snapshots.length + 1}`,
      timestamp: Date.now(),
      state: Y.encodeStateAsUpdate(this.doc),
    };
    this.snapshots.push(snapshot);
    return id;
  }

  listSnapshots(): Array<{ id: string; name: string; timestamp: number }> {
    return this.snapshots.map(({ id, name, timestamp }) => ({ id, name, timestamp }));
  }

  loadSnapshot(id: string): void {
    const snap = this.snapshots.find(s => s.id === id);
    if (snap) {
      // Clear doc and apply snapshot
      this.doc = new Y.Doc();
      Y.applyUpdate(this.doc, snap.state);
      this.nodes = this.doc.getArray('nodes');
      this.edges = this.doc.getArray('edges');
      this.meta = this.doc.getMap('meta');
      this.meta.set('updatedAt', new Date().toISOString());
    }
  }

  // Real-time sync
  getUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applyUpdate(update: Uint8Array) {
    Y.applyUpdate(this.doc, update);
  }

  // Public method to get the document reference
  getDocument(): Y.Doc {
    return this.doc;
  }

  // Cleanup
  destroy() {
    this.doc.destroy();
  }
}

// Hook for React components
export function useBoardState(boardId?: string) {
  const [board, setBoard] = React.useState<Board>();
  const [isLoading, setIsLoading] = React.useState(true);
  // Memoize BoardState instance for the life of the boardId
  const boardStateRef = React.useRef<BoardState | null>(null);
  const prevBoardIdRef = React.useRef<string | undefined>(undefined);

  // Only create/destroy BoardState if boardId actually changes
  React.useEffect(() => {
    if (prevBoardIdRef.current !== boardId) {
      if (boardStateRef.current) {
        console.log('[DEBUG] Destroying BoardState instance for boardId:', prevBoardIdRef.current);
        boardStateRef.current.destroy();
      }
      console.log('[DEBUG] Creating new BoardState instance for boardId:', boardId);
      boardStateRef.current = new BoardState(boardId);
      prevBoardIdRef.current = boardId;
    } else {
      console.log('[DEBUG] Reusing existing BoardState instance for boardId:', boardId);
    }
    // Cleanup on unmount
    return () => {
      if (boardStateRef.current) {
        console.log('[DEBUG] Cleaning up BoardState instance for boardId:', prevBoardIdRef.current);
        boardStateRef.current.destroy();
        boardStateRef.current = null;
        prevBoardIdRef.current = undefined;
      }
    };
  }, [boardId]);

  // Helper to get the current board state
  const getBoardState = React.useCallback(() => {
    return boardStateRef.current;
  }, []);

  // Helper to get the current board state

  // Node operations
  const addNode = React.useCallback((node: Omit<Node, 'id'>): Node => {
    const state = getBoardState();
    if (!state) throw new Error('Board state not initialized');
    return state.addNode(node);
  }, [getBoardState]);

  const updateNode = React.useCallback((nodeId: string, updates: Partial<Node>) => {
    const state = boardStateRef.current;
    if (!state) return false;
    return state.updateNode(nodeId, updates);
  }, []);

  const deleteNode = React.useCallback((nodeId: string) => {
    const state = boardStateRef.current;
    if (!state) return false;
    return state.deleteNode(nodeId);
  }, []);

  // Edge operations
  const addEdge = React.useCallback((edge: Omit<Edge, 'id'>) => {
    const state = boardStateRef.current;
    if (!state) return { id: '', error: 'Board state not initialized' };
    return state.addEdge(edge);
  }, []);


  const updateEdge = React.useCallback((edgeId: string, updates: Partial<Edge>) => {
    const state = boardStateRef.current;
    if (!state) return { success: false, error: 'Board state not initialized' };
    return state.updateEdge(edgeId, updates);
  }, []);

  const updateEdgeLikelihood = React.useCallback((edgeId: string, likelihood: number) => {
    const state = boardStateRef.current;
    if (!state) return { success: false, error: 'Board state not initialized' };
    return state.updateEdge(edgeId, { likelihood });
  }, []);

  const deleteEdge = React.useCallback((edgeId: string) => {
    const state = boardStateRef.current;
    if (!state) return false;
    return state.deleteEdge(edgeId);
  }, []);

  // Track the attached doc to avoid re-attaching observer
  const attachedDocRef = React.useRef<Y.Doc | null>(null);

  React.useEffect(() => {
    const boardState = getBoardState();
    if (!boardState) {
      setIsLoading(false);
      return;
    }
    // Initial load
    setBoard(boardState.getBoard());
    setIsLoading(false);

    // Subscribe to changes from Yjs, only if doc instance changes
    const doc = boardState.getDocument();
    if (!doc) return;
    if (attachedDocRef.current === doc) {
      // Already attached to this doc, do nothing
      return;
    }
    attachedDocRef.current = doc;
    const observer = () => {
      console.log('[DEBUG] Yjs doc update event fired');
      if (!boardState) return;
      const newBoard = boardState.getBoard();
      console.log('[DEBUG] New board after Yjs update:', newBoard);
      if (Array.isArray(newBoard.nodes)) {
        console.log('[DEBUG] Nodes array after Yjs update:', newBoard.nodes);
      }
      setBoard(newBoard);
    };
    doc.on('update', observer);
    console.log('[DEBUG] Yjs observer attached to doc:', doc.guid);

    return () => {
      doc.off('update', observer);
      console.log('[DEBUG] Yjs observer detached from doc:', doc.guid);
    };
  }, [getBoardState]);

  return {
    board,
    isLoading,
    // Node operations
    addNode,
    updateNode,
    deleteNode,
    // Edge operations
    addEdge,
    updateEdge,
    updateEdgeLikelihood,
    deleteEdge,
    // Board operations
    getBoard: () => {
      const state = boardStateRef.current;
      if (!state) return undefined;
      return state.getBoard();
    },
    // Snapshot operations
    saveSnapshot: (...args: Parameters<BoardState['saveSnapshot']>) => {
      const state = boardStateRef.current;
      if (!state) return '';
      return state.saveSnapshot(...args);
    },
    listSnapshots: () => {
      const state = boardStateRef.current;
      if (!state) return [];
      return state.listSnapshots();
    },
    loadSnapshot: (id: string) => {
      const state = boardStateRef.current;
      if (!state) return;
      state.loadSnapshot(id);
      setBoard(state.getBoard());
    },
    getCurrentDocument: () => {
      const state = boardStateRef.current;
      if (!state) return undefined;
      return state.getDocument();
    },
  };
}
