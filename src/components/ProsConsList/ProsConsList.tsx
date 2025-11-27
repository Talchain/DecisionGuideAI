import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useHistory } from './hooks/useHistory';
import { useLocalStorage } from './hooks/storage/useLocalStorage';
import { Header, EmptyState, OptionsGrid } from './components';
import AddOptionModal from './AddOptionModal';
import ScoreComparison from './ScoreComparison';
import { Option, OptionScore } from './types';
import { Bias } from '../../lib/api';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

interface ProsConsListProps {
  decision: string;
  initialOptions?: Option[];
  biases?: Bias[];
  onOptionsChange?: (options: Option[]) => void;
}

// Memoize the component to prevent unnecessary re-renders
const ProsConsList = memo(({ 
  decision, 
  initialOptions = [],
  biases = [],
  onOptionsChange
}: ProsConsListProps) => {
  const [initialized, setInitialized] = useState(false);
  const [showAddOption, setShowAddOption] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [displayOptions, setDisplayOptions] = useState<Option[]>([]);
  const optionsProcessedRef = useRef(false);
  const lastInitialOptionsRef = useRef<Option[] | null>(null);

  const {
    value: savedOptions,
    setValue: setSavedOptions,
    hasValue
  } = useLocalStorage<Option[]>(
    `proscons_${decision}`,
    [],
    { debug: true }
  );

  const {
    state: options,
    push: updateHistory,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo
  } = useHistory<Option[]>(
    hasValue ? savedOptions : [],
    { maxSize: 30, debug: true }
  );

  // Compare initialOptions with the last processed options to avoid re-processing
  const shouldProcessInitialOptions = useCallback(() => {
    if (!initialOptions || initialOptions.length === 0) return false;
    if (optionsProcessedRef.current) {
      if (lastInitialOptionsRef.current === null) return true;
      
      // Compare initialOptions with lastInitialOptionsRef.current
      const lastJson = JSON.stringify(lastInitialOptionsRef.current);
      const currentJson = JSON.stringify(initialOptions);
      return lastJson !== currentJson;
    }
    return true;
  }, [initialOptions]);

  // CRITICAL FIX: Add initialization effect with optimization
  useEffect(() => {
    if (shouldProcessInitialOptions()) {
      try {
        // Ensure all options have valid arrays for pros and cons
        const validatedOptions = initialOptions.map(opt => ({
          ...opt,
          pros: Array.isArray(opt.pros) ? opt.pros : [],
          cons: Array.isArray(opt.cons) ? opt.cons : []
        }));

        setDisplayOptions(validatedOptions);
        updateHistory(validatedOptions);
        setInitialized(true);
        optionsProcessedRef.current = true;
        lastInitialOptionsRef.current = [...initialOptions];
      } catch (err) {
        console.error('[ProsConsList] Error processing options:', err);
      }
    }
  }, [initialOptions, updateHistory, shouldProcessInitialOptions]);

  const handleOptionsChange = useCallback((newOptions: Option[]) => {
    if (!Array.isArray(newOptions)) {
      console.error('[ProsConsList] Invalid options format:', newOptions);
      return;
    }

    // Only update history if there are actual changes
    if (JSON.stringify(options) !== JSON.stringify(newOptions)) {
      updateHistory(newOptions);
    }

    setDisplayOptions(newOptions);
    setSavedOptions(newOptions);
    if (onOptionsChange) {
      onOptionsChange(newOptions);
    }
  }, [options, updateHistory, setSavedOptions, onOptionsChange]);

  const calculateScores = useCallback((): OptionScore[] => {
    return (displayOptions || []).map(option => {
      const prosScore = option.pros.reduce((sum, pro) => sum + pro.score, 0);
      const consScore = option.cons.reduce((sum, con) => sum + con.score, 0);
      return {
        name: option.name,
        prosScore,
        consScore,
        totalScore: prosScore - consScore
      };
    });
  }, [displayOptions]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const [activeOptionId, activeType, activeIndex] = (active.id as string).split('_');
    const [overOptionId, overType, overIndex] = (over.id as string).split('_');

    if (activeOptionId === overOptionId && activeType === overType) {
      const newOptions = (displayOptions || []).map(opt => {
        if (opt.id === activeOptionId) {
          const items = activeType === 'pros' ? opt.pros : opt.cons;
          const reorderedItems = arrayMove(
            items,
            parseInt(activeIndex),
            parseInt(overIndex)
          );
          return {
            ...opt,
            [activeType]: reorderedItems
          };
        }
        return opt;
      });
      
      handleOptionsChange(newOptions);
    }
  }, [displayOptions, handleOptionsChange]);

  const handleAddOption = useCallback((name: string) => {
    const timestamp = Date.now();
    const newOption: Option = {
      id: `option_${timestamp}`,
      name,
      pros: [],
      cons: [],
      createdAt: new Date().toISOString()
    };
    const newOptions = [...(displayOptions || []), newOption];
    handleOptionsChange(newOptions);
    setShowAddOption(false);
  }, [displayOptions, handleOptionsChange]);

  const handleDeleteOption = useCallback((optionId: string) => {
    const newOptions = (displayOptions || []).filter(opt => opt.id !== optionId);
    handleOptionsChange(newOptions);
  }, [displayOptions, handleOptionsChange]);

  const handleUpdateOption = useCallback((optionId: string, name: string) => {
    const newOptions = (displayOptions || []).map(opt =>
      opt.id === optionId ? { ...opt, name } : opt
    );
    handleOptionsChange(newOptions);
  }, [displayOptions, handleOptionsChange]);

  const handleAddItem = useCallback((optionId: string, type: 'pros' | 'cons', content: string) => {
    const timestamp = Date.now();
    const newOptions = (displayOptions || []).map(opt => {
      if (opt.id !== optionId) return opt;
      const items = type === 'pros' ? opt.pros : opt.cons;
      const newItem = {
        id: `${optionId}_${type}_${items.length}_${timestamp}`,
        content,
        score: 0,
        createdAt: new Date().toISOString()
      };
      return {
        ...opt,
        [type]: [...items, newItem]
      };
    });
    handleOptionsChange(newOptions);
  }, [displayOptions, handleOptionsChange]);

  const handleDeleteItem = useCallback((optionId: string, type: 'pros' | 'cons', itemId: string) => {
    const newOptions = (displayOptions || []).map(opt => {
      if (opt.id !== optionId) return opt;
      const items = type === 'pros' ? opt.pros : opt.cons;
      return {
        ...opt,
        [type]: items.filter(item => item.id !== itemId)
      };
    });
    handleOptionsChange(newOptions);
  }, [displayOptions, handleOptionsChange]);

  const handleUpdateItem = useCallback((optionId: string, type: 'pros' | 'cons', itemId: string, content: string) => {
    const newOptions = (displayOptions || []).map(opt => {
      if (opt.id !== optionId) return opt;
      const items = type === 'pros' ? opt.pros : opt.cons;
      return {
        ...opt,
        [type]: items.map(item =>
          item.id === itemId ? { ...item, content } : item
        )
      };
    });
    handleOptionsChange(newOptions);
  }, [displayOptions, handleOptionsChange]);

  const handleUpdateScore = useCallback((optionId: string, type: 'pros' | 'cons', itemId: string, score: number) => {
    const newOptions = (displayOptions || []).map(opt => {
      if (opt.id !== optionId) return opt;
      const items = type === 'pros' ? opt.pros : opt.cons;
      return {
        ...opt,
        [type]: items.map(item =>
          item.id === itemId ? { ...item, score } : item
        )
      };
    });
    handleOptionsChange(newOptions);
  }, [displayOptions, handleOptionsChange]);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <Header
        className="mb-8"
        canUndo={canUndo}
        canRedo={canRedo}
        hasOptions={displayOptions.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onShowScores={() => setShowScores(true)}
        onSave={() => {
          setSaveStatus('saving');
          setSavedOptions(displayOptions || []);
          setSaveStatus('success');
          setTimeout(() => setSaveStatus('idle'), 3000);
        }}
        onAddOption={() => setShowAddOption(true)}
        saveStatus={saveStatus}
        saveError={saveError}
      />

      {displayOptions.length > 0 ? (
        <OptionsGrid
          options={displayOptions}
          onDeleteOption={handleDeleteOption}
          onUpdateOption={handleUpdateOption}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
          onUpdateItem={handleUpdateItem}
          onUpdateScore={handleUpdateScore}
          onDragEnd={handleDragEnd}
        />
      ) : (
        <EmptyState onAddOption={() => setShowAddOption(true)} />
      )}

      {showAddOption && (
        <AddOptionModal
          onAdd={handleAddOption}
          onClose={() => setShowAddOption(false)}
        />
      )}

      {showScores && (
        <ScoreComparison
          scores={calculateScores()}
          onClose={() => setShowScores(false)}
        />
      )}
    </div>
  );
});

// Add display name for debugging
ProsConsList.displayName = 'ProsConsList';

export default ProsConsList;
export * from './types';
export * from './hooks/useOptionsHistory';
export * from './ScoreStars';