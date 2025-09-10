export interface NodeData {
  description?: string;
  [key: string]: unknown;
}

export interface VoteStats {
  upvotes: number;
  downvotes: number;
  userVote?: boolean | null; // true = upvote, false = downvote, null/undefined = no vote
}

export interface Node {
  id: string;
  type: 'decision' | 'option' | 'problem' | 'action' | 'outcome';
  x: number;
  y: number;
  label: string;
  width?: number;
  height?: number;
  data?: NodeData;
  votes?: VoteStats; // Only present when voting is enabled
}

export type Handle = 'left' | 'right' | 'bottom' | 'top' | `option:${string}`;

export interface Edge {
  id: string;
  source: string;
  target: string;
  /**
   * Likelihood of this edge being taken, from 0 to 100.
   * Defaults to 50 if not specified.
   */
  likelihood?: number;
  // Optional persisted handles for stable anchoring
  sourceHandle?: Handle;
  targetHandle?: Handle;
}

export interface BoardBase {
  id: string;
  title: string;
  nodes: Node[];
  edges: Edge[];
  version: number;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  createdBy: string;
  parentVersionId?: string | null; // For tracking the parent version when creating new versions
}

export interface Board extends BoardBase {}

export interface BoardDiff {
  addedNodes: Node[];
  removedNodes: string[]; // node IDs
  modifiedNodes: Node[];
  addedEdges: Edge[];
  removedEdges: string[]; // edge IDs
  modifiedEdges: Array<{
    id: string;
    oldLikelihood: number;
    newLikelihood: number;
  }>;
}

export interface CommitResult {
  success: boolean;
  newVersion?: BoardVersion;
  conflict?: {
    type: 'node' | 'edge' | 'both';
    details: string[];
  };
  error?: string;
}

export interface BoardVersion extends Omit<BoardBase, 'id' | 'version'> {
  id: string;
  boardId: string;
  version: number;
  isCurrent: boolean;
  commitMessage?: string;
  committedBy: string;
  committedAt: string;
  diff?: BoardDiff; // Computed diff from previous version
}

export interface Scenario {
  id: string;
  boardId: string;
  versionId: string; // References a specific BoardVersion
  name: string;
  description?: string;
  thumbnail?: string; // Base64 encoded thumbnail
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isCurrent?: boolean; // If this is the current version
  stats?: {
    nodeCount: number;
    edgeCount: number;
    voteScore: number; // Net votes (upvotes - downvotes)
  };
}

export interface OptionVote {
  id: string;
  optionId: string;
  userId: string;
  vote: boolean; // true = upvote, false = downvote
  createdAt: string;
  updatedAt: string;
}

export interface CommitOptions {
  message: string;
  userId: string;
  autoResolveConflicts?: boolean;
}

export interface SnapshotOptions {
  name: string;
  description?: string;
  userId: string;
  autoIncrementName?: boolean;
}

export interface VoteUpdate {
  optionId: string;
  userId: string;
  vote: boolean | null; // null to remove vote
}
