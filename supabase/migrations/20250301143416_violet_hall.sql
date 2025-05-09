-- Test script to verify decision options data

-- 1. Check if the decision exists and get its basic info
SELECT id, title, type, status, created_at, updated_at
FROM public.decisions 
WHERE id = '2c7918d1-4733-4629-a6a3-ac6814fe095a';

-- 2. Check if there's any analysis data for this decision
SELECT id, decision_id, status, version, 
       analysis_data->>'options' as options_json,
       created_at, updated_at
FROM public.decision_analysis
WHERE decision_id = '2c7918d1-4733-4629-a6a3-ac6814fe095a'
ORDER BY version DESC;

-- 3. Validate the options structure in analysis_data
WITH latest_analysis AS (
  SELECT analysis_data->'options' as options
  FROM public.decision_analysis
  WHERE decision_id = '2c7918d1-4733-4629-a6a3-ac6814fe095a'
  ORDER BY version DESC
  LIMIT 1
)
SELECT 
  jsonb_array_length(options::jsonb) as options_count,
  jsonb_pretty(options::jsonb) as formatted_options
FROM latest_analysis;

-- 4. Create test data if none exists
DO $$
BEGIN
  -- Only insert if no analysis exists
  IF NOT EXISTS (
    SELECT 1 
    FROM public.decision_analysis 
    WHERE decision_id = '2c7918d1-4733-4629-a6a3-ac6814fe095a'
  ) THEN
    INSERT INTO public.decision_analysis (
      decision_id,
      analysis_data,
      status,
      version,
      metadata
    ) VALUES (
      '2c7918d1-4733-4629-a6a3-ac6814fe095a',
      jsonb_build_object(
        'options', jsonb_build_array(
          jsonb_build_object(
            'name', 'Option 1',
            'pros', ARRAY['Pro 1', 'Pro 2'],
            'cons', ARRAY['Con 1', 'Con 2']
          ),
          jsonb_build_object(
            'name', 'Option 2',
            'pros', ARRAY['Pro 1', 'Pro 2'],
            'cons', ARRAY['Con 1', 'Con 2']
          )
        )
      ),
      'draft',
      1,
      jsonb_build_object(
        'lastUpdated', now()
      )
    );
  END IF;
END $$;

-- 5. Verify the data structure is correct
WITH options_check AS (
  SELECT 
    analysis_data->'options' as options,
    jsonb_array_elements(analysis_data->'options') as option_element
  FROM public.decision_analysis
  WHERE decision_id = '2c7918d1-4733-4629-a6a3-ac6814fe095a'
  ORDER BY version DESC
  LIMIT 1
)
SELECT
  jsonb_typeof(options) as options_type,
  COUNT(option_element) as option_count,
  BOOL_AND(
    option_element ? 'name' AND
    option_element ? 'pros' AND
    option_element ? 'cons'
  ) as has_required_fields,
  BOOL_AND(
    jsonb_typeof(option_element->'pros') = 'array' AND
    jsonb_typeof(option_element->'cons') = 'array'
  ) as has_valid_arrays
FROM options_check
GROUP BY options;