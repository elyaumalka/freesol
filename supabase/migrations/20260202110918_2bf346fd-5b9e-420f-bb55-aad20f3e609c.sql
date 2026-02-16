-- Create customer_notes table for notes history
CREATE TABLE public.customer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all notes
CREATE POLICY "Admins can manage customer notes"
ON public.customer_notes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Office workers can view notes
CREATE POLICY "Office workers can view customer notes"
ON public.customer_notes
FOR SELECT
USING (has_role(auth.uid(), 'office_worker'::app_role));

-- Create index for faster queries
CREATE INDEX idx_customer_notes_profile_id ON public.customer_notes(profile_id);