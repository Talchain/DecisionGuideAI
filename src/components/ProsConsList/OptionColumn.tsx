import React, { useState, useRef, useEffect, memo } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoreVertical, Edit2, Trash2, ThumbsUp, ThumbsDown, Eraser } from 'lucide-react';
import SortableItem from './SortableItem';
import { Option } from './types';
import Tooltip from '../Tooltip';

interface OptionColumnProps {
  option: Option;
  onDelete: () => void;
  onUpdate: (name: string) => void;
  onAddItem: (type: 'pros' | 'cons', content: string) => void;
  onDeleteItem: (type: 'pros' | 'cons', itemId: string) => void;
  onUpdateItem: (type: 'pros' | 'cons', itemId: string, content: string) => void;
  onUpdateScore: (type: 'pros' | 'cons', itemId: string, score: number) => void;
}

// Memoize the component to prevent unnecessary re-renders
const OptionColumn = memo(({
  option,
  onDelete,
  onUpdate,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  onUpdateScore
}: OptionColumnProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(option.name);
  const [showMenu, setShowMenu] = useState(false);
  const [newItemType, setNewItemType] = useState<'pros' | 'cons' | null>(null);
  const [newItemText, setNewItemText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // DEBUG: Add render counter
  const renderCountRef = useRef(0);
  const optionId = option.id;
  
  // Only log render count in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      renderCountRef.current++;
      console.log(`[DEBUG] OptionColumn render #${renderCountRef.current} for option:`, {
        id: option.id,
        name: option.name,
        prosCount: option.pros.length,
        consCount: option.cons.length
      });
    }
  // Explicitly including dependencies that matter for logging
  }, [optionId, option.name]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSave = () => {
    if (editedName.trim() !== option.name) {
      onUpdate(editedName.trim());
    }
    setIsEditing(false);
  };

  const handleAddItem = (type: 'pros' | 'cons') => {
    if (!newItemText.trim()) return;
    onAddItem(type, newItemText.trim());
    setNewItemText('');
    setNewItemType(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && newItemType) {
      e.preventDefault();
      handleAddItem(newItemType);
    }
  };

  const handleRemoveAllItems = () => {
    option.pros.forEach(item => {
      onDeleteItem('pros', item.id);
    });
    option.cons.forEach(item => {
      onDeleteItem('cons', item.id);
    });
    setShowMenu(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-200 relative">
        <div className="pr-10">
          {isEditing ? (
            <Tooltip content="Press Enter to save, Escape to cancel">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSave}
                onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
            </Tooltip>
          ) : (
            <Tooltip content="Double click to edit option name">
              <h4 
                className="text-lg font-medium text-gray-900 cursor-pointer"
                onDoubleClick={() => setIsEditing(true)}
              >
                {option.name}
              </h4>
            </Tooltip>
          )}
          
          <div className="absolute top-3 right-3">
            <Tooltip content="Option actions">
              <button
                ref={buttonRef}
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md focus:outline-none"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </Tooltip>
            
            {showMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-10"
              >
                <Tooltip content="Change the option name">
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowMenu(false);
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Rename Option
                  </button>
                </Tooltip>
                <Tooltip content="Remove all pros and cons from this option">
                  <button
                    onClick={handleRemoveAllItems}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Eraser className="h-4 w-4 mr-2" />
                    Remove all pros and cons
                  </button>
                </Tooltip>
                <Tooltip content="Remove this option and all its pros/cons">
                  <button
                    onClick={() => onDelete()}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Option
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tooltip content="Positive aspects of this option">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                <h5 className="font-medium text-gray-900">Pros</h5>
              </div>
            </Tooltip>
          </div>
          <SortableContext
            items={option.pros.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {option.pros.map((item, index) => (
                <SortableItem
                  key={item.id}
                  id={`${option.id}_pros_${index}`}
                  index={index}
                  content={item.content}
                  score={item.score}
                  type="pros"
                  onDelete={() => onDeleteItem('pros', item.id)}
                  onUpdate={(content) => onUpdateItem('pros', item.id, content)}
                  onUpdateScore={(score) => onUpdateScore('pros', item.id, score)}
                />
              ))}
            </div>
          </SortableContext>
          {newItemType === 'pros' ? (
            <div className="mt-2">
              <Tooltip content="Describe a positive aspect of this option">
                <textarea
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add a new pro..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  rows={2}
                  autoFocus
                />
              </Tooltip>
              <div className="flex justify-end gap-2 mt-2">
                <Tooltip content="Cancel adding new pro">
                  <button
                    onClick={() => setNewItemType(null)}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                </Tooltip>
                <Tooltip content="Save this pro">
                  <button
                    onClick={() => handleAddItem('pros')}
                    disabled={!newItemText.trim()}
                    className="px-3 py-1 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </Tooltip>
              </div>
            </div>
          ) : (
            <Tooltip content="Click to add a new positive aspect">
              <button
                onClick={() => setNewItemType('pros')}
                className="mt-2 w-full px-3 py-2 text-sm text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                + Add Pro
              </button>
            </Tooltip>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tooltip content="Negative aspects of this option">
              <div className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-red-600" />
                <h5 className="font-medium text-gray-900">Cons</h5>
              </div>
            </Tooltip>
          </div>
          <SortableContext
            items={option.cons.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {option.cons.map((item, index) => (
                <SortableItem
                  key={item.id}
                  id={`${option.id}_cons_${index}`}
                  index={index}
                  content={item.content}
                  score={item.score}
                  type="cons"
                  onDelete={() => onDeleteItem('cons', item.id)}
                  onUpdate={(content) => onUpdateItem('cons', item.id, content)}
                  onUpdateScore={(score) => onUpdateScore('cons', item.id, score)}
                />
              ))}
            </div>
          </SortableContext>
          {newItemType === 'cons' ? (
            <div className="mt-2">
              <Tooltip content="Describe a negative aspect of this option">
                <textarea
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add a new con..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  rows={2}
                  autoFocus
                />
              </Tooltip>
              <div className="flex justify-end gap-2 mt-2">
                <Tooltip content="Cancel adding new con">
                  <button
                    onClick={() => setNewItemType(null)}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                </Tooltip>
                <Tooltip content="Save this con">
                  <button
                    onClick={() => handleAddItem('cons')}
                    disabled={!newItemText.trim()}
                    className="px-3 py-1 text-sm text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </Tooltip>
              </div>
            </div>
          ) : (
            <Tooltip content="Click to add a new negative aspect">
              <button
                onClick={() => setNewItemType('cons')}
                className="mt-2 w-full px-3 py-2 text-sm text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                + Add Con
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
});

OptionColumn.displayName = 'OptionColumn';

export default OptionColumn;