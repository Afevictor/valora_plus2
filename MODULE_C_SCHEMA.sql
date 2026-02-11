-- MODULE_C_SCHEMA.sql
-- Work Order Intake Form Extensions (Module C)

-- 1. Create Insurers table
CREATE TABLE IF NOT EXISTS public.insurers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workshop_id, name)
);

-- Enable RLS for insurers
ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies if any to avoid errors on re-run
DROP POLICY IF EXISTS "Workshops can see their own insurers" ON public.insurers;

CREATE POLICY "Workshops can see their own insurers"
    ON public.insurers FOR ALL
    USING (workshop_id = auth.uid());

-- Insert some default common insurers for the current user
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        INSERT INTO public.insurers (workshop_id, name)
        VALUES 
            (user_record.id, 'Mapfre'),
            (user_record.id, 'Allianz'),
            (user_record.id, 'AXA'),
            (user_record.id, 'Mutua Madrileña'),
            (user_record.id, 'Línea Directa'),
            (user_record.id, 'Pelayo'),
            (user_record.id, 'Reale'),
            (user_record.id, 'Generali')
        ON CONFLICT (workshop_id, name) DO NOTHING;
    END LOOP;
END $$;

-- 2. Extend work_orders with incident and vehicle details
-- We ensure these columns exist as proper database columns for Module C
ALTER TABLE public.work_orders
    ADD COLUMN IF NOT EXISTS insurer_id UUID REFERENCES public.insurers(id),
    ADD COLUMN IF NOT EXISTS claim_number TEXT,
    ADD COLUMN IF NOT EXISTS incident_type TEXT,
    ADD COLUMN IF NOT EXISTS incident_date DATE,
    ADD COLUMN IF NOT EXISTS vin TEXT,
    ADD COLUMN IF NOT EXISTS current_km INTEGER,
    ADD COLUMN IF NOT EXISTS plate TEXT,
    ADD COLUMN IF NOT EXISTS vehicle TEXT,
    ADD COLUMN IF NOT EXISTS insured_name TEXT;

-- 3. Add validations (Optional: will use soft validation in frontend first)
-- COMMENTED OUT TO AVOID BREAKING EXISTING INVALID DATA
-- ALTER TABLE public.work_orders ADD CONSTRAINT chk_license_plate_format CHECK (plate ~ '^[0-9]{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$');
-- ALTER TABLE public.work_orders ADD CONSTRAINT chk_phone_format CHECK (phone ~ '^[679][0-9]{8}$');

-- 4. Indexes for faster search
CREATE INDEX IF NOT EXISTS idx_work_orders_plate ON public.work_orders(plate);
CREATE INDEX IF NOT EXISTS idx_work_orders_claim_number ON public.work_orders(claim_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_insurer_id ON public.work_orders(insurer_id);
