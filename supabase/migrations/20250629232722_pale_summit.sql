/*
  # Add GIN indexes for frequently queried jsonb columns
  
  1. New Indexes
    - Added GIN indexes for frequently queried jsonb columns to improve query performance
    - Indexed specific paths within jsonb data where appropriate
    - Added indexes for canvas_data, template_data, content, position, and other jsonb columns
  
  2. Performance Benefits
    - Significantly improves performance for queries that filter or search within jsonb data
    - Reduces query execution time for complex jsonb operations
    - Optimizes containment and existence operators (@>, ?, ?&, ?| etc.)
*/

-- Canvas Templates template_data
CREATE INDEX IF NOT EXISTS idx_canvas_templates_template_data ON public.canvas_templates USING GIN (template_data);

-- Canvases canvas_data
CREATE INDEX IF NOT EXISTS idx_canvases_canvas_data ON public.canvases USING GIN (canvas_data);

-- Canvas Blocks content
CREATE INDEX IF NOT EXISTS idx_canvas_blocks_content ON public.canvas_blocks USING GIN (content);

-- Canvas Blocks position
CREATE INDEX IF NOT EXISTS idx_canvas_blocks_position ON public.canvas_blocks USING GIN (position);

-- Canvas Blocks style
CREATE INDEX IF NOT EXISTS idx_canvas_blocks_style ON public.canvas_blocks USING GIN (style);

-- Canvas Comments position
CREATE INDEX IF NOT EXISTS idx_canvas_comments_position ON public.canvas_comments USING GIN (position);

-- Decision Suggestions content
CREATE INDEX IF NOT EXISTS idx_decision_suggestions_content ON public.decision_suggestions USING GIN (content);

-- Decision Comments context
CREATE INDEX IF NOT EXISTS idx_decision_comments_context ON public.decision_comments USING GIN (context);

-- Decision Comments mentions
CREATE INDEX IF NOT EXISTS idx_decision_comments_mentions ON public.decision_comments USING GIN (decision_comments.mentions);

-- Decision Analysis analysis_data
CREATE INDEX IF NOT EXISTS idx_decision_analysis_analysis_data ON public.decision_analysis USING GIN (analysis_data);

-- Decision Analysis metadata
CREATE INDEX IF NOT EXISTS idx_decision_analysis_metadata ON public.decision_analysis USING GIN (metadata);

-- AI Feedback details
CREATE INDEX IF NOT EXISTS idx_ai_feedback_details ON public.ai_feedback USING GIN (details);

-- AI Context goals
CREATE INDEX IF NOT EXISTS idx_ai_context_goals ON public.ai_context USING GIN (goals);

-- Decisions collaboration_settings
CREATE INDEX IF NOT EXISTS idx_decisions_collaboration_settings ON public.decisions USING GIN (collaboration_settings);

-- Decision Activities details
CREATE INDEX IF NOT EXISTS idx_decision_activities_details ON public.decision_activities USING GIN (details);

-- Criteria Sets criteria
CREATE INDEX IF NOT EXISTS idx_criteria_sets_criteria ON public.criteria_sets USING GIN (criteria);

-- Criteria Templates criteria
CREATE INDEX IF NOT EXISTS idx_criteria_templates_criteria ON public.criteria_templates USING GIN (criteria);

-- Organisations settings
CREATE INDEX IF NOT EXISTS idx_organisations_settings ON public.organisations USING GIN (settings);