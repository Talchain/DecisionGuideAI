import { renderHook, act } from '@testing-library/react';
import { useCommentState } from './useCommentState';

describe('useCommentState', () => {
  it('should add, edit, and delete comments', () => {
    const { result } = renderHook(() => useCommentState());
    // Add
    act(() => {
      result.current.addComment({ targetId: 'node1', author: 'A', text: 'Hello' });
    });
    expect(result.current.comments.length).toBe(1);
    const id = result.current.comments[0].id;
    // Edit
    act(() => {
      result.current.editComment(id, 'Updated');
    });
    expect(result.current.comments[0].text).toBe('Updated');
    // Delete
    act(() => {
      result.current.deleteComment(id);
    });
    expect(result.current.comments.length).toBe(0);
  });
});
