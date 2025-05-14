import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Check, X, User } from 'lucide-react';
import { Option } from '../../hooks/useDecisionOptions';
import Tooltip from '../Tooltip';

interface OptionCardProps {
  option: Option;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, updates: Partial<Option>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currentUserId: string | undefined;
}

export default function OptionCard({
  option,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  currentUserId
}: OptionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(option.text);
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleUpdate = async () => {
    try {
      await onUpdate(option.id, { text: editedText });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update option:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this option?')) return;
    
    setIsDeleting(true);
    try {
      await onDelete(option.id);
    } catch (err) {
      console.error('Failed to delete option:', err);
      setIsDeleting(false);
    }
  };

  const canModify = currentUserId && (
    option.user_id === currentUserId || 
    option.source === 'ai'
  );

  return (
    <div
      className={`
        relative p-4 bg-white rounded-lg border transition-all duration-200
        ${isSelected ? 'border-indigo-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}
      `}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditedText(option.text);
                    setIsEditing(false);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={!editedText.trim() || editedText === option.text}
                  className="p-1 text-green-600 hover:text-green-700 rounded disabled:opacity-50"
                >
                  <Check className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-900">{option.text}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canModify && !isEditing && (
            <>
              <Tooltip content="Edit option">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content="Delete option">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-1 text-gray-400 hover:text-red-600 rounded disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-gray-500">
            <User className="h-4 w-4" />
            <span>{option.source === 'ai' ? 'AI Generated' : 'User'}</span>
          </div>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">
            {new Date(option.created_at).toLocaleDateString()}
          </span>
        </div>

        <button
          onClick={onSelect}
          className={`
            px-2 py-1 text-xs font-medium rounded
            ${isSelected
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-500 hover:text-gray-700'
            }
          `}
        >
          {isSelected ? 'Selected' : 'Select'}
        </button>
      </div>
    </div>
  );
}