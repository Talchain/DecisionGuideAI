-- Create handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  first_name text,
  last_name text,
  phone_number text,
  address text,
  age_bracket text,
  gender text,
  contact_consent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create decision_data table
CREATE TABLE IF NOT EXISTS public.decision_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES public.decisions(id) ON DELETE CASCADE,
  step_data jsonb,
  current_step integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_data ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Decision Data Policies
CREATE POLICY "Users can view own decision data"
  ON public.decision_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_data.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own decision data"
  ON public.decision_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_data.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own decision data"
  ON public.decision_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_data.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own decision data"
  ON public.decision_data FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decisions
      WHERE decisions.id = decision_data.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- Create triggers for updated_at timestamps
CREATE TRIGGER handle_updated_at_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_decision_data
  BEFORE UPDATE ON public.decision_data
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();