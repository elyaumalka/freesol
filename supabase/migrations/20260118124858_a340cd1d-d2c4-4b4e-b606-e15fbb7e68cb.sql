
-- Fix the permissive INSERT policy on inquiries to require authenticated users
DROP POLICY IF EXISTS "Users can create inquiries" ON public.inquiries;
CREATE POLICY "Authenticated users can create inquiries" ON public.inquiries 
    FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);
