/**
 * Developer Note: BoardState internal snapshots are intended for development/ephemeral use only
 * (e.g., quick in-memory save/restore during experimentation). The UI must use storage-level
 * snapshots defined in `src/sandbox/state/snapshots.ts`, which are the single source of truth
 * for snapshot lifecycle and telemetry (trim/delete/clear). Consider these internal helpers as
 * non-canonical and avoid wiring UI behaviors to them.
 */
import * as Y from 'yjs';
import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

// Verbose board logs are disabled by default; enable with VITE_DEBUG_BOARD=true in dev
const DEBUG_BOARD =
  import.meta.env.MODE === 'development' &&
  (import.meta.env.VITE_DEBUG_BOARD === 'true' || import.meta.env.VITE_DEBUG_BOARD === '1');

// Snapshot payload compatibility version for Scenario Sandbox snapshots
export const SNAPSHOT_VERSION = 1;

export interface Node {
  id: string;
  type: 'decision' | 'option' | 'problem' | 'action' | 'outcome';
  x: number;
  y: number;
  label: string;
  data?: Record<string, unknown>;
}

// Handle identifiers for edge anchoring.
// Supports positional handles and stable option-level handles (e.g., "option:<optionId>").
export type Handle = 'left' | 'right' | 'top' | 'bottom' | `option:${string}`;

// Stable helper to construct an option handle id
export const getOptionHandleId = (optionId: string): Handle => `option:${optionId}`;

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
  private ownsDoc: boolean;
  private nodes: Y.Array<Y.Map<unknown>>;
  private edges: Y.Array<Y.Map<unknown>>;
  private meta: Y.Map<unknown>;

  private snapshots: SnapshotMeta[] = [];
  // Fast lookup indexes for stress operations
  private nodeIdSet: Set<string> = new Set();
  private edgeKeySet: Set<string> = new Set();

  constructor(boardId?: string, externalDoc?: Y.Doc) {
    this.doc = externalDoc ?? new Y.Doc();
    this.ownsDoc = !externalDoc;
    this.nodes = this.doc.getArray('nodes');
    this.edges = this.doc.getArray('edges');
    this.meta = this.doc.getMap('meta');

    if (!boardId) {
      this.initializeNewBoard();
    } else {
      this.loadBoard(boardId);
    }
    // Build indexes for any pre-existing state
    this.rebuildIndexes();
  }

  // Returns problem node ids connected to any option under the given decision
  getProblemsForDecision(decisionId: string): string[] {
    const problemIds = new Set<string>();
    const optionIds = new Set(this.getDecisionOptions(decisionId));
    if (optionIds.size === 0) return [];
    // Build type map
    const typeById = new Map<string, string>();
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes.get(i);
      typeById.set(n.get('id') as string, n.get('type') as string);
    }
    // Scan edges option -> problem
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges.get(i);
      const src = e.get('source') as string;
      const tgt = e.get('target') as string;
      if (optionIds.has(src) && typeById.get(tgt) === 'problem') {
        problemIds.add(tgt);
      }
    }
    return Array.from(problemIds);
  }

  // Returns action node ids connected to any option under the given decision
  getActionsForDecision(decisionId: string): string[] {
    const actionIds = new Set<string>();
    const optionIds = new Set(this.getDecisionOptions(decisionId));
    if (optionIds.size === 0) return [];
    // Build type map
    const typeById = new Map<string, string>();
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes.get(i);
      typeById.set(n.get('id') as string, n.get('type') as string);
    }
    // Scan edges option -> action
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges.get(i);
      const src = e.get('source') as string;
      const tgt = e.get('target') as string;
      if (optionIds.has(src) && typeById.get(tgt) === 'action') {
        actionIds.add(tgt);
      }
    }
    return Array.from(actionIds);
  }

  // Returns edges where both endpoints are within the provided node id set
  getEdgesAmong(nodeIds: string[]): Edge[] {
    const set = new Set(nodeIds);
    const result: Edge[] = [];
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges.get(i);
      const src = e.get('source') as string;
      const tgt = e.get('target') as string;
      if (set.has(src) && set.has(tgt)) {
        result.push({
          id: e.get('id') as string,
          source: src,
          target: tgt,
          likelihood: e.get('likelihood') as number | undefined,
          sourceHandle: e.get('sourceHandle') as Handle | undefined,
          targetHandle: e.get('targetHandle') as Handle | undefined,
        });
      }
    }
    return result;
  }

  private initializeNewBoard() {
    this.meta.set('id', `board_${uuidv4()}`);
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
  private edgeKey(sourceId: string, targetId: string, sourceHandle?: Handle, targetHandle?: Handle): string {
    // Edge key scheme includes handles to block duplicates at option-level anchors
    // [sourceId, sourceHandle, targetId, targetHandle]
    return `${sourceId}|${sourceHandle ?? ''}|${targetId}|${targetHandle ?? ''}`;
  }

  private hasEdge(sourceId: string, targetId: string, sourceHandle?: Handle, targetHandle?: Handle): boolean {
    return this.edgeKeySet.has(this.edgeKey(sourceId, targetId, sourceHandle, targetHandle));
  }

  private rebuildIndexes() {
    this.nodeIdSet.clear();
    this.edgeKeySet.clear();
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes.get(i);
      const id = n.get('id') as string;
      if (id) this.nodeIdSet.add(id);
    }
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges.get(i);
      const key = this.edgeKey(
        e.get('source') as string,
        e.get('target') as string,
        e.get('sourceHandle') as Handle | undefined,
        e.get('targetHandle') as Handle | undefined,
      );
      this.edgeKeySet.add(key);
    }
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
    if (DEBUG_BOARD) console.debug('[DEBUG] addNode called');
    let nodeId = ''; let createdNode: Node | null = null;
    this.doc.transact(() => {
      const nodeMap = new Y.Map<unknown>();
      nodeId = `node_${uuidv4()}`;
      Object.entries({ ...node, id: nodeId }).forEach(([key, value]) => {
        nodeMap.set(key, value);
      });
      this.nodes.push([nodeMap]);
      this.meta.set('updatedAt', new Date().toISOString());
      // Compose the created node object
      createdNode = { ...node, id: nodeId } as Node;
      if (DEBUG_BOARD) console.debug('[DEBUG] Node added in Yjs', nodeId);
    });
    // Index new node id for O(1) existence checks
    if (nodeId) this.nodeIdSet.add(nodeId);
    if (DEBUG_BOARD) console.debug('[DEBUG] Board after addNode:', this.getBoard());
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
      const idx = edgesToDelete[i];
      const e = this.edges.get(idx);
      const key = this.edgeKey(
        e.get('source') as string,
        e.get('target') as string,
        e.get('sourceHandle') as Handle | undefined,
        e.get('targetHandle') as Handle | undefined,
      );
      this.edgeKeySet.delete(key);
      this.edges.delete(idx, 1);
    }
    
    // Delete the node
    this.nodes.delete(nodeIndex, 1);
    this.nodeIdSet.delete(nodeId);
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
    const sourceExists = this.nodeIdSet.has(edge.source);
    const targetExists = this.nodeIdSet.has(edge.target);
    
    if (!sourceExists || !targetExists) {
      return { id: '', error: 'Source or target node not found' };
    }
    
    // Prevent self-loops
    if (edge.source === edge.target) {
      return { id: '', error: 'Cannot create an edge from a node to itself' };
    }
    
    // Check if edge already exists with same handles (undefined compares to undefined for legacy)
    if (this.hasEdge(edge.source, edge.target, edge.sourceHandle, edge.targetHandle)) {
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
    const edgeId = `edge_${uuidv4()}`;
    
    Object.entries({ ...edgeWithDefaults, id: edgeId }).forEach(([key, value]) => {
      edgeMap.set(key, value);
    });
    
    this.edges.push([edgeMap]);
    this.meta.set('updatedAt', new Date().toISOString());
    // Index new edge for O(1) duplicate checks
    this.edgeKeySet.add(this.edgeKey(edgeWithDefaults.source, edgeWithDefaults.target, edgeWithDefaults.sourceHandle, edgeWithDefaults.targetHandle));
    return { id: edgeId };
  }

  updateEdge(edgeId: string, updates: Partial<Edge>): { success: boolean; error?: string } {
    const edgeIndex = this.edges.toArray().findIndex((e: Y.Map<unknown>) => e.get('id') === edgeId);
    if (edgeIndex === -1) return { success: false, error: 'Edge not found' };

    const edge = this.edges.get(edgeIndex);
    const currentSource = edge.get('source') as string;
    const currentTarget = edge.get('target') as string;
    const currentSourceHandle = edge.get('sourceHandle') as Handle | undefined;
    const currentTargetHandle = edge.get('targetHandle') as Handle | undefined;
    const oldKey = this.edgeKey(currentSource, currentTarget, currentSourceHandle, currentTargetHandle);
    
    // Process updates
    const processedUpdates = { ...updates };
    
    // If updating likelihood, ensure it's within 0-100 range
    if ('likelihood' in processedUpdates && processedUpdates.likelihood !== undefined) {
      processedUpdates.likelihood = Math.max(0, Math.min(100, processedUpdates.likelihood));
    }
    
    // Compute prospective new values
    const newSource = processedUpdates.source !== undefined ? processedUpdates.source : currentSource;
    const newTarget = processedUpdates.target !== undefined ? processedUpdates.target : currentTarget;
    const newSourceHandle = processedUpdates.sourceHandle !== undefined ? processedUpdates.sourceHandle : currentSourceHandle;
    const newTargetHandle = processedUpdates.targetHandle !== undefined ? processedUpdates.targetHandle : currentTargetHandle;
    const newKey = this.edgeKey(newSource, newTarget, newSourceHandle, newTargetHandle);

    // Prevent self-loops for the prospective values
    if (newSource === newTarget) {
      return { success: false, error: 'Cannot create an edge from a node to itself' };
    }

    // Reject duplicates (including handles) regardless of whether source/target changed
    if (newKey !== oldKey && this.edgeKeySet.has(newKey)) {
      return { success: false, error: 'An edge already exists between these nodes' };
    }

    // If source or target is being updated, validate nodes exist and cycles
    if (newSource !== currentSource || newTarget !== currentTarget) {
      // Validate source and target nodes exist
      const sourceNode = this.nodes.toArray().find(n => n.get('id') === newSource);
      const targetNode = this.nodes.toArray().find(n => n.get('id') === newTarget);
      if (!sourceNode || !targetNode) {
        return { success: false, error: 'Source or target node not found' };
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
    // Update edge index if key changed
    if (newKey !== oldKey) {
      this.edgeKeySet.delete(oldKey);
      this.edgeKeySet.add(newKey);
    }
    return { success: true };
  }

  deleteEdge(edgeId: string): boolean {
    const edgeIndex = this.edges.toArray().findIndex((e: Y.Map<unknown>) => e.get('id') === edgeId);
    if (edgeIndex === -1) return false;
    
    const e = this.edges.get(edgeIndex);
    const key = this.edgeKey(
      e.get('source') as string,
      e.get('target') as string,
      e.get('sourceHandle') as Handle | undefined,
      e.get('targetHandle') as Handle | undefined,
    );
    this.edgeKeySet.delete(key);
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
      type: node.get('type') as 'decision' | 'option' | 'problem' | 'action' | 'outcome',
      x: node.get('x') as number,
      y: node.get('y') as number,
      label: node.get('label') as string,
      data: node.get('data') as Record<string, unknown> | undefined,
    };
  }

  getBoard(): Board {
    const nodes = this.nodes.toArray().map((node: Y.Map<unknown>) => ({
      id: node.get('id') as string,
      type: node.get('type') as 'decision' | 'option' | 'problem' | 'action' | 'outcome',
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
    if (DEBUG_BOARD) console.debug('[DEBUG] getBoard returning:', boardObj);
    return boardObj;
  }

  // --- Tile ↔ Graph bridge helpers ---
  // Returns option node ids that are connected from the given decision node
  getDecisionOptions(decisionId: string): string[] {
    const optionIds = new Set<string>();
    // Build a quick map of node types for lookup
    const typeById = new Map<string, string>();
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes.get(i);
      typeById.set(n.get('id') as string, n.get('type') as string);
    }
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges.get(i);
      const src = e.get('source') as string;
      const tgt = e.get('target') as string;
      if (src === decisionId && typeById.get(tgt) === 'option') {
        optionIds.add(tgt);
      }
    }
    return Array.from(optionIds);
  }

  // Returns stable handles for each option connection on a decision: "option:<optionId>"
  getDecisionEdgeHandles(decisionId: string): string[] {
    return this.getDecisionOptions(decisionId).map((optId) => `option:${optId}`);
  }

  // Snapshot operations
  saveSnapshot(name?: string): string {
    const id = `snap_${uuidv4()}`;
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
      this.rebuildIndexes();
    }
  }

  // Real-time sync
  getUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  applyUpdate(update: Uint8Array) {
    Y.applyUpdate(this.doc, update);
    // Keep metadata fresh and rebuild indexes to reflect the applied update
    this.meta.set('updatedAt', new Date().toISOString());
    this.rebuildIndexes();
  }

  // Replace the underlying document with a provided update (used for snapshot restore)
  replaceWithUpdate(update: Uint8Array) {
    const next = new Y.Doc();
    Y.applyUpdate(next, update);
    this.doc = next;
    this.nodes = this.doc.getArray('nodes');
    this.edges = this.doc.getArray('edges');
    this.meta = this.doc.getMap('meta');
    this.meta.set('updatedAt', new Date().toISOString());
    this.rebuildIndexes();
  }

  // Public method to get the document reference
  getDocument(): Y.Doc {
    return this.doc;
  }

  // Cleanup
  destroy() {
    if (this.ownsDoc) this.doc.destroy();
  }
}

// Hook for React components
export function useBoardState(boardId?: string, externalDoc?: Y.Doc) {
  const [board, setBoard] = React.useState<Board>();
  const [isLoading, setIsLoading] = React.useState(true);
  // Memoize BoardState instance for the life of the boardId
  const boardStateRef = React.useRef<BoardState | null>(null);
  const prevBoardIdRef = React.useRef<string | undefined>(undefined);

  // Only create/destroy BoardState if boardId actually changes
  React.useEffect(() => {
    if (prevBoardIdRef.current !== boardId) {
      if (boardStateRef.current) {
        if (DEBUG_BOARD) console.debug('[DEBUG] Destroying BoardState instance for boardId:', prevBoardIdRef.current);
        boardStateRef.current.destroy();
      }
      if (DEBUG_BOARD) console.debug('[DEBUG] Creating new BoardState instance for boardId:', boardId);
      boardStateRef.current = new BoardState(boardId, externalDoc);
      prevBoardIdRef.current = boardId;
    } else {
      if (DEBUG_BOARD) console.debug('[DEBUG] Reusing existing BoardState instance for boardId:', boardId);
    }
    // Cleanup on unmount
    return () => {
      if (boardStateRef.current) {
        if (DEBUG_BOARD) console.debug('[DEBUG] Cleaning up BoardState instance for boardId:', prevBoardIdRef.current);
        boardStateRef.current.destroy();
        boardStateRef.current = null;
        prevBoardIdRef.current = undefined;
      }
    };
  }, [boardId, externalDoc]);

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
      if (DEBUG_BOARD) console.debug('[DEBUG] Yjs doc update event fired');
      if (!boardState) return;
      const newBoard = boardState.getBoard();
      if (DEBUG_BOARD) console.debug('[DEBUG] New board after Yjs update:', newBoard);
      if (Array.isArray(newBoard.nodes)) {
        if (DEBUG_BOARD) console.debug('[DEBUG] Nodes array after Yjs update:', newBoard.nodes);
      }
      setBoard(newBoard);
    };
    doc.on('update', observer);
    if (DEBUG_BOARD) console.debug('[DEBUG] Yjs observer attached to doc:', doc.guid);

    return () => {
      doc.off('update', observer);
      if (DEBUG_BOARD) console.debug('[DEBUG] Yjs observer detached from doc:', doc.guid);
    };
  }, [getBoardState, /* re-attach when docKey changes */ attachedDocRef.current]);

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
    // Yjs update helpers
    getUpdate: () => {
      const state = boardStateRef.current;
      if (!state) return new Uint8Array();
      return state.getUpdate();
    },
    applyUpdate: (update: Uint8Array) => {
      const state = boardStateRef.current;
      if (!state) return;
      state.applyUpdate(update);
      setBoard(state.getBoard());
    },
    replaceWithUpdate: (update: Uint8Array) => {
      const state = boardStateRef.current;
      if (!state) return;
      state.replaceWithUpdate(update);
      // Force re-attach by clearing and reassigning the attached doc ref
      attachedDocRef.current = null;
      setBoard(state.getBoard());
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
    // Tile ↔ Graph bridge helpers
    getDecisionOptions: (decisionId: string) => {
      const state = boardStateRef.current;
      if (!state) return [] as string[];
      return state.getDecisionOptions(decisionId);
    },
    getDecisionEdgeHandles: (decisionId: string) => {
      const state = boardStateRef.current;
      if (!state) return [] as string[];
      return state.getDecisionEdgeHandles(decisionId);
    },
    getProblemsForDecision: (decisionId: string) => {
      const state = boardStateRef.current;
      if (!state) return [] as string[];
      return state.getProblemsForDecision(decisionId);
    },
    getActionsForDecision: (decisionId: string) => {
      const state = boardStateRef.current;
      if (!state) return [] as string[];
      return state.getActionsForDecision(decisionId);
    },
    getEdgesAmong: (nodeIds: string[]) => {
      const state = boardStateRef.current;
      if (!state) return [] as Edge[];
      return state.getEdgesAmong(nodeIds);
    },
  };
}
