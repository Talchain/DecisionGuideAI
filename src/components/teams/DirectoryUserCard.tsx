import React from 'react';
import { User, Clock, UserPlus } from 'lucide-react';
import type { DirectoryUser } from '../../types/directory';
import Tooltip from '../Tooltip';

interface DirectoryUserCardProps {
  user: DirectoryUser;
  isSelected: boolean;
  onSelect: (user: DirectoryUser) => void;
}

export default function DirectoryUserCard({ user, isSelected, onSelect }: DirectoryUserCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(user);
    }
  };

  return (
    <div 
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-indigo-50 border border-indigo-200' 
          : 'bg-white border border-gray-200 hover:bg-gray-50'
      }`}
      onClick={() => onSelect(user)}
    >
      <div className="flex items-center gap-3">
        <div className="bg-gray-100 h-10 w-10 rounded-full flex items-center justify-center">
          <User className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <div className="font-medium text-gray-900">
            {user.email}
          </div>
          {user.first_name && user.last_name ? (
            <div className="text-sm text-gray-600">
              {user.first_name} {user.last_name}
            </div>
          ) : null}
          {user.source === 'invitation' && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Clock className="h-3 w-3" />
              <span>Invited {new Date(user.invited_at!).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
      <Tooltip content="Add to team">
        <button
          className={`p-1.5 rounded-full ${
            isSelected
              ? 'bg-indigo-100 text-indigo-600'
              : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
          }`}
          aria-label="Add to team"
        >
          <UserPlus className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}