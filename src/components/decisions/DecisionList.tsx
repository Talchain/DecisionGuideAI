import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUserId, getDecisions } from '../../lib/supabase';
import { authLogger } from '../../lib/auth/authLogger';
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
  const [filteredDecisions, setFilteredDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryTimeout, setRetryTimeout] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filtering and sorting state
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOption, setSortOption] = useState('created_desc');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection state
  const [selectedDecisions, setSelectedDecisions] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Cleanup function for retry timeout
  useEffect(() => {
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [retryTimeout]);

  const fetchDecisions = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const userId = await getUserId();
      if (!userId) {
        authLogger.debug('DECISIONS', 'No user found');
        setError('You must be signed in to view your decisions');
        setLoading(false);
        return;
      }

      const { data, error } = await getDecisions(userId);
      
      if (error) {
        // Handle session errors specifically
        if (error.message.includes('session') || error.message.includes('JWT')) {
          authLogger.error('ERROR', 'Session error', error);
          setError('Your session has expired. Please sign in again.');
          return;
        }
        throw error;
      }
      
      setDecisions(data ?? []);
      if (retryCount > 0) {
        setRetryCount(0); // Only reset if we had retries
      }
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load decisions';
      
      // Handle specific error cases
      let finalError = errorMessage;
      if (errorMessage.includes('Database setup incomplete')) {
        finalError = 'The system is currently being initialized. Please try again in a moment.';
      } else if (errorMessage.includes('network')) {
        finalError = 'Unable to connect to the server. Please check your internet connection.';
      } else if (errorMessage.includes('session')) {
        finalError = 'Your session has expired. Please sign in again.';
      }
      
      setError(finalError);
      
      // Auto-retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        const timeoutId = window.setTimeout((): void => {
          setRetryCount(prev => prev + 1);
          // Retry on network errors or database setup issues
          if (err instanceof Error && (
            err.message.includes('network') ||
            err.message.includes('Database setup incomplete')
          )) {
            fetchDecisions();
          }
        }, delay);
        setRetryTimeout(timeoutId);
      }
    } finally {
      setLoading(false);
    }
  }, [retryCount]);

  // Apply filters and sorting
  useEffect(() => {
    if (!decisions.length) {
      setFilteredDecisions([]);
      return;
    }

    let result = [...decisions];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(d => d.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(d => d.type === typeFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.title.toLowerCase().includes(query) || 
        (d.description && d.description.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    result = sortDecisions(result, sortOption);

    setFilteredDecisions(result);
    setCurrentPage(1); // Reset to first page when filters change
    setSelectedDecisions([]); // Clear selections when filters change
    setSelectAll(false);
  }, [decisions, statusFilter, typeFilter, sortOption, searchQuery]);

  // Handle select all checkbox
  useEffect(() => {
    if (selectAll) {
      const currentPageDecisions = getCurrentPageDecisions();
      setSelectedDecisions(currentPageDecisions.map(d => d.id));
    } else if (selectedDecisions.length === getCurrentPageDecisions().length && selectedDecisions.length > 0) {
      // If all decisions on the current page are selected, set selectAll to true
      setSelectAll(true);
    }
  }, [selectAll, currentPage, itemsPerPage]);

  // Fetch decisions on mount
  useEffect(() => {
    fetchDecisions();
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [fetchDecisions, retryTimeout]);

  // Helper function to sort decisions
  const sortDecisions = (decisions: Decision[], sortOption: string) => {
    return [...decisions].sort((a, b) => {
      switch (sortOption) {
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'updated_asc':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case 'updated_desc':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
  };

  // Get current page decisions
  const getCurrentPageDecisions = () => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredDecisions.slice(indexOfFirstItem, indexOfLastItem);
  };

  // Pagination controls
  const totalPages = Math.ceil(filteredDecisions.length / itemsPerPage);
  
  const goToPage = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  // Handle checkbox selection
  const toggleDecisionSelection = (id: string) => {
    setSelectedDecisions(prev => {
      if (prev.includes(id)) {
        const newSelection = prev.filter(decisionId => decisionId !== id);
        if (newSelection.length !== getCurrentPageDecisions().length) {
          setSelectAll(false);
        }
        return newSelection;
      } else {
        const newSelection = [...prev, id];
        if (newSelection.length === getCurrentPageDecisions().length) {
          setSelectAll(true);
        }
        return newSelection;
      }
    });
  };

  const handleSelectAllChange = () => {
    setSelectAll(!selectAll);
    if (!selectAll) {
      setSelectedDecisions(getCurrentPageDecisions().map(d => d.id));
    } else {
      setSelectedDecisions([]);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Toggle action menu for a decision
  const toggleActionMenu = (id: string) => {
    if (actionMenuOpen === id) {
      setActionMenuOpen(null);
    } else {
      setActionMenuOpen(id);
    }
  };

  // Handle bulk actions
  const handleBulkAction = (action: string) => {
    // Implement bulk actions (delete, archive, etc.)
    console.log(`Bulk action: ${action} on decisions:`, selectedDecisions);
    // Reset selection after action
    setSelectedDecisions([]);
    setSelectAll(false);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Your Decisions</h2>
          <div className="animate-pulse bg-gray-200 h-10 w-32 rounded-md"></div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-full"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex flex-col items-center gap-4">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-red-800 mb-2">Error loading decisions</h3>
            <p className="text-sm text-red-700 mb-4">{error}</p>
            <button
              onClick={() => {
                setRetryCount(0);
                fetchDecisions();
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render empty state
  if (decisions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Your Decisions</h2>
          <Link
            to="/decisions/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusCircle className="h-5 w-5 mr-2" />
            New Decision
          </Link>
        </div>

        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No decisions yet</h3>
            <p className="text-gray-600 mb-6">Start by creating your first decision to track and analyse your decision-making process.</p>
            
            <Link
              to="/decisions/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Create Decision
            </Link>
            
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Getting Started Tips</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>Create a new decision by clicking the button above</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>Fill in the details about your decision</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span>Use our AI-powered analysis to help you make better choices</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main content with decisions list
  return (
    <div className="space-y-6">
      {/* Header with title and new decision button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Your Decisions</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filteredDecisions.length} {filteredDecisions.length === 1 ? 'decision' : 'decisions'}
            {filteredDecisions.length !== decisions.length && ` (filtered from ${decisions.length})`}
          </p>
        </div>
        <Link
          to="/decisions/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          New Decision
        </Link>
      </div>

      {/* Main content area */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Search and filters */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search input */}
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search decisions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Filter toggle button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {showFilters ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </button>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status filter */}
              <div>
                <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type filter */}
              <div>
                <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  id="type-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Bulk actions (visible when items are selected) */}
          {selectedDecisions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                {selectedDecisions.length} {selectedDecisions.length === 1 ? 'item' : 'items'} selected
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('archive')}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Archive
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    setSelectedDecisions([]);
                    setSelectAll(false);
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Decisions table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAllChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Modified
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getCurrentPageDecisions().map((decision) => (
                <tr 
                  key={decision.id} 
                  className={`hover:bg-gray-50 ${selectedDecisions.includes(decision.id) ? 'bg-indigo-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedDecisions.includes(decision.id)}
                      onChange={() => toggleDecisionSelection(decision.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="ml-0">
                        <div className="text-sm font-medium text-gray-900 line-clamp-1">
                          {decision.title}
                        </div>
                        {decision.description && (
                          <div className="text-sm text-gray-500 line-clamp-1">
                            {decision.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 text-gray-400 mr-1.5" />
                      <span className="text-sm text-gray-900 capitalize">{decision.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-1.5" />
                      <span className="text-sm text-gray-500">{formatDate(decision.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-gray-400 mr-1.5" />
                      <span className="text-sm text-gray-500">{formatDate(decision.updated_at)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      decision.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      decision.status === 'completed' ? 'bg-green-100 text-green-800' :
                      decision.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {decision.status === 'in_progress' ? 'In Progress' :
                       decision.status === 'completed' ? 'Completed' :
                       decision.status === 'archived' ? 'Archived' :
                       decision.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative inline-block text-left">
                      <div className="flex items-center space-x-2">
                        <Tooltip content="Edit">
                          <Link
                            to={`/decisions/${decision.id}`}
                            className="text-indigo-600 hover:text-indigo-900 p-1.5 rounded-full hover:bg-gray-100"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Tooltip>
                        <Tooltip content="More actions">
                          <button
                            onClick={() => toggleActionMenu(decision.id)}
                            className="text-gray-400 hover:text-gray-500 p-1.5 rounded-full hover:bg-gray-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      </div>
                      
                      {actionMenuOpen === decision.id && (
                        <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              role="menuitem"
                              onClick={() => {
                                console.log('Duplicate', decision.id);
                                setActionMenuOpen(null);
                              }}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              role="menuitem"
                              onClick={() => {
                                console.log('Share', decision.id);
                                setActionMenuOpen(null);
                              }}
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              role="menuitem"
                              onClick={() => {
                                console.log('Delete', decision.id);
                                setActionMenuOpen(null);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center mb-4 sm:mb-0">
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredDecisions.length)}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredDecisions.length)}</span> of{' '}
                <span className="font-medium">{filteredDecisions.length}</span> results
              </p>
              <div className="ml-4">
                <label htmlFor="itemsPerPage" className="sr-only">Items Per Page</label>
                <select
                  id="itemsPerPage"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} per page
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">First Page</span>
                <ChevronDown className="h-4 w-4 rotate-90" />
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Previous Page</span>
                <ChevronDown className="h-5 w-5 rotate-90" />
              </button>
              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                Page {currentPage} of {totalPages || 1}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Next Page</span>
                <ChevronDown className="h-5 w-5 -rotate-90" />
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="sr-only">Last Page</span>
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}