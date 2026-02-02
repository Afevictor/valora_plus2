-- ==========================================
-- DUAL CHAT SYSTEM SCHEMA
-- ==========================================

-- 1. INTERNAL MESSAGES (Workshop Internal)
CREATE TABLE IF NOT EXISTS public.internal_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    sender_name TEXT,
    message TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    mentions JSONB DEFAULT '[]'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EXPERT MESSAGES (Workshop <-> Expert)
-- Note: valuation_messages table already exists but let's ensure it has all fields
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'valuation_messages' AND column_name = 'sender_id') THEN
        ALTER TABLE public.valuation_messages ADD COLUMN sender_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'valuation_messages' AND column_name = 'sender_name') THEN
        ALTER TABLE public.valuation_messages ADD COLUMN sender_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'valuation_messages' AND column_name = 'attachments') THEN
        ALTER TABLE public.valuation_messages ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'valuation_messages' AND column_name = 'bitrix_message_id') THEN
        ALTER TABLE public.valuation_messages ADD COLUMN bitrix_message_id TEXT;
    END IF;
END $$;

-- 3. ENABLE RLS
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_messages ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
DROP POLICY IF EXISTS "Workshop Internal Chat Isolation" ON public.internal_messages;
CREATE POLICY "Workshop Internal Chat Isolation" ON public.internal_messages
FOR ALL TO authenticated
USING (auth.uid() = workshop_id)
WITH CHECK (auth.uid() = workshop_id);

DROP POLICY IF EXISTS "Expert Chat Isolation" ON public.valuation_messages;
CREATE POLICY "Expert Chat Isolation" ON public.valuation_messages
FOR ALL TO authenticated
USING (auth.uid() = workshop_id)
WITH CHECK (auth.uid() = workshop_id);

-- 5. NOTIFICATION TRIGGER (Mental only - handled by Supabase Realtime/Frontend for now)
