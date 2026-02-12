-- ==========================================
-- 🛠️ TIME TRACKING & OPERATOR ASSIGNMENT SYSTEM
-- Version: V3 (Simplified Assigned Flow)
-- ==========================================

-- 1. Table: work_order_tasks
-- Stores assignments of operators to specific repair phases.
CREATE TABLE IF NOT EXISTS public.work_order_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    task_type TEXT NOT NULL, -- e.g. 'Desmontaje', 'Pintura', etc.
    status TEXT DEFAULT 'assigned' CHECK (status IN ('pending', 'assigned', 'in_progress', 'on_hold', 'paused', 'finished', 'cancelled')),
    description TEXT,
    estimated_hours NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: task_time_logs
-- Stores granular time entries (Start, Pause, Finish).
CREATE TABLE IF NOT EXISTS public.task_time_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.work_order_tasks(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ, -- NULL means currently active
    duration_seconds INTEGER, -- Seconds recorded in this specific session
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Security (RLS)
ALTER TABLE public.work_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Tasks
DROP POLICY IF EXISTS "Workshop operators can view tasks" ON public.work_order_tasks;
CREATE POLICY "Workshop operators can view tasks" ON public.work_order_tasks
FOR SELECT USING (true); -- We'll rely on the app layer for basic filtering, but RLS should allow the read.

DROP POLICY IF EXISTS "Workshop owners can manage tasks" ON public.work_order_tasks;
CREATE POLICY "Workshop owners can manage tasks" ON public.work_order_tasks
FOR ALL USING (true);

-- Policies for Time Logs
DROP POLICY IF EXISTS "Workshop operators can manage logs" ON public.task_time_logs;
CREATE POLICY "Workshop operators can manage logs" ON public.task_time_logs
FOR ALL USING (true);

-- 4. Indexes for Performance
-- Essential for real-time "Resumen" calculation speed.
CREATE INDEX IF NOT EXISTS idx_tasks_work_order ON public.work_order_tasks(work_order_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee ON public.work_order_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_logs_task ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_logs_active ON public.task_time_logs(employee_id) WHERE ended_at IS NULL;

-- 5. Helper Function for Real-Time Calculation (Optional)
-- This ensures that querying "total time" includes the live seconds of active tasks.
-- However, the React frontend already does this using: 
-- s = l.duration_seconds || Math.floor((new Date() - new Date(l.started_at)) / 1000)

-- 6. Trigger to cleanup active logs
-- When a task is marked as finished, ensure all its open logs are closed.
CREATE OR REPLACE FUNCTION public.fn_close_open_logs_on_finish()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
        UPDATE public.task_time_logs
        SET ended_at = NOW(),
            status = 'completed',
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
        WHERE task_id = NEW.id AND ended_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_close_logs_on_task_finish ON public.work_order_tasks;
CREATE TRIGGER trg_close_logs_on_task_finish
AFTER UPDATE ON public.work_order_tasks
FOR EACH ROW EXECUTE FUNCTION public.fn_close_open_logs_on_finish();

-- 7. Permissions
GRANT ALL ON public.work_order_tasks TO authenticated;
GRANT ALL ON public.task_time_logs TO authenticated;
GRANT ALL ON public.work_order_tasks TO service_role;
GRANT ALL ON public.task_time_logs TO service_role;
