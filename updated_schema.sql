-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANY PROFILE (Workshop Identity)
CREATE TABLE IF NOT EXISTS company_profile (
    id INTEGER PRIMARY KEY DEFAULT 1,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_profile_per_workshop UNIQUE(workshop_id)
);

-- 2. EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    annual_salary NUMERIC DEFAULT 0,
    es_productivo BOOLEAN DEFAULT FALSE,
    porcentaje_productivo INTEGER DEFAULT 0,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CLIENTS
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY, -- Linked to Auth User ID if it's a client login
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. WORK ORDERS (Expedientes)
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id TEXT,
    expediente_id TEXT,
    status TEXT,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wo_expediente ON work_orders(expediente_id);
CREATE INDEX IF NOT EXISTS idx_wo_workshop ON work_orders(workshop_id);

-- 5. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. LABOR LOGS (Time Tracking)
CREATE TABLE IF NOT EXISTS labor_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id TEXT NOT NULL,
    client_id TEXT,
    employee_id TEXT,
    phase TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    hourly_rate_snapshot NUMERIC,
    calculated_labor_cost NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Phase Constraint for Labor Logs
ALTER TABLE labor_logs DROP CONSTRAINT IF EXISTS labor_logs_phase_check;
ALTER TABLE labor_logs ADD CONSTRAINT labor_logs_phase_check 
CHECK (phase IN ('disassembly', 'bodywork', 'paint', 'reception', 'finished', 'Mechanics', 'Pintura', 'Chapa', 'Preparation'));

-- 7. WORKSHOP FILES (DMS Cloud Storage Mapping)
CREATE TABLE IF NOT EXISTS workshop_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expediente_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    category TEXT,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. HOUR RATE STORAGE (Cost Analysis)
CREATE TABLE IF NOT EXISTS hour_rate_storage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL,
    payload_input JSONB,
    resultado_calculo JSONB,
    estado TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workshop_id, periodo)
);

-- 9. VALUATIONS (Damage Assessments)
CREATE TABLE IF NOT EXISTS valuations (
    id UUID PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. VALUATION MESSAGES (Chat Support)
CREATE TABLE IF NOT EXISTS valuation_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    valuation_id UUID REFERENCES valuations(id) ON DELETE CASCADE,
    sender TEXT,
    text TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. AI ANALYSIS REQUESTS
CREATE TABLE IF NOT EXISTS analysis_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    valuation_id UUID REFERENCES valuations(id) ON DELETE CASCADE,
    file_url TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. CRM: QUOTES & OPPORTUNITIES
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- This ensures each workshop/user only sees THEIR OWN data.

ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshop_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_rate_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE valuation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

-- Generic Policy Template: "Users can only access records belonging to their workshop_id"
-- Note: Vehicles might be shared or logic might differ, for now isolate by workshop_id if possible.
-- If workshop_id column exists on all tables above:
DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        -- Check if column workshop_id exists before creating policy
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'workshop_id') THEN
            EXECUTE format('DROP POLICY IF EXISTS "Workshop Isolation" ON %I;', t);
            EXECUTE format('CREATE POLICY "Workshop Isolation" ON %I FOR ALL USING (auth.uid() = workshop_id);', t);
        END IF;
    END LOOP;
END $$;
