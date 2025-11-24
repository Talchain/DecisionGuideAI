import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Users, Loader2 } from 'lucide-react';
import BiasesCarousel from './BiasesCarousel';
import { useAnalysis } from '../hooks/useAnalysis'; // Assuming path is correct
import ProsConsList from './ProsConsList';
import { analyzeOptions } from '../lib/api';
import type { Bias } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { saveDecisionAnalysis, supabase, createDecision } from '../lib/supabase';
import AnalysisContent from './Analysis/AnalysisContent';
import type { Database } from '../types/database';

// Define types
interface LocationState {
  decision: string;
  decisionId: string; // This can be temporary initially
  decisionType: string;
  reversibility: string;
  importance: string;
  goals?: string[];
  skipGoalsReason?: string;
}

// Extend LocationState locally for extra fields used in this component
type LocationStateExt = LocationState & {
  collaboration_settings?: Record<string, boolean>;
};

// Local DB row aliases (keep only what's used to satisfy noUnusedLocals)
type CollaboratorRow = Database['public']['Tables']['decision_collaborators']['Row'];

// (RPC helper types not required explicitly here; we narrow results inline as needed)

// Decision type union guard
const decisionTypes = ['professional','financial','health','career','relationships','other'] as const;
type DecisionType = typeof decisionTypes[number];
function toDecisionType(value: string | null | undefined): DecisionType {
  const v = (value ?? '').toLowerCase() as DecisionType;
  return (decisionTypes as readonly string[]).includes(v) ? (v as DecisionType) : 'other';
}

// Interface for the raw collaborator row + fetched email
interface Collaborator {
  id: string; // PK of the decision_collaborators row
  user_id: string; // UUID of the user
  decision_id: string;
  role?: string;
  status?: string;
  email?: string; // Email fetched separately
}


interface AnalysisDataToSave {
    analysis: any;
    biases: Bias[];
    options: any;
    goals?: string[];
    importance: string;
    reversibility: string;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAVE_TIMEOUT = 15000; // 15 seconds

export default function Analysis() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationStateExt;

  // Helper function to check if a decision ID is a valid UUID
  const isValidDecisionId = useCallback((id: string | null): id is string => {
     if (!id) return false;
    return UUID_REGEX.test(id);
  }, []);

  // == State ==
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [biases, setBiases] = useState<Bias[]>([]);
  const [analysisHookError, setAnalysisError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState<boolean>(false);
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  const [collaborationRetryCount, setCollaborationRetryCount] = useState<number>(0);
  const [showCollaborationPanel, setShowCollaborationPanel] = useState<boolean>(false);
  const [permanentId, setPermanentId] = useState<string | null>(() =>
    isValidDecisionId(state.decisionId) ? state.decisionId : null
  );

  // == Refs ==
  const permanentDecisionIdRef = useRef<string | null>(permanentId); // Sync ref with initial state
  const saveTimeoutRef = useRef<number | null>(null);
  const collaborationRetryTimeoutRef = useRef<number | null>(null);
  const componentMountedRef = useRef(true);
  const creationAttemptedRef = useRef(false);
  const hasCreatedPermanentDecisionRef = useRef(false);


  // Redirect if missing required state
  if (!state?.decisionId || !state?.decision || !state?.decisionType || !state?.reversibility || !state?.importance) {
    console.warn("Missing required state for Analysis component, redirecting.", state);
    return <Navigate to="/" replace />;
  }


  // Main analysis hook
  const {
    aiAnalysis,
    options,
    loading: analysisLoading,
    error: useAnalysisError,
    retryCount,
    retry
  } = useAnalysis({
    decision: state.decision,
    decisionType: state.decisionType,
    reversibility: state.reversibility,
    importance: state.importance,
    goals: state.goals
  });

  // Update local error state when hook error changes
  useEffect(() => {
      setAnalysisError(useAnalysisError);
  }, [useAnalysisError]);

  // Update ref whenever permanentId state changes
   useEffect(() => {
       permanentDecisionIdRef.current = permanentId;
   }, [permanentId]);


  // Cleanup on unmount
  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      if (collaborationRetryTimeoutRef.current) window.clearTimeout(collaborationRetryTimeoutRef.current);
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Fetch Biases/Options
  const fetchBiasesAndOptions = useCallback(async () => {
    if (!componentMountedRef.current) return;
    setOptionsLoading(true);
    setOptionsError(null);
    try {
      const response = await analyzeOptions({
        decision: state.decision, decisionType: state.decisionType,
        reversibility: state.reversibility, importance: state.importance, goals: state.goals
      });
      if (componentMountedRef.current) {
          setBiases(response.biases && Array.isArray(response.biases) ? response.biases : []);
      }
    } catch (err) {
      if (componentMountedRef.current) {
          setOptionsError(err instanceof Error ? err.message : 'Failed to fetch biases/options');
          setBiases([]);
      }
    } finally {
      if (componentMountedRef.current) setOptionsLoading(false);
    }
  }, [state.decision, state.decisionType, state.reversibility, state.importance, state.goals]);

  useEffect(() => { fetchBiasesAndOptions(); }, [fetchBiasesAndOptions]);


  // Function to create a permanent decision in the database
  const createPermanentDecision = useCallback(async (): Promise<string | null> => {
     if (!user) { return null; }
     if (permanentId) { return permanentId; }
     if (isValidDecisionId(state.decisionId)) {
       if (componentMountedRef.current) setPermanentId(state.decisionId);
       return state.decisionId;
     }
     console.log("Creating permanent decision...");
     try {
      const safeType: DecisionType = toDecisionType(state.decisionType);
      const { data, error } = await createDecision({
        user_id: user.id, title: state.decision, type: safeType,
        reversibility: state.reversibility, importance: state.importance,
        status: 'in_progress', description: state.goals?.join("; ")
      });
      if (error) throw error;
      const newId = (data && typeof data === 'object' && data !== null && 'id' in (data as any))
        ? ((data as any).id as string)
        : null;
      if (!newId) throw new Error("No ID returned");
      hasCreatedPermanentDecisionRef.current = true;
      if (componentMountedRef.current) setPermanentId(newId);
      return newId;
     } catch (err) {
       console.error("Error creating permanent decision:", err);
       if (componentMountedRef.current) setSaveError("Failed to initialize decision saving.");
       return null;
     }
  }, [user, state.decision, state.decisionType, state.reversibility, state.importance, state.goals, state.decisionId, isValidDecisionId, permanentId]);


  // Fetch Collaborators Function - Refactored to 2 queries
  const fetchCollaborators = useCallback(async (decisionId: string) => {
    if (!decisionId || !isValidDecisionId(decisionId)) {
      if (componentMountedRef.current) {
        setCollaboratorsLoading(false);
        setCollaborators([]);
      }
      return;
    }
    if (componentMountedRef.current) {
        setCollaboratorsLoading(true);
        setCollaborationError(null);
    }
    
    try {
      console.log(`Fetching collaborator user IDs for decision ID: ${decisionId}`);
      
      let collabData: CollaboratorRow[] = [];
      
      // First try the RPC function
      try {
        // Use the get_decision_collaborators function to avoid RLS recursion issues
        const { data, error } = await (supabase as any)
          .rpc('get_decision_collaborators', { decision_id_param: decisionId as CollaboratorRow['decision_id'] });
  
        if (error) {
          console.warn(`RPC error fetching collaborators: ${error.message}`);
          throw error;
        }
        
        collabData = (Array.isArray(data) ? data : []) as unknown as CollaboratorRow[];
      } catch (rpcError) {
        console.error('RPC method failed, falling back to direct query:', rpcError);
        
        // Fallback to direct query
        const { data, error } = await supabase
          .from('decision_collaborators')
          .select('*')
          .eq('decision_id', decisionId as any)
          .returns<CollaboratorRow[]>();
          
        if (error) throw error;
        collabData = (data ?? []) as CollaboratorRow[];
      }

      if (!collabData || collabData.length === 0) {
          console.log("No collaborators found for this decision.");
          if (componentMountedRef.current) setCollaborators([]);
          // No need to fetch users if no collaborators
          if (componentMountedRef.current) setCollaboratorsLoading(false);
          return;
      }

      // Step 2: Extract user IDs and fetch user details
      const userIds = collabData.map((c: CollaboratorRow) => c.user_id).filter((id): id is string => Boolean(id));
      if (userIds.length === 0) {
          console.log("Collaborator rows found, but no valid user IDs associated.");
          if (componentMountedRef.current) setCollaborators(collabData as unknown as Collaborator[]); // Set data without emails
          if (componentMountedRef.current) setCollaboratorsLoading(false);
          return;
      }

      console.log(`Fetching user details for IDs:`, userIds);
      // Use auth.users table through a secure RPC function
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email:auth.users!user_profiles_id_fkey(email)')
        .in('id', userIds as any)
        .returns<any[]>();

      if (usersError) throw usersError;

      // Step 3: Map user emails back to collaborator data
      const usersMap = new Map(((usersData ?? []) as any[]).map((u: any) => [u.id as string, (u?.email?.email as string | undefined)]));
      const combinedData: Collaborator[] = collabData.map((collab: CollaboratorRow) => ({
          ...collab,
          email: usersMap.get(collab.user_id) || undefined // Add email if found
      }));

      console.log("Collaborators processed:", combinedData);
      if (componentMountedRef.current) setCollaborators(combinedData);

    } catch (err) {
      console.error('Caught error fetching collaborators:', err);
      if (componentMountedRef.current) {
          // Implement retry logic with exponential backoff
          if (collaborationRetryCount < 3) {
            const retryDelay = Math.pow(2, collaborationRetryCount) * 1000; // 1s, 2s, 4s
            console.log(`Will retry fetching collaborators in ${retryDelay}ms (attempt ${collaborationRetryCount + 1}/3)`);
            
            if (collaborationRetryTimeoutRef.current) {
              window.clearTimeout(collaborationRetryTimeoutRef.current);
            }
            
            collaborationRetryTimeoutRef.current = window.setTimeout(() => {
              if (componentMountedRef.current) {
                setCollaborationRetryCount(prev => prev + 1);
                fetchCollaborators(decisionId);
              }
            }, retryDelay);
          } else {
            console.error('Max retry attempts reached for fetching collaborators');
          }
          
          setCollaborationError(err instanceof Error ? err.message : 'Failed to load collaborators');
          setCollaborators([]);
      }
    } finally {
      // Ensure loading is set to false only if component still mounted
      if (componentMountedRef.current) {
        setCollaboratorsLoading(false);
      }
    }
  }, [isValidDecisionId, collaborationRetryCount]);

  // Function to invite a collaborator
  const inviteCollaborator = useCallback(async (email: string, role: 'collaborator' | 'viewer') => {
    if (!permanentId || !isValidDecisionId(permanentId)) {
      setSaveError('Cannot invite collaborators without a valid decision ID');
      return;
    }
    
    try {
      // First check if user exists
      const { data: userCheck } = await (supabase as any)
        .rpc('check_user_email_exists', { email_to_check: email });
        
      // Create the collaborator record
      const userId: string | null = (userCheck && typeof userCheck === 'object' && userCheck !== null && 'id' in (userCheck as any))
        ? ((userCheck as any).id as string)
        : null;
      const insertPayload = {
        decision_id: permanentId,
        user_id: userId,
        email: email,
        role: role,
        status: 'invited',
        permissions: {
          can_comment: role === 'collaborator',
          can_suggest: role === 'collaborator',
          can_rate: role === 'collaborator'
        },
        invited_at: new Date().toISOString()
      } as any;
      const { error: inviteError } = await supabase
        .from('decision_collaborators')
        .insert(insertPayload as any);
        
      if (inviteError) throw inviteError;
      
      // Refresh collaborator list
      fetchCollaborators(permanentId);
      
    } catch (err) {
      console.error('Error inviting collaborator:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to invite collaborator');
    }
  }, [permanentId, isValidDecisionId, fetchCollaborators, supabase]);
  
  // (updateCollaborator removed – unused)

  // Function to remove collaborator
  const removeCollaborator = useCallback(async (collaboratorId: string) => {
    if (!permanentId) return;
    
    try {
      const { error } = await supabase
        .from('decision_collaborators')
        .delete()
        .eq('id', collaboratorId as any);
        
      if (error) throw error;
      
      // Refresh collaborator list
      fetchCollaborators(permanentId);
      
    } catch (err) {
      console.error('Error removing collaborator:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to remove collaborator');
    }
  }, [permanentId, fetchCollaborators, supabase]);
  
  // Function to update collaboration settings
  const updateCollaborationSettings = useCallback(async (settings: Record<string, boolean>) => {
    if (!permanentId) return;
    
    try {
      const payload: Database['public']['Tables']['decisions']['Update'] = {
        collaboration_settings: settings as unknown as Database['public']['Tables']['decisions']['Row']['collaboration_settings'],
        is_collaborative: true,
      };
      const { error } = await supabase
        .from('decisions')
        .update(payload as any)
        .eq('id', permanentId as any);
        
      if (error) throw error;
      
    } catch (err) {
      console.error('Error updating collaboration settings:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to update collaboration settings');
    }
  }, [permanentId, supabase]);

  // Save Analysis to Database Function
  const saveAnalysisToDatabase = useCallback(async (
    decisionId: string,
    dataToSave: AnalysisDataToSave,
    status: string = 'in_progress'
   ) => {
     // ... (implementation remains the same) ...
     if (!user) { return { success: false, error: "User not logged in" }; }
     if (!dataToSave || !dataToSave.analysis) { return { success: false, error: "Missing analysis data" }; }
     if (!isValidDecisionId(decisionId)) { return { success: false, error: "Invalid decision ID passed to save function" }; }
     console.log(`Saving analysis (status: ${status}) for decision: ${decisionId}`);
     if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
     saveTimeoutRef.current = window.setTimeout(() => { /* ... timeout logic ... */ }, SAVE_TIMEOUT);
     try {
       const metadata = { decisionType: state.decisionType, reversibility: state.reversibility, importance: state.importance, lastUpdated: new Date().toISOString() };
       const { error } = await saveDecisionAnalysis(decisionId, dataToSave, status, metadata);
       if (error) throw error;
       if (componentMountedRef.current) setSaveError(null);
       return { success: true, error: null };
     } catch (err) {
       const errorMessage = err instanceof Error ? err.message : 'Failed to save analysis';
       if (componentMountedRef.current) setSaveError(errorMessage);
       return { success: false, error: errorMessage };
     } finally {
       if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
       saveTimeoutRef.current = null;
     }
  }, [user, state.decisionType, state.reversibility, state.importance, supabase]); // saveInProgress removed


  // Effect Hook for Establishing Permanent ID
  useEffect(() => {
    // ... (implementation remains the same) ...
    if (!permanentId && user && !analysisLoading && aiAnalysis && !creationAttemptedRef.current) {
        creationAttemptedRef.current = true;
        console.log("Attempting to establish permanent ID...");
        (async () => {
            const newPermId = await createPermanentDecision();
            if (!newPermId && componentMountedRef.current) {
                 console.error("Failed to establish permanent ID.");
                 setSaveError("Failed to initialize decision. Cannot save.");
            }
        })();
    }
  }, [user, aiAnalysis, analysisLoading, permanentId, createPermanentDecision]);


  // Effect Hook for Fetching Collaborators
  useEffect(() => {
      if (permanentId) {
          console.log("Permanent ID available, fetching collaborators:", permanentId);
          fetchCollaborators(permanentId);
      } else {
           if (componentMountedRef.current) {
               setCollaborators([]);
               setCollaboratorsLoading(false);
           }
      }
  }, [permanentId, fetchCollaborators]);


  // Auto-Save Effect Hook
  useEffect(() => {
    // DEBUG: Log all dependency values for auto-save check
    console.log("Auto-save check:", {
        permanentId: !!permanentId,
        user: !!user,
        aiAnalysis: !!aiAnalysis,
        analysisLoading,
        analysisHookError: !!analysisHookError,
        saveInProgress
    });

    if (!permanentId || !user || !aiAnalysis || analysisLoading || analysisHookError || saveInProgress) {
      return; // Skip if conditions not met
    }

    console.log("Auto-save triggered for decision:", permanentId);
    if (componentMountedRef.current) setSaveInProgress(true);

    const dataToSave: AnalysisDataToSave = {
        analysis: aiAnalysis, biases, options,
        goals: state.goals, importance: state.importance, reversibility: state.reversibility,
    };

    (async () => {
      try {
        const { success, error } = await saveAnalysisToDatabase(permanentId, dataToSave);
        if (!success) {
          console.error("Auto-save failed:", error);
        } else {
          console.log("Auto-save successful for decision:", permanentId);
        }
      } catch (err) {
        console.error("Unexpected error during auto-save effect:", err);
        if (componentMountedRef.current) setSaveError(err instanceof Error ? err.message : "Auto-save failed");
      } finally {
         if (componentMountedRef.current) setSaveInProgress(false);
      }
    })();

  }, [ // Dependencies reviewed
      user, aiAnalysis, biases, options, state.goals, state.importance, state.reversibility, // Data
      permanentId, // Gatekeeper state
      analysisLoading, analysisHookError, // Gatekeepers
      saveAnalysisToDatabase // Stable save function
      // saveInProgress removed from deps
  ]);


  // Manual Save Handler
  const handleSave = async () => {
    // ... (implementation remains the same) ...
    if (!user) { setSaveError('You must be logged in to save'); return; }
    if (analysisLoading || analysisHookError) { setSaveError('Please wait for analysis to complete or resolve errors.'); return; }
    if (saveInProgress) { return; }
     if (componentMountedRef.current) setSaveInProgress(true);
    try {
      let decisionIdToSave = permanentId;
      if (!decisionIdToSave) {
          decisionIdToSave = await createPermanentDecision();
          if (!decisionIdToSave) throw new Error('Failed to establish a decision ID before saving');
      }
       if (!isValidDecisionId(decisionIdToSave)) {
           throw new Error(`Invalid Decision ID cannot be saved: ${decisionIdToSave}`);
       }
       const dataToSave: AnalysisDataToSave = {
           analysis: aiAnalysis, biases, options,
           goals: state.goals, importance: state.importance, reversibility: state.reversibility,
       };
      const { success, error } = await saveAnalysisToDatabase(decisionIdToSave, dataToSave, 'finalized');
      if (!success) throw error || new Error('Unknown error during save');
      navigate('/decisions', { replace: true });
    } catch (err) {
       if (componentMountedRef.current) setSaveError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
       if (componentMountedRef.current) setSaveInProgress(false);
    }
  };

  // Back Navigation Handler
  const handleBack = useCallback(() => {
    // ... (implementation remains the same) ...
    if (state.skipGoalsReason) {
        navigate('/decision/reversibility', { state: { ...state } });
    } else {
        navigate('/decision/goals', { state: { ...state } });
    }
  }, [navigate, state]);

  // DEBUG: Effect to log button disabled state dependencies
  useEffect(() => {
      console.log("Save Button State Debug:", {
          saveInProgress,
          analysisLoading,
          analysisHookError: !!analysisHookError,
          optionsLoading,
          optionsError: !!optionsError,
          permanentId: !!permanentId,
          isDisabled: saveInProgress || analysisLoading || !!analysisHookError || optionsLoading || !!optionsError || !permanentId
      });
  }, [saveInProgress, analysisLoading, analysisHookError, optionsLoading, optionsError, permanentId]);


  // Render Logic
  return (
    <div className="flex flex-col min-h-0 h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <button onClick={handleBack} disabled={saveInProgress} className="flex items-center text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 p-2 rounded border" >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {state.skipGoalsReason ? 'Back to Reversibility' : 'Back to Goals'}
          </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCollaborationPanel(!showCollaborationPanel)}
              className="flex items-center px-4 py-2 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors border border-indigo-200"
            >
              <Users className="h-4 w-4 mr-2" />
              Collaboration
            </button>
          {/* Save Button - Disable if no permanentId state */}
          <button onClick={handleSave} disabled={saveInProgress || analysisLoading || !!analysisHookError || optionsLoading || !!optionsError || !permanentId} className="flex items-center px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors border" >
            {saveInProgress ? ( <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving... </> ) : ( 'Save and Finalize Analysis' )}
          </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 gap-4">
        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-lg p-6 overflow-y-auto space-y-6">
        {/* Collaborators Section */}
        <div className="border-b pb-4 mb-4">
          <h3 className="text-lg font-semibold mb-2 flex items-center"><Users className="mr-2 h-5 w-5 text-gray-600"/> Collaborators</h3>
           {!permanentId ? ( <div className="text-sm text-gray-500 italic">Collaboration features available after analysis is generated.</div>
           ) : collaboratorsLoading ? ( <div className="flex items-center text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading collaborators...</div>
           ) : collaborationError ? (
             <div className="bg-red-50 p-3 rounded-lg">
                 <div className="flex items-center gap-2">
                   <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                   <p className="text-sm text-red-700">{collaborationError}</p>
                 </div>
             </div>
           ) : collaborators.length > 0 ? (
             <ul className="list-disc list-inside pl-2 text-sm text-gray-700 space-y-1">
               {collaborators.map((collab) => (
                 <li key={collab.id || collab.user_id}>
                   {/* Use mapped email */}
                   {collab.email || `User ID: ${collab.user_id}`}
                 </li>
               ))}
             </ul>
           ) : ( <p className="text-sm text-gray-500">No collaborators found.</p> )}
        </div>

        {/* Biases Carousel */}
        <BiasesCarousel biases={biases} isLoading={optionsLoading} error={optionsError} />

        {/* Save Error Display */}
        {saveError && ( <div className="bg-red-50 p-4 rounded-lg"><p className="text-red-700">Save Error: {saveError}</p></div> )}

        {/* Main Analysis Display */}
        <div>
            <h3 className="text-lg font-semibold mb-2">AI Analysis</h3>
            {analysisLoading || optionsLoading ? ( <div className="flex items-center justify-center p-8 text-gray-500"><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading Analysis Data...</div>
            ) : analysisHookError || optionsError ? (
                 ( <div className="bg-red-50 p-4 rounded-lg">
                     <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-700 font-medium">{analysisHookError ? 'Error loading AI analysis:' : 'Error loading options/biases:'}</p>
                     </div>
                     <p className="text-red-600 text-sm pl-7">{analysisHookError || optionsError}</p>
                     {analysisHookError && typeof retry === 'function' && retryCount < 3 && (
                        <button onClick={retry} className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium pl-7">Try Again</button>
                     )}
                 </div> )
            ) : aiAnalysis ? ( <AnalysisContent text={aiAnalysis} />
            ) : ( <p className="text-gray-500 italic">No analysis content generated.</p> )}
        </div>

        {/* Options Render Section using ProsConsList */}
        {!(analysisLoading || analysisHookError || optionsLoading || optionsError) && options && options.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Options Analysis</h3>
            <ProsConsList decision={state.decision} initialOptions={options} biases={biases}/>
          </div>
        )}
        </div>
        
        {showCollaborationPanel && permanentId && (
          <div className="w-96 min-h-0 bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100">
              <h3 className="text-lg font-semibold text-gray-900">Collaboration Hub</h3>
              <p className="text-sm text-gray-600">Invite others to collaborate on this decision</p>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
              <div className="space-y-6">
                {/* Collaborator List */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Current Collaborators</h4>
                  {collaboratorsLoading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 text-indigo-500 animate-spin mr-2" />
                      <span className="text-gray-500">Loading collaborators...</span>
                    </div>
                  ) : collaborationError ? (
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-sm text-red-600">{collaborationError}</p>
                    </div>
                  ) : collaborators.length > 0 ? (
                    <div className="space-y-2">
                      {collaborators.map(collab => (
                        <div key={collab.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-gray-800">{collab.email || `User ${collab.user_id.substring(0, 8)}`}</p>
                              <p className="text-xs text-gray-500">
                                {collab.role} • {collab.status}
                              </p>
                            </div>
                            <button 
                              onClick={() => removeCollaborator(collab.id)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No collaborators yet. Invite someone below.</p>
                  )}
                </div>
                
                {/* Invite Form */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Invite Collaborators</h4>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                    const role = (form.elements.namedItem('role') as HTMLSelectElement).value as 'collaborator' | 'viewer';
                    inviteCollaborator(email, role);
                    form.reset();
                  }}>
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Enter email address"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                          Role
                        </label>
                        <select
                          id="role"
                          name="role"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="collaborator">Collaborator (can edit)</option>
                          <option value="viewer">Viewer (read-only)</option>
                        </select>
                      </div>
                      
                      <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Send Invitation
                      </button>
                    </div>
                  </form>
                </div>
                
                {/* Collaboration Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Collaboration Settings</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">Allow Suggestions</p>
                        <p className="text-xs text-gray-500">Let collaborators suggest changes</p>
                      </div>
                      <button
                        onClick={() => updateCollaborationSettings({
                          ...state.collaboration_settings,
                          allow_suggestions: !state.collaboration_settings?.allow_suggestions
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                          state.collaboration_settings?.allow_suggestions ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            state.collaboration_settings?.allow_suggestions ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">Require Approval</p>
                        <p className="text-xs text-gray-500">Approve suggestions before applying</p>
                      </div>
                      <button
                        onClick={() => updateCollaborationSettings({
                          ...state.collaboration_settings,
                          require_approval: !state.collaboration_settings?.require_approval
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                          state.collaboration_settings?.require_approval ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            state.collaboration_settings?.require_approval ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">Auto Notifications</p>
                        <p className="text-xs text-gray-500">Send email notifications</p>
                      </div>
                      <button
                        onClick={() => updateCollaborationSettings({
                          ...state.collaboration_settings,
                          auto_notify: !state.collaboration_settings?.auto_notify
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                          state.collaboration_settings?.auto_notify ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            state.collaboration_settings?.auto_notify ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}