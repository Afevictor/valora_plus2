-- Add subscription tier tracking to company profiles
alter table public.company_profiles 
add column if not exists subscription_tier text default 'free'; -- 'free', 'premium'

-- Optional: Add stripe_customer_id if you plan real payments later
alter table public.company_profiles 
add column if not exists stripe_customer_id text;
