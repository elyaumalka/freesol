-- Add sumit_customer_id column to purchases table
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS sumit_customer_id text;