import React from 'react';
import { Switch } from './switch';
import { useTheme } from '../../contexts/ThemeContext';

interface DraftToggleProps {
  className?: string;
}

export function DraftToggle({ className }: DraftToggleProps) {
  const { isDraft, toggleDraft } = useTheme();
  return (
    <div className={`flex items-center space-x-2 ${className}`}>   
      <Switch
        checked={isDraft}
        onCheckedChange={toggleDraft}
        className="data-[state=checked]:bg-purple-600"
      />
      <span className="text-sm text-gray-500">Draft Mode</span>
    </div>
  );
}
