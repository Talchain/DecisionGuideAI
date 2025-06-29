import { useState, useEffect, useCallback, useRef } from 'react';
import { analyzeDecision, analyzeOptions } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Bias, Option as APIOption } from '../lib/api';
import type { Option } from '../components/ProsConsList/types';

interface UseAnalysisProps {
  decision: string;
  decisionType: string;
  reversibility: string;
  importance: string;
  goals?: string[];
}

interface AnalysisState {
  aiAnalysis: string | null;
  options: Option[];
  biases: Bias[];
  loading: boolean;
  error: string | null;
}

interface DebugInfo {
  apiResponses: {
    analysis: boolean;
    options: boolean;
    timestamp: number | null;
  };
  optionsData: {
    raw: any | null;
    processed: Option[] | null;
    timestamp: number | null;
  };
  stateUpdates: {
    count: number;
    lastUpdate: number | null;
  };
  errors: {
    count: number;
    last: string | null;
    timestamp: number | null;
  };
}

// Convert API options to ProsConsList format
function convertAPIOptionsToProsConsList(apiOptions: APIOption[]): Option[] {
  if (!Array.isArray(apiOptions) || apiOptions.length === 0) {
    return [];
  }
  
  const timestamp = Date.now();
  
  return apiOptions.map((opt, index) => {
    const optionId = `option_${timestamp}_${index}`;
    
    // Ensure pros and cons are arrays
    const pros = Array.isArray(opt.pros) ? opt.pros : [];
    const cons = Array.isArray(opt.cons) ? opt.cons : [];
    
    return {
      id: optionId,
      name: opt.name || `Option ${index + 1}`,
      pros: pros.map((content, i) => ({
        id: `${optionId}_pro_${i}_${timestamp}`,
        content: typeof content === 'string' ? content : String(content),
        score: 0,
        createdAt: new Date().toISOString()
      })),
      cons: cons.map((content, i) => ({
        id: `${optionId}_con_${i}_${timestamp}`,
        content: typeof content === 'string' ? content : String(content),
        score: 0,
        createdAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString()
    };
  });
}

export function useAnalysis({
  decision,
  decisionType,
  reversibility,
  importance,
  goals
}: UseAnalysisProps) {
  const [state, setState] = useState<AnalysisState>({
    aiAnalysis: null,
    options: [],
    biases: [],
    loading: true,
    error: null
  });

  const debugInfoRef = useRef<DebugInfo>({
    apiResponses: {
      analysis: false,
      options: false,
      timestamp: null
    },
    optionsData: {
      raw: null,
      processed: null,
      timestamp: null
    },
    stateUpdates: {
      count: 0,
      lastUpdate: null
    },
    errors: {
      count: 0,
      last: null,
      timestamp: null
    }
  });

  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const hasRunAnalysisRef = useRef(false);
  const apiCallInProgressRef = useRef(false);
  const optionsDataRef = useRef<Option[]>([]);

  // Debug logging
  const logDebug = useCallback((action: string, data?: any) => {
    const timestamp = Date.now();
    console.log(`[DEBUG] useAnalysis ${action}:`, {
      timestamp: new Date(timestamp).toISOString(),
      debugInfo: debugInfoRef.current,
      currentState: state,
      hasRunAnalysis: hasRunAnalysisRef.current,
      apiCallInProgress: apiCallInProgressRef.current,
      ...data
    });
  }, [state]);

  // Update state with API responses
  const updateStateFromResponses = useCallback((
    analysisResponse?: string | null,
    optionsResponse?: { options: APIOption[]; biases: Bias[]; } | null
  ) => {
    if (!isMountedRef.current) return;

    const timestamp = Date.now();
    const hasAnalysis = analysisResponse !== undefined;
    const hasOptions = optionsResponse !== undefined;

    debugInfoRef.current.apiResponses = {
      analysis: hasAnalysis,
      options: hasOptions,
      timestamp
    };

    logDebug('updateStateFromResponses:start', {
      hasAnalysis,
      hasOptions,
      analysisLength: analysisResponse?.length,
      optionsCount: optionsResponse?.options?.length
    });

    // Create updates object
    const updates: Partial<AnalysisState> = {
      loading: false
    };

    if (hasAnalysis) {
      updates.aiAnalysis = analysisResponse;
    }
    
    if (hasOptions && optionsResponse?.options) {
      try {
        const convertedOptions = convertAPIOptionsToProsConsList(optionsResponse.options);
        
        debugInfoRef.current.optionsData = {
          raw: optionsResponse.options,
          processed: convertedOptions,
          timestamp
        };

        // Store options in ref for persistence
        optionsDataRef.current = convertedOptions;

        logDebug('convertOptions:success', {
          inputCount: optionsResponse.options.length,
          outputCount: convertedOptions.length,
          sample: convertedOptions[0]
        });

        updates.options = convertedOptions;
        updates.biases = optionsResponse.biases || [];
      } catch (error) {
        logDebug('convertOptions:error', { error });
        // If conversion fails, don't update options
      }
    }

    // Update state with all changes at once
    setState(prev => {
      const newState = { ...prev, ...updates };
      
      debugInfoRef.current.stateUpdates = {
        count: debugInfoRef.current.stateUpdates.count + 1,
        lastUpdate: timestamp
      };

      logDebug('updateStateFromResponses:complete', { 
        updates,
        newState
      });

      return newState;
    });
  }, [logDebug]);

  // Main analysis function
  const runAnalysis = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (hasRunAnalysisRef.current) {
      logDebug('mount:skipAnalysis', { reason: 'already run' });
      return;
    }
    if (apiCallInProgressRef.current) {
      logDebug('runAnalysis:skipDuplicateCall', { reason: 'API call already in progress' });
      return;
    }

    logDebug('runAnalysis:start');
    hasRunAnalysisRef.current = true;
    apiCallInProgressRef.current = true;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const supabaseUrl = supabase.supabaseUrl;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/openai-proxy`;

      // Prepare messages for the API
      const messages = [
        {
          role: 'system',
          content: `You are a decision analysis, behavioural science, cognitive psychology, and neuroscience expert helping users make better choices. 

Your role is to:
1. Guide users through an optimal decision-making process based on their decision type and its reversibility, importance, and complexity 
2. Help identify any blind spots, missing considerations, or potential biases

You are now guiding the user to update their decision options with weighted pros and cons that you just provided to make it more relevant to them. 

For each response:
1. Use a friendly and comforting communication style with a clean and spacious layout
2. Briefly acknowledge the current situation, the decision they face, and any goals they provide
3. Provide analysis and guidance based on principles from behavioural science, cognitive psychology, and neuroscience to help the user complete their list of options with weighted pros and cons. 

Keep responses clear, actionable, and appropriate to the decision's scope.`
        },
        {
          role: 'user',
          content: `Help me with this ${decisionType} decision: "${decision}"

Context:
• Reversibility: ${reversibility}
• Importance: ${importance}
${goals?.length ? `• Goals:\n${goals.map(goal => `  - ${goal}`).join('\n')}` : ''}

Guide me through the next step in this decision-making process, considering the appropriate depth of analysis for its importance level and the ${reversibility.toLowerCase()} nature of the decision.`
        }
      ];

      const [analysisResponse, optionsResponse] = await Promise.all([
        // Make request to Edge Function for analysis
        fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            messages,
            options: {
              model: 'gpt-4',
              temperature: 0.7,
              max_tokens: importance === 'critical_in_depth_analysis' ? 2000 : 1000
            }
          })
        }).then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API error: ${response.status}`);
          }
          const result = await response.json();
          return { analysis: result.content };
        }),
        analyzeOptions({
          decision,
          decisionType,
          reversibility,
          importance,
          goals
        })
      ]);

      if (!isMountedRef.current) return;
      apiCallInProgressRef.current = false;

      logDebug('runAnalysis:success', {
        analysisReceived: !!analysisResponse?.analysis,
        optionsReceived: !!optionsResponse?.options,
        biasesReceived: !!optionsResponse?.biases,
        optionsLength: optionsResponse?.options?.length
      });

      // Log the entire options data for debugging
      console.log("API returned options:", optionsResponse?.options);

      updateStateFromResponses(
        analysisResponse.analysis,
        {
          options: optionsResponse.options,
          biases: optionsResponse.biases
        }
      );

    } catch (error) {
      logDebug('runAnalysis:error', { error });
      if (!isMountedRef.current) return;
      apiCallInProgressRef.current = false;

      debugInfoRef.current.errors = {
        count: debugInfoRef.current.errors.count + 1,
        last: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        error: 'Failed to analyze decision',
        loading: false
      }));
    }
  }, [
    decision,
    decisionType,
    reversibility,
    importance,
    goals,
    updateStateFromResponses,
    logDebug
  ]);

  // Run analysis on mount
  useEffect(() => {
    isMountedRef.current = true;
    logDebug('mount');
    
    runAnalysis();

    // Safety timeout to prevent infinite loading
    const safetyTimeout = window.setTimeout(() => {
      if (isMountedRef.current && state.loading) {
        logDebug('safety timeout triggered');
        setState(prev => ({ ...prev, loading: false }));
      }
    }, 30000); // Increased from 10000 to 30000 (30 seconds)

    return () => {
      isMountedRef.current = false;
      apiCallInProgressRef.current = false;
      window.clearTimeout(safetyTimeout);
      logDebug('unmount');
    };
  }, [runAnalysis, logDebug, state.loading]);

  // Retry handler
  const retry = useCallback(() => {
    if (retryCountRef.current >= 3) {
      logDebug('retry:maxAttempts');
      return;
    }

    retryCountRef.current++;
    hasRunAnalysisRef.current = false;
    apiCallInProgressRef.current = false;
    logDebug('retry:attempt', { count: retryCountRef.current });
    runAnalysis();
  }, [runAnalysis, logDebug]);

  // If we have options in the ref but not in state, update state
  useEffect(() => {
    if (isMountedRef.current && optionsDataRef.current.length > 0 && state.options.length === 0 && !state.loading) {
      logDebug('syncOptionsFromRef', { 
        optionsInRef: optionsDataRef.current.length,
        optionsInState: state.options.length
      });
      
      setState(prev => ({
        ...prev,
        options: [...optionsDataRef.current]
      }));
    }
  }, [state.options.length, state.loading, logDebug]);

  return {
    ...state,
    retryCount: retryCountRef.current,
    retry,
    debugInfo: {
      apiResponses: {
        analysis: debugInfoRef.current.apiResponses.analysis,
        options: debugInfoRef.current.apiResponses.options,
        timestamp: debugInfoRef.current.apiResponses.timestamp
      },
      optionsData: {
        hasRawData: !!debugInfoRef.current.optionsData.raw,
        hasProcessedData: !!debugInfoRef.current.optionsData.processed,
        rawCount: debugInfoRef.current.optionsData.raw?.length || 0,
        processedCount: debugInfoRef.current.optionsData.processed?.length || 0,
        timestamp: debugInfoRef.current.optionsData.timestamp
      },
      stateUpdates: debugInfoRef.current.stateUpdates,
      errors: debugInfoRef.current.errors,
      currentTimestamp: Date.now(),
      apiCallInProgress: apiCallInProgressRef.current,
      hasRunAnalysis: hasRunAnalysisRef.current,
      optionsInRef: optionsDataRef.current.length
    }
  };
}