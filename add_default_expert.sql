
-- Adds a global default expert ID and name to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS default_expert_id text,
ADD COLUMN IF NOT EXISTS default_expert_name text;
