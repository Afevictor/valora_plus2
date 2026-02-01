-- ==========================================
-- ANONYMIZED VALUATIONS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.anonymized_valuations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    valuation_id UUID REFERENCES public.valuations(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL, -- Plate number
    registration_number TEXT NOT NULL, -- Plate number
    first_name TEXT,
    last_name TEXT,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb, -- Only JPG/PNG images
    mileage INTEGER,
    labour_cost NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Enable RLS
ALTER TABLE public.anonymized_valuations ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policy if any (to avoid conflicts)
DROP POLICY IF EXISTS "Workshops can manage their own anonymized valuations" ON public.anonymized_valuations;

-- 3. Create Isolation Policy
CREATE POLICY "Workshops can manage their own anonymized valuations"
    ON public.anonymized_valuations
    FOR ALL
    TO authenticated
    USING (workshop_id = auth.uid())
    WITH CHECK (workshop_id = auth.uid());

-- 4. Enable Trigger for updated_at
CREATE OR REPLACE TRIGGER update_anonymized_valuations_updated_at
    BEFORE UPDATE ON public.anonymized_valuations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Grant Permissions
GRANT ALL ON public.anonymized_valuations TO authenticated;
GRANT ALL ON public.anonymized_valuations TO service_role;
