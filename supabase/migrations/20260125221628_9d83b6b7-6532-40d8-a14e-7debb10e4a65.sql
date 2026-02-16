-- Add customer_number field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS customer_number TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_customer_number ON public.profiles(customer_number);

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- Create function to generate unique 5-digit customer number
CREATE OR REPLACE FUNCTION public.generate_customer_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate random 5-digit number (10000-99999)
    new_number := LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE customer_number = new_number) INTO exists_check;
    
    -- If not exists, return it
    IF NOT exists_check THEN
      RETURN new_number;
    END IF;
  END LOOP;
END;
$$;