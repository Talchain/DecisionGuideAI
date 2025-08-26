import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Edge } from '../../types/sandbox';
import { EdgeLikelihoodEditor } from './EdgeLikelihoodEditor';
import { useYjsComments } from '../state/useYjsComments';
import { useYjsEdgeReads } from '../state/useYjsEdgeReads';

interface EdgeOverlayPillProps {
  edge: Edge;
  likelihood: number;
  selected: boolean;
  hovered: boolean;
  onLikelihoodUpdate?: (id: string, value: number) => void;
  onShowComments: (id: string, opts?: { type?: 'node' | 'edge' }) => void;
  onPillFocus: () => void;
  onPillBlur: () => void;
  yOffset?: number; // for parent to offset overlay to avoid overlap
  currentUserId?: string; // optional; used for unread tracking
}


/**
 * Unified pill overlay for edge controls (likelihood + comments)
 * - Shows minimal badge by default
 * - Expands on hover/focus/selection
 * - Handles accessibility and keyboard nav
 * - Never overlaps nodes (parent must position)
 */
export const EdgeOverlayPill: React.FC<EdgeOverlayPillProps> = ({
  edge,
  likelihood,
  selected,
  hovered,
  onLikelihoodUpdate,
  onShowComments,
  onPillFocus,
  onPillBlur,
  yOffset = 0,
  currentUserId,
}) => {
  const pillRef = useRef<HTMLDivElement>(null);
  // Expansion state: always expanded on hover, focus, or click (persistExpanded for click)
  const [persistExpanded, setPersistExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const expanded = hovered || selected || persistExpanded;
  // Focus management
  const [focusIdx, setFocusIdx] = useState(0); // 0: pill, 1: likelihood, 2: comment

  // Real-time comment count for this edge
  const { comments, lastCommentAt } = useYjsComments(edge.id);
  const commentCount = useMemo(() => comments.filter(c => !c.isDeleted).length, [comments]);

  // Unread tracking (only if we have a user id)
  const reads = currentUserId ? useYjsEdgeReads(edge.id, currentUserId) : null;
  const unread = useMemo(() => {
    if (!currentUserId || !reads) return false;
    if (commentCount === 0) return false;
    return lastCommentAt > reads.lastReadAt;
  }, [currentUserId, reads?.lastReadAt, commentCount, lastCommentAt]);

  // Auto-start editing on expand (hover/focus/click)
  useEffect(() => {
    if (expanded) setEditing(true);
    else setEditing(false);
  }, [expanded]);

  // Collapse on click-away or Esc
  useEffect(() => {
    if (!persistExpanded) return;
    function onDocClick(e: MouseEvent) {
      if (!pillRef.current?.contains(e.target as Node)) setPersistExpanded(false);
    }
    function onDocKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPersistExpanded(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onDocKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onDocKey);
    };
  }, [persistExpanded]);

  // Animate expansion/collapse
  // (tailwind 'transition-all' + duration, or use inline style for snappier effect)

  // Keyboard: Tab to pill, Enter/Space to expand, Esc/click outside to collapse
  function handlePillKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!expanded && (e.key === 'Enter' || e.key === ' ')) {
      setPersistExpanded(true);
      e.preventDefault();
    }
    if (expanded && e.key === 'Escape') {
      setPersistExpanded(false);
      e.preventDefault();
    }
  }

  // Focus trap: when expanded, tab cycles between likelihood and comment
  function handleChildKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Tab') {
      setFocusIdx(idx => (idx === 1 ? 2 : 1));
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      setPersistExpanded(false);
      e.preventDefault();
    }
  }

  // ARIA state
  const ariaExpanded = expanded ? 'true' : 'false';

  return (
    <div
      ref={pillRef}
      tabIndex={0}
      role="group"
      aria-label="Edge controls"
      aria-expanded={ariaExpanded}
      className={`transition-all duration-200 ease-in-out flex flex-row items-center justify-center select-none shadow-sm
        ${expanded ? 'bg-white border border-gray-200 rounded-full px-3 min-w-28' : 'bg-white border border-gray-200 rounded-full px-2 min-w-14'}
        ${persistExpanded || expanded ? 'z-[100]' : 'z-40'} h-7 min-h-[28px] max-h-[28px]'`}
      style={{
        height: 28,
        minHeight: 28,
        maxHeight: 28,
        minWidth: 56,
        outline: 'none', // Remove default blue outline
        boxShadow: expanded ? '0 2px 8px rgba(0,0,0,0.10)' : '0 1px 2px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        zIndex: 1000,
        transform: `translateY(${yOffset}px)`
      }}
      onFocus={onPillFocus}
      onBlur={onPillBlur}
      onMouseEnter={onPillFocus}
      onMouseLeave={onPillBlur}
      onClick={() => {
        if (!expanded) setPersistExpanded(true);
      }}
      onKeyDown={handlePillKeyDown}
      data-testid="edge-overlay-pill"
    >
      {/* Likelihood label always visible, input only in expanded mode */}
      {/* Editing is always enabled when overlay is expanded (hover/focus/click) */}
      {expanded ? (
        <>
          <EdgeLikelihoodEditor
            edge={edge}
            likelihood={likelihood}
            onUpdate={onLikelihoodUpdate}
            autoFocus
            onKeyDown={handleChildKeyDown}
            inputClassName="focus:shadow-[0_0_0_2px_rgba(180,180,180,0.15)] focus:outline-none border-gray-300 outline-none h-7 min-h-[28px] max-h-[28px] !m-0 !p-0 flex-shrink-0 bg-white"
            editing={editing}
            setEditing={setEditing}
            onBlur={() => setEditing(false)}
          />
          <button
            className="ml-2 w-7 h-7 min-h-[28px] max-h-[28px] flex items-center justify-center rounded-full border border-gray-200 hover:bg-blue-50 focus:shadow-[0_0_0_2px_rgba(180,180,180,0.15)] transition-colors relative"
            aria-label="Show comments for edge"
            tabIndex={0}
            style={{ pointerEvents: 'auto', background: 'none', outline: focusIdx === 2 ? '2px solid #cbd5e1' : 'none', boxShadow: focusIdx === 2 ? '0 0 0 2px rgba(96,165,250,0.15)' : 'none' }}
            onMouseDown={e => e.preventDefault()}
            onClick={e => { e.stopPropagation(); onShowComments(edge.id, { type: 'edge' }); if (reads) reads.markRead(lastCommentAt || Date.now()); }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onShowComments(edge.id, { type: 'edge' });
                if (reads) reads.markRead(lastCommentAt || Date.now());
              }
              handleChildKeyDown(e);
            }}
            onFocus={() => setFocusIdx(2)}
            onBlur={() => setFocusIdx(0)}
          >
            <span role="img" aria-label="comments" className="text-lg">💬</span>
            {/* Show a badge if there are comments: count; and an unread dot if applicable */}
            {commentCount > 0 && (
              <span
                aria-label={`${commentCount} comment${commentCount > 1 ? 's' : ''}`}
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold"
                style={{ minWidth: 18, height: 18, fontSize: 11, padding: '0 5px', border: '2px solid white', boxSizing: 'border-box' }}
              >
                {commentCount < 10 ? commentCount : '9+'}
              </span>
            )}
            {unread && (
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white"
              />
            )}
          </button>
        </>
      ) : (
        <span
          className="text-gray-700 font-semibold select-none px-1"
          aria-label={`Edge likelihood: ${likelihood}%`}
          style={{ fontSize: 15, minWidth: 32, textAlign: 'center', letterSpacing: 0.5 }}
        >
          {likelihood}%
        </span>
      )}
    </div>
  );
};
