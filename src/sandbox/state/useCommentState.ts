import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface Comment {
  id: string;
  parentId?: string;
  targetId: string;
  author: string;
  text: string;
  createdAt: number;
}

export function useCommentState() {
  const [comments, setComments] = useState<Comment[]>([]);

  const addComment = useCallback((comment: Omit<Comment, 'id' | 'createdAt'>) => {
    const newComment: Comment = {
      ...comment,
      id: uuidv4(),
      createdAt: Date.now(),
    };
    setComments(prev => [...prev, newComment]);
    return newComment;
  }, []);

  const editComment = useCallback((id: string, text: string) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, text } : c));
  }, []);

  const deleteComment = useCallback((id: string) => {
    setComments(prev => prev.filter(c => c.id !== id && c.parentId !== id));
  }, []);

  const listComments = useCallback((targetId: string) => {
    return comments.filter(c => c.targetId === targetId);
  }, [comments]);

  return {
    comments,
    addComment,
    editComment,
    deleteComment,
    listComments,
  };
}
