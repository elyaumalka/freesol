-- Add document_id column to purchases for Sumit invoice reference
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS document_id text DEFAULT NULL;

-- Add document_url column for cached invoice URL
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS document_url text DEFAULT NULL;