import { useCallback, useEffect, useState } from 'react';
import * as Y from 'yjs';

// Yjs doc singleton (same document space as comments)
const ydoc = new Y.Doc();
const readsMap = ydoc.getMap<Y.Map<number>>('edge_reads'); // key: edgeId -> (userId -> last_read_at)

/**
 * useYjsEdgeReads - track per-user last_read_at for an edge
 * Minimal helper for unread badge logic.
 */
export function useYjsEdgeReads(edgeId: string, userId: string) {
  const [lastReadAt, setLastReadAt] = useState<number>(0);

  useEffect(() => {
    if (!readsMap.has(edgeId)) {
      readsMap.set(edgeId, new Y.Map<number>());
    }
    const yUserReads = readsMap.get(edgeId)!;
    const update = () => setLastReadAt(yUserReads.get(userId) ?? 0);
    yUserReads.observe(update);
    update();
    return () => {
      yUserReads.unobserve(update);
    };
  }, [edgeId, userId]);

  const markRead = useCallback((at: number = Date.now()) => {
    const yUserReads = readsMap.get(edgeId)!;
    yUserReads.set(userId, at);
  }, [edgeId, userId]);

  return { lastReadAt, markRead };
}
