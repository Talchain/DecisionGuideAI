import React from 'react';
import { User } from 'lucide-react';
import Tooltip from '../Tooltip';

interface CollaboratorAvatarProps {
  userId: string;
  isTyping?: boolean;
}

export default function CollaboratorAvatar({ userId, isTyping }: CollaboratorAvatarProps) {
  // In a real app, you'd fetch user details from a cache or context
  const initial = userId.charAt(0).toUpperCase();

  return (
    <Tooltip content={isTyping ? `User ${userId} is typing...` : `User ${userId}`}>
      <div className={`
        relative w-8 h-8 rounded-full 
        flex items-center justify-center
        bg-panel text-info
        ${isTyping ? 'ring-2 ring-info ring-offset-2' : ''}
      `}>
        <User className="h-4 w-4" />
        {isTyping && (
          <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-white" />
        )}
      </div>
    </Tooltip>
  );
}