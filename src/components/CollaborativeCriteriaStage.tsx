import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Users,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useDecision } from '../contexts/DecisionContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CriteriaSuggestion {
  id: string;
  name: string;
  description?: string;
  weight: number;
  status: 'pending' | 'accepted' | 'rejected';
  user_id: string;
  votes: {
    upvotes: number;
    downvotes: number;
    currentUserVote?: 'upvote' | 'downvote';
  };
  comments_count: number;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  user_email?: string;
}

export default function CollaborativeCriteriaStage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { decisionId, collaborators } = useDecision();

  const [suggestions, setSuggestions] = useState<CriteriaSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSuggestion, setNewSuggestion] = useState({ name: '', weight: 3 });
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch suggestions and set up real-time subscription
  useEffect(() => {
    if (!decisionId) return;

    const fetchSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('criteria_suggestions')
          .select(`
            *,
            votes:criteria_votes(vote_type),
            comments:criteria_comments(count)
          `)
          .eq('decision_id', decisionId);

        if (error) throw error;

        const processedSuggestions = data.map(suggestion => ({
          ...suggestion,
          votes: {
            upvotes: suggestion.votes?.filter(v => v.vote_type === 'upvote').length || 0,
            downvotes: suggestion.votes?.filter(v => v.vote_type === 'downvote').length || 0,
            currentUserVote: suggestion.votes?.find(v => v.user_id === user?.id)?.vote_type
          },
          comments_count: suggestion.comments?.[0]?.count || 0
        }));

        setSuggestions(processedSuggestions);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
        setError('Failed to load criteria suggestions');
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`criteria_changes:${decisionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'criteria_suggestions',
        filter: `decision_id=eq.${decisionId}`
      }, () => {
        fetchSuggestions();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [decisionId, user?.id]);

  // Fetch comments when a suggestion is selected
  useEffect(() => {
    if (!selectedSuggestion) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      try {
        const { data, error } = await supabase
          .from('criteria_comments')
          .select(`
            *,
            users:user_id(email)
          `)
          .eq('suggestion_id', selectedSuggestion)
          .order('created_at', { ascending: true });

        if (error) throw error;

        setComments(data.map(comment => ({
          ...comment,
          user_email: comment.users?.email
        })));
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };

    fetchComments();
  }, [selectedSuggestion]);

  const handleAddSuggestion = async () => {
    if (!newSuggestion.name.trim() || !decisionId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('criteria_suggestions')
        .insert({
          decision_id: decisionId,
          name: newSuggestion.name.trim(),
          weight: newSuggestion.weight,
          user_id: user?.id
        });

      if (error) throw error;

      setNewSuggestion({ name: '', weight: 3 });
    } catch (err) {
      console.error('Error adding suggestion:', err);
      setError('Failed to add suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestionId: string, voteType: 'upvote' | 'downvote') => {
    try {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (!suggestion) return;

      if (suggestion.votes.currentUserVote === voteType) {
        // Remove vote
        await supabase
          .from('criteria_votes')
          .delete()
          .eq('suggestion_id', suggestionId)
          .eq('user_id', user?.id);
      } else {
        // Upsert vote
        await supabase
          .from('criteria_votes')
          .upsert({
            suggestion_id: suggestionId,
            user_id: user?.id,
            vote_type: voteType
          }, {
            onConflict: 'suggestion_id,user_id'
          });
      }
    } catch (err) {
      console.error('Error voting:', err);
      setError('Failed to register vote');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedSuggestion) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('criteria_comments')
        .insert({
          suggestion_id: selectedSuggestion,
          user_id: user?.id,
          content: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptSuggestion = async (suggestionId: string) => {
    try {
      const { error } = await supabase
        .from('criteria_suggestions')
        .update({ status: 'accepted' })
        .eq('id', suggestionId);

      if (error) throw error;
    } catch (err) {
      console.error('Error accepting suggestion:', err);
      setError('Failed to accept suggestion');
    }
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    try {
      const { error } = await supabase
        .from('criteria_suggestions')
        .update({ status: 'rejected' })
        .eq('id', suggestionId);

      if (error) throw error;
    } catch (err) {
      console.error('Error rejecting suggestion:', err);
      setError('Failed to reject suggestion');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/decision/options')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Options
        </button>
        
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          <span className="text-sm text-gray-600">
            {collaborators.length} team member{collaborators.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Suggestions List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Suggested Criteria</h2>

            {error && (
              <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            )}

            {/* Add New Suggestion */}
            <div className="mb-6 space-y-4">
              <input
                type="text"
                value={newSuggestion.name}
                onChange={e => setNewSuggestion(s => ({ ...s, name: e.target.value }))}
                placeholder="Suggest a new criterion..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(weight => (
                    <button
                      key={weight}
                      onClick={() => setNewSuggestion(s => ({ ...s, weight }))}
                      className={`w-8 h-8 rounded-full font-medium transition-colors ${
                        newSuggestion.weight === weight
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {weight}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleAddSuggestion}
                  disabled={!newSuggestion.name.trim() || submitting}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-5 w-5 mr-2" />
                      Add Suggestion
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Suggestions List */}
            <div className="space-y-4">
              {suggestions.map(suggestion => (
                <div
                  key={suggestion.id}
                  className={`p-4 rounded-lg border ${
                    suggestion.status === 'accepted'
                      ? 'bg-green-50 border-green-200'
                      : suggestion.status === 'rejected'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{suggestion.name}</h3>
                      
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleVote(suggestion.id, 'upvote')}
                            className={`p-1 rounded ${
                              suggestion.votes.currentUserVote === 'upvote'
                                ? 'text-green-600 bg-green-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </button>
                          <span className="text-sm text-gray-600">
                            {suggestion.votes.upvotes}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleVote(suggestion.id, 'downvote')}
                            className={`p-1 rounded ${
                              suggestion.votes.currentUserVote === 'downvote'
                                ? 'text-red-600 bg-red-50'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </button>
                          <span className="text-sm text-gray-600">
                            {suggestion.votes.downvotes}
                          </span>
                        </div>

                        <button
                          onClick={() => setSelectedSuggestion(
                            selectedSuggestion === suggestion.id ? null : suggestion.id
                          )}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          <MessageSquare className="h-4 w-4" />
                          {suggestion.comments_count}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {suggestion.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAcceptSuggestion(suggestion.id)}
                            className="p-1 text-gray-400 hover:text-green-600 rounded"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleRejectSuggestion(suggestion.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comments Panel */}
        <div className={`lg:col-span-1 ${!selectedSuggestion ? 'hidden lg:block' : ''}`}>
          <div className="bg-white rounded-xl shadow-lg p-6 h-full">
            {selectedSuggestion ? (
              <>
                <h3 className="text-lg font-medium mb-4">Comments</h3>
                
                <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
                  {comments.map(comment => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {comment.user_email || 'Anonymous'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600">{comment.content}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Send'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Select a suggestion to view comments
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate('/decision/analysis')}
          disabled={!suggestions.some(s => s.status === 'accepted')}
          className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          Continue to Analysis
          <ArrowRight className="ml-2 h-5 w-5" />
        </button>
      </div>
    </div>
  );
}