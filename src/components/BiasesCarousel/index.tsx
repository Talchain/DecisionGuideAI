import React, { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Loader } from 'lucide-react';
import BiasCard from './BiasCard';
import Tooltip from '../Tooltip';
import type { Bias } from '../../lib/api';

interface BiasesCarouselProps {
  biases: Bias[];
  isLoading?: boolean;
  error?: string | null;
}

export default function BiasesCarousel({ biases, isLoading = false, error = null }: BiasesCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('BiasesCarousel rendered with:', {
      biasesCount: biases?.length,
      isLoading,
      error,
      biases
    });
  }, [biases, isLoading, error]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8;
    const targetScroll = container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
    
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Loader className="h-6 w-6 text-indigo-500 animate-spin" />
            <span className="text-gray-600">Loading cognitive biases...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-3 p-4 h-[400px] bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-red-700 font-medium">Error loading cognitive biases</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      );
    }

    if (!biases?.length) {
      return (
        <div className="flex items-center gap-3 p-4 h-[400px] bg-yellow-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-yellow-700 font-medium">No cognitive biases identified</p>
            <p className="text-yellow-600 text-sm mt-1">
              The analysis did not identify any relevant cognitive biases for this decision.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {biases.map((bias, index) => (
          <div key={index} className="flex-shrink-0 snap-start">
            <BiasCard
              name={bias.name}
              definition={bias.definition}
              mitigationTip={bias.mitigationTip}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Cognitive Biases and Mitigation Strategies
        </h2>
        {biases?.length > 0 && (
          <div className="flex items-center gap-2">
            <Tooltip content="Scroll left">
              <button
                onClick={() => scroll('left')}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-6 w-6 text-gray-600" />
              </button>
            </Tooltip>
            <Tooltip content="Scroll right">
              <button
                onClick={() => scroll('right')}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-6 w-6 text-gray-600" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {renderContent()}
    </div>
  );
}