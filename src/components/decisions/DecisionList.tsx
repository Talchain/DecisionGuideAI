import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUserId, getDecisions } from '../../lib/supabase';
import { authLogger } from '../../lib/auth/authLogger';
import { useDecision } from '../../contexts/DecisionContext';
import EmptyState from '../EmptyState';
import { Decision } from '../../types/database';
import { 
  PlusCircle, Loader, AlertTriangle, RefreshCw, Search, Filter, 
  ChevronDown, ChevronUp, MoreHorizontal, Trash2, Edit, Copy, Share2,
  Check, X, ArrowUp, ArrowDown, Calendar, Clock, Tag, CheckSquare
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Tooltip from '../Tooltip';

// Decision status options
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }
];

// Decision type options 
const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'professional', label: 'Professional' },
  { value: 'financial', label: 'Financial' },
  { value: 'health', label: 'Health' },
  { value: 'career', label: 'Career' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'other', label: 'Other' }
];

// Sort options
const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Date Created (Newest)' },
  { value: 'created_asc', label: 'Date Created (Oldest)' },
  { value: 'updated_desc', label: 'Date Modified (Newest)' },
  { value: 'updated_asc', label: 'Date Modified (Oldest)' },
  { value: 'title_asc', label: 'Title (A-Z)' },
  { value: 'title_desc', label: 'Title (Z-A)' }
];

// Items per page options
const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];

export default function DecisionList() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const { resetDecisionContext, setActiveDecisionId } = useDecision();
  const [filteredDecisions, setFilteredDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Render empty state
  if (decisions.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Your Decisions</h2>
          <Link
            to="/decision/intake"
            onClick={() => {
              console.log("[DecisionList] Starting new decision, resetting context");
              resetDecisionContext();
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            New Decision
          </Link>
        </div>

        <EmptyState
          title="No decisions yet"
          description="Start by creating your first decision to track and analyze your decision-making process."
          actionText="Create Decision"
          actionPath="/decision/intake"
          tips={[
            "Create a new decision by clicking the button above",
            "Fill in the details about your decision",
            "Use our AI-powered analysis to help you make better choices"
          ]}
        />
      </div>
    );
  }

                            onClick={(e) => {
                              e.preventDefault();
                              // Ensure we have a valid session before navigating
                              setActiveDecisionId(decision.id);
                              supabase.auth.getSession().then(({ data }) => {
                                if (data.session) {
                                  navigate(`/decisions/${decision.id}`);
                                } else {
                                  console.error('No valid session found');
                                }
                              });
                            }}
  // ... rest of the component code ...
}