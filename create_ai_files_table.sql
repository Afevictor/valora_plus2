-- Create a specific table for AI Extraction Files
-- This replaces usage of 'workshop_files' which had missing columns/permissions.

CREATE TABLE IF NOT EXISTS public.ai_extraction_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    category TEXT DEFAULT 'Valuation Report',
    uploaded_by UUID REFERENCES auth.users(id),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_extraction_files ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert own files" ON public.ai_extraction_files
FOR INSERT WITH CHECK (auth.uid() = workshop_id);

CREATE POLICY "Users can view own files" ON public.ai_extraction_files
FOR SELECT USING (auth.uid() = workshop_id);

-- Grant Permissions
GRANT ALL ON public.ai_extraction_files TO authenticated;
GRANT ALL ON public.ai_extraction_files TO service_role;

-- Fix potential FK issue in extraction_jobs if it limits file_id to workshop_files
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'extraction_jobs_file_id_fkey') THEN
        ALTER TABLE public.extraction_jobs DROP CONSTRAINT extraction_jobs_file_id_fkey;
    END IF;
END $$;
