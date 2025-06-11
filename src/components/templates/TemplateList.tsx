import React from 'react';
import {
  Edit,
  Trash2,
  Copy,
  Share2,
  Play,
  Star,
  Users,
  Building,
  Lock,
  Globe,
  Calendar,
  Tag,
  MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import type { CriteriaTemplate } from '../../types/templates';
import Tooltip from '../Tooltip';

interface TemplateListProps {
  templates: CriteriaTemplate[];
  onEdit: (template: CriteriaTemplate) => void;
  onDelete: (id: string) => void;
  onShare: (template: CriteriaTemplate) => void;
  onFork: (id: string) => void;
  onApply: (template: CriteriaTemplate) => void;
  currentUserId?: string;
  selectedTemplates: string[];
  onSelectionChange: (selected: string[]) => void;
}

export default function TemplateList({
  templates,
  onEdit,
  onDelete,
  onShare,
  onFork,
  onApply,
  currentUserId,
  selectedTemplates,
  onSelectionChange
}: TemplateListProps) {
  const getSharingIcon = (sharing: string) => {
    switch (sharing) {
      case 'private':
        return <Lock className="h-4 w-4 text-gray-500" />;
      case 'team':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'organization':
        return <Building className="h-4 w-4 text-purple-500" />;
      case 'public':
        return <Globe className="h-4 w-4 text-green-500" />;
      default:
        return <Lock className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleSelectAll = () => {
    if (selectedTemplates.length === templates.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(templates.map(t => t.id));
    }
  };

  const handleSelectTemplate = (id: string) => {
    if (selectedTemplates.includes(id)) {
      onSelectionChange(selectedTemplates.filter(t => t !== id));
    } else {
      onSelectionChange([...selectedTemplates, id]);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedTemplates.length === templates.length && templates.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
          </div>
          <div className="ml-6 flex-1 grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <div className="col-span-4">Template</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Criteria</div>
            <div className="col-span-1">Sharing</div>
            <div className="col-span-2">Updated</div>
            <div className="col-span-1">Actions</div>
          </div>
        </div>
      </div>

      {/* List Items */}
      <div className="divide-y divide-gray-200">
        {templates.map((template) => {
          const canEdit = template.owner_id === currentUserId;
          const canDelete = template.owner_id === currentUserId;
          
          return (
            <div
              key={template.id}
              className={`px-6 py-4 hover:bg-gray-50 transition-colors ${
                selectedTemplates.includes(template.id) ? 'bg-indigo-50' : ''
              }`}
            >
              <div className="flex items-center">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.includes(template.id)}
                    onChange={() => handleSelectTemplate(template.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </div>
                
                <div className="ml-6 flex-1 grid grid-cols-12 gap-4 items-center">
                  {/* Template Info */}
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{template.name}</h3>
                          {template.featured && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-1">{template.description}</p>
                        {template.tags && template.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {template.tags.slice(0, 2).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
                              >
                                <Tag className="h-2.5 w-2.5 mr-1" />
                                {tag}
                              </span>
                            ))}
                            {template.tags.length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{template.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="col-span-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                      {template.type}
                    </span>
                  </div>

                  {/* Criteria Count */}
                  <div className="col-span-2">
                    <span className="text-sm text-gray-900">{template.criteria.length} criteria</span>
                  </div>

                  {/* Sharing */}
                  <div className="col-span-1">
                    <Tooltip content={template.sharing}>
                      {getSharingIcon(template.sharing)}
                    </Tooltip>
                  </div>

                  {/* Updated */}
                  <div className="col-span-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(template.updated_at), 'MMM d, yyyy')}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-1">
                      <Tooltip content="Apply to Decision">
                        <button
                          onClick={() => onApply(template)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      </Tooltip>
                      
                      <Tooltip content="Duplicate">
                        <button
                          onClick={() => onFork(template.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </Tooltip>
                      
                      {canEdit && (
                        <>
                          <Tooltip content="Edit">
                            <button
                              onClick={() => onEdit(template)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          
                          <Tooltip content="Share">
                            <button
                              onClick={() => onShare(template)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50"
                            >
                              <Share2 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        </>
                      )}
                      
                      {canDelete && (
                        <Tooltip content="Delete">
                          <button
                            onClick={() => onDelete(template.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}