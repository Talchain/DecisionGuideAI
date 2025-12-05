import React, { memo } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import OptionColumn from '../OptionColumn';
import { Option } from '../types';

interface OptionsGridProps {
  options: Option[];
  onDeleteOption: (id: string) => void;
  onUpdateOption: (id: string, name: string) => void;
  onAddItem: (optionId: string, type: 'pros' | 'cons', content: string) => void;
  onDeleteItem: (optionId: string, type: 'pros' | 'cons', itemId: string) => void;
  onUpdateItem: (optionId: string, type: 'pros' | 'cons', itemId: string, content: string) => void;
  onUpdateScore: (optionId: string, type: 'pros' | 'cons', itemId: string, score: number) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

const OptionsGrid = memo(({
  options,
  onDeleteOption,
  onUpdateOption,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  onUpdateScore,
  onDragEnd
}: OptionsGridProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance to start
        tolerance: 5, // Tolerance for slight movements
        delay: 150, // Small delay to differentiate from clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Don't render if no options
  if (!options || options.length === 0) {
    return null;
  }

  // CRITICAL FIX: Ensure options are valid before rendering
  const validOptions = options.filter(opt => 
    opt && typeof opt === 'object' && 
    opt.id && 
    Array.isArray(opt.pros) && 
    Array.isArray(opt.cons)
  );

  if (validOptions.length === 0) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg text-center">
        <p className="text-yellow-700">No valid options available. Please add an option to get started.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {validOptions.map((option) => (
          <OptionColumn
            key={option.id}
            option={option}
            onDelete={() => onDeleteOption(option.id)}
            onUpdate={(name) => onUpdateOption(option.id, name)}
            onAddItem={(type, content) => onAddItem(option.id, type, content)}
            onDeleteItem={(type, itemId) => onDeleteItem(option.id, type, itemId)}
            onUpdateItem={(type, itemId, content) => onUpdateItem(option.id, type, itemId, content)}
            onUpdateScore={(type, itemId, score) => onUpdateScore(option.id, type, itemId, score)}
          />
        ))}
      </div>
    </DndContext>
  );
});

OptionsGrid.displayName = 'OptionsGrid';

export default OptionsGrid;