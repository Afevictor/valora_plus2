-- ==========================================
-- VALORA PLUS - DEFINITIVE MASTER SCHEMA (V2)
-- ==========================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANY PROFILES (Workshop Identity)
CREATE TABLE IF NOT EXISTS public.company_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    company_name TEXT,
    cif TEXT,
    address TEXT,
    city TEXT,
    zip_code TEXT,
    province TEXT,
    email TEXT,
    phone TEXT,
    coste_hora NUMERIC DEFAULT 0,
    pvp_mano_obra NUMERIC DEFAULT 0,
    subscription_tier TEXT DEFAULT 'free', -- 'free', 'premium'
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EMPLOYEES
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT,
    department TEXT,
    email TEXT,
    mobile TEXT,
    annual_salary NUMERIC DEFAULT 0,
    es_productivo BOOLEAN DEFAULT FALSE,
    porcentaje_productivo NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    skills TEXT[],
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY, -- Can be linked to Auth User ID
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    taxId TEXT,
    address TEXT,
    city TEXT,
    zip TEXT,
    province TEXT,
    country TEXT DEFAULT 'Spain',
    clientType TEXT DEFAULT 'Individual', -- 'Individual', 'Company', 'Fleet', etc.
    isCompany BOOLEAN DEFAULT FALSE,
    preferredChannel TEXT DEFAULT 'WhatsApp',
    paymentMethod TEXT DEFAULT 'Cash',
    paymentTerms TEXT,
    tariff TEXT DEFAULT 'General',
    allowCommercialComms BOOLEAN DEFAULT TRUE,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. WORK ORDERS (Expedientes)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    vehicle_id UUID, -- Will link to vehicles table
    expediente_id TEXT, -- Human readable ID
    status TEXT DEFAULT 'reception', -- 'reception', 'disassembly', 'bodywork', 'paint', 'finished'
    repair_type TEXT[], -- e.g. ['Mecánica', 'Chapa']
    entry_date TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    priority TEXT DEFAULT 'Medium',
    current_km INTEGER,
    request_appraisal BOOLEAN DEFAULT FALSE,
    insurance_payment NUMERIC DEFAULT 0,
    insurance_payment_status TEXT DEFAULT 'pending',
    total_amount NUMERIC DEFAULT 0,
    plate TEXT, -- Denormalized for fast lookup
    vehicle TEXT, -- Denormalized for fast lookup
    insured_name TEXT, -- Denormalized for fast lookup
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wo_expediente ON public.work_orders(expediente_id);
CREATE INDEX IF NOT EXISTS idx_wo_workshop ON public.work_orders(workshop_id);

-- 5. VEHICLES
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    plate TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    vin TEXT,
    year INTEGER,
    color TEXT,
    engine_type TEXT,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LABOR LOGS (Time Tracking)
CREATE TABLE IF NOT EXISTS public.labor_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id),
    employee_id UUID REFERENCES public.employees(id),
    phase TEXT CHECK (phase IN ('reception', 'disassembly', 'bodywork', 'paint', 'finished', 'Mechanics', 'Pintura', 'Chapa', 'Preparation')),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    hourly_rate_snapshot NUMERIC,
    calculated_labor_cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. WORKSHOP FILES (DMS Cloud Storage Mapping)
CREATE TABLE IF NOT EXISTS public.workshop_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    expediente_id TEXT, -- Legacy link
    original_filename TEXT NOT NULL,
    category TEXT,
    storage_path TEXT NOT NULL,
    bucket TEXT NOT NULL,
    mime_type TEXT,
    size_bytes BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. HOUR RATE STORAGE (Cost Analysis Calculations)
CREATE TABLE IF NOT EXISTS public.hour_rate_storage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL,
    payload_input JSONB,
    resultado_calculo JSONB,
    estado TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workshop_id, periodo)
);

-- 9. ANALYSIS USAGE LOG
CREATE TABLE IF NOT EXISTS public.analysis_usage_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_type TEXT DEFAULT 'profitability',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CLIENT ACTIVITY FEED
CREATE TABLE IF NOT EXISTS public.client_activity_feed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    plate TEXT,
    expediente_id TEXT,
    activity_type TEXT DEFAULT 'request',
    summary TEXT,
    file_assets JSONB DEFAULT '[]'::jsonb,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. VALUATIONS (Legacy/External)
CREATE TABLE IF NOT EXISTS public.valuations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. CRM: QUOTES & OPPORTUNITIES
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

DO $$ 
DECLARE 
    t text;
BEGIN 
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        
        -- Special case for company_profiles as ID is the workshop_id
        IF t = 'company_profiles' THEN
            EXECUTE format('DROP POLICY IF EXISTS "Workshop profiles Isolation" ON public.%I;', t);
            EXECUTE format('CREATE POLICY "Workshop profiles Isolation" ON public.%I FOR ALL USING (auth.uid() = id);', t);
        
        -- Generic Workshop Isolation check for tables with workshop_id column
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'workshop_id') THEN
            EXECUTE format('DROP POLICY IF EXISTS "Workshop Isolation" ON public.%I;', t);
            EXECUTE format('CREATE POLICY "Workshop Isolation" ON public.%I FOR ALL USING (auth.uid() = workshop_id);', t);
        END IF;

        -- Client Visibility (Permissive Select for own records if client login)
        -- Logic: If I am a client, let me see records where client_id = auth.uid()
    END LOOP;
END $$;

-- Specific permissive policies for clients to see their own data
CREATE POLICY "Clients can view their own profile" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Clients can view their own work orders" ON public.work_orders FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Clients can view their own activity" ON public.client_activity_feed FOR SELECT TO authenticated USING (auth.uid() = client_id);
CREATE POLICY "Clients can view their own files" ON public.workshop_files FOR SELECT TO authenticated 
USING (
    work_order_id IN (SELECT id FROM public.work_orders WHERE client_id = auth.uid())
);
