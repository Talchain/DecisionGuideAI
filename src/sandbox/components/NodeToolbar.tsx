import React from 'react';
import { Trash2 } from 'lucide-react';

interface NodeToolbarProps {
  x: number;
  y: number;
  onDeleteNode: () => void;
  onToggleDraft: () => void;
  isDraft: boolean;
}

export const NodeToolbar: React.FC<NodeToolbarProps> = ({
  x,
  y,

  onDeleteNode,
  onToggleDraft,
  isDraft,
}) => {


  return (
    <div 
      className="absolute z-20 flex items-center gap-1 p-1 bg-white rounded-lg shadow-md"
      style={{
        left: `${x}px`,
        top: `${y - 40}px`,
      }}
    >
      {/* Only draft and delete remain. */}
      <button
        onClick={onToggleDraft}
        className={`p-1 rounded ${isDraft ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'}`}
        title={isDraft ? 'Exit Draft Mode' : 'Enter Draft Mode'}
      >
        {isDraft ? 'Draft' : 'Draft'}
      </button>
      <button
        onClick={onDeleteNode}
        className="p-1 text-red-500 rounded hover:bg-red-50"
        title="Delete Node"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};
