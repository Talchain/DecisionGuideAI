/*
  # Initial Schema for Decision Making App

  1. New Tables
    - `decisions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `type` (text)
      - `reversibility` (text)
      - `importance` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `options`
      - `id` (uuid, primary key)
      - `decision_id` (uuid, references decisions)
      - `name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `items`
      - `id` (uuid, primary key)
      - `option_id` (uuid, references options)
      - `type` (text) - either 'pros' or 'cons'
      - `content` (text)
      - `score` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create decisions table
CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  reversibility text NOT NULL,
  importance text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create options table
CREATE TABLE IF NOT EXISTS options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid REFERENCES decisions ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid REFERENCES options ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('pros', 'cons')),
  content text NOT NULL,
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Create policies for decisions
CREATE POLICY "Users can create their own decisions"
  ON decisions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own decisions"
  ON decisions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own decisions"
  ON decisions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decisions"
  ON decisions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for options
CREATE POLICY "Users can manage options for their decisions"
  ON options
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decisions
      WHERE decisions.id = options.decision_id
      AND decisions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decisions
      WHERE decisions.id = options.decision_id
      AND decisions.user_id = auth.uid()
    )
  );

-- Create policies for items
CREATE POLICY "Users can manage items for their options"
  ON items
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM options
      JOIN decisions ON decisions.id = options.decision_id
      WHERE options.id = items.option_id
      AND decisions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM options
      JOIN decisions ON decisions.id = options.decision_id
      WHERE options.id = items.option_id
      AND decisions.user_id = auth.uid()
    )
  );

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_options_updated_at
  BEFORE UPDATE ON options
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();