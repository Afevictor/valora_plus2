-- ==============================================================================
-- FIX STORAGE BUCKETS (SAFE MODE)
-- ==============================================================================
-- Only attempts to create buckets. Does NOT modify policies to avoid 42501 errors.
-- Run this if 'reception-files' or 'documents' buckets are missing.

INSERT INTO storage.buckets (id, name, public)
VALUES ('reception-files', 'reception-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;
