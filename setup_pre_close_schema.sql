
-- Tables for Module E: Mandatory Pre-Close Modal

CREATE TABLE IF NOT EXISTS public.work_order_profit_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  snapshot_type TEXT NOT NULL, -- 'closed', 'monthly', etc.
  billed_amount NUMERIC NOT NULL,
  labor_cost NUMERIC NOT NULL,
  material_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  profit NUMERIC NOT NULL,
  profit_percent NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_order_close_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES auth.users(id),
  profit_snapshot_id UUID REFERENCES work_order_profit_snapshots(id),
  reason TEXT,
  reviewed_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_profit_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_close_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Workshops can view own snapshots" ON public.work_order_profit_snapshots
FOR SELECT USING (EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND workshop_id = auth.uid()));

CREATE POLICY "Workshops can insert own snapshots" ON public.work_order_profit_snapshots
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND workshop_id = auth.uid()));

CREATE POLICY "Workshops can view own reviews" ON public.work_order_close_reviews
FOR SELECT USING (EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND workshop_id = auth.uid()));

CREATE POLICY "Workshops can insert own reviews" ON public.work_order_close_reviews
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM work_orders WHERE id = work_order_id AND workshop_id = auth.uid()));

-- Constraint trigger (Optional, but in the spec)
-- We will implement the check in the UI first.
