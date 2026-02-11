-- ==============================================================================
-- MODULE A: AI EXTRACTION ENGINE & DATA STRUCTURES
-- ==============================================================================
-- Implements storage for AI extraction jobs, billing data, and parts lists.
-- Adds Row Level Security (RLS) to ensure multi-tenant isolation.
-- ==============================================================================

-- 0. Enable extensions if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EXTRACTION JOBS (Track AI process)
CREATE TABLE IF NOT EXISTS extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Denormalized for RLS
    work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    file_id UUID REFERENCES workshop_files(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'requires_review')),
    extracted_data JSONB,
    confidence_scores JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_work_order ON extraction_jobs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_workshop ON extraction_jobs(workshop_id);

-- 2. WORK ORDER BILLING (Financial Totals)
CREATE TABLE IF NOT EXISTS work_order_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Denormalized for RLS
    work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    labor_hours_billed NUMERIC DEFAULT 0,
    labor_amount NUMERIC DEFAULT 0,
    materials_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    invoice_status TEXT DEFAULT 'draft' CHECK (invoice_status IN ('draft', 'sent', 'paid', 'cancelled')),
    source TEXT DEFAULT 'manual', -- 'ai_extraction', 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_billing_wo ON work_order_billing(work_order_id);

-- 3. WORK ORDER PARTS (Line Items)
CREATE TABLE IF NOT EXISTS work_order_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Denormalized for RLS
    work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
    part_number TEXT,
    description TEXT,
    qty_billed NUMERIC DEFAULT 1,
    price_billed NUMERIC DEFAULT 0,
    
    -- Cost tracking (for Module D: Purchase Importer later)
    cost_total NUMERIC, 
    cost_source TEXT, -- 'purchase', 'inventory'
    
    source TEXT DEFAULT 'manual', -- 'ai_extraction', 'manual'
    confidence NUMERIC, -- AI confidence score for this item
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_parts_wo ON work_order_parts(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_parts_number ON work_order_parts(part_number);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Enable RLS
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_parts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Workshop Isolation" ON extraction_jobs;
DROP POLICY IF EXISTS "Workshop Isolation" ON work_order_billing;
DROP POLICY IF EXISTS "Workshop Isolation" ON work_order_parts;

-- Create Policies (Admins/Workshop Owners see their own data)
CREATE POLICY "Workshop Isolation" ON extraction_jobs
    FOR ALL USING (auth.uid() = workshop_id);

CREATE POLICY "Workshop Isolation" ON work_order_billing
    FOR ALL USING (auth.uid() = workshop_id);

CREATE POLICY "Workshop Isolation" ON work_order_parts
    FOR ALL USING (auth.uid() = workshop_id);
