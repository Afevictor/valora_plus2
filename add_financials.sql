-- Add financial columns to work_orders table
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS insurance_payment numeric,
ADD COLUMN IF NOT EXISTS insurance_payment_status text DEFAULT 'pending';

-- Optional: Comment to describe the column
COMMENT ON COLUMN work_orders.insurance_payment IS 'Total Gross Amount extracted from Insurance Valuation Report';
