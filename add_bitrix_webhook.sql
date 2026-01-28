ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS bitrix_webhook_url text;
