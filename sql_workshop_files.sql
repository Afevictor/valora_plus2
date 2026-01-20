-- Workshop Files Table
-- This table stores metadata for all files uploaded during workshop reception
-- Files are stored in Supabase Storage buckets: evidence_photos, videos, documents

CREATE TABLE IF NOT EXISTS workshop_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expediente_id TEXT NOT NULL, -- Links to work_orders.id or expediente_id
    original_filename TEXT NOT NULL,
    category TEXT, -- e.g., "Daño Frontal", "Ficha Técnica", "Valuation Report"
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    bucket TEXT NOT NULL, -- Storage bucket: evidence_photos, videos, documents
    mime_type TEXT,
    size_bytes BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_workshop_files_expediente ON workshop_files(expediente_id);
CREATE INDEX IF NOT EXISTS idx_workshop_files_workshop ON workshop_files(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_files_bucket ON workshop_files(bucket);
CREATE INDEX IF NOT EXISTS idx_workshop_files_category ON workshop_files(category);

-- Enable Row Level Security
ALTER TABLE workshop_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own workshop files"
    ON workshop_files FOR SELECT
    USING (auth.uid() = workshop_id);

CREATE POLICY "Users can insert their own workshop files"
    ON workshop_files FOR INSERT
    WITH CHECK (auth.uid() = workshop_id);

CREATE POLICY "Users can update their own workshop files"
    ON workshop_files FOR UPDATE
    USING (auth.uid() = workshop_id);

CREATE POLICY "Users can delete their own workshop files"
    ON workshop_files FOR DELETE
    USING (auth.uid() = workshop_id);
