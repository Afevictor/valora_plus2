
-- Create a table specifically for storing Profitability Analysis results
-- This allows users to save their progress and review past reports.

CREATE TABLE IF NOT EXISTS public.profitability_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    case_id TEXT, -- Human readable case ID or reference
    
    -- Extracted data from the Valuation PDF (Insurance perspective)
    valuation_data JSONB DEFAULT '{}'::jsonb,
    
    -- Real workshop costs entered by the user
    workshop_costs JSONB DEFAULT '{}'::jsonb,
    
    -- Final calculation results (Margens, Totals, AI Summary)
    analysis_results JSONB DEFAULT '{}'::jsonb,
    
    -- High level metrics for fast filtering/sorting
    margin_percent NUMERIC,
    profitability_rating TEXT, -- e.g. 'Low', 'Medium', 'High'
    total_revenue NUMERIC,
    total_cost NUMERIC,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profitability_analyses ENABLE ROW LEVEL SECURITY;

-- Policies for Workshops
DROP POLICY IF EXISTS "Workshops can view own analyses" ON public.profitability_analyses;
CREATE POLICY "Workshops can view own analyses" ON public.profitability_analyses
FOR SELECT USING (auth.uid() = workshop_id);

DROP POLICY IF EXISTS "Workshops can insert own analyses" ON public.profitability_analyses;
CREATE POLICY "Workshops can insert own analyses" ON public.profitability_analyses
FOR INSERT WITH CHECK (auth.uid() = workshop_id);

DROP POLICY IF EXISTS "Workshops can update own analyses" ON public.profitability_analyses;
CREATE POLICY "Workshops can update own analyses" ON public.profitability_analyses
FOR UPDATE USING (auth.uid() = workshop_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pa_workshop ON public.profitability_analyses(workshop_id);
CREATE INDEX IF NOT EXISTS idx_pa_case ON public.profitability_analyses(case_id);

-- Permissions
GRANT ALL ON public.profitability_analyses TO authenticated;
GRANT ALL ON public.profitability_analyses TO service_role;
