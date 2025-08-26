import React from 'react';
import { Slider } from '../../components/ui/slider';
import { Edge } from '../state/boardState';

interface EdgeLikelihoodSliderProps {
  edge: Edge;
  onChange: (likelihood: number) => void;
  position?: { x: number; y: number };
}

export const EdgeLikelihoodSlider: React.FC<EdgeLikelihoodSliderProps> = ({
  edge,
  onChange,
  position,
}) => {
  // Ensure we have a valid likelihood value between 0 and 100
  const currentValue = Math.max(0, Math.min(100, edge.likelihood ?? 50));
  
  const handleChange = (value: number[]) => {
    // The slider component provides an array of numbers, we take the first one
    const likelihood = Math.max(0, Math.min(100, value[0] ?? 50));
    onChange(likelihood);
  };

  return (
    <div 
      className="absolute z-50 w-56 p-4 bg-white rounded-lg shadow-xl border border-gray-200"
      style={position ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%)', // Center above the position
      } : {}}
      onClick={(e) => e.stopPropagation()} // Prevent click propagation to canvas
    >
      <div className="mb-2 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">
          Connection Strength
        </span>
        <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded">
          {currentValue}%
        </span>
      </div>
      <div className="mb-1">
        <Slider
          value={[currentValue]}
          onValueChange={handleChange}
          min={0}
          max={100}
          step={1}
          className="w-full"
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Weak</span>
        <span>Strong</span>
      </div>
    </div>
  );
};
