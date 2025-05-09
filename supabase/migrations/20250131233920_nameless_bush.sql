/*
  # Create Interest Registrations Table

  1. New Tables
    - `interest_registrations`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `ip_address` (text)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `interest_registrations` table
    - Add policy for authenticated users to read registrations
    - Add policy for public to create registrations
*/

-- Create interest_registrations table
CREATE TABLE IF NOT EXISTS public.interest_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  ip_address text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.interest_registrations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view registrations"
  ON public.interest_registrations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow public to create registrations"
  ON public.interest_registrations
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER handle_updated_at_interest_registrations
  BEFORE UPDATE ON public.interest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes
CREATE INDEX idx_interest_registrations_email ON public.interest_registrations(email);
CREATE INDEX idx_interest_registrations_created_at ON public.interest_registrations(created_at);
CREATE INDEX idx_interest_registrations_status ON public.interest_registrations(status);

-- Add constraints
ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_email_check 
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE public.interest_registrations
  ADD CONSTRAINT interest_registrations_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

COMMENT ON TABLE public.interest_registrations IS 'Stores early access registrations for DecisionGuide.AI';