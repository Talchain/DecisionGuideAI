import React, { useState } from 'react';
import {
  MoreHorizontal,
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
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import type { CriteriaTemplate } from '../../types/templates';
import Tooltip from '../Tooltip';

interface TemplateCardProps {
  template: CriteriaTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onFork: () => void;
  onApply: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function TemplateCard({
  template,
  onEdit,
  onDelete,
  onShare,
  onFork,
  onApply,
  canEdit,
  canDelete
}: TemplateCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getSharingIcon = () => {
    switch (template.sharing) {
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

  const getSharingLabel = () => {
    switch (template.sharing) {
      case 'private':
        return 'Private';
      case 'team':
        return 'Team';
      case 'organization':
        return 'Organization';
      case 'public':
        return 'Public';
      default:
        return 'Private';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 group">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
              {template.featured && (
                <Tooltip content="Featured template">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                </Tooltip>
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
          </div>
          
          <div className="relative ml-2">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={() => {
                    onApply();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Apply to Decision
                </button>
                
                <button
                  onClick={() => {
                    onFork();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </button>
                
                {canEdit && (
                  <>
                    <button
                      onClick={() => {
                        onEdit();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </button>
                    
                    <button
                      onClick={() => {
                        onShare();
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </button>
                  </>
                )}
                
                {canDelete && (
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Criteria Preview */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Criteria ({template.criteria.length})
          </div>
          <div className="space-y-1">
            {template.criteria.slice(0, 3).map((criterion, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-gray-700 truncate">{criterion.name}</span>
                <div className="flex items-center gap-1 ml-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        i < criterion.weight ? 'bg-indigo-400' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
            {template.criteria.length > 3 && (
              <div className="text-xs text-gray-500 italic">
                +{template.criteria.length - 3} more criteria
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{template.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 rounded-b-xl">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Tooltip content={getSharingLabel()}>
              {getSharingIcon()}
            </Tooltip>
            <span className="truncate">{template.owner_name || 'Unknown'}</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{format(new Date(template.updated_at), 'MMM d')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}