-- MODULE_D_SCHEMA.sql
-- Purchase Importer (Module D)

-- 1. Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tax_id TEXT, -- CIF/NIF
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workshop_id, name)
);

-- 2. Purchase Documents (Invoices/Delivery Notes)
CREATE TABLE IF NOT EXISTS public.purchase_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    document_number TEXT,
    document_date DATE DEFAULT CURRENT_DATE,
    document_type TEXT CHECK (document_type IN ('invoice', 'delivery_note')),
    total_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'imported' CHECK (status IN ('imported', 'matched', 'pending_review')),
    file_id UUID REFERENCES public.workshop_files(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Purchase Lines (Items)
CREATE TABLE IF NOT EXISTS public.purchase_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_document_id UUID REFERENCES public.purchase_documents(id) ON DELETE CASCADE,
    sku TEXT,
    description TEXT,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    work_order_part_id UUID REFERENCES public.work_order_parts(id) ON DELETE SET NULL,
    matching_status TEXT DEFAULT 'pending' CHECK (matching_status IN ('pending', 'matched', 'no_match')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_docs_workshop ON public.purchase_documents(workshop_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_doc ON public.purchase_lines(purchase_document_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_wo ON public.purchase_lines(work_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_lines_sku ON public.purchase_lines(sku);

-- RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workshop Isolation" ON public.suppliers;
CREATE POLICY "Workshop Isolation" ON public.suppliers FOR ALL USING (auth.uid() = workshop_id);

DROP POLICY IF EXISTS "Workshop Isolation" ON public.purchase_documents;
CREATE POLICY "Workshop Isolation" ON public.purchase_documents FOR ALL USING (auth.uid() = workshop_id);

DROP POLICY IF EXISTS "Workshop Isolation" ON public.purchase_lines;
CREATE POLICY "Workshop Isolation" ON public.purchase_lines FOR ALL USING (auth.uid() = workshop_id);

-- Insert some default common suppliers
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users LOOP
        INSERT INTO public.suppliers (workshop_id, name)
        VALUES 
            (user_record.id, 'Recambios Hergar'),
            (user_record.id, 'AD Parts'),
            (user_record.id, 'Lausan'),
            (user_record.id, 'Gerstenmaier'),
            (user_record.id, 'Sampa'),
            (user_record.id, 'Mann-Filter'),
            (user_record.id, 'Bosch Service')
        ON CONFLICT (workshop_id, name) DO NOTHING;
    END LOOP;
END $$;
