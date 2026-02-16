-- Allow anyone to view clubs (for coupon validation)
DROP POLICY IF EXISTS "Staff can view clubs" ON public.clubs;

CREATE POLICY "Anyone can view clubs"
ON public.clubs
FOR SELECT
USING (true);

-- Admins can still manage (insert, update, delete)
-- The existing "Admins can manage clubs" policy handles this