-- Create function to increment coupon usage count
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.coupons
  SET usage_count = usage_count + 1
  WHERE id = coupon_id;
END;
$$;