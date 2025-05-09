import React, { useState, useRef, useEffect, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Edit2 } from 'lucide-react';
import ScoreStars from './ScoreStars';
import Tooltip from '../Tooltip';

interface SortableItemProps {
  id: string;
  index: number;
  content: string;
  score?: number;
  type: 'pros' | 'cons';
  onDelete: () => void;
  onUpdate: (content: string) => void;
  onUpdateScore?: (score: number) => void;
}

// Memoize the component to prevent unnecessary re-renders
const SortableItem = memo(({
  id,
  index,
  content,
  score = 0,
  type,
  onDelete,
  onUpdate,
  onUpdateScore
}: SortableItemProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const isBlurringRef = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id,
    data: {
      type,
      index,
      optionId: id.split('_')[0]
    }
  });

  // Update state when content prop changes
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
    willChange: 'transform',
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
      adjustTextareaHeight(textareaRef.current);
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editedContent.trim() !== content) {
      onUpdate(editedContent.trim());
    }
    setIsEditing(false);
    isBlurringRef.current = false;
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
    isBlurringRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      isBlurringRef.current = true;
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isBlurringRef.current = true;
      handleCancel();
    }
  };

  const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    adjustTextareaHeight(e.target);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (isEditing || target.closest('.stars-section') || target.closest('button')) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (isBlurringRef.current) {
      return; // Already handled by keyboard event
    }
    
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest(`[data-item-id="${id}"]`) || !isEditing) {
      return;
    }

    handleSave();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-item-id={id}
      data-type={type}
      data-index={index}
      className={`group relative flex flex-col p-3 rounded-lg bg-white border hover:border-gray-300 ${
        type === 'pros' ? 'border-green-200' : 'border-red-200'
      } hover:shadow-sm transition-shadow min-h-[120px]`}
    >
      <div className="flex-1">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none overflow-hidden"
            style={{ minHeight: '24px' }}
            autoFocus
          />
        ) : (
          <div 
            className="text-sm text-gray-900 cursor-text mb-4"
            onClick={handleContentClick}
          >
            {editedContent}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        <Tooltip content="Rate the importance of this item (1-5 stars)">
          <div className="stars-section">
            <ScoreStars score={score} onChange={onUpdateScore || (() => {})} type={type} />
          </div>
        </Tooltip>

        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Tooltip content="Drag to reorder">
            <button
              {...attributes}
              {...listeners}
              className="touch-none p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md focus:outline-none"
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </Tooltip>
          {!isEditing && (
            <>
              <Tooltip content="Edit this item">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md focus:outline-none"
                  aria-label="Edit item"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content="Delete this item">
                <button
                  onClick={onDelete}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md focus:outline-none"
                  aria-label="Delete item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

SortableItem.displayName = 'SortableItem';

export default SortableItem;