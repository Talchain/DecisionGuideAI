import React, { useState } from 'react';
import { X, Mail, Loader2, UserPlus, CreditCard } from 'lucide-react';
import { useTeams } from '../contexts/TeamsContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

interface InviteCollaboratorsProps {
  open: boolean;
  onClose: () => void;
  decisionId: string;
}

export default function InviteCollaborators({ open, onClose, decisionId }: InviteCollaboratorsProps) {
  const { inviteTeamMember } = useTeams();
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('contributor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [organisationDetails, setOrganisationDetails] = useState<any>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  // Fetch decision and organisation details to check plan type
  React.useEffect(() => {
    if (decisionId) {
      const fetchDecisionOrg = async () => {
        setLoadingOrg(true);
        try {
          // First get the decision to find its organisation_id
          const { data: decisionData, error: decisionError } = await supabase
            .from('decisions')
            .select('organisation_id')
            .eq('id', decisionId)
            .single();
            
          if (decisionError) throw decisionError;
          
          if (decisionData?.organisation_id) {
            // Then get the organisation details
            const { data: orgData, error: orgError } = await supabase
              .from('organisations')
              .select('id, plan_type')
              .eq('id', decisionData.organisation_id)
              .single();
              
            if (orgError) throw orgError;
            setOrganisationDetails(orgData);
          } else {
            // If no organisation_id, set to null
            setOrganisationDetails(null);
          }
        } catch (err) {
          console.error('Error fetching decision organisation:', err);
          setError(err instanceof Error ? err.message : 'Failed to load organisation details');
        } finally {
          setLoadingOrg(false);
        }
      };
      
      fetchDecisionOrg();
    }
  }, [decisionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await inviteTeamMember(decisionId, email.trim(), 'member', role);
      if (result.error) {
        throw result.error;
      }
      setSuccess(true);
      setEmail('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  // Check if organisation is on solo plan
  const isSoloPlan = organisationDetails?.plan_type === 'solo';

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Invite Collaborators</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {loadingOrg ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : isSoloPlan ? (
          <div className="bg-amber-50 p-6 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-full">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-medium text-amber-800 mb-2">Team Plan Required</h3>
                <p className="text-sm text-amber-700 mb-4">
                  Inviting collaborators requires a Team Plan. Please upgrade your organisation plan to continue.
                </p>
                <Link
                  to={`/organisations/${organisationDetails?.id}`}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg hover:from-amber-700 hover:to-amber-600"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-lg">
                Invitation sent successfully!
              </div>
            )}
    
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
    
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="contributor">Contributor (can edit)</option>
                  <option value="viewer">Viewer (read-only)</option>
                </select>
              </div>
    
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}