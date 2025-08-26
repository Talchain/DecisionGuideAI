import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { track } from '../telemetry/track';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';

// Extended comment model for sandbox realtime comments
// Back-compat fields: author, text, createdAt are preserved
export interface RTComment {
  id: string;
  parentId?: string;
  targetId: string; // edge id
  author: string; // current repo uses a simple string
  text: string; // body
  createdAt: number;
  updatedAt?: number;
  isDeleted?: boolean; // soft delete
  mentions?: string[]; // usernames
  reactions?: Record<string, string[]>; // derived view over Y.Map for convenience
}

// Yjs doc singleton (in real app, use a provider or context)
const ydoc = new Y.Doc();
const commentsMap = ydoc.getMap<Y.Array<RTComment>>('comments');
// Per-comment reactions: commentId -> (emoji -> (userId -> 1)) emulating a Set via Y.Map
// Types expand to: Y.Map< commentId, Y.Map< emoji, Y.Map< userId, 1 >> >
const reactionsMap = ydoc.getMap<Y.Map<Y.Map<number>>>('comment_reactions');

/**
 * useYjsComments - React hook for real-time edge comments using Yjs.
 * @param edgeId The edge (target) ID for which to sync comments.
 * @returns { comments, addComment, editComment, deleteComment, listComments }
 */
export function useYjsComments(edgeId: string) {
  const [comments, setComments] = useState<RTComment[]>([]);
  const yarrRef = useRef<Y.Array<RTComment> | null>(null);
  const lastPostAtRef = useRef<number>(0);
  const lastReactionAtRef = useRef<Map<string, number>>(new Map()); // key: `${commentId}:${emoji}`
  const POST_THROTTLE_MS = 500;
  const REACTION_THROTTLE_MS = 200;

  // Ensure a Y.Array exists for this edge
  useEffect(() => {
    if (!commentsMap.has(edgeId)) {
      commentsMap.set(edgeId, new Y.Array<RTComment>());
    }
    if (!commentsMap.has(edgeId)) {
      commentsMap.set(edgeId, new Y.Array<RTComment>());
    }
    const yarr = commentsMap.get(edgeId)!;
    yarrRef.current = yarr;
    const update = () => {
      const base = yarr.toArray();
      // merge in derived reactions from Y structure
      const merged = base.map(c => {
        const rMap = reactionsMap.get(c.id);
        if (!rMap) return c;
        const entries: [string, string[]][] = [];
        (rMap as Y.Map<Y.Map<number>>).forEach((userMap: Y.Map<number>, emoji: string) => {
          const users: string[] = [];
          userMap.forEach((_v, uid: string) => { users.push(uid); });
          entries.push([emoji, users]);
        });
        return { ...c, reactions: Object.fromEntries(entries) } as RTComment;
      });
      setComments(merged);
    };
    const reactionsObserver = () => update();
    yarr.observeDeep(update);
    reactionsMap.observeDeep(reactionsObserver);
    update();
    return () => {
      yarr.unobserveDeep(update);
      reactionsMap.unobserveDeep(reactionsObserver);
    };
  }, [edgeId]);

  // Add a new comment
  const addComment = useCallback((comment: Omit<RTComment, 'id' | 'createdAt'>) => {
    const now = Date.now();
    if (now - lastPostAtRef.current < POST_THROTTLE_MS) return null as unknown as RTComment;
    lastPostAtRef.current = now;
    const yarr = commentsMap.get(edgeId)!;
    const newComment: RTComment = {
      ...comment,
      id: uuidv4(),
      createdAt: Date.now(),
      isDeleted: false,
      reactions: comment.reactions ?? {},
      mentions: comment.mentions ?? [],
    };
    yarr.push([newComment]);
    // Immediately reflect in local state to avoid races before observers fire
    setComments(prev => {
      // keep deterministic order logic consistent with sortedComments memo
      const next = [...prev, newComment];
      return next;
    });
    track('comment_posted', { edgeId, commentId: newComment.id });
    // init empty reactions container for this comment id
    if (!reactionsMap.has(newComment.id)) {
      reactionsMap.set(newComment.id, new Y.Map<Y.Map<number>>());
    }
    return newComment;
  }, [edgeId]);

  // Edit a comment (by id)
  const editComment = useCallback((id: string, text: string) => {
    const yarr = commentsMap.get(edgeId)!;
    const idx = yarr.toArray().findIndex(c => c.id === id);
    if (idx !== -1) {
      const existing = yarr.get(idx);
      const updated = { ...existing, text, updatedAt: Date.now() } as RTComment;
      yarr.delete(idx, 1);
      yarr.insert(idx, [updated]);
    }
  }, [edgeId]);

  // Soft-delete a single comment (preserve replies)
  const deleteComment = useCallback((id: string) => {
    const yarr = commentsMap.get(edgeId)!;
    const arr = yarr.toArray();
    const idx = arr.findIndex(c => c.id === id);
    if (idx !== -1) {
      const updated = { ...(yarr.get(idx) as RTComment), isDeleted: true, updatedAt: Date.now() } as RTComment;
      yarr.delete(idx, 1);
      yarr.insert(idx, [updated]);
      track('comment_deleted_soft', { edgeId, commentId: id });
    }
  }, [edgeId]);

  // List comments for this edge (flat or threaded)
  const listComments = useCallback(() => comments, [comments]);

  // Toggle reaction via Y.Map<emoji, Y.Set<userId>> for minimal deltas
  const toggleReaction = useCallback((commentId: string, emoji: string, userId: string) => {
    const key = `${commentId}:${emoji}`;
    const now = Date.now();
    const last = lastReactionAtRef.current.get(key) || 0;
    if (now - last < REACTION_THROTTLE_MS) return;
    lastReactionAtRef.current.set(key, now);
    ydoc.transact(() => {
      let rMap = reactionsMap.get(commentId) as Y.Map<Y.Map<number>> | undefined;
      if (!rMap) {
        rMap = new Y.Map<Y.Map<number>>();
        reactionsMap.set(commentId, rMap);
      }
      let userMap = rMap.get(emoji) as Y.Map<number> | undefined;
      if (!userMap) {
        userMap = new Y.Map<number>();
        rMap.set(emoji, userMap);
      }
      const added = !userMap.has(userId);
      if (!added) userMap.delete(userId);
      else userMap.set(userId, 1);
      track('reaction_toggled', { edgeId, commentId, emoji, added });
    });
  }, []);

  // Last non-deleted comment timestamp (uses stored timestamps)
  const lastCommentAt = useMemo(() => {
    const visible = comments.filter(c => !c.isDeleted);
    if (visible.length === 0) return 0;
    return Math.max(...visible.map(c => c.updatedAt ?? c.createdAt));
  }, [comments]);

  // Sorted comments and simple pagination
  const sortedComments = useMemo(() => {
    // stable sort by createdAt asc, then id asc to guarantee determinism
    return [...comments].sort((a, b) => (a.createdAt - b.createdAt) || a.id.localeCompare(b.id));
  }, [comments]);

  const getCommentsPage = useCallback((page: number, pageSize: number) => {
    const start = Math.max(0, page * pageSize);
    return sortedComments.slice(start, start + pageSize);
  }, [sortedComments]);

  const PAGE_SIZE = 50;
  const roots = useMemo(() => sortedComments.filter(c => !c.parentId), [sortedComments]);
  const repliesByParent = useMemo(() => {
    const m = new Map<string, RTComment[]>();
    sortedComments.forEach(c => {
      if (c.parentId) {
        const arr = m.get(c.parentId) || [];
        arr.push(c);
        m.set(c.parentId, arr);
      }
    });
    return m;
  }, [sortedComments]);

  return {
    comments: sortedComments,
    addComment,
    editComment,
    deleteComment,
    listComments,
    toggleReaction,
    lastCommentAt,
    getCommentsPage,
    PAGE_SIZE,
    roots,
    repliesByParent,
    POST_THROTTLE_MS,
    REACTION_THROTTLE_MS,
  };
}

/**
 * Comment data model (for reference):
 * id: string;
 * parentId?: string; // for threading (one level in UI)
 * targetId: string; // edge id
 * author: string; // simple string for sandbox
 * text: string; // body
 * createdAt: number;
 * updatedAt?: number;
 * isDeleted?: boolean;
 * mentions?: string[];
 * reactions?: Record<string, string[]>; // emoji -> userIds
 */
