import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export const DraftWatermark: React.FC = () => {
  const { isDraft } = useTheme();

  if (!isDraft) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      <div className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-100 rounded-full shadow-md">
        DRAFT MODE
      </div>
    </div>
  );
};
