import React, { useState, useRef, useEffect } from 'react';
import type { Edge } from '../../types/sandbox';

interface EdgeLikelihoodEditorProps {
  edge: Edge;
  likelihood: number;
  onUpdate?: (id: string, value: number) => void;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputClassName?: string;
  editing?: boolean;
  setEditing?: (editing: boolean) => void;
  onBlur?: () => void;
}

/**
 * Inline editor for edge likelihood (0-100%)
 * - Instantly editable on hover/focus/click
 * - Enter/blur saves, Esc cancels
 * - Harmonised compact style
 */
export const EdgeLikelihoodEditor: React.FC<EdgeLikelihoodEditorProps> = ({
  edge,
  likelihood,
  onUpdate,
  autoFocus,
  onKeyDown,
  inputClassName,
  editing,
  setEditing,
  onBlur,
}) => {
  // Controlled editing state
  const [localEditing] = useState(false); // not set, for legacy support
  const isEditing = typeof editing === 'boolean' ? editing : localEditing;

  const [inputValue, setInputValue] = useState(likelihood);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input with likelihood
  useEffect(() => {
    if (!isEditing) setInputValue(likelihood);
  }, [likelihood, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Activate editing (not used directly here)
  const activateEdit = () => {
    if (setEditing) setEditing(true);
    setInputValue(likelihood);
    setError(null);
  };

  // Save new value
  const save = () => {
    if (inputValue < 0 || inputValue > 100 || isNaN(inputValue)) {
      setError('Value must be 0–100');
      return;
    }
    if (inputValue !== likelihood && onUpdate) {
      onUpdate(edge.id, inputValue);
    }
    setEditing && setEditing(false);
    setError(null);
  };

  // Cancel edit
  const cancel = () => {
    setInputValue(likelihood);
    setEditing && setEditing(false);
    setError(null);
  };

  // Input change
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^0-9]/g, '');
    let n = Number(v);
    if (v === '') n = 0;
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    setInputValue(n);
    if (n < 0 || n > 100) setError('Value must be 0–100');
    else setError(null);
  };

  // Keyboard events
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') save();
    else if (e.key === 'Escape') cancel();
  };

  // Styles for pill and input
  const pillStyle: React.CSSProperties = {
    minWidth: 36,
    minHeight: 24,
    maxHeight: 24,
    height: 24,
    padding: '0 8px',
    display: 'inline-flex',
    alignItems: 'center',
    background: 'white',
    borderRadius: 9999,
    boxShadow: 'none',
    border: '1px solid #e5e7eb',
    fontSize: 13,
    userSelect: 'none',
    margin: 0,
    gap: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: 32,
    height: 20,
    minHeight: 20,
    maxHeight: 20,
    fontSize: 13,
    padding: '0 2px',
    textAlign: 'center',
    outline: 'none',
    border: error ? '1px solid #f87171' : '1px solid #e5e7eb',
    borderRadius: 4,
    boxShadow: 'none',
    margin: 0,
    background: 'white',
    transition: 'box-shadow 0.1s',    
  };

  if (!isEditing) {
    return (
      <div
        tabIndex={0}
        role="button"
        aria-label="Edit likelihood"
        className="text-xs font-medium fill-gray-700 cursor-pointer"
        style={pillStyle}
        onClick={() => setEditing ? setEditing(true) : activateEdit()}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && setEditing) setEditing(true);
        }}
      >
        {likelihood}<span className="text-xs text-gray-500" style={{marginLeft: 1}}>%</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); save(); }}
      style={pillStyle}
      tabIndex={-1}
      aria-label="Edit edge likelihood"
    >
      <input
        ref={inputRef}
        type="number"
        min={0}
        max={100}
        className={`text-xs font-medium ${inputClassName ?? ''}`}
        value={inputValue}
        onChange={onInput}
        onBlur={e => {
          save();
          onBlur && onBlur();
        }}
        onKeyDown={onKeyDown ? onKeyDown : handleInputKeyDown}
        aria-label="Edit edge likelihood"
        aria-invalid={!!error}
        autoFocus={autoFocus}
        style={inputStyle}
      />
      {/* Hide % while editing */}
      {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
    </form>
  );
};

export default EdgeLikelihoodEditor;