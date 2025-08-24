import {
  Inbox,
  Brain,
  Target,
  BarChart3,
  BookOpen,
  Users,
  HelpCircle,
  Settings,
  Plus,
  Clock,
  CheckSquare,
  AlertCircle,
  Pin,
  Zap,
  Play,
  Trophy,
  CheckCircle,
  FileTemplate,
  Eye,
  History,
  TrendingUp,
  Lightbulb,
  Database,
  Wrench,
  Activity,
  Library,
  Link,
  User,
  Shield,
  MessageSquare,
  Sparkles,
  Info,
  CreditCard,
  PieChart,
  Lock,
  Building
} from 'lucide-react';
import type { NavigationGroup } from './types';

export const navigationConfig: NavigationGroup[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    showDivider: true,
    items: [
      {
        id: 'waiting-on-me',
        label: 'Waiting on me',
        path: '/inbox/waiting',
        icon: Clock,
        tooltip: 'Items where your action is required',
        badge: 3,
        attention: true
      },
      {
        id: 'reviews-due',
        label: 'Reviews due',
        path: '/inbox/reviews',
        icon: CheckSquare,
        tooltip: 'Decisions needing outcome updates or checkpoints',
        badge: 2,
        attention: true
      },
      {
        id: 'approvals-requested',
        label: 'Approvals requested',
        path: '/inbox/approvals',
        icon: AlertCircle,
        tooltip: 'Decisions awaiting your approval',
        badge: 1,
        attention: true
      },
      {
        id: 'new-assignments',
        label: 'New assignments',
        path: '/inbox/assignments',
        icon: Zap,
        tooltip: 'Decisions newly assigned to you',
        unread: true
      },
      {
        id: 'pinned',
        label: 'Pinned',
        path: '/inbox/pinned',
        icon: Pin,
        tooltip: 'Your pinned decisions and views'
      }
    ]
  },
  {
    id: 'decisions',
    label: 'Decisions',
    showDivider: true,
    items: [
      {
        id: 'new-decision',
        label: 'New',
        path: '/decision/intake',
        icon: Plus,
        tooltip: 'Create a decision in the Decisions hub',
        onClick: () => {
          // Reset decision context when creating new
          console.log('Starting new decision from sidebar');
        }
      },
      {
        id: 'active-decisions',
        label: 'Active',
        path: '/decisions/active',
        icon: Play,
        tooltip: 'All in-progress decisions'
      },
      {
        id: 'priority-decisions',
        label: 'Priority',
        path: '/decisions/priority',
        icon: Trophy,
        tooltip: 'Due soon, waiting on you, or high risk/impact',
        badge: 4,
        attention: true
      },
      {
        id: 'completed-decisions',
        label: 'Completed',
        path: '/decisions/completed',
        icon: CheckCircle,
        tooltip: 'Decisions that have been committed'
      },
      {
        id: 'decision-templates',
        label: 'Decision templates',
        path: '/templates',
        icon: FileTemplate,
        tooltip: 'Start from a reusable decision template'
      },
      {
        id: 'saved-views',
        label: 'Saved views',
        path: '/decisions/saved-views',
        icon: Eye,
        tooltip: 'Your custom filters and pinned views'
      },
      {
        id: 'recently-viewed',
        label: 'Recently viewed',
        path: '/decisions/recent',
        icon: History,
        tooltip: 'The last decisions you opened'
      }
    ]
  },
  {
    id: 'strategy',
    label: 'Strategy',
    showDivider: true,
    items: [
      {
        id: 'new-strategy',
        label: 'New',
        path: '/strategy/new',
        icon: Plus,
        tooltip: 'Create a new strategy item (goal, OKR or framework)',
        disabled: true
      },
      {
        id: 'active-strategy',
        label: 'Active',
        path: '/strategy/active',
        icon: Target,
        tooltip: 'Current strategies and goals in use',
        disabled: true
      },
      {
        id: 'completed-strategy',
        label: 'Completed',
        path: '/strategy/completed',
        icon: CheckCircle,
        tooltip: 'Archived or finished strategies',
        disabled: true
      },
      {
        id: 'strategy-frameworks',
        label: 'Strategy frameworks',
        path: '/strategy/frameworks',
        icon: TrendingUp,
        tooltip: 'Pick a framework (Lean, BMC, VPC, OKR, SWOT, Custom)',
        disabled: true
      }
    ]
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    showDivider: true,
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        path: '/intelligence/analytics',
        icon: BarChart3,
        tooltip: 'Portfolio dashboards and reports across decisions',
        disabled: true
      },
      {
        id: 'model-tuning',
        label: 'Model tuning',
        path: '/intelligence/tuning',
        icon: Wrench,
        tooltip: 'Safely tune how Olumi reasons, scores and explains',
        disabled: true
      },
      {
        id: 'decision-frameworks',
        label: 'Decision frameworks',
        path: '/intelligence/frameworks',
        icon: Brain,
        tooltip: 'Optimise methods, rubrics and method cards',
        disabled: true
      },
      {
        id: 'change-log',
        label: 'Change log',
        path: '/intelligence/changelog',
        icon: Activity,
        tooltip: 'Version history and approvals for model/framework changes',
        disabled: true
      }
    ]
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    showDivider: true,
    items: [
      {
        id: 'library',
        label: 'Library',
        path: '/knowledge/library',
        icon: Library,
        tooltip: 'Docs, notes and datasets with tags and search',
        disabled: true
      },
      {
        id: 'integrations',
        label: 'Integrations',
        path: '/knowledge/integrations',
        icon: Link,
        tooltip: 'Connect Drive, Confluence, Slack, Jira/Linear and databases',
        disabled: true
      },
      {
        id: 'connect-to-decision',
        label: 'Connect to decision',
        path: '/knowledge/connect',
        icon: Database,
        tooltip: 'Attach sources and map them to a decision\'s criteria',
        disabled: true
      }
    ]
  },
  {
    id: 'people',
    label: 'People',
    showDivider: true,
    items: [
      {
        id: 'profile',
        label: 'Profile',
        path: '/profile',
        icon: User,
        tooltip: 'Your settings, including your Collaboration Profile'
      },
      {
        id: 'people-teams',
        label: 'People & Teams',
        path: '/teams',
        icon: Users,
        tooltip: 'Manage members, roles, squads and preferences'
      },
      {
        id: 'stakeholders',
        label: 'Stakeholders',
        path: '/people/stakeholders',
        icon: Shield,
        tooltip: 'Approvers, watchers and stakeholder briefs',
        disabled: true
      },
      {
        id: 'roles-rules',
        label: 'Roles & Rules',
        path: '/people/roles',
        icon: Lock,
        tooltip: 'RBAC, approval paths and review cadences',
        disabled: true
      },
      {
        id: 'participation-analytics',
        label: 'Participation analytics',
        path: '/people/analytics',
        icon: PieChart,
        tooltip: 'Engagement and contribution insights by team',
        disabled: true
      }
    ]
  },
  {
    id: 'support',
    label: 'Support',
    showDivider: true,
    items: [
      {
        id: 'help',
        label: 'Help',
        path: '/about',
        icon: HelpCircle,
        tooltip: 'Product guides and documentation'
      },
      {
        id: 'whats-new',
        label: 'What\'s new',
        path: '/support/whats-new',
        icon: Sparkles,
        tooltip: 'Release notes and changes',
        disabled: true
      },
      {
        id: 'feedback',
        label: 'Feedback',
        path: '/support/feedback',
        icon: MessageSquare,
        tooltip: 'Share feedback or report an issue',
        disabled: true
      }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      {
        id: 'plan-billing',
        label: 'Plan & Billing',
        path: '/organisations',
        icon: CreditCard,
        tooltip: 'Subscription, invoices and payment details'
      },
      {
        id: 'usage',
        label: 'Usage',
        path: '/settings/usage',
        icon: BarChart3,
        tooltip: 'Seats, API and feature usage',
        disabled: true
      },
      {
        id: 'data-privacy',
        label: 'Data & Privacy',
        path: '/settings/privacy',
        icon: Lock,
        tooltip: 'Data retention, privacy and exports',
        disabled: true
      },
      {
        id: 'workspace',
        label: 'Workspace',
        path: '/settings/workspace',
        icon: Building,
        tooltip: 'Workspace name, domains and defaults',
        disabled: true
      }
    ]
  }
];