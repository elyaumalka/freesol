-- Create table for alert settings
CREATE TABLE public.alert_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_alert_minutes integer NOT NULL DEFAULT 15,
  second_alert_minutes integer NOT NULL DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.alert_settings (first_alert_minutes, second_alert_minutes) 
VALUES (15, 5);

-- Enable RLS
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view alert settings (needed for customers to know thresholds)
CREATE POLICY "Anyone can view alert settings" 
ON public.alert_settings 
FOR SELECT 
USING (true);

-- Only admins can update alert settings
CREATE POLICY "Admins can manage alert settings" 
ON public.alert_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_alert_settings_updated_at
BEFORE UPDATE ON public.alert_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();