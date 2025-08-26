import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { track } from '../telemetry/track';
import { useYjsComments, type RTComment } from '../state/useYjsComments';
import { useYjsEdgeReads } from '../state/useYjsEdgeReads';

/**
 * CommentPanel
 * Real-time, threaded comment panel for an edge, using Yjs for sync.
 * @param targetId - Edge id to show comments for
 * @param author - Current user
 * @param onClose - Callback to close the panel
 */
interface CommentPanelProps {
  targetId: string;
  author: string; // current user name (display)
  onClose: () => void;
  currentUserId?: string; // for reactions and unread tracking
  isModerator?: boolean; // moderator can always delete
  mentionUsers?: Array<{ id: string; name: string }>; // optional list for typeahead
  idleMarkMs?: number;
  mentionDebounceMs?: number; // debounce for typeahead
  notify?: { mention?: (args: { edgeId: string; commentId: string; userId: string; }) => void };
}

export function canEdit(comment: RTComment, author: string, isModerator: boolean, now = Date.now()): boolean {
  if (isModerator) return true;
  if (comment.author !== author) return false;
  const fifteen = 15 * 60 * 1000;
  const baseline = comment.updatedAt ?? comment.createdAt;
  return now - baseline <= fifteen;
}

export function extractMentions(body: string, mentionUsers: Array<{ id: string; name: string }>, selectedByName?: Map<string, string>) {
  const ids = new Set<string>();
  const nameToIds = new Map<string, string[]>();
  mentionUsers.forEach(u => {
    const arr = nameToIds.get(u.name) ?? [];
    arr.push(u.id);
    nameToIds.set(u.name, arr);
  });
  // Only match tokens that start at line start, whitespace, or opening punctuation to avoid emails like a@b.com
  // Use Unicode-aware character classes to support diacritics in names
  const matches = [...body.matchAll(/(^|[\s\(\[\{])@([\p{L}\p{M}\p{N}_-]+)/gu)];
  matches.forEach(m => {
    const name = (m[2] || '').trim();
    if (selectedByName?.has(name)) {
      ids.add(selectedByName.get(name)!);
      return;
    }
    const arr = nameToIds.get(name);
    if (arr && arr.length > 0) ids.add(arr[arr.length - 1]); // prefer last occurrence for stability
  });
  return Array.from(ids);
}

export const CommentPanel: React.FC<CommentPanelProps> = ({ targetId, author, onClose, currentUserId, isModerator = false, mentionUsers = [], idleMarkMs = 5000, mentionDebounceMs = 200, notify }) => {
  const { comments, addComment, editComment, deleteComment, toggleReaction, lastCommentAt, roots, repliesByParent } = useYjsComments(targetId);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const addToast = (msg: string) => setToasts(t => [...t, msg]);
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = window.setTimeout(() => setToasts(t => t.slice(1)), 2500);
    return () => window.clearTimeout(id);
  }, [toasts]);

  // Reads: mark as read on open if user provided
  const reads = currentUserId ? useYjsEdgeReads(targetId, currentUserId) : null;
  const localLastReadAtRef = useRef<number>(0);
  // capture opener to return focus
  useEffect(() => {
    openerRef.current = (document.activeElement as HTMLElement) || null;
  }, []);
  // mark read on open and on idle (5s) and on close
  useEffect(() => {
    if (!reads) return;
    const nowMax = Math.max(localLastReadAtRef.current, lastCommentAt || 0);
    reads.markRead(nowMax);
    track('edge_mark_read', { edgeId: targetId, lastReadAt: nowMax });
    localLastReadAtRef.current = nowMax;
  }, [reads]);
  useEffect(() => {
    if (!reads) return;
    const t = window.setTimeout(() => {
      if (reads) {
        const nowMax = Math.max(localLastReadAtRef.current, lastCommentAt || 0);
        reads.markRead(nowMax);
        track('edge_mark_read', { edgeId: targetId, lastReadAt: nowMax });
        localLastReadAtRef.current = nowMax;
      }
    }, idleMarkMs);
    return () => window.clearTimeout(t);
  }, [reads, lastCommentAt, idleMarkMs, targetId]);
  const handleClose = () => {
    if (reads) {
      const nowMax = Math.max(localLastReadAtRef.current, lastCommentAt || 0);
      reads.markRead(nowMax);
      track('edge_mark_read', { edgeId: targetId, lastReadAt: nowMax });
      localLastReadAtRef.current = nowMax;
    }
    onClose();
    // return focus to opener
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  const rootsSorted = useMemo(() => {
    return [...roots].sort((a, b) => (a.createdAt - b.createdAt) || a.id.localeCompare(b.id));
  }, [roots]);
  // Pagination: last 50 by default with Load older (in steps of 50)
  const PAGE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const visibleRoots = useMemo(() => {
    const start = Math.max(rootsSorted.length - visibleCount, 0);
    return rootsSorted.slice(start);
  }, [rootsSorted, visibleCount]);
  const replies = (parentId: string) => repliesByParent.get(parentId) || [];

  const canEditLocal = (c: RTComment) => canEdit(c, author, isModerator);
  const selectedMentionByNameRef = useRef<Map<string, string>>(new Map());
  const selectedMentionIdsRef = useRef<Set<string>>(new Set());

  // Focus trap: keep focus within panel while open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = panelRef.current;
      if (!container) return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>('button, [href], textarea, input, select, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (active === last || !container.contains(active)) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const extractMentionsLocal = (body: string) => extractMentions(body, mentionUsers, selectedMentionByNameRef.current);

  const [isSending, setIsSending] = useState(false);
  const handleAdd = () => {
    const val = text.trim();
    if (val.length === 0) return;
    if (val.length > 4000) return; // basic length guard
    if (isSending) return;
    const extracted = extractMentionsLocal(val);
    // Build set of token names present to filter persisted selections
    const tokenMatches = [...val.matchAll(/(^|[\s\(\[\{])@([\p{L}\p{M}\p{N}_-]+)/gu)];
    const tokenNames = new Set(tokenMatches.map(m => (m[2] || '').trim()));
    const persisted = Array.from(selectedMentionByNameRef.current.entries())
      .filter(([name]) => tokenNames.has(name))
      .map(([, id]) => id);
    const mentions = Array.from(new Set([...extracted, ...persisted]));
    const created = addComment({ targetId, author, text: val, parentId: replyTo, mentions });
    // notifier fallback if mentions present
    if (mentions.length > 0) {
      mentions.forEach(id => {
        const user = mentionUsers.find(u => u.id === id);
        if (user && id !== currentUserId) {
          addToast(`Mentioned ${user.name}`);
          if (notify?.mention && created) notify.mention({ edgeId: targetId, commentId: created.id, userId: id });
        }
      });
    }
    setText('');
    setReplyTo(undefined);
    inputRef.current?.focus();
    setIsSending(true);
    window.setTimeout(() => setIsSending(false), 500);
    selectedMentionIdsRef.current.clear();
    selectedMentionByNameRef.current.clear();
    setMentionQuery(null);
  };
  const handleEdit = (id: string) => {
    const val = editText.trim();
    if (val.length === 0) return;
    if (val.length > 4000) return;
    // enforce 15-min window at submit time
    const all = [...roots, ...Array.from(repliesByParent.values()).flat()];
    const target = all.find(c => c.id === id);
    if (target) {
      const baseline = target.updatedAt ?? target.createdAt;
      const fifteen = 15 * 60 * 1000;
      if (Date.now() - baseline > fifteen && !isModerator) {
        addToast('Edit window expired');
        setEditingId(null);
        return;
      }
    }
    editComment(id, val);
    setEditingId(null);
    setEditText('');
  };
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // newline
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = editingId ? editText : text;
      const next = val.slice(0, start) + '\n' + val.slice(end);
      if (editingId) setEditText(next); else setText(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 1;
      });
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (editingId) handleEdit(editingId); else handleAdd();
      return;
    }
    if (e.key === 'Escape') {
      setEditingId(null);
      setEditText('');
      setReplyTo(undefined);
      onClose();
    }
  };

  // Mention typeahead (lightweight)
  const [mentionQueryRaw, setMentionQueryRaw] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setMentionQuery(mentionQueryRaw), mentionDebounceMs);
    return () => window.clearTimeout(t);
  }, [mentionQueryRaw, mentionDebounceMs]);
  const mentionResults = useMemo(() => {
    if (!mentionQuery) return [] as Array<{ id: string; name: string }>;
    const q = mentionQuery.toLowerCase();
    return mentionUsers.filter(u => u.name.toLowerCase().includes(q)).slice(0, 20);
  }, [mentionQuery, mentionUsers]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const handleComposerChange = (val: string, isEdit: boolean) => {
    // update text and detect @query
    const m = /(^|\s)@([\p{L}\p{M}\p{N}_-]{1,32})$/u.exec(val.slice(0, (inputRef.current?.selectionStart ?? val.length)));
    setMentionQueryRaw(m ? m[2] : null);
    if (!m) setActiveIndex(0);
    if (val.trim().length === 0) {
      // clear selected maps on composer clear
      selectedMentionIdsRef.current.clear();
      selectedMentionByNameRef.current.clear();
    }
    if (isEdit) setEditText(val); else setText(val);
  };
  const insertMention = (user: { id: string; name: string }) => {
    const el = inputRef.current;
    if (!el) return;
    const isEdit = !!editingId;
    const val = isEdit ? editText : text;
    const pos = el.selectionStart ?? val.length;
    // replace the trailing @query with @name (Unicode-aware)
    const before = val.slice(0, pos).replace(/@([\p{L}\p{M}\p{N}_-]{1,32})$/u, `@${user.name}`);
    const after = val.slice(pos);
    const next = before + after + ' ';
    selectedMentionByNameRef.current.set(user.name, user.id);
    selectedMentionIdsRef.current.add(user.id);
    if (isEdit) setEditText(next); else setText(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const caret = (before + ' ').length;
      el.selectionStart = el.selectionEnd = caret;
    });
  };
  const remaining = 4000 - (editingId ? editText.length : text.length);
  const showCounter = remaining <= 200;
  const sendDisabled = isSending || (editingId ? editText.trim().length === 0 : text.trim().length === 0) || remaining < 0;
  return (
    <div ref={panelRef} className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg z-50 flex flex-col" role="dialog" aria-modal="true" aria-label="Comments">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="font-bold">Comments</span>
        <button aria-label="Close comments" onClick={handleClose} className="text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600">✕</button>
      </div>
      {/* Live region for updates */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">{comments.length} comments</div>
      <div className="flex-1 overflow-y-auto p-3">
        {rootsSorted.length === 0 && <div className="text-gray-400">Be the first to comment on this connection.</div>}
        {visibleRoots.map(c => (
          <div key={c.id} className="mb-4">
            {/* Author and timestamp */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{c.author}</span>
              <span className="text-xs text-gray-400">{new Date(c.updatedAt ?? c.createdAt).toLocaleString()}</span>
              <button aria-label="Reply" onClick={() => { setReplyTo(c.id); inputRef.current?.focus(); }} className="ml-auto text-xs text-blue-600">Reply</button>
              {(isModerator || c.author === author) && <>
                <button
                  aria-label="Edit"
                  onClick={() => {
                    if (!canEditLocal(c)) { addToast('Edit window expired'); return; }
                    setEditingId(c.id); setEditText(c.text);
                  }}
                  className={`text-xs ml-2 ${canEditLocal(c) ? 'text-green-600' : 'text-gray-400'}`}
                  aria-disabled={!canEditLocal(c)}
                >Edit</button>
                <button aria-label="Delete" onClick={() => deleteComment(c.id)} className="text-xs text-red-600 ml-1">Delete</button>
              </>}
            </div>
            {editingId === c.id ? (
              <textarea
                ref={inputRef}
                className="w-full border rounded px-2 py-1 mt-1"
                value={editText}
                onChange={e => handleComposerChange(e.target.value, true)}
                onKeyDown={(e) => {
            // Typeahead keyboard navigation
            if (mentionResults.length > 0 && !editingId) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, mentionResults.length - 1)); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return; }
              if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
                e.preventDefault(); insertMention(mentionResults[activeIndex]); return;
              }
              if (e.key === 'Escape') { setMentionQuery(null); return; }
            }
            handleComposerKeyDown(e);
          }}
                aria-label="Edit comment"
                autoFocus
              />
            ) : (
              <div className="mt-1 text-gray-800 whitespace-pre-line">
                {c.isDeleted ? <i className="text-gray-400">Deleted</i> : highlightMentions(sanitizeText(c.text))}
              </div>
            )}
            {/* Reactions */}
            <ReactionBar
              comment={c}
              currentUserId={currentUserId}
              onToggle={(emoji) => currentUserId && toggleReaction(c.id, emoji, currentUserId)}
            />
            {/* Replies */}
            <div className="ml-4 mt-2">
              {replies(c.id).map(r => (
                <div key={r.id} className="mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs">{r.author}</span>
                    <span className="text-xs text-gray-400">{new Date(r.updatedAt ?? r.createdAt).toLocaleString()}</span>
                    {(isModerator || r.author === author) && <>
                      <button
                        aria-label="Edit reply"
                        onClick={() => {
                          if (!canEditLocal(r)) { addToast('Edit window expired'); return; }
                          setEditingId(r.id); setEditText(r.text);
                        }}
                        className={`text-xs ml-2 ${canEditLocal(r) ? 'text-green-600' : 'text-gray-400'}`}
                        aria-disabled={!canEditLocal(r)}
                      >Edit</button>
                      <button aria-label="Delete reply" onClick={() => deleteComment(r.id)} className="text-xs text-red-600 ml-1">Delete</button>
                    </>}
                  </div>
                  {editingId === r.id ? (
                    <textarea
                      ref={inputRef}
                      className="w-full border rounded px-2 py-1 mt-1"
                      value={editText}
                      onChange={e => handleComposerChange(e.target.value, true)}
                      onKeyDown={handleComposerKeyDown}
                      aria-label="Edit reply"
                      autoFocus
                    />
                  ) : (
                    <div className="mt-1 text-gray-800 whitespace-pre-line">{r.isDeleted ? <i className="text-gray-400">Deleted</i> : highlightMentions(sanitizeText(r.text))}</div>
                  )}
                  <ReactionBar
                    comment={r}
                    currentUserId={currentUserId}
                    onToggle={(emoji) => currentUserId && toggleReaction(r.id, emoji, currentUserId)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {rootsSorted.length > visibleRoots.length && (
          <div className="flex justify-center">
            <button className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600" onClick={() => setVisibleCount(v => v + PAGE)} aria-label="Load older comments">Load older</button>
          </div>
        )}
      </div>
      <div className="p-3 border-t flex flex-col gap-2">
        {replyTo && <div className="text-xs text-gray-600">Replying...</div>}
        <div className="relative">
        <textarea
          ref={inputRef}
          className="w-full border rounded px-2 py-1"
          value={editingId ? editText : text}
          onChange={e => handleComposerChange(e.target.value, !!editingId)}
          onKeyDown={(e) => {
            // Typeahead keyboard navigation for main composer
            if (mentionResults.length > 0 && !editingId) {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, mentionResults.length - 1)); return; }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return; }
              if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); insertMention(mentionResults[activeIndex]); return; }
              if (e.key === 'Escape') { setMentionQuery(null); return; }
            }
            handleComposerKeyDown(e);
          }}
          aria-label={editingId ? 'Edit comment' : replyTo ? 'Reply to comment' : 'Add comment'}
          placeholder={editingId ? 'Edit comment...' : replyTo ? 'Reply...' : 'Add a comment...'}
          style={{ fontFamily: 'inherit' }}
          rows={3}
        />
        {showCounter && (
          <div className={"absolute right-2 -bottom-5 text-xs " + (remaining < 0 ? 'text-red-600' : 'text-gray-500')}>{remaining}</div>
        )}
        {/* Mention typeahead dropdown with listbox semantics */}
        {mentionResults.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 right-0 bg-white border rounded shadow z-10" role="listbox" aria-activedescendant={mentionResults[activeIndex]?.id}>
            <div className="sr-only" aria-live="polite" aria-atomic="true">{mentionResults.length} suggestions</div>
            {mentionResults.map((u, i) => (
              <button
                key={u.id}
                id={u.id}
                role="option"
                aria-selected={i === activeIndex}
                className={"w-full text-left px-2 py-1 " + (i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50')}
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertMention(u)}
              >
                @{u.name}
              </button>
            ))}
          </div>
        )}
      </div>

        <div className="flex gap-2">
          {editingId ? (
            <button className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50" onClick={() => handleEdit(editingId)} aria-label="Save edit" disabled={sendDisabled}>Save</button>
          ) : (
            <button className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50" onClick={handleAdd} aria-label="Add comment" disabled={sendDisabled}>Add</button>
          )}
          <button className="px-3 py-1 rounded bg-gray-200" onClick={handleClose} aria-label="Close">Close</button>
        </div>
        {/* Lightweight toast fallback */}
        <div aria-live="polite" aria-atomic="true" className="pointer-events-none fixed right-2 bottom-2 flex flex-col gap-1">
          {toasts.map((t, i) => (
            <div key={i} className="px-2 py-1 rounded bg-gray-900/80 text-white text-xs shadow">{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Highlight @mentions in text with a span
function sanitizeText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightMentions(text: string) {
  const parts = text.split(/([@][\w-]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} style={{ color: '#2563eb', fontWeight: 500, background: '#e0e7ff', borderRadius: 3, padding: '0 2px' }}>{part}</span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

// Lightweight reaction bar with accessible emoji chips
const EMOJIS = ['👍','🎉','👀','❗','🙌','😀','😍','🤔','👎','🔥','🚀','✅','❓','🤝','🧠','💡','📌','🧪','🏁','🕒','📈','🛠️'];
const ReactionBar: React.FC<{ comment: RTComment; currentUserId?: string; onToggle: (emoji: string) => void; }> = ({ comment, currentUserId, onToggle }) => {
  const reactions = comment.reactions || {};
  const entries = Object.entries(reactions).filter(([, users]) => (users?.length || 0) > 0);
  const userHas = (emoji: string) => !!currentUserId && (new Set(reactions[emoji] || [])).has(currentUserId);
  return (
    <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Reactions">
      {entries.map(([emoji, users]) => (
        <button
          key={emoji}
          className={`px-1.5 h-6 rounded-full border text-sm flex items-center gap-1 ${userHas(emoji) ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}
          onClick={() => onToggle(emoji)}
          aria-pressed={userHas(emoji)}
        >
          <span>{emoji}</span>
          <span className="text-xs text-gray-600">{users.length}</span>
        </button>
      ))}
      {/* Minimal picker */}
      <details>
        <summary className="cursor-pointer select-none text-xs text-gray-600 px-1">Add</summary>
        <div className="mt-1 p-1 border rounded bg-white shadow max-w-xs grid grid-cols-8 gap-1">
          {EMOJIS.map(e => (
            <button key={e} className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-50" onClick={(ev) => { ev.preventDefault(); onToggle(e); }} aria-label={`React ${e}`}>{e}</button>
          ))}
        </div>
      </details>
    </div>
  );
};
