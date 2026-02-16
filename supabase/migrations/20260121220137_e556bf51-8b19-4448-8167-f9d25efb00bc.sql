-- Add new columns to playbacks table for pre-processed data
ALTER TABLE public.playbacks 
ADD COLUMN IF NOT EXISTS instrumental_url text,
ADD COLUMN IF NOT EXISTS sections jsonb,
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS original_audio_url text;

-- Add comment explaining the columns
COMMENT ON COLUMN public.playbacks.instrumental_url IS 'Full song with vocals removed (what users hear in search)';
COMMENT ON COLUMN public.playbacks.sections IS 'Array of song sections with their instrumental URLs: [{type, label, startTime, endTime, duration, instrumentalUrl}]';
COMMENT ON COLUMN public.playbacks.processing_status IS 'Status of AI processing: pending, processing, completed, failed';
COMMENT ON COLUMN public.playbacks.original_audio_url IS 'Original uploaded song with vocals (used for processing)';