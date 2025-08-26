import { Node, Edge } from 'reactflow';

// Extended edge type for handle-anchored edges
export interface SandboxEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'left' | 'right' | 'bottom';
  targetHandle?: 'left' | 'right' | 'bottom';
  likelihood?: number;
}


export interface Board {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
  version: number;
  isDraft?: boolean;
  parentVersionId?: string | null;
}

export interface BoardVersion {
  id: string;
  boardId: string;
  version: number;
  data: Omit<Board, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
  createdAt: string;
  createdBy: string;
  message?: string;
}

export interface Scenario {
  id: string;
  boardId: string;
  name: string;
  description?: string;
  data: Omit<Board, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isCurrent?: boolean;
  version?: number;
}

export interface VoteStats {
  upvotes: number;
  downvotes: number;
  netScore: number;
  userVote?: 'up' | 'down' | null;
}

export interface VoteUpdate {
  nodeId: string;
  userId: string;
  vote: 'up' | 'down';
  timestamp: string;
}

export interface BoardDiff {
  addedNodes: Node[];
  removedNodes: string[];
  modifiedNodes: {
    id: string;
    previous: Partial<Node>;
    current: Partial<Node>;
  }[];
  addedEdges: Edge[];
  removedEdges: string[];
}

export interface CommitResult {
  success: boolean;
  version?: BoardVersion;
  error?: string;
  hasConflicts?: boolean;
  conflicts?: {
    nodes: string[];
    edges: string[];
  };
}

export interface SnapshotOptions {
  name: string;
  description?: string;
  isCurrent?: boolean;
}

export interface SnapshotActionHandlers {
  onCreate: (options: SnapshotOptions) => Promise<void>;
  onUpdate: (id: string, options: Partial<SnapshotOptions>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLoad: (id: string) => Promise<void>;
}
