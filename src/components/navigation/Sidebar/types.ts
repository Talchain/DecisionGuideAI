import { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  tooltip: string;
  badge?: string | number;
  disabled?: boolean;
  attention?: boolean;
  unread?: boolean;
  onClick?: () => void;
}

export interface NavigationGroup {
  id: string;
  label: string;
  items: NavigationItem[];
  showDivider?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  path: string;
  canRename?: boolean;
  canDelete?: boolean;
}

export interface RecentItem {
  id: string;
  title: string;
  path: string;
  timestamp: string;
}