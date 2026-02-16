-- Create storage bucket for playbacks
INSERT INTO storage.buckets (id, name, public)
VALUES ('playbacks', 'playbacks', true);

-- Create policies for playbacks bucket
CREATE POLICY "Anyone can view playback files"
ON storage.objects FOR SELECT
USING (bucket_id = 'playbacks');

CREATE POLICY "Admins can upload playback files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'playbacks' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update playback files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'playbacks' 
  AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete playback files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'playbacks' 
  AND has_role(auth.uid(), 'admin')
);