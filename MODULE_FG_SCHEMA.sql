-- MODULE_FG_SCHEMA.sql
-- Module F (State Machine) & Module G (Control Horario Laboral)

-- ==============================================================================
-- MODULE F: STATE MACHINE
-- ==============================================================================

-- 1. State Transitions Audit Table
CREATE TABLE IF NOT EXISTS public.work_order_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    transitioned_by UUID NOT NULL REFERENCES auth.users(id),
    transitioned_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_state_transitions_work_order ON public.work_order_state_transitions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_state_transitions_workshop ON public.work_order_state_transitions(workshop_id);

-- RLS for State Transitions
ALTER TABLE public.work_order_state_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Workshop Isolation" ON public.work_order_state_transitions;
CREATE POLICY "Workshop Isolation" ON public.work_order_state_transitions FOR ALL USING (auth.uid() = workshop_id);


-- ==============================================================================
-- MODULE G: CONTROL HORARIO LABORAL (Obligatorio España - RD-ley 8/2019)
-- ==============================================================================

-- 1. Employee Attendance (Clock In/Out)
CREATE TABLE IF NOT EXISTS public.employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    
    day_type TEXT NOT NULL DEFAULT 'work' CHECK (day_type IN (
        'work', 'vacation', 'sick_leave', 'personal_leave', 'holiday'
    )),
    
    -- Calculated total hours (using a function or stored generated column)
    total_hours NUMERIC(5,2), 
    extra_hours NUMERIC(5,2) DEFAULT 0,
    notes TEXT,
    
    is_locked BOOLEAN DEFAULT false, -- Blocks editing after 48h (Legal requirement)
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT chk_clock_out_after_clock_in CHECK (clock_out > clock_in OR clock_out IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON public.employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_workshop ON public.employee_attendance(workshop_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.employee_attendance((clock_in::DATE));

-- 2. Attendance Breaks
CREATE TABLE IF NOT EXISTS public.attendance_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES public.employee_attendance(id) ON DELETE CASCADE,
    break_start TIMESTAMPTZ NOT NULL,
    break_end TIMESTAMPTZ,
    break_type TEXT NOT NULL CHECK (break_type IN ('meal', 'rest', 'personal')),
    duration_minutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_breaks_attendance ON public.attendance_breaks(attendance_id);

-- 3. Employee Absences (Scheduled)
CREATE TABLE IF NOT EXISTS public.employee_absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workshop_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    absence_type TEXT NOT NULL CHECK (absence_type IN (
        'vacation', 'sick_leave', 'personal_leave', 'maternity_leave', 'paternity_leave', 'unpaid_leave'
    )),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_absences_employee ON public.employee_absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_workshop ON public.employee_absences(workshop_id);

-- RLS for Attendance & Absences
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workshop Isolation" ON public.employee_attendance;
CREATE POLICY "Workshop Isolation" ON public.employee_attendance FOR ALL USING (auth.uid() = workshop_id OR auth.uid() = employee_id);

DROP POLICY IF EXISTS "Workshop Isolation" ON public.attendance_breaks;
CREATE POLICY "Workshop Isolation" ON public.attendance_breaks FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employee_attendance ea WHERE ea.id = attendance_id AND (ea.workshop_id = auth.uid() OR ea.employee_id = auth.uid()))
);

DROP POLICY IF EXISTS "Workshop Isolation" ON public.employee_absences;
CREATE POLICY "Workshop Isolation" ON public.employee_absences FOR ALL USING (auth.uid() = workshop_id OR auth.uid() = employee_id);


-- ==============================================================================
-- TRIGGERS & FUNCTIONS
-- ==============================================================================

-- Function to update total_hours on clock_out
CREATE OR REPLACE FUNCTION public.calculate_attendance_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.clock_out IS NOT NULL THEN
        NEW.total_hours := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_attendance_hours
    BEFORE INSERT OR UPDATE ON public.employee_attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_attendance_hours();

-- Function to update break duration
CREATE OR REPLACE FUNCTION public.calculate_break_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.break_end IS NOT NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.break_end - NEW.break_start)) / 60;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_break_duration
    BEFORE INSERT OR UPDATE ON public.attendance_breaks
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_break_duration();
