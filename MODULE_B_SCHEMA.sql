-- MODULE_B_SCHEMA.sql
-- Module B: Real-time Time Tracking for Operators

-- 1. Tasks Table (Specific operations within a Work Order)
CREATE TABLE IF NOT EXISTS public.work_order_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL, -- e.g., 'Desmontaje', 'Pintura Paragolpes'
    description TEXT,
    category TEXT CHECK (category IN ('mechanics', 'electricity', 'bodywork', 'paint', 'cleaning', 'other')),
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'on_hold', 'finished', 'cancelled')),
    
    estimated_hours NUMERIC(5,2),
    actual_hours NUMERIC(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_tasks_wo ON public.work_order_tasks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_tasks_workshop ON public.work_order_tasks(workshop_id);


-- 2. Task Time Logs (Individual trackable sessions)
CREATE TABLE IF NOT EXISTS public.task_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.work_order_tasks(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    
    duration_seconds INTEGER, -- Calculated on finish
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    
    -- For offline sync (IndexedDB sync token)
    sync_id TEXT UNIQUE,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_logs_task ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_employee ON public.task_time_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_workshop ON public.task_time_logs(workshop_id);


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.work_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workshop Isolation" ON public.work_order_tasks;
CREATE POLICY "Workshop Isolation" ON public.work_order_tasks FOR ALL USING (auth.uid() = workshop_id);

DROP POLICY IF EXISTS "Workshop Isolation" ON public.task_time_logs;
CREATE POLICY "Workshop Isolation" ON public.task_time_logs FOR ALL USING (auth.uid() = workshop_id OR auth.uid() = employee_id);


-- ==============================================================================
-- TRIGGERS
-- ==============================================================================

-- Function to update task actual_hours when a log is completed
CREATE OR REPLACE FUNCTION public.update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.finished_at IS NOT NULL AND OLD.finished_at IS NULL THEN
        UPDATE public.work_order_tasks
        SET actual_hours = COALESCE(actual_hours, 0) + (EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at)) / 3600),
            updated_at = now()
        WHERE id = NEW.task_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_task_hours
    AFTER UPDATE ON public.task_time_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_task_actual_hours();
