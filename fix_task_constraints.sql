-- ==========================================
-- 🛠️ FIX: TASK STATUS CHECK CONSTRAINT
-- Run this if you get "violates check constraint"
-- ==========================================

-- 1. Drop the old constraint
ALTER TABLE public.work_order_tasks 
DROP CONSTRAINT IF EXISTS work_order_tasks_status_check;

-- 2. Add the updated, more inclusive constraint
ALTER TABLE public.work_order_tasks 
ADD CONSTRAINT work_order_tasks_status_check 
CHECK (status IN ('pending', 'assigned', 'in_progress', 'on_hold', 'paused', 'finished', 'cancelled'));

-- 3. Also update the time logs status list just in case
ALTER TABLE public.task_time_logs 
DROP CONSTRAINT IF EXISTS task_time_logs_status_check;

ALTER TABLE public.task_time_logs 
ADD CONSTRAINT task_time_logs_status_check 
CHECK (status IN ('in_progress', 'paused', 'completed'));

-- 4. Ensure the default is correct for new rows
ALTER TABLE public.work_order_tasks 
ALTER COLUMN status SET DEFAULT 'assigned';

-- 📊 Verification Query:
-- SELECT id, task_type, status FROM public.work_order_tasks LIMIT 5;
