import React from 'react';
import { Star } from 'lucide-react';

interface ScoreStarsProps {
  score: number;
  onChange: (score: number) => void;
  type: 'pros' | 'cons';
}

export default function ScoreStars({ score, onChange, type }: ScoreStarsProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          onClick={() => onChange(value === score ? 0 : value)}
          className={`p-0.5 rounded-full hover:bg-gray-100 transition-colors ${
            value <= score
              ? type === 'pros'
                ? 'text-green-500'
                : 'text-red-500'
              : 'text-gray-300'
          }`}
          aria-label={`Rate ${value} stars`}
        >
          <Star className="h-4 w-4" fill={value <= score ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}