-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload recordings
CREATE POLICY "Users can upload recordings"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'recordings' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to view their recordings
CREATE POLICY "Users can view recordings"
ON storage.objects
FOR SELECT
USING (bucket_id = 'recordings' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update their recordings
CREATE POLICY "Users can update recordings"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'recordings' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their recordings
CREATE POLICY "Users can delete recordings"
ON storage.objects
FOR DELETE
USING (bucket_id = 'recordings' AND auth.uid() IS NOT NULL);