-- Add status column to purchases table to track payment status
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Add index for faster status queries
CREATE INDEX IF NOT EXISTS idx_purchases_status ON public.purchases(status);

-- Comment for documentation
COMMENT ON COLUMN public.purchases.status IS 'Payment status: pending, completed, failed';