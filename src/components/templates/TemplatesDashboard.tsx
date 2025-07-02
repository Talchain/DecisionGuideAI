import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  Users,
  Building,
  Globe,
  Sparkles,
  Settings,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTemplates } from '../../hooks/useTemplates';
import EmptyState from '../EmptyState';
import TemplateCard from './TemplateCard';
import TemplateList from './TemplateList';
import CreateTemplateModal from './CreateTemplateModal';
import EditTemplateModal from './EditTemplateModal';
import ShareTemplateModal from './ShareTemplateModal';
import OnboardingModal from './OnboardingModal';
import AIGenerationModal from './AIGenerationModal';
import IntegrationsModal from './IntegrationsModal';
import type { CriteriaTemplate, TemplateFilter, TabId } from '../../types/templates';

type ViewMode = 'grid' | 'list';

export default function TemplatesDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    shareTemplate,
    forkTemplate
  } = useTemplates();

  // UI State
  const [activeTab, setActiveTab] = useState<TabId>('my');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CriteriaTemplate | null>(null);
  const [sharingTemplate, setSharingTemplate] = useState<CriteriaTemplate | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);

  // Filters
  const [filters, setFilters] = useState<TemplateFilter>({
    owner: 'all',
    useCase: 'all',
    tags: [],
    dateRange: 'all',
    sharing: 'all'
  });

  // Check if first visit for onboarding
  useEffect(() => {
    const hasVisited = localStorage.getItem('templates_dashboard_visited');
    if (!hasVisited) {
      setShowOnboarding(true);
      localStorage.setItem('templates_dashboard_visited', 'true');
    }
  }, []);

  // Fetch templates on mount and tab change
  useEffect(() => {
    if (activeTab) {
      fetchTemplates(activeTab);
    }
  }, [activeTab, fetchTemplates]);

  // Filter templates based on search and filters
  const filteredTemplates = templates.filter(template => {
    if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !template.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    if (filters.useCase !== 'all' && template.type !== filters.useCase) {
      return false;
    }
    
    if (filters.tags.length > 0 && !filters.tags.some(tag => template.tags?.includes(tag))) {
      return false;
    }
    
    return true;
  });

  const handleCreateTemplate = async (templateData: Partial<CriteriaTemplate>) => {
    try {
      await createTemplate(templateData);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const handleEditTemplate = async (id: string, updates: Partial<CriteriaTemplate>) => {
    try {
      await updateTemplate(id, updates);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(id);
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const handleShareTemplate = async (id: string, sharing: string) => {
    try {
      await shareTemplate(id, sharing);
      setSharingTemplate(null);
    } catch (error) {
      console.error('Failed to share template:', error);
    }
  };

  const handleForkTemplate = async (id: string) => {
    try {
      await forkTemplate(id);
    } catch (error) {
      console.error('Failed to fork template:', error);
    }
  };

  const handleApplyToDecision = (template: CriteriaTemplate) => {
    navigate('/decision', { 
      state: { 
        selectedTemplate: template,
        fromTemplatesDashboard: true 
      } 
    });
  };

  const tabs = [
    { id: 'my', label: 'My Templates', icon: Star, count: templates.filter(t => t.owner_id === user?.id).length },
    { id: 'team', label: 'Team', icon: Users, count: templates.filter(t => t.sharing === 'team').length },
    { id: 'organization', label: 'Organization', icon: Building, count: templates.filter(t => t.sharing === 'organization').length },
    { id: 'featured', label: 'Featured', icon: Star, count: templates.filter(t => t.featured).length },
    { id: 'marketplace', label: 'Marketplace', icon: Globe, count: 0, disabled: true }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Error loading templates</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600">Manage your decision criteria templates</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* AI Generation Button */}
          <button
            onClick={() => setShowAIModal(true)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Generate with AI
          </button>
          
          {/* Integrations Button */}
          <button
            onClick={() => setShowIntegrationsModal(true)}
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Settings className="h-5 w-5 mr-2" />
            Integrations
          </button>
          
          {/* Create Template Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Template
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id as TabId)}
                disabled={tab.disabled}
                className={`
                  flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : tab.disabled
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs
                    ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}
                  `}>
                    {tab.count}
                  </span>
                )}
                {tab.disabled && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center px-4 py-2 border rounded-lg transition-colors
              ${showFilters 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </button>
          
          <div className="flex border border-gray-300 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`
                p-2 ${viewMode === 'grid' 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-gray-400 hover:text-gray-600'
                }
              `}
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`
                p-2 border-l border-gray-300 ${viewMode === 'list' 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-gray-400 hover:text-gray-600'
                }
              `}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <select
                value={filters.owner}
                onChange={(e) => setFilters(prev => ({ ...prev, owner: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Owners</option>
                <option value="me">Me</option>
                <option value="team">Team Members</option>
                <option value="organization">Organization</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Use Case</label>
              <select
                value={filters.useCase}
                onChange={(e) => setFilters(prev => ({ ...prev, useCase: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="professional">Professional</option>
                <option value="financial">Financial</option>
                <option value="health">Health</option>
                <option value="career">Career</option>
                <option value="relationships">Relationships</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Time</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sharing</label>
              <select
                value={filters.sharing}
                onChange={(e) => setFilters(prev => ({ ...prev, sharing: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Levels</option>
                <option value="private">Private</option>
                <option value="team">Team</option>
                <option value="organization">Organization</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Templates Grid/List */}
      {filteredTemplates.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No templates found' : 'No templates yet'}
          description={searchQuery 
            ? 'Try adjusting your search or filters'
            : 'Create your first template to get started'}
          icon={Star}
          actionText="Create Template"
          actionPath="#"
          tips={[
            "Templates help you reuse criteria across multiple decisions",
            "Share templates with your team for consistent decision-making",
            "Use AI to generate templates based on your needs"
          ]}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditingTemplate(template)}
              onDelete={() => handleDeleteTemplate(template.id)}
              onShare={() => setSharingTemplate(template)}
              onFork={() => handleForkTemplate(template.id)}
              onApply={() => handleApplyToDecision(template)}
              canEdit={template.owner_id === user?.id}
              canDelete={template.owner_id === user?.id}
            />
          ))}
        </div>
      ) : (
        <TemplateList
          templates={filteredTemplates}
          onEdit={(template) => setEditingTemplate(template)}
          onDelete={(id) => handleDeleteTemplate(id)}
          onShare={(template) => setSharingTemplate(template)}
          onFork={(id) => handleForkTemplate(id)}
          onApply={handleApplyToDecision}
          currentUserId={user?.id}
          selectedTemplates={selectedTemplates}
          onSelectionChange={setSelectedTemplates}
        />
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateTemplateModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateTemplate}
        />
      )}

      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(updates) => handleEditTemplate(editingTemplate.id, updates)}
        />
      )}

      {sharingTemplate && (
        <ShareTemplateModal
          template={sharingTemplate}
          onClose={() => setSharingTemplate(null)}
          onSave={(sharing) => handleShareTemplate(sharingTemplate.id, sharing)}
        />
      )}

      {showOnboarding && (
        <OnboardingModal
          onClose={() => setShowOnboarding(false)}
        />
      )}

      {showAIModal && (
        <AIGenerationModal
          onClose={() => setShowAIModal(false)}
        />
      )}

      {showIntegrationsModal && (
        <IntegrationsModal
          onClose={() => setShowIntegrationsModal(false)}
        />
      )}
    </div>
  );
}