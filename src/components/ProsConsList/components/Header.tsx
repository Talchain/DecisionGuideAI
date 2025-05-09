import React from 'react';
import { Plus, Save, BarChart2, RotateCcw, RotateCw, Check, AlertCircle } from 'lucide-react';
import Tooltip from '../../Tooltip';

interface HeaderProps {
  className?: string;
  canUndo: boolean;
  canRedo: boolean;
  hasOptions: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onShowScores: () => void;
  onSave: () => void;
  onAddOption: () => void;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  saveError: string | null;
}

export default function Header({
  className = '',
  canUndo,
  canRedo,
  hasOptions,
  onUndo,
  onRedo,
  onShowScores,
  onSave,
  onAddOption,
  saveStatus,
  saveError
}: HeaderProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Options Analysis with weighted pros and cons
        </h3>
        <p className="text-sm text-gray-600">
          Compare different options to help make an informed decision.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {saveStatus === 'success' && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
              <Check className="h-4 w-4" />
              <span className="text-sm">Saved successfully</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{saveError}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {(canUndo || canRedo) && (
            <div className="flex items-center gap-2">
              {canUndo && (
                <Tooltip content="Undo last action">
                  <button
                    onClick={onUndo}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Undo
                  </button>
                </Tooltip>
              )}
              {canRedo && (
                <Tooltip content="Redo last undone action">
                  <button
                    onClick={onRedo}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <RotateCw className="h-4 w-4" />
                    Redo
                  </button>
                </Tooltip>
              )}
            </div>
          )}
          {hasOptions && (
            <Tooltip content="Review option scores">
              <button
                onClick={onShowScores}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <BarChart2 className="h-4 w-4" />
                Review Scores
              </button>
            </Tooltip>
          )}
          <Tooltip content="Save your analysis">
            <button
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </Tooltip>
          <Tooltip content="Add a new option">
            <button
              onClick={onAddOption}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Option
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}