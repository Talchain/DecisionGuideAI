-- Staging Schema Backup (pre-scenario-schema-v2)
-- Generated: 2026-02-26T13:13:13Z

-- TABLES
[
    {
        "table_name": "ai_context"
    },
    {
        "table_name": "ai_feedback"
    },
    {
        "table_name": "ai_prompt_templates"
    },
    {
        "table_name": "ai_suggestions"
    },
    {
        "table_name": "app_email_settings"
    },
    {
        "table_name": "app_settings"
    },
    {
        "table_name": "billing_events"
    },
    {
        "table_name": "canvas_blocks"
    },
    {
        "table_name": "canvas_comments"
    },
    {
        "table_name": "canvas_permissions"
    },
    {
        "table_name": "canvas_presence"
    },
    {
        "table_name": "canvas_templates"
    },
    {
        "table_name": "canvas_version_comments"
    },
    {
        "table_name": "canvas_versions"
    },
    {
        "table_name": "canvases"
    },
    {
        "table_name": "cee_prompt_observations"
    },
    {
        "table_name": "cee_prompt_versions"
    },
    {
        "table_name": "cee_prompts"
    },
    {
        "table_name": "criteria_comments"
    },
    {
        "table_name": "criteria_sets"
    },
    {
        "table_name": "criteria_suggestions"
    },
    {
        "table_name": "criteria_templates"
    },
    {
        "table_name": "criteria_votes"
    },
    {
        "table_name": "decision_activities"
    },
    {
        "table_name": "decision_analysis"
    },
    {
        "table_name": "decision_collaborators"
    },
    {
        "table_name": "decision_comments"
    },
    {
        "table_name": "decision_data"
    },
    {
        "table_name": "decision_suggestions"
    },
    {
        "table_name": "decisions"
    },
    {
        "table_name": "email_templates"
    },
    {
        "table_name": "interest_registrations"
    },
    {
        "table_name": "invitation_logs"
    },
    {
        "table_name": "invitations"
    },
    {
        "table_name": "invoices"
    },
    {
        "table_name": "items"
    },
    {
        "table_name": "options"
    },
    {
        "table_name": "organisation_members"
    },
    {
        "table_name": "organisations"
    },
    {
        "table_name": "payment_methods"
    },
    {
        "table_name": "subscription_plans"
    },
    {
        "table_name": "subscriptions"
    },
    {
        "table_name": "team_members"
    },
    {
        "table_name": "teams"
    },
    {
        "table_name": "upgrade_requests"
    },
    {
        "table_name": "usage_tracking"
    },
    {
        "table_name": "user_profiles"
    }
]

-- COLUMNS
[
    {
        "table_name": "ai_context",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "ai_context",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_context",
        "column_name": "canvas_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_context",
        "column_name": "team_size",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_context",
        "column_name": "industry_context",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_context",
        "column_name": "business_stage",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_context",
        "column_name": "challenge_description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_context",
        "column_name": "goals",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "ai_context",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "ai_context",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "ai_feedback",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "ai_feedback",
        "column_name": "suggestion_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_feedback",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_feedback",
        "column_name": "is_helpful",
        "data_type": "boolean",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_feedback",
        "column_name": "details",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_feedback",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "ai_feedback",
        "column_name": "prompt_content",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_feedback",
        "column_name": "context_snapshot",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "template",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "version",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "1"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "framework",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "block_type",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "is_active",
        "data_type": "boolean",
        "is_nullable": "NO",
        "column_default": "true"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "is_system",
        "data_type": "boolean",
        "is_nullable": "NO",
        "column_default": "false"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "category",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'canvas'::text"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'stable'::text"
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "tone",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_prompt_templates",
        "column_name": "preferred_model",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "block_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "block_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "explanation",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'pending'::text"
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "source",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "prompt_template_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "prompt_template_version",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "prompt_content",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "feedback_submitted",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "is_alternative",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "is_proactive",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "trigger_type",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "ai_suggestions",
        "column_name": "template_id",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "app_email_settings",
        "column_name": "id",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "nextval('app_email_settings_id_seq'::regclass)"
    },
    {
        "table_name": "app_email_settings",
        "column_name": "api_key",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "app_email_settings",
        "column_name": "from_email",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "app_email_settings",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "app_settings",
        "column_name": "key",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "app_settings",
        "column_name": "value",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "app_settings",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "app_settings",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "billing_events",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "billing_events",
        "column_name": "subscription_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "billing_events",
        "column_name": "event_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "billing_events",
        "column_name": "event_data",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "billing_events",
        "column_name": "stripe_event_id",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "billing_events",
        "column_name": "performed_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "billing_events",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "block_key",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "content",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "position",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "style",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "last_edited_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_blocks",
        "column_name": "version",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "1"
    },
    {
        "table_name": "canvas_comments",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvas_comments",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "block_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "parent_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "position",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "resolved",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "canvas_comments",
        "column_name": "resolved_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "resolved_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_comments",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_comments",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_permissions",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvas_permissions",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_permissions",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_permissions",
        "column_name": "team_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_permissions",
        "column_name": "permission_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_permissions",
        "column_name": "granted_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_permissions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_presence",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvas_presence",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_presence",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_presence",
        "column_name": "cursor_position",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_presence",
        "column_name": "last_seen",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_presence",
        "column_name": "editing_block_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "team_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "template_data",
        "data_type": "jsonb",
        "is_nullable": "NO",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "preview_image_url",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_templates",
        "column_name": "is_public",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "is_system",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "is_featured",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "usage_count",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "0"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "version",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "1"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_templates",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "event_type",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "event_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "event_timestamp",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "version_number",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "source_type",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "is_starred",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "event_title",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "event_description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "related_block_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "parent_event_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "is_resolved",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "resolved_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "resolved_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "suggestion_type",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_timeline_events",
        "column_name": "suggestion_status",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "version_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "parent_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "resolved",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "resolved_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "resolved_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_version_comments",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_versions",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvas_versions",
        "column_name": "canvas_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "version_number",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "canvas_data",
        "data_type": "jsonb",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "change_summary",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "created_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvas_versions",
        "column_name": "source_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'user'::text"
    },
    {
        "table_name": "canvas_versions",
        "column_name": "is_starred",
        "data_type": "boolean",
        "is_nullable": "NO",
        "column_default": "false"
    },
    {
        "table_name": "canvas_versions",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "diff_data",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "block_changes",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "metadata",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "canvas_versions",
        "column_name": "outcome_summary",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "lessons_learned",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "confidence_rating",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvas_versions",
        "column_name": "follow_up_actions",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "canvas_versions",
        "column_name": "revisit_date",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "canvases",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "team_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "template_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "canvas_data",
        "data_type": "jsonb",
        "is_nullable": "NO",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "canvases",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'draft'::text"
    },
    {
        "table_name": "canvases",
        "column_name": "tags",
        "data_type": "ARRAY",
        "is_nullable": "YES",
        "column_default": "'{}'::text[]"
    },
    {
        "table_name": "canvases",
        "column_name": "last_edited_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "canvases",
        "column_name": "last_edited_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvases",
        "column_name": "version",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "1"
    },
    {
        "table_name": "canvases",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvases",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "canvases",
        "column_name": "source_type",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'user'::text"
    },
    {
        "table_name": "canvases",
        "column_name": "ai_applied_metadata",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "prompt_id",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "version",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "observation_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "rating",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "payload_hash",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "created_by",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_observations",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "prompt_id",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "version",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "variables",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "created_by",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "change_note",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "content_hash",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "requires_approval",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "approved_by",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "approved_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompt_versions",
        "column_name": "test_cases",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "cee_prompts",
        "column_name": "id",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompts",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompts",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompts",
        "column_name": "task_id",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "cee_prompts",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'draft'::text"
    },
    {
        "table_name": "cee_prompts",
        "column_name": "active_version",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "1"
    },
    {
        "table_name": "cee_prompts",
        "column_name": "tags",
        "data_type": "ARRAY",
        "is_nullable": "YES",
        "column_default": "'{}'::text[]"
    },
    {
        "table_name": "cee_prompts",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "cee_prompts",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "cee_prompts",
        "column_name": "staging_version",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompts",
        "column_name": "design_version",
        "data_type": "character varying",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "cee_prompts",
        "column_name": "model_config",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_comments",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "criteria_comments",
        "column_name": "suggestion_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_comments",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_comments",
        "column_name": "parent_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_comments",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_comments",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_comments",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_comments",
        "column_name": "deleted_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_sets",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "criteria_sets",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_sets",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_sets",
        "column_name": "criteria",
        "data_type": "jsonb",
        "is_nullable": "NO",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "criteria_sets",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_sets",
        "column_name": "team_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_sets",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_sets",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "weight",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'pending'::text"
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_suggestions",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_templates",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "criteria_templates",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_templates",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_templates",
        "column_name": "type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_templates",
        "column_name": "criteria",
        "data_type": "jsonb",
        "is_nullable": "NO",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "criteria_templates",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_templates",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "criteria_templates",
        "column_name": "owner_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "criteria_templates",
        "column_name": "sharing",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'private'::text"
    },
    {
        "table_name": "criteria_templates",
        "column_name": "tags",
        "data_type": "ARRAY",
        "is_nullable": "YES",
        "column_default": "'{}'::text[]"
    },
    {
        "table_name": "criteria_templates",
        "column_name": "featured",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "criteria_votes",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "criteria_votes",
        "column_name": "suggestion_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_votes",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_votes",
        "column_name": "vote_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "criteria_votes",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_activities",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "decision_activities",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_activities",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_activities",
        "column_name": "activity_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_activities",
        "column_name": "details",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "decision_activities",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_analysis",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "decision_analysis",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_analysis",
        "column_name": "analysis_data",
        "data_type": "jsonb",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_analysis",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'draft'::text"
    },
    {
        "table_name": "decision_analysis",
        "column_name": "version",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "1"
    },
    {
        "table_name": "decision_analysis",
        "column_name": "metadata",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "decision_analysis",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_analysis",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_analysis",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "role",
        "data_type": "USER-DEFINED",
        "is_nullable": "NO",
        "column_default": "'viewer'::collaborator_role"
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "status",
        "data_type": "USER-DEFINED",
        "is_nullable": "NO",
        "column_default": "'invited'::collaborator_status"
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "permissions",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{\"can_rate\": false, \"can_comment\": false, \"can_suggest\": false}'::jsonb"
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "email",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "invited_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "joined_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_collaborators",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_comments",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "decision_comments",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_comments",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_comments",
        "column_name": "parent_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_comments",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_comments",
        "column_name": "context",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "decision_comments",
        "column_name": "mentions",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "decision_comments",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_comments",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_comments",
        "column_name": "deleted_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_data",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "decision_data",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_data",
        "column_name": "step_data",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_data",
        "column_name": "current_step",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_data",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_data",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "type",
        "data_type": "USER-DEFINED",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "content",
        "data_type": "jsonb",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "status",
        "data_type": "USER-DEFINED",
        "is_nullable": "YES",
        "column_default": "'pending'::suggestion_status"
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "feedback",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decision_suggestions",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decisions",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "decisions",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "title",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "reversibility",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "importance",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decisions",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "decisions",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'in_progress'::text"
    },
    {
        "table_name": "decisions",
        "column_name": "is_archived",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "decisions",
        "column_name": "due_date",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "is_collaborative",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "decisions",
        "column_name": "collaboration_settings",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{\"auto_notify\": true, \"require_approval\": true, \"allow_suggestions\": true}'::jsonb"
    },
    {
        "table_name": "decisions",
        "column_name": "goals",
        "data_type": "ARRAY",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "decisions",
        "column_name": "team_ids",
        "data_type": "ARRAY",
        "is_nullable": "YES",
        "column_default": "'{}'::uuid[]"
    },
    {
        "table_name": "decisions",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "email_templates",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "email_templates",
        "column_name": "html",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "email_templates",
        "column_name": "txt",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "email_templates",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "email_templates",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "interest_registrations",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "interest_registrations",
        "column_name": "email",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "interest_registrations",
        "column_name": "ip_address",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "interest_registrations",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'pending'::text"
    },
    {
        "table_name": "interest_registrations",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "interest_registrations",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "invitation_logs",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "invitation_logs",
        "column_name": "invitation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invitation_logs",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "invitation_logs",
        "column_name": "details",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "invitation_logs",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "invitations",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "invitations",
        "column_name": "email",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "invitations",
        "column_name": "invited_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "invitations",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "invitations",
        "column_name": "invited_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invitations",
        "column_name": "team_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invitations",
        "column_name": "role",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'member'::text"
    },
    {
        "table_name": "invitations",
        "column_name": "decision_role",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'contributor'::text"
    },
    {
        "table_name": "invitations",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "invoices",
        "column_name": "subscription_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "stripe_invoice_id",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "stripe_customer_id",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "amount_due",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "0"
    },
    {
        "table_name": "invoices",
        "column_name": "amount_paid",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "0"
    },
    {
        "table_name": "invoices",
        "column_name": "amount_remaining",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "0"
    },
    {
        "table_name": "invoices",
        "column_name": "currency",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'usd'::text"
    },
    {
        "table_name": "invoices",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "invoice_pdf",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "hosted_invoice_url",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "period_start",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "period_end",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "due_date",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "paid_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "invoices",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "invoices",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "items",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "items",
        "column_name": "option_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "items",
        "column_name": "type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "items",
        "column_name": "content",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "items",
        "column_name": "score",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "0"
    },
    {
        "table_name": "items",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "items",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "options",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "options",
        "column_name": "decision_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "options",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "options",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "options",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "organisation_members",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "organisation_members",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "organisation_members",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "organisation_members",
        "column_name": "role",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'member'::text"
    },
    {
        "table_name": "organisation_members",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "organisation_members",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "organisations",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "organisations",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "organisations",
        "column_name": "slug",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "organisations",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "organisations",
        "column_name": "owner_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "organisations",
        "column_name": "settings",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "organisations",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "organisations",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "organisations",
        "column_name": "plan_type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'solo'::text"
    },
    {
        "table_name": "payment_methods",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "payment_methods",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "stripe_payment_method_id",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "type",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "card_brand",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "card_last4",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "card_exp_month",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "card_exp_year",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "payment_methods",
        "column_name": "is_default",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "payment_methods",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "payment_methods",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "subscription_plans",
        "column_name": "display_name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "subscription_plans",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscription_plans",
        "column_name": "price_monthly",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "0"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "price_yearly",
        "data_type": "integer",
        "is_nullable": "NO",
        "column_default": "0"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "stripe_price_id_monthly",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscription_plans",
        "column_name": "stripe_price_id_yearly",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscription_plans",
        "column_name": "stripe_product_id",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscription_plans",
        "column_name": "features",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'[]'::jsonb"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "limits",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "max_team_members",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "1"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "is_active",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "true"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "sort_order",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "0"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "subscription_plans",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "subscriptions",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "subscriptions",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "plan_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "stripe_subscription_id",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "stripe_customer_id",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'active'::text"
    },
    {
        "table_name": "subscriptions",
        "column_name": "billing_interval",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'monthly'::text"
    },
    {
        "table_name": "subscriptions",
        "column_name": "current_period_start",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "current_period_end",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "cancel_at_period_end",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "subscriptions",
        "column_name": "canceled_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "trial_start",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "trial_end",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "subscriptions",
        "column_name": "seats_purchased",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "1"
    },
    {
        "table_name": "subscriptions",
        "column_name": "seats_used",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "0"
    },
    {
        "table_name": "subscriptions",
        "column_name": "metadata",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "subscriptions",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "subscriptions",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "team_members",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "team_members",
        "column_name": "team_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "team_members",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "team_members",
        "column_name": "role",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "team_members",
        "column_name": "joined_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "team_members",
        "column_name": "decision_role",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "teams",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "teams",
        "column_name": "name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "teams",
        "column_name": "description",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "teams",
        "column_name": "created_by",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "teams",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "teams",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "teams",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "requested_plan",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "current_plan",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "message",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "admin_response",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "status",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": "'pending'::text"
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": "now()"
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "processed_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "upgrade_requests",
        "column_name": "processed_by",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "usage_tracking",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": "gen_random_uuid()"
    },
    {
        "table_name": "usage_tracking",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "usage_tracking",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "usage_tracking",
        "column_name": "feature_name",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "usage_tracking",
        "column_name": "feature_category",
        "data_type": "text",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "usage_tracking",
        "column_name": "usage_count",
        "data_type": "integer",
        "is_nullable": "YES",
        "column_default": "1"
    },
    {
        "table_name": "usage_tracking",
        "column_name": "metadata",
        "data_type": "jsonb",
        "is_nullable": "YES",
        "column_default": "'{}'::jsonb"
    },
    {
        "table_name": "usage_tracking",
        "column_name": "tracked_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "usage_tracking",
        "column_name": "period_start",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "usage_tracking",
        "column_name": "period_end",
        "data_type": "timestamp with time zone",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "id",
        "data_type": "uuid",
        "is_nullable": "NO",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "first_name",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "last_name",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "phone_number",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "address",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "age_bracket",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "gender",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "contact_consent",
        "data_type": "boolean",
        "is_nullable": "YES",
        "column_default": "false"
    },
    {
        "table_name": "user_profiles",
        "column_name": "created_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "user_profiles",
        "column_name": "updated_at",
        "data_type": "timestamp with time zone",
        "is_nullable": "YES",
        "column_default": "now()"
    },
    {
        "table_name": "user_profiles",
        "column_name": "avatar_url",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "email",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "user_profiles",
        "column_name": "onboarding_step",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": "'profile_incomplete'::text"
    },
    {
        "table_name": "v_team_members",
        "column_name": "team_member_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "team_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "user_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "first_name",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "last_name",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "avatar_url",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "email",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "role",
        "data_type": "text",
        "is_nullable": "YES",
        "column_default": null
    },
    {
        "table_name": "v_team_members",
        "column_name": "organisation_id",
        "data_type": "uuid",
        "is_nullable": "YES",
        "column_default": null
    }
]

-- FUNCTIONS
[
    {
        "routine_name": "accept_organization_invitation",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "add_team_member",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "auto_log_canvas_version",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "calculate_canvas_diff",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "can_access_decision",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "can_access_organisation_resource",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "can_create_organization",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_account_permission",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_organisation_slug_exists",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_pending_invitations",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_registration_exists",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_slug_exists",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_team_admin",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_team_admin_access",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_team_member",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_team_member_access",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_team_member_org",
        "routine_type": "FUNCTION",
        "security_type": "INVOKER"
    },
    {
        "routine_name": "check_team_permission",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_team_size_limit",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_usage_limit",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_user_email_exists",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_user_exists_by_email",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "check_user_profile",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "create_invite_link",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "create_manual_canvas_version",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "ensure_user_profile",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_ai_prompt_template",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_app_setting",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_brevo_api_key",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_canvas_ai_human_stats",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_canvas_participation_stats",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_canvas_timeline_events",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_decision_collaborators",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_invitation_status",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_latest_analysis_version",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_organisation_details",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_organisation_invitations",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_organisation_members",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_organisation_teams",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_smtp_credentials",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_team_details",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_team_invitations",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_team_members",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_teams_with_members",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_user_directory",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_user_display_name",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_user_organisations",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "get_user_teams",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "handle_duplicate_registration",
        "routine_type": "FUNCTION",
        "security_type": "INVOKER"
    },
    {
        "routine_name": "handle_new_user",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "handle_updated_at",
        "routine_type": "FUNCTION",
        "security_type": "INVOKER"
    },
    {
        "routine_name": "has_canvas_permission",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "has_collaboration_permission",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "has_collaborator_access",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "has_team_permission",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "increment_canvas_block_version",
        "routine_type": "FUNCTION",
        "security_type": "INVOKER"
    },
    {
        "routine_name": "initialize_user_profile",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "invite_user_to_organization_or_team",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_canvas_owner",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_decision_collaborator",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_decision_owner",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_org_admin_or_owner",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_team_admin",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_team_admin",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_team_member",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "is_team_member",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "log_decision_activity",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "log_smtp_issue",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "manage_team_invitation",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "manage_team_invite",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "manage_team_invite",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "manage_team_invite",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "manage_team_member",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "parse_smtp_url",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "prevent_last_owner",
        "routine_type": "FUNCTION",
        "security_type": "INVOKER"
    },
    {
        "routine_name": "remove_organization_member",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "remove_team_member",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "request_organization_access",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "resend_organisation_invitation",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "resend_team_invitation",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "restore_canvas_blocks",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "safe_check_org_access",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "send_email_via_brevo",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "send_email_with_template",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "send_team_invitation_email",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "send_team_invitation_email",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "send_test_email",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "set_app_setting",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "sync_auth_profiles",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "sync_missing_profiles",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "sync_user_profiles",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "test_auth_public_sync",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "test_email_sending",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "test_smtp_configuration",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "track_invitation_status",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "track_usage",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "update_organization_member_role",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "update_team_member_role",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "update_updated_at_column",
        "routine_type": "FUNCTION",
        "security_type": "INVOKER"
    },
    {
        "routine_name": "update_user_profile_email",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "validate_decision_ownership",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "validate_smtp_url",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    },
    {
        "routine_name": "verify_email_settings",
        "routine_type": "FUNCTION",
        "security_type": "DEFINER"
    }
]

-- POLICIES
[
    {
        "schemaname": "public",
        "tablename": "ai_context",
        "policyname": "ai_context_delete_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR (EXISTS ( SELECT 1\n   FROM canvases c\n  WHERE ((c.id = ai_context.canvas_id) AND is_org_admin_or_owner(c.organisation_id)))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "ai_context",
        "policyname": "ai_context_insert_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR (EXISTS ( SELECT 1\n   FROM canvases c\n  WHERE ((c.id = ai_context.canvas_id) AND is_org_admin_or_owner(c.organisation_id)))))"
    },
    {
        "schemaname": "public",
        "tablename": "ai_context",
        "policyname": "ai_context_select_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'viewer'::text) OR (EXISTS ( SELECT 1\n   FROM canvases c\n  WHERE ((c.id = ai_context.canvas_id) AND is_org_admin_or_owner(c.organisation_id)))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "ai_context",
        "policyname": "ai_context_update_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR (EXISTS ( SELECT 1\n   FROM canvases c\n  WHERE ((c.id = ai_context.canvas_id) AND is_org_admin_or_owner(c.organisation_id)))))",
        "with_check": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR (EXISTS ( SELECT 1\n   FROM canvases c\n  WHERE ((c.id = ai_context.canvas_id) AND is_org_admin_or_owner(c.organisation_id)))))"
    },
    {
        "schemaname": "public",
        "tablename": "ai_feedback",
        "policyname": "Users can create AI feedback via permissions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((user_id = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM (ai_suggestions ais\n     JOIN canvas_permissions cp ON ((ais.canvas_id = cp.canvas_id)))\n  WHERE ((ais.id = ai_feedback.suggestion_id) AND (cp.user_id = auth.uid())))))"
    },
    {
        "schemaname": "public",
        "tablename": "ai_feedback",
        "policyname": "Users can read AI feedback via permissions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(EXISTS ( SELECT 1\n   FROM (ai_suggestions ais\n     JOIN canvas_permissions cp ON ((ais.canvas_id = cp.canvas_id)))\n  WHERE ((ais.id = ai_feedback.suggestion_id) AND (cp.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "ai_prompt_templates",
        "policyname": "Organization admins can manage prompt templates",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "(organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))",
        "with_check": "(organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))"
    },
    {
        "schemaname": "public",
        "tablename": "ai_prompt_templates",
        "policyname": "Users can read accessible and stable prompt templates",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((is_system = true) OR is_org_admin_or_owner(organisation_id) OR ((status = 'stable'::text) AND (is_active = true) AND ((organisation_id IS NULL) OR (organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE (organisation_members.user_id = auth.uid()))))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "ai_suggestions",
        "policyname": "Users can create AI suggestions for accessible canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1\n   FROM canvases\n  WHERE ((canvases.id = ai_suggestions.canvas_id) AND (canvases.user_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions cp\n  WHERE ((cp.canvas_id = ai_suggestions.canvas_id) AND (cp.user_id = auth.uid()) AND (cp.permission_type = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text]))))) OR (EXISTS ( SELECT 1\n   FROM (canvases c\n     JOIN organisation_members om ON ((c.organisation_id = om.organisation_id)))\n  WHERE ((c.id = ai_suggestions.canvas_id) AND (om.user_id = auth.uid()))))))"
    },
    {
        "schemaname": "public",
        "tablename": "ai_suggestions",
        "policyname": "Users can read AI suggestions for accessible canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((EXISTS ( SELECT 1\n   FROM canvases\n  WHERE ((canvases.id = ai_suggestions.canvas_id) AND (canvases.user_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions cp\n  WHERE ((cp.canvas_id = ai_suggestions.canvas_id) AND (cp.user_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM (canvases c\n     JOIN organisation_members om ON ((c.organisation_id = om.organisation_id)))\n  WHERE ((c.id = ai_suggestions.canvas_id) AND (om.user_id = auth.uid())))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "ai_suggestions",
        "policyname": "Users can update AI suggestions for accessible canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "((EXISTS ( SELECT 1\n   FROM canvases\n  WHERE ((canvases.id = ai_suggestions.canvas_id) AND (canvases.user_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions cp\n  WHERE ((cp.canvas_id = ai_suggestions.canvas_id) AND (cp.user_id = auth.uid()) AND (cp.permission_type = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text]))))) OR (EXISTS ( SELECT 1\n   FROM (canvases c\n     JOIN organisation_members om ON ((c.organisation_id = om.organisation_id)))\n  WHERE ((c.id = ai_suggestions.canvas_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))",
        "with_check": "((EXISTS ( SELECT 1\n   FROM canvases\n  WHERE ((canvases.id = ai_suggestions.canvas_id) AND (canvases.user_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions cp\n  WHERE ((cp.canvas_id = ai_suggestions.canvas_id) AND (cp.user_id = auth.uid()) AND (cp.permission_type = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text]))))) OR (EXISTS ( SELECT 1\n   FROM (canvases c\n     JOIN organisation_members om ON ((c.organisation_id = om.organisation_id)))\n  WHERE ((c.id = ai_suggestions.canvas_id) AND (om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))"
    },
    {
        "schemaname": "public",
        "tablename": "app_email_settings",
        "policyname": "write_email_settings",
        "permissive": "PERMISSIVE",
        "roles": "{service_role}",
        "cmd": "ALL",
        "qual": "true",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "app_settings",
        "policyname": "No direct access to settings",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "ALL",
        "qual": "false",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "billing_events",
        "policyname": "Users can view billing events for their subscriptions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((subscription_id IN ( SELECT subscriptions.id\n   FROM subscriptions\n  WHERE (subscriptions.user_id = auth.uid()))) OR (subscription_id IN ( SELECT s.id\n   FROM ((subscriptions s\n     JOIN teams t ON ((s.organisation_id = t.organisation_id)))\n     JOIN team_members tm ON ((tm.team_id = t.id)))\n  WHERE (tm.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_blocks",
        "policyname": "canvas_blocks_delete_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR is_org_admin_or_owner(organisation_id))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_blocks",
        "policyname": "canvas_blocks_insert_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR is_org_admin_or_owner(organisation_id))"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_blocks",
        "policyname": "canvas_blocks_select_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'viewer'::text) OR is_org_admin_or_owner(organisation_id))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_blocks",
        "policyname": "canvas_blocks_update_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR is_org_admin_or_owner(organisation_id))",
        "with_check": "(is_canvas_owner(canvas_id) OR has_canvas_permission(canvas_id, 'editor'::text) OR is_org_admin_or_owner(organisation_id))"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_comments",
        "policyname": "Users can create comments",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(EXISTS ( SELECT 1\n   FROM canvas_permissions cp\n  WHERE ((cp.canvas_id = canvas_comments.canvas_id) AND (cp.user_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_permissions",
        "policyname": "Canvas owners and admins can add permissions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((auth.uid() IS NOT NULL) AND ((EXISTS ( SELECT 1\n   FROM canvases\n  WHERE ((canvases.id = canvas_permissions.canvas_id) AND (canvases.user_id = auth.uid())))) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions cp\n  WHERE ((cp.canvas_id = canvas_permissions.canvas_id) AND (cp.user_id = auth.uid()) AND (cp.permission_type = ANY (ARRAY['owner'::text, 'admin'::text])))))))"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_permissions",
        "policyname": "Owners can delete permissions on their own canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "(EXISTS ( SELECT 1\n   FROM canvases\n  WHERE ((canvases.id = canvas_permissions.canvas_id) AND (canvases.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_permissions",
        "policyname": "Owners can update permissions on their own canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(EXISTS ( SELECT 1\n   FROM canvases\n  WHERE ((canvases.id = canvas_permissions.canvas_id) AND (canvases.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_permissions",
        "policyname": "Users can view their own permissions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(user_id = auth.uid())",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_presence",
        "policyname": "Users can manage their own presence",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "(user_id = auth.uid())",
        "with_check": "(user_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_templates",
        "policyname": "Users can create templates in their organizations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(((organisation_id IS NULL) AND (user_id = auth.uid())) OR ((organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))) AND check_account_permission(organisation_id, 'team'::text)))"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_templates",
        "policyname": "Users can read accessible templates",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((is_public = true) OR (is_system = true) OR (organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE (organisation_members.user_id = auth.uid()))) OR (user_id = auth.uid()))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_templates",
        "policyname": "Users can update their own templates",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'admin'::text]))))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_version_comments",
        "policyname": "Canvas owners and editors can resolve version comments",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(version_id IN ( SELECT canvas_versions.id\n   FROM canvas_versions\n  WHERE (canvas_versions.canvas_id IN ( SELECT canvases.id\n           FROM canvases\n          WHERE (canvases.user_id = auth.uid())\n        UNION\n         SELECT canvas_permissions.canvas_id\n           FROM canvas_permissions\n          WHERE ((canvas_permissions.user_id = auth.uid()) AND (canvas_permissions.permission_type = ANY (ARRAY['owner'::text, 'editor'::text])))))))",
        "with_check": "(version_id IN ( SELECT canvas_versions.id\n   FROM canvas_versions\n  WHERE (canvas_versions.canvas_id IN ( SELECT canvases.id\n           FROM canvases\n          WHERE (canvases.user_id = auth.uid())\n        UNION\n         SELECT canvas_permissions.canvas_id\n           FROM canvas_permissions\n          WHERE ((canvas_permissions.user_id = auth.uid()) AND (canvas_permissions.permission_type = ANY (ARRAY['owner'::text, 'editor'::text])))))))"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_version_comments",
        "policyname": "Users can create comments on versions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((user_id = auth.uid()) AND (version_id IN ( SELECT canvas_versions.id\n   FROM canvas_versions\n  WHERE (canvas_versions.canvas_id IN ( SELECT canvases.id\n           FROM canvases\n          WHERE (canvases.user_id = auth.uid())\n        UNION\n         SELECT canvas_permissions.canvas_id\n           FROM canvas_permissions\n          WHERE (canvas_permissions.user_id = auth.uid()))))))"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_version_comments",
        "policyname": "Users can delete their own version comments",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "(user_id = auth.uid())",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_version_comments",
        "policyname": "Users can read comments on versions of canvases they have acces",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(version_id IN ( SELECT canvas_versions.id\n   FROM canvas_versions\n  WHERE (canvas_versions.canvas_id IN ( SELECT canvases.id\n           FROM canvases\n          WHERE (canvases.user_id = auth.uid())\n        UNION\n         SELECT canvas_permissions.canvas_id\n           FROM canvas_permissions\n          WHERE (canvas_permissions.user_id = auth.uid())))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvas_version_comments",
        "policyname": "Users can update their own version comments",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(user_id = auth.uid())",
        "with_check": "(user_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "canvas_versions",
        "policyname": "Users can read canvas versions via permissions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(EXISTS ( SELECT 1\n   FROM canvas_permissions cp\n  WHERE ((cp.canvas_id = canvas_versions.canvas_id) AND (cp.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvases",
        "policyname": "Allow users to create canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((user_id = auth.uid()) AND ((organisation_id IS NULL) OR (EXISTS ( SELECT 1\n   FROM organisation_members\n  WHERE ((organisation_members.organisation_id = canvases.organisation_id) AND (organisation_members.user_id = auth.uid()))))))"
    },
    {
        "schemaname": "public",
        "tablename": "canvases",
        "policyname": "Allow users to delete their canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "((user_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions\n  WHERE ((canvas_permissions.canvas_id = canvases.id) AND (canvas_permissions.user_id = auth.uid()) AND (canvas_permissions.permission_type = 'owner'::text)))) OR ((organisation_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM organisation_members\n  WHERE ((organisation_members.organisation_id = canvases.organisation_id) AND (organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['admin'::text, 'owner'::text])))))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvases",
        "policyname": "Allow users to read their canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((user_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions\n  WHERE ((canvas_permissions.canvas_id = canvases.id) AND (canvas_permissions.user_id = auth.uid())))) OR ((organisation_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM organisation_members\n  WHERE ((organisation_members.organisation_id = canvases.organisation_id) AND (organisation_members.user_id = auth.uid()))))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "canvases",
        "policyname": "Allow users to update their canvases",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "((user_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM canvas_permissions\n  WHERE ((canvas_permissions.canvas_id = canvases.id) AND (canvas_permissions.user_id = auth.uid()) AND (canvas_permissions.permission_type = ANY (ARRAY['editor'::text, 'owner'::text]))))) OR ((organisation_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM organisation_members\n  WHERE ((organisation_members.organisation_id = canvases.organisation_id) AND (organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['admin'::text, 'owner'::text])))))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "cee_prompt_versions",
        "policyname": "Service role access",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "ALL",
        "qual": "true",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "cee_prompts",
        "policyname": "Service role access",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "ALL",
        "qual": "true",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "criteria_comments",
        "policyname": "Users can create comments on suggestions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(EXISTS ( SELECT 1\n   FROM (criteria_suggestions cs\n     JOIN decision_collaborators dc ON ((dc.decision_id = cs.decision_id)))\n  WHERE ((cs.id = criteria_comments.suggestion_id) AND (dc.user_id = auth.uid()) AND (dc.status = 'active'::collaborator_status))))"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_comments",
        "policyname": "Users can update their own comments",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(user_id = auth.uid())",
        "with_check": "(user_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_comments",
        "policyname": "Users can view comments on suggestions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(EXISTS ( SELECT 1\n   FROM (criteria_suggestions cs\n     JOIN decision_collaborators dc ON ((dc.decision_id = cs.decision_id)))\n  WHERE ((cs.id = criteria_comments.suggestion_id) AND (dc.user_id = auth.uid()) AND (dc.status = 'active'::collaborator_status))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "criteria_sets",
        "policyname": "Enable delete for owners and team admins",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM team_members\n  WHERE ((team_members.team_id = criteria_sets.team_id) AND (team_members.user_id = auth.uid()) AND (team_members.role = 'admin'::text))))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "criteria_sets",
        "policyname": "Enable insert for authenticated users",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(((team_id IS NULL) AND (user_id = auth.uid())) OR ((team_id IS NOT NULL) AND (user_id = auth.uid()) AND (EXISTS ( SELECT 1\n   FROM team_members\n  WHERE ((team_members.team_id = criteria_sets.team_id) AND (team_members.user_id = auth.uid()) AND (team_members.role = 'admin'::text))))))"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_sets",
        "policyname": "Enable read for own, team, and organization criteria sets",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "SELECT",
        "qual": "((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM team_members\n  WHERE ((team_members.team_id = criteria_sets.team_id) AND (team_members.user_id = auth.uid()))))) OR ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM teams\n  WHERE ((teams.id = criteria_sets.team_id) AND (teams.organisation_id IS NOT NULL) AND can_access_organisation_resource(teams.organisation_id))))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "criteria_sets",
        "policyname": "Enable update for owners and team admins",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM team_members\n  WHERE ((team_members.team_id = criteria_sets.team_id) AND (team_members.user_id = auth.uid()) AND (team_members.role = 'admin'::text))))))",
        "with_check": "((user_id = auth.uid()) OR ((team_id IS NOT NULL) AND (EXISTS ( SELECT 1\n   FROM team_members\n  WHERE ((team_members.team_id = criteria_sets.team_id) AND (team_members.user_id = auth.uid()) AND (team_members.role = 'admin'::text))))))"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_suggestions",
        "policyname": "Decision owners can update suggestions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(EXISTS ( SELECT 1\n   FROM decisions d\n  WHERE ((d.id = criteria_suggestions.decision_id) AND (d.user_id = auth.uid()))))",
        "with_check": "(EXISTS ( SELECT 1\n   FROM decisions d\n  WHERE ((d.id = criteria_suggestions.decision_id) AND (d.user_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_suggestions",
        "policyname": "Users can create suggestions for their decisions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(EXISTS ( SELECT 1\n   FROM decision_collaborators dc\n  WHERE ((dc.decision_id = criteria_suggestions.decision_id) AND (dc.user_id = auth.uid()) AND (dc.status = 'active'::collaborator_status))))"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_suggestions",
        "policyname": "Users can view suggestions for their decisions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(EXISTS ( SELECT 1\n   FROM decision_collaborators dc\n  WHERE ((dc.decision_id = criteria_suggestions.decision_id) AND (dc.user_id = auth.uid()) AND (dc.status = 'active'::collaborator_status))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "criteria_templates",
        "policyname": "Users can create own templates",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(owner_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_templates",
        "policyname": "Users can delete own templates",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "(owner_id = auth.uid())",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "criteria_templates",
        "policyname": "Users can read accessible templates",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "SELECT",
        "qual": "((sharing = 'public'::text) OR ((sharing = 'private'::text) AND (owner_id = auth.uid())) OR ((sharing = 'team'::text) AND (owner_id IS NOT NULL)) OR ((sharing = 'organization'::text) AND (owner_id IS NOT NULL)))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "criteria_templates",
        "policyname": "Users can update own templates",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(owner_id = auth.uid())",
        "with_check": "(owner_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "criteria_votes",
        "policyname": "Users can vote on suggestions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "(EXISTS ( SELECT 1\n   FROM (criteria_suggestions cs\n     JOIN decision_collaborators dc ON ((dc.decision_id = cs.decision_id)))\n  WHERE ((cs.id = criteria_votes.suggestion_id) AND (dc.user_id = auth.uid()) AND (dc.status = 'active'::collaborator_status))))",
        "with_check": "(EXISTS ( SELECT 1\n   FROM (criteria_suggestions cs\n     JOIN decision_collaborators dc ON ((dc.decision_id = cs.decision_id)))\n  WHERE ((cs.id = criteria_votes.suggestion_id) AND (dc.user_id = auth.uid()) AND (dc.status = 'active'::collaborator_status))))"
    },
    {
        "schemaname": "public",
        "tablename": "decision_activities",
        "policyname": "Enable insert access for system",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "true"
    },
    {
        "schemaname": "public",
        "tablename": "decision_activities",
        "policyname": "Enable read access for decision participants",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(decision_id IN ( SELECT decisions.id\n   FROM decisions\n  WHERE (decisions.user_id = auth.uid())\nUNION\n SELECT decision_collaborators.decision_id\n   FROM decision_collaborators\n  WHERE ((decision_collaborators.user_id = auth.uid()) AND (decision_collaborators.status = 'active'::collaborator_status))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_analysis",
        "policyname": "Enable delete access for decision owners",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "validate_decision_ownership(decision_id)",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_analysis",
        "policyname": "Enable insert access for decision owners",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "validate_decision_ownership(decision_id)"
    },
    {
        "schemaname": "public",
        "tablename": "decision_analysis",
        "policyname": "Enable read access for decision owners and organization members",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "SELECT",
        "qual": "(validate_decision_ownership(decision_id) OR ((organisation_id IS NOT NULL) AND can_access_organisation_resource(organisation_id)))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_analysis",
        "policyname": "Enable update access for decision owners and organization membe",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "UPDATE",
        "qual": "(validate_decision_ownership(decision_id) OR ((organisation_id IS NOT NULL) AND can_access_organisation_resource(organisation_id)))",
        "with_check": "(validate_decision_ownership(decision_id) OR ((organisation_id IS NOT NULL) AND can_access_organisation_resource(organisation_id)))"
    },
    {
        "schemaname": "public",
        "tablename": "decision_collaborators",
        "policyname": "Collaborators can update own record",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(user_id = auth.uid())",
        "with_check": "(user_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "decision_collaborators",
        "policyname": "Delete collaborators for owners",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "can_access_decision(decision_id)",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_collaborators",
        "policyname": "Insert collaborators for owners",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "can_access_decision(decision_id)"
    },
    {
        "schemaname": "public",
        "tablename": "decision_collaborators",
        "policyname": "Select collaborators as participant",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((user_id = auth.uid()) AND (status = 'active'::collaborator_status))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_collaborators",
        "policyname": "Select collaborators for owners",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "can_access_decision(decision_id)",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_collaborators",
        "policyname": "Update collaborators for owners",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "can_access_decision(decision_id)",
        "with_check": "can_access_decision(decision_id)"
    },
    {
        "schemaname": "public",
        "tablename": "decision_comments",
        "policyname": "Enable insert access for collaborators with permission",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "has_collaboration_permission(decision_id, 'can_comment'::text)"
    },
    {
        "schemaname": "public",
        "tablename": "decision_comments",
        "policyname": "Enable read access for decision participants",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(decision_id IN ( SELECT decisions.id\n   FROM decisions\n  WHERE (decisions.user_id = auth.uid())\nUNION\n SELECT decision_collaborators.decision_id\n   FROM decision_collaborators\n  WHERE ((decision_collaborators.user_id = auth.uid()) AND (decision_collaborators.status = 'active'::collaborator_status))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_comments",
        "policyname": "Enable update access for comment authors",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(user_id = auth.uid())",
        "with_check": "(user_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "decision_data",
        "policyname": "Users can create own decision data",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(EXISTS ( SELECT 1\n   FROM decisions\n  WHERE ((decisions.id = decision_data.decision_id) AND (decisions.user_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "decision_data",
        "policyname": "Users can delete own decision data",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "DELETE",
        "qual": "(EXISTS ( SELECT 1\n   FROM decisions\n  WHERE ((decisions.id = decision_data.decision_id) AND (decisions.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_data",
        "policyname": "Users can update own decision data",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "UPDATE",
        "qual": "(EXISTS ( SELECT 1\n   FROM decisions\n  WHERE ((decisions.id = decision_data.decision_id) AND (decisions.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_data",
        "policyname": "Users can view own decision data",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "SELECT",
        "qual": "(EXISTS ( SELECT 1\n   FROM decisions\n  WHERE ((decisions.id = decision_data.decision_id) AND (decisions.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_suggestions",
        "policyname": "Enable insert access for collaborators with permission",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "has_collaboration_permission(decision_id, 'can_suggest'::text)"
    },
    {
        "schemaname": "public",
        "tablename": "decision_suggestions",
        "policyname": "Enable read access for decision participants",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(decision_id IN ( SELECT decisions.id\n   FROM decisions\n  WHERE (decisions.user_id = auth.uid())\nUNION\n SELECT decision_collaborators.decision_id\n   FROM decision_collaborators\n  WHERE ((decision_collaborators.user_id = auth.uid()) AND (decision_collaborators.status = 'active'::collaborator_status))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decision_suggestions",
        "policyname": "Enable update access for decision owners",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "is_decision_owner(decision_id)",
        "with_check": "is_decision_owner(decision_id)"
    },
    {
        "schemaname": "public",
        "tablename": "decisions",
        "policyname": "Enable delete for own decisions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "(auth.uid() = user_id)",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decisions",
        "policyname": "Enable insert for own decisions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "true"
    },
    {
        "schemaname": "public",
        "tablename": "decisions",
        "policyname": "Enable read for own and organization decisions",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "SELECT",
        "qual": "((auth.uid() = user_id) OR ((organisation_id IS NOT NULL) AND can_access_organisation_resource(organisation_id)))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "decisions",
        "policyname": "Enable update for own and organization decisions",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "UPDATE",
        "qual": "((auth.uid() = user_id) OR ((organisation_id IS NOT NULL) AND can_access_organisation_resource(organisation_id)))",
        "with_check": "((auth.uid() = user_id) OR ((organisation_id IS NOT NULL) AND can_access_organisation_resource(organisation_id)))"
    },
    {
        "schemaname": "public",
        "tablename": "email_templates",
        "policyname": "Only admins can manage email templates",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "ALL",
        "qual": "(auth.jwt() ? 'is_admin'::text)",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "interest_registrations",
        "policyname": "Enable public registration",
        "permissive": "PERMISSIVE",
        "roles": "{anon,authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((email IS NOT NULL) AND (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'::text))"
    },
    {
        "schemaname": "public",
        "tablename": "interest_registrations",
        "policyname": "Enable public registration check",
        "permissive": "PERMISSIVE",
        "roles": "{anon,authenticated}",
        "cmd": "SELECT",
        "qual": "true",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "invitation_logs",
        "policyname": "invitation_logs_insert_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "true"
    },
    {
        "schemaname": "public",
        "tablename": "invitation_logs",
        "policyname": "invitation_logs_select_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "true",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "invitations",
        "policyname": "Authenticated users can create invitations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(invited_by = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "invitations",
        "policyname": "Users can delete their invitations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "(invited_by = auth.uid())",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "invitations",
        "policyname": "Users can read their own invitations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((lower(email) = lower((auth.jwt() ->> 'email'::text))) OR (invited_by = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM organisations\n  WHERE ((organisations.id = invitations.organisation_id) AND (organisations.owner_id = auth.uid())))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "invitations",
        "policyname": "Users can update their invitations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(invited_by = auth.uid())",
        "with_check": "(invited_by = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "invoices",
        "policyname": "Users can view own invoices",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((subscription_id IN ( SELECT subscriptions.id\n   FROM subscriptions\n  WHERE (subscriptions.user_id = auth.uid()))) OR (subscription_id IN ( SELECT s.id\n   FROM ((subscriptions s\n     JOIN teams t ON ((s.organisation_id = t.organisation_id)))\n     JOIN team_members tm ON ((tm.team_id = t.id)))\n  WHERE (tm.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "items",
        "policyname": "Users can manage items for their options",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "(EXISTS ( SELECT 1\n   FROM (options\n     JOIN decisions ON ((decisions.id = options.decision_id)))\n  WHERE ((options.id = items.option_id) AND (decisions.user_id = auth.uid()))))",
        "with_check": "(EXISTS ( SELECT 1\n   FROM (options\n     JOIN decisions ON ((decisions.id = options.decision_id)))\n  WHERE ((options.id = items.option_id) AND (decisions.user_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "options",
        "policyname": "Users can manage options for their decisions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "(EXISTS ( SELECT 1\n   FROM decisions\n  WHERE ((decisions.id = options.decision_id) AND (decisions.user_id = auth.uid()))))",
        "with_check": "(EXISTS ( SELECT 1\n   FROM decisions\n  WHERE ((decisions.id = options.decision_id) AND (decisions.user_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "organisation_members",
        "policyname": "Organization owners can manage all members",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "safe_check_org_access(organisation_id)",
        "with_check": "(safe_check_org_access(organisation_id) AND check_team_size_limit(organisation_id))"
    },
    {
        "schemaname": "public",
        "tablename": "organisation_members",
        "policyname": "Users can insert themselves as owner for new orgs",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((user_id = auth.uid()) AND (role = 'owner'::text) AND safe_check_org_access(organisation_id))"
    },
    {
        "schemaname": "public",
        "tablename": "organisation_members",
        "policyname": "Users can view own membership",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(user_id = auth.uid())",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "organisations",
        "policyname": "Owners and admins can delete organizations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "((owner_id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM organisation_members\n  WHERE ((organisation_members.organisation_id = organisations.id) AND (organisation_members.user_id = auth.uid()) AND (organisation_members.role = 'admin'::text)))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "organisations",
        "policyname": "Owners can update organizations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(owner_id = auth.uid())",
        "with_check": "(owner_id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "organisations",
        "policyname": "Users can create organizations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((owner_id = auth.uid()) AND can_create_organization(auth.uid(), plan_type))"
    },
    {
        "schemaname": "public",
        "tablename": "organisations",
        "policyname": "Users can view owned organizations",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(owner_id = auth.uid())",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "payment_methods",
        "policyname": "Organization owners can manage payment methods",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT organisations.id\n   FROM organisations\n  WHERE (organisations.owner_id = auth.uid()))))",
        "with_check": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT organisations.id\n   FROM organisations\n  WHERE (organisations.owner_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "payment_methods",
        "policyname": "Users can view own payment methods",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT t.organisation_id\n   FROM (teams t\n     JOIN team_members tm ON ((tm.team_id = t.id)))\n  WHERE (tm.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "subscription_plans",
        "policyname": "Anyone can view active subscription plans",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(is_active = true)",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "subscriptions",
        "policyname": "Organization owners can manage subscriptions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT organisations.id\n   FROM organisations\n  WHERE (organisations.owner_id = auth.uid()))))",
        "with_check": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT organisations.id\n   FROM organisations\n  WHERE (organisations.owner_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "subscriptions",
        "policyname": "Users can view own subscriptions",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT t.organisation_id\n   FROM (teams t\n     JOIN team_members tm ON ((tm.team_id = t.id)))\n  WHERE (tm.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "team_members",
        "policyname": "team_members_delete_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "DELETE",
        "qual": "((team_id IN ( SELECT t.id\n   FROM teams t\n  WHERE (t.created_by = auth.uid()))) OR (team_id IN ( SELECT tm.team_id\n   FROM team_members tm\n  WHERE ((tm.user_id = auth.uid()) AND (tm.role = 'admin'::text)))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "team_members",
        "policyname": "team_members_insert_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((team_id IN ( SELECT t.id\n   FROM teams t\n  WHERE (t.created_by = auth.uid()))) OR (team_id IN ( SELECT tm.team_id\n   FROM team_members tm\n  WHERE ((tm.user_id = auth.uid()) AND (tm.role = 'admin'::text)))))"
    },
    {
        "schemaname": "public",
        "tablename": "team_members",
        "policyname": "team_members_select_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((user_id = auth.uid()) OR (team_id IN ( SELECT t.id\n   FROM teams t\n  WHERE (t.created_by = auth.uid()))) OR (team_id IN ( SELECT tm.team_id\n   FROM team_members tm\n  WHERE ((tm.user_id = auth.uid()) AND (tm.role = 'admin'::text)))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "team_members",
        "policyname": "team_members_update_policy",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "((team_id IN ( SELECT t.id\n   FROM teams t\n  WHERE (t.created_by = auth.uid()))) OR (team_id IN ( SELECT tm.team_id\n   FROM team_members tm\n  WHERE ((tm.user_id = auth.uid()) AND (tm.role = 'admin'::text)))))",
        "with_check": "((team_id IN ( SELECT t.id\n   FROM teams t\n  WHERE (t.created_by = auth.uid()))) OR (team_id IN ( SELECT tm.team_id\n   FROM team_members tm\n  WHERE ((tm.user_id = auth.uid()) AND (tm.role = 'admin'::text)))))"
    },
    {
        "schemaname": "public",
        "tablename": "teams",
        "policyname": "Create own teams",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(auth.uid() = created_by)"
    },
    {
        "schemaname": "public",
        "tablename": "teams",
        "policyname": "Delete own teams",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "DELETE",
        "qual": "(created_by = auth.uid())",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "teams",
        "policyname": "Insert own teams",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "(created_by = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "teams",
        "policyname": "Select own and organization teams",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "SELECT",
        "qual": "((created_by = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM team_members\n  WHERE ((team_members.team_id = teams.id) AND (team_members.user_id = auth.uid())))) OR ((organisation_id IS NOT NULL) AND can_access_organisation_resource(organisation_id)))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "teams",
        "policyname": "Update own teams",
        "permissive": "PERMISSIVE",
        "roles": "{public}",
        "cmd": "UPDATE",
        "qual": "(created_by = auth.uid())",
        "with_check": "(created_by = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "upgrade_requests",
        "policyname": "Admins can update upgrade requests",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "UPDATE",
        "qual": "(organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))",
        "with_check": "(organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE ((organisation_members.user_id = auth.uid()) AND (organisation_members.role = ANY (ARRAY['owner'::text, 'admin'::text])))))"
    },
    {
        "schemaname": "public",
        "tablename": "upgrade_requests",
        "policyname": "Organization members can view upgrade requests",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "(organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE (organisation_members.user_id = auth.uid())))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "upgrade_requests",
        "policyname": "Users can create upgrade requests",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "((user_id = auth.uid()) AND (organisation_id IN ( SELECT organisation_members.organisation_id\n   FROM organisation_members\n  WHERE (organisation_members.user_id = auth.uid()))))"
    },
    {
        "schemaname": "public",
        "tablename": "usage_tracking",
        "policyname": "System can insert usage tracking",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "INSERT",
        "qual": null,
        "with_check": "true"
    },
    {
        "schemaname": "public",
        "tablename": "usage_tracking",
        "policyname": "Users can view own usage",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((user_id = auth.uid()) OR (organisation_id IN ( SELECT t.organisation_id\n   FROM (teams t\n     JOIN team_members tm ON ((tm.team_id = t.id)))\n  WHERE (tm.user_id = auth.uid()))))",
        "with_check": null
    },
    {
        "schemaname": "public",
        "tablename": "user_profiles",
        "policyname": "Users can manage own profile",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "ALL",
        "qual": "(id = auth.uid())",
        "with_check": "(id = auth.uid())"
    },
    {
        "schemaname": "public",
        "tablename": "user_profiles",
        "policyname": "Users can view accessible profiles",
        "permissive": "PERMISSIVE",
        "roles": "{authenticated}",
        "cmd": "SELECT",
        "qual": "((id = auth.uid()) OR (EXISTS ( SELECT 1\n   FROM (organisation_members om1\n     JOIN organisation_members om2 ON ((om1.organisation_id = om2.organisation_id)))\n  WHERE ((om1.user_id = auth.uid()) AND (om2.user_id = user_profiles.id)))))",
        "with_check": null
    }
]

-- RLS STATUS
[
    {
        "tablename": "invitations",
        "rowsecurity": true
    },
    {
        "tablename": "ai_prompt_templates",
        "rowsecurity": true
    },
    {
        "tablename": "ai_feedback",
        "rowsecurity": true
    },
    {
        "tablename": "app_email_settings",
        "rowsecurity": true
    },
    {
        "tablename": "canvas_comments",
        "rowsecurity": true
    },
    {
        "tablename": "app_settings",
        "rowsecurity": true
    },
    {
        "tablename": "criteria_sets",
        "rowsecurity": true
    },
    {
        "tablename": "criteria_comments",
        "rowsecurity": true
    },
    {
        "tablename": "canvas_version_comments",
        "rowsecurity": true
    },
    {
        "tablename": "criteria_suggestions",
        "rowsecurity": true
    },
    {
        "tablename": "criteria_votes",
        "rowsecurity": true
    },
    {
        "tablename": "decision_activities",
        "rowsecurity": true
    },
    {
        "tablename": "canvases",
        "rowsecurity": true
    },
    {
        "tablename": "canvas_versions",
        "rowsecurity": true
    },
    {
        "tablename": "canvas_presence",
        "rowsecurity": true
    },
    {
        "tablename": "items",
        "rowsecurity": true
    },
    {
        "tablename": "teams",
        "rowsecurity": true
    },
    {
        "tablename": "interest_registrations",
        "rowsecurity": true
    },
    {
        "tablename": "options",
        "rowsecurity": true
    },
    {
        "tablename": "decisions",
        "rowsecurity": true
    },
    {
        "tablename": "organisations",
        "rowsecurity": true
    },
    {
        "tablename": "decision_suggestions",
        "rowsecurity": true
    },
    {
        "tablename": "organisation_members",
        "rowsecurity": true
    },
    {
        "tablename": "decision_collaborators",
        "rowsecurity": true
    },
    {
        "tablename": "ai_context",
        "rowsecurity": true
    },
    {
        "tablename": "ai_suggestions",
        "rowsecurity": true
    },
    {
        "tablename": "canvas_permissions",
        "rowsecurity": true
    },
    {
        "tablename": "canvas_templates",
        "rowsecurity": true
    },
    {
        "tablename": "criteria_templates",
        "rowsecurity": true
    },
    {
        "tablename": "decision_analysis",
        "rowsecurity": true
    },
    {
        "tablename": "canvas_blocks",
        "rowsecurity": true
    },
    {
        "tablename": "decision_comments",
        "rowsecurity": true
    },
    {
        "tablename": "decision_data",
        "rowsecurity": true
    },
    {
        "tablename": "email_templates",
        "rowsecurity": true
    },
    {
        "tablename": "invitation_logs",
        "rowsecurity": true
    },
    {
        "tablename": "team_members",
        "rowsecurity": true
    },
    {
        "tablename": "upgrade_requests",
        "rowsecurity": true
    },
    {
        "tablename": "user_profiles",
        "rowsecurity": true
    },
    {
        "tablename": "subscription_plans",
        "rowsecurity": true
    },
    {
        "tablename": "subscriptions",
        "rowsecurity": true
    },
    {
        "tablename": "payment_methods",
        "rowsecurity": true
    },
    {
        "tablename": "invoices",
        "rowsecurity": true
    },
    {
        "tablename": "usage_tracking",
        "rowsecurity": true
    },
    {
        "tablename": "billing_events",
        "rowsecurity": true
    },
    {
        "tablename": "cee_prompt_observations",
        "rowsecurity": false
    },
    {
        "tablename": "cee_prompt_versions",
        "rowsecurity": true
    },
    {
        "tablename": "cee_prompts",
        "rowsecurity": true
    }
]
