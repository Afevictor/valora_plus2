-- Fix Labor Logs Phase Constraint
-- This script updates the check constraint on the labor_logs table to allow new phase values.

ALTER TABLE labor_logs DROP CONSTRAINT IF EXISTS labor_logs_phase_check;

ALTER TABLE labor_logs 
ADD CONSTRAINT labor_logs_phase_check 
CHECK (phase IN (
    -- Lowercase (Current App Standard)
    'disassembly', 
    'bodywork', 
    'paint', 
    'reception',
    'finished',
    
    -- Legacy / Capitalized
    'Bodywork', 
    'Preparation', 
    'Paint', 
    'Finished',
    'Mechanics',
    
    -- Spanish / Display Labels
    'Desmontaje', 
    'Reparación Chapa', 
    'Pintura'
));
