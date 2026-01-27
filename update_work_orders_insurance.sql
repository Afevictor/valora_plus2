-- Add column to store the extracted insurance payment amount
alter table public.work_orders 
add column if not exists insurance_payment numeric default 0;

-- Optional: Add a text column for the extraction source/status if needed for debugging
alter table public.work_orders
add column if not exists insurance_payment_status text default 'pending'; -- 'pending', 'extracted', 'manual', 'failed'
