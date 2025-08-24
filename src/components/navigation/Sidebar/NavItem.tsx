import React from 'react';
import { Link } from 'react-router-dom';
import Tooltip from '../../Tooltip';
import type { NavigationItem } from './types';

interface NavItemProps {
  item: NavigationItem;
  isCollapsed: boolean;
  isActive: boolean;
  groupLabel?: string;
}

export default function NavItem({ item, isCollapsed, isActive, groupLabel }: NavItemProps) {
  const IconComponent = item.icon;
  
  const getTooltipContent = () => {
    if (!isCollapsed) return null;
    return groupLabel ? `${groupLabel} → ${item.label} — ${item.tooltip}` : `${item.label} — ${item.tooltip}`;
  };

  const baseClasses = `
    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
    text-sm font-medium min-h-[44px] relative group
    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
  `;

  const stateClasses = isActive
    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600 ml-0 pl-2'
    : item.disabled
    ? 'text-gray-400 cursor-not-allowed'
    : item.attention
    ? 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900';

  const content = (
    <div className={`${baseClasses} ${stateClasses}`}>
      {/* Icon */}
      <div className="flex-shrink-0 relative">
        <IconComponent className="h-5 w-5" />
        {item.unread && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </div>

      {/* Label and Badge */}
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className={`
              px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0
              ${item.attention 
                ? 'bg-orange-100 text-orange-800' 
                : 'bg-gray-100 text-gray-600'
              }
            `}>
              {item.badge}
            </span>
          )}
        </>
      )}

      {/* Collapsed state badge */}
      {isCollapsed && item.badge && (
        <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {item.badge}
        </div>
      )}
    </div>
  );

  if (item.disabled) {
    return isCollapsed ? (
      <Tooltip content={getTooltipContent()}>
        <div className={content.props.className}>
          {content.props.children}
        </div>
      </Tooltip>
    ) : content;
  }

  const linkElement = (
    <Link
      to={item.path}
      className="block"
      onClick={item.onClick}
      aria-current={isActive ? 'page' : undefined}
    >
      {content}
    </Link>
  );

  return isCollapsed ? (
    <Tooltip content={getTooltipContent()}>
      {linkElement}
    </Tooltip>
  ) : linkElement;
}