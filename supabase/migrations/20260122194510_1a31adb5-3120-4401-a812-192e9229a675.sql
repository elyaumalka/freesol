-- Create a table for playback purchases
CREATE TABLE public.playback_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  playback_id UUID NOT NULL REFERENCES public.playbacks(id),
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  document_id TEXT,
  document_url TEXT,
  sumit_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.playback_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view own playback purchases" 
ON public.playback_purchases 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create playback purchases" 
ON public.playback_purchases 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all playback purchases" 
ON public.playback_purchases 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'office_worker'));

-- Create index for faster lookups
CREATE INDEX idx_playback_purchases_user_id ON public.playback_purchases(user_id);
CREATE INDEX idx_playback_purchases_playback_id ON public.playback_purchases(playback_id);