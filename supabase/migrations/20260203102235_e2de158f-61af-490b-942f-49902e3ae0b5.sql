-- Add document_number column to purchases table
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS document_number TEXT;

-- Add document_number column to playback_purchases table
ALTER TABLE public.playback_purchases 
ADD COLUMN IF NOT EXISTS document_number TEXT;