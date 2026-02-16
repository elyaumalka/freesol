-- Create table for system settings including welcome popup
CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view settings
CREATE POLICY "Anyone can view system settings"
ON public.system_settings
FOR SELECT
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can manage system settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default welcome popup setting
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES ('welcome_popup_image', null);

-- Create trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for system assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-assets', 'system-assets', true);

-- Storage policies for system assets bucket
CREATE POLICY "Public can view system assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'system-assets');

CREATE POLICY "Admins can upload system assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'system-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update system assets"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'system-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete system assets"
ON storage.objects
FOR DELETE
USING (bucket_id = 'system-assets' AND has_role(auth.uid(), 'admin'::app_role));