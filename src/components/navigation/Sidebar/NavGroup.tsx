import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import NavItem from './NavItem';
import type { NavigationGroup } from './types';

interface NavGroupProps {
  group: NavigationGroup;
  isCollapsed: boolean;
  currentPath: string;
}

export default function NavGroup({ group, isCollapsed, currentPath }: NavGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (isCollapsed) {
    // In collapsed mode, render items without group headers
    return (
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isCollapsed={true}
            isActive={currentPath === item.path}
            groupLabel={group.label}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`nav-group-${group.id}`}
      >
        <span>{group.label}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {/* Group Items */}
      {isExpanded && (
        <div id={`nav-group-${group.id}`} className="space-y-1">
          {group.items.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isCollapsed={false}
              isActive={currentPath === item.path}
            />
          ))}
        </div>
      )}

      {/* Divider */}
      {isExpanded && group.showDivider && (
        <div className="mx-3 border-t border-gray-200 my-3" />
      )}
    </div>
  );
}